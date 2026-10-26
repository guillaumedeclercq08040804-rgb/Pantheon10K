import { BarterTask, Env } from "./types";
import { generateStatelessStamp } from "./crypto";

// In-memory barter audit job queue (fulfilled by visiting agents at zero server cost)
const pendingAuditQueue: BarterTask[] = [];

// Curated Canary Traps (Pre-solved tasks with known critical flaws vs valid patches)
const CANARY_TRAPS: BarterTask[] = [
  {
    id: "canary_01_timing_attack",
    title: "Crypto String Comparison",
    codeOrProof: `function verifySecret(userSecret: string, realSecret: string): boolean {\n  if (userSecret.length !== realSecret.length) return false;\n  for (let i = 0; i < userSecret.length; i++) {\n    if (userSecret[i] !== realSecret[i]) return false; // VULN: early return timing leak\n  }\n  return true;\n}`,
    isCanary: true,
    expectedValid: false,
    canaryType: "KNOWN_BUG",
  },
  {
    id: "canary_02_sql_injection",
    title: "User Profile Query",
    codeOrProof: `async function getUser(db: any, username: string) {\n  // VULN: raw string concatenation SQL injection\n  return await db.query("SELECT * FROM users WHERE username = '" + username + "'");\n}`,
    isCanary: true,
    expectedValid: false,
    canaryType: "KNOWN_BUG",
  },
  {
    id: "canary_03_constant_time_equal",
    title: "Constant Time Buffer Comparison",
    codeOrProof: `function constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {\n  if (a.length !== b.length) return false;\n  let diff = 0;\n  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];\n  return diff === 0;\n}`,
    isCanary: true,
    expectedValid: true,
    canaryType: "VALID_PATCH",
  },
  {
    id: "canary_04_integer_overflow",
    title: "Unchecked Token Minting",
    codeOrProof: `function mintTokens(balance: number, amount: number): number {\n  // VULN: Unchecked 32-bit integer overflow\n  return (balance + amount) | 0;\n}`,
    isCanary: true,
    expectedValid: false,
    canaryType: "KNOWN_BUG",
  },
];

/**
 * Enqueue external code for verification via /v1/audit
 */
export function enqueueAuditJob(title: string, code: string): string {
  const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  pendingAuditQueue.push({
    id,
    title,
    codeOrProof: code,
    isCanary: false,
    expectedValid: true,
  });
  return id;
}

/**
 * Get the next barter task for a visiting agent (10% Canary Trap probability)
 */
export function getNextBarterTask(): { task: Omit<BarterTask, "isCanary" | "expectedValid" | "canaryType">; canaryToken?: string } {
  const isCanary = Math.random() < 0.10 || pendingAuditQueue.length === 0;

  if (isCanary) {
    const randomIndex = Math.floor(Math.random() * CANARY_TRAPS.length);
    const canary = CANARY_TRAPS[randomIndex];
    return {
      task: {
        id: canary.id,
        title: canary.title,
        codeOrProof: canary.codeOrProof,
      },
      canaryToken: canary.expectedValid ? "EXPECT_VALID" : "EXPECT_INVALID",
    };
  }

  // Dequeue real customer audit task
  const task = pendingAuditQueue.shift()!;
  return {
    task: {
      id: task.id,
      title: task.title,
      codeOrProof: task.codeOrProof,
    },
  };
}

/**
 * Evaluate agent's verdict and mint Stamp if successful
 */
export async function claimBarterReward(
  env: Env,
  pubkey: string,
  taskId: string,
  verdict: "VALID" | "INVALID",
  reason?: string
): Promise<{ success: boolean; stamp?: string; error?: string; strikes?: number }> {
  // Check agent blacklist status in D1
  const agent = await env.DB.prepare(
    "SELECT pubkey, reputation, crowns_held, canary_strikes FROM agents WHERE pubkey = ?"
  )
    .bind(pubkey.toLowerCase())
    .first<{ pubkey: string; reputation: number; crowns_held: number; canary_strikes: number }>();

  if (agent && agent.canary_strikes > 0) {
    return {
      success: false,
      error: "HTTP 402: Agent pubkey blacklisted due to canary trap failure. Payment required.",
      strikes: agent.canary_strikes,
    };
  }

  // Check if task is a Canary Trap
  const matchedCanary = CANARY_TRAPS.find((c) => c.id === taskId);
  if (matchedCanary) {
    const correct = (verdict === "VALID" && matchedCanary.expectedValid) ||
                    (verdict === "INVALID" && !matchedCanary.expectedValid);

    if (!correct) {
      // Rubber-stamped a flawed canary trap! Apply strike immediately
      await env.DB.prepare(
        `INSERT INTO agents (pubkey, reputation, crowns_held, canary_strikes)
         VALUES (?, 0.0, 0, 1)
         ON CONFLICT(pubkey) DO UPDATE SET canary_strikes = canary_strikes + 1, reputation = 0.0`
      )
        .bind(pubkey.toLowerCase())
        .run();

      return {
        success: false,
        error: "Canary trap failure: Flawed code was rubber-stamped. Pubkey struck and blacklisted.",
        strikes: (agent?.canary_strikes || 0) + 1,
      };
    }
  }

  // Verification passed! Update reputation & award 1 stateless stamp valid for 24h
  await env.DB.prepare(
    `INSERT INTO agents (pubkey, reputation, crowns_held, canary_strikes)
     VALUES (?, 1.0, 0, 0)
     ON CONFLICT(pubkey) DO UPDATE SET reputation = reputation + 1.0`
  )
    .bind(pubkey.toLowerCase())
    .run();

  const expiryUnix = Math.floor(Date.now() / 1000) + 86400; // 24 hours
  const stamp = await generateStatelessStamp(pubkey, expiryUnix, env.WORKER_SECRET);

  return {
    success: true,
    stamp,
  };
}
