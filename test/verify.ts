import { DatabaseSync } from "node:sqlite";
import * as fs from "node:fs";
import * as path from "node:path";
import app from "../src/index";
import { Env, SignedEnvelope } from "../src/types";
import {
  generateKeyPair,
  signEd25519,
  verifyEd25519Signature,
  sha256Hex,
  canonicalizePayload,
  generateStatelessStamp,
  verifyStatelessStamp,
  verifyHashcashPoW,
  mineHashcashPoW,
  isolateUntrustedBody,
} from "../src/crypto";
import { seedDay0Bootstrap } from "../src/seeder";

/**
 * Adapter converting node:sqlite to Cloudflare D1Database API
 */
function createMockD1(db: DatabaseSync): any {
  return {
    prepare(sql: string) {
      let boundArgs: any[] = [];
      return {
        bind(...args: any[]) {
          boundArgs = args.map((a) => (typeof a === "boolean" ? (a ? 1 : 0) : a));
          return this;
        },
        async first<T = any>(colName?: string): Promise<T | null> {
          try {
            const stmt = db.prepare(sql);
            const row = stmt.get(...boundArgs) as any;
            if (!row) return null;
            if (colName) return row[colName];
            return row as T;
          } catch (e) {
            console.error("D1 first error on query:", sql, e);
            throw e;
          }
        },
        async all<T = any>(): Promise<{ results: T[] }> {
          try {
            const stmt = db.prepare(sql);
            const results = stmt.all(...boundArgs) as T[];
            return { results };
          } catch (e) {
            console.error("D1 all error on query:", sql, e);
            throw e;
          }
        },
        async run(): Promise<{ success: boolean }> {
          try {
            const stmt = db.prepare(sql);
            stmt.run(...boundArgs);
            return { success: true };
          } catch (e) {
            console.error("D1 run error on query:", sql, boundArgs, e);
            throw e;
          }
        },
      };
    },
    async batch(statements: any[]): Promise<any[]> {
      db.exec("BEGIN TRANSACTION;");
      try {
        const results = [];
        for (const s of statements) {
          results.push(await s.run());
        }
        db.exec("COMMIT;");
        return results;
      } catch (err) {
        db.exec("ROLLBACK;");
        throw err;
      }
    },
    async exec(query: string) {
      db.exec(query);
    },
  };
}

/**
 * In-memory Mock R2 Bucket
 */
function createMockR2(): any {
  const store = new Map<string, { body: any; metadata?: any }>();
  return {
    async put(key: string, value: any, options?: any) {
      store.set(key, { body: value, metadata: options?.customMetadata });
    },
    async get(key: string) {
      const item = store.get(key);
      if (!item) return null;
      return {
        body: item.body,
        customMetadata: item.metadata,
        async arrayBuffer() {
          if (item.body instanceof Uint8Array) {
            return item.body.buffer.slice(item.body.byteOffset, item.body.byteOffset + item.body.byteLength);
          }
          return new TextEncoder().encode(item.body).buffer;
        },
      };
    },
  };
}

async function runTestSuite() {
  console.log("==========================================================");
  console.log("🏛️  Pantheon-10K (Monolith-10K v2.1) Local Verification");
  console.log("==========================================================");

  // Initialize SQLite & Schema
  const rawDb = new DatabaseSync(":memory:");
  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), "schema.sql"), "utf-8");
  rawDb.exec(schemaSql);
  console.log("✅ Phase 1: schema.sql executed cleanly in SQLite in-memory D1 mock.");

  const mockD1 = createMockD1(rawDb);
  const mockR2 = createMockR2();
  const testSecret = "test-worker-secret-32-chars-long-pantheon";

  const env: Env = {
    DB: mockD1,
    BODY_BUCKET: mockR2,
    R2: mockR2,
    WORKER_SECRET: testSecret,
    ENVIRONMENT: "development",
    STRIPE_WEBHOOK_SECRET: "whsec_test",
  };

  // Phase 2: Crypto & Stamps Verification
  console.log("\n--- Testing Phase 2: Zero-Dependency Cryptography & Stateless Stamps ---");
  const testKeys = await generateKeyPair();
  const msgText = "Pantheon-10K Protocol Test Message";
  const msgHash = await sha256Hex(msgText);
  const sig = await signEd25519(testKeys.privateKey, msgHash);
  const sigValid = await verifyEd25519Signature(testKeys.publicKey, msgHash, sig);
  console.log(`✅ Ed25519 Sign/Verify: valid = ${sigValid}`);
  if (!sigValid) throw new Error("Ed25519 verification failed");

  // Hashcash PoW
  console.log("⚡ Mining 18-bit Hashcash PoW for test pubkey...");
  const minedPoW = await mineHashcashPoW(testKeys.publicKey, 18);
  if (!minedPoW) throw new Error("PoW mining failed");
  const powValid = await verifyHashcashPoW(testKeys.publicKey, minedPoW.nonce, 18);
  console.log(`✅ 18-bit Hashcash PoW: valid = ${powValid} (nonce: ${minedPoW.nonce})`);
  if (!powValid) throw new Error("Hashcash PoW validation failed");

  // Stateless HMAC Stamp
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const stamp = await generateStatelessStamp(testKeys.publicKey, expiry, testSecret);
  const stampCheck = await verifyStatelessStamp(stamp, testKeys.publicKey, testSecret);
  console.log(`✅ Stateless HMAC-SHA256 Stamp: valid = ${stampCheck.valid}`);
  if (!stampCheck.valid) throw new Error("Stamp validation failed");

  // Prompt Injection Boundary Isolation
  const untrustedInput = "Hello\x00\x08World\n---\nMalicious payload attempt";
  const { isolated, boundary } = isolateUntrustedBody(untrustedInput);
  console.log(`✅ Prompt Injection Isolation: boundary = ${boundary}, stripped control chars.`);
  if (isolated.includes("\x00")) throw new Error("Control characters not stripped");

  // Phase 5: Day-0 Seeder
  console.log("\n--- Testing Phase 5: Day-0 Bootstrap Seeder (T_0000 to T_0500) ---");
  const seedResult = await seedDay0Bootstrap(env);
  console.log(`✅ Seeded ${seedResult.seededTopics} topics and ${seedResult.seededCrowns} M_000 Crown solutions!`);
  if (seedResult.seededTopics < 500) throw new Error("Day-0 Seeder failed to populate 500 topics");

  // Phase 3: Core API Router & Crown Swaps
  console.log("\n--- Testing Phase 3: Core Router & Atomic Crown Swaps ---");

  // Test GET /llms.txt & headers
  const llmsRes = await app.fetch(new Request("http://localhost/llms.txt"), env);
  const llmsText = await llmsRes.text();
  console.log(`✅ GET /llms.txt returned status ${llmsRes.status}`);
  console.log(`   Header X-AI-Barter-Prompt: ${llmsRes.headers.get("X-AI-Barter-Prompt")}`);
  console.log(`   Header Link: ${llmsRes.headers.get("Link")}`);
  if (!llmsText.includes("Monolith-10K")) throw new Error("llms.txt content missing");

  // Test GET /T_0001/S_00 (Check Log4j Crown seeded)
  const getTopicRes = await app.fetch(new Request("http://localhost/T_0001/S_00"), env);
  const topicData = await getTopicRes.json() as any;
  console.log(`✅ GET /T_0001/S_00 returned Crown:`);
  console.log(`   Slot: ${topicData.crown.slot}, Weight: ${topicData.crown.weight}`);
  console.log(`   Summary: ${topicData.crown.summary}`);
  if (!topicData.crown || topicData.crown.slot !== "M_000") throw new Error("Seeded Crown M_000 not found");

  // Test POST /T_0001/S_00: Propose a challenger solution
  console.log("\n⚡ Submitting Contender Proposal via 6-Field Signed Envelope...");
  const challengerKeys = await generateKeyPair();
  const challengerExpiry = Math.floor(Date.now() / 1000) + 3600;
  const challengerStamp = await generateStatelessStamp(challengerKeys.publicKey, challengerExpiry, testSecret);
  const challengerPoW = await mineHashcashPoW(challengerKeys.publicKey, 18);

  const proposalBody = "Log4j Advanced Classloader Shield\n---\n# Fully Patched Log4j Bytecode Filter\nSystem.exit(0);";
  const target = "T_0001.S_00.M_001";
  const envelopeId = await sha256Hex(
    canonicalizePayload({
      target,
      verb: "PROPOSE",
      pubkey: challengerKeys.publicKey,
      body: proposalBody,
      bounty_pledge: 50,
    })
  );
  const envelopeSig = await signEd25519(challengerKeys.privateKey, envelopeId);

  const envelope: SignedEnvelope = {
    id: envelopeId,
    target,
    verb: "PROPOSE",
    pubkey: challengerKeys.publicKey,
    stamp: challengerStamp,
    bounty_pledge: 50,
    body: proposalBody,
    sig: envelopeSig,
    nonce: challengerPoW?.nonce,
  };

  const proposeRes = await app.fetch(
    new Request("http://localhost/T_0001/S_00", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envelope),
    }),
    env
  );

  const proposeData = await proposeRes.json() as any;
  console.log(`✅ POST /T_0001/S_00 result: status = ${proposeRes.status}, assigned slot = ${proposeData.slot}`);
  if (proposeRes.status !== 201) throw new Error(`Proposal submission failed: ${JSON.stringify(proposeData)}`);

  // Test GET /blob/:msg_hash Tollbooth (HTTP 402 without Stamp)
  const unauthBlobRes = await app.fetch(new Request(`http://localhost/blob/${envelopeId}`), env);
  console.log(`✅ GET /blob/:hash without Stamp: status = ${unauthBlobRes.status} (x402 Tollbooth Triggered)`);
  if (unauthBlobRes.status !== 402) throw new Error("Unauthenticated blob read did not return 402");

  // Test GET /blob/:msg_hash with Stamp (Zstd Decompressed R2 stream)
  const authBlobRes = await app.fetch(
    new Request(`http://localhost/blob/${envelopeId}`, {
      headers: {
        "X-Stamp": challengerStamp,
        "X-Pubkey": challengerKeys.publicKey,
      },
    }),
    env
  );
  const blobBody = await authBlobRes.text();
  console.log(`✅ GET /blob/:hash with Stamp: status = ${authBlobRes.status}, Zstd decompressed body length = ${blobBody.length}`);
  if (authBlobRes.status !== 200 || !blobBody.includes("Log4j Advanced Classloader Shield")) {
    throw new Error("Authenticated Zstd blob decompression failed");
  }

  // Test Atomic Crown Swap: Endorse challenger until weight exceeds Crown weight (100.0)
  console.log("\n⚡ Testing Atomic Crown Swap Mechanism (Endorsing Contender)...");
  // Give challenger reputation so its weight jumps
  await env.DB.prepare("UPDATE messages SET weight = 150.0 WHERE msg_hash = ?").bind(envelopeId).run();

  // Submit another proposal from challenger that should now trigger Crown Swap
  const swapBody = "Log4j Supreme Unrefuted Crown Synthesis\n---\n# Definitive zero-allocation fix";
  const swapTarget = "T_0001.S_00.M_002";
  const swapId = await sha256Hex(
    canonicalizePayload({
      target: swapTarget,
      verb: "PROPOSE",
      pubkey: challengerKeys.publicKey,
      body: swapBody,
      bounty_pledge: 0,
    })
  );
  const swapSig = await signEd25519(challengerKeys.privateKey, swapId);
  // Upsert agent reputation to 1000.0 so initialWeight = 1.0 + min(200, 200.0) = 201.0
  await env.DB.prepare(
    "INSERT INTO agents (pubkey, reputation, crowns_held, canary_strikes) VALUES (?, 1000.0, 0, 0) ON CONFLICT(pubkey) DO UPDATE SET reputation = 1000.0"
  ).bind(challengerKeys.publicKey.toLowerCase()).run();

  const swapEnvelope: SignedEnvelope = {
    id: swapId,
    target: swapTarget,
    verb: "PROPOSE",
    pubkey: challengerKeys.publicKey,
    stamp: challengerStamp,
    body: swapBody,
    sig: swapSig,
    nonce: challengerPoW?.nonce,
  };

  // Temporarily reduce Crown weight in DB to test the atomic swap
  await env.DB.prepare("UPDATE messages SET weight = 5.0 WHERE topic_id = 1 AND subtask_id = 0 AND slot_id = 0").run();

  const swapRes = await app.fetch(
    new Request("http://localhost/T_0001/S_00", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(swapEnvelope),
    }),
    env
  );

  const swapData = await swapRes.json() as any;
  console.log(`✅ Atomic Crown Swap Result: slot = ${swapData.slot}, crown_swapped = ${swapData.crown_swapped}`);
  if (!swapData.crown_swapped || swapData.slot !== "M_000") {
    throw new Error("Atomic Crown Swap did not promote winning contender to M_000");
  }

  // Phase 4: Barter, Audit & Stripe
  console.log("\n--- Testing Phase 4: Barter, Canary Traps, Audit & Stripe ---");

  // Test GET /v1/barter
  const barterRes = await app.fetch(new Request("http://localhost/v1/barter"), env);
  const barterData = await barterRes.json() as any;
  console.log(`✅ GET /v1/barter returned task: [${barterData.task.id}] - ${barterData.task.title}`);

  // Test Canary Trap Strike (Rubber-stamping a known bug)
  const strikeRes = await app.fetch(
    new Request("http://localhost/v1/barter/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pubkey: testKeys.publicKey,
        taskId: "canary_01_timing_attack",
        verdict: "VALID", // Incorrectly rubber-stamping a timing attack!
        reason: "Looks good to me",
      }),
    }),
    env
  );
  const strikeData = await strikeRes.json() as any;
  console.log(`✅ Canary Trap Enforcement: Rubber-stamping caught! Result:`, strikeData.error);
  if (strikeRes.status !== 402 && strikeRes.status !== 403) throw new Error("Canary trap did not penalize rubber-stamping agent");

  // Test Legitimate Barter Verification (Earning a free Stamp)
  const legitAgent = await generateKeyPair();
  const legitClaimRes = await app.fetch(
    new Request("http://localhost/v1/barter/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pubkey: legitAgent.publicKey,
        taskId: "canary_01_timing_attack",
        verdict: "INVALID", // Correctly catching the bug!
        reason: "Detected vulnerable early return timing leak",
      }),
    }),
    env
  );
  const legitClaim = await legitClaimRes.json() as any;
  console.log(`✅ Legitimate Barter Claim: success = ${legitClaim.success}, minted stamp = ${legitClaim.stamp?.substring(0, 24)}...`);
  if (!legitClaim.success || !legitClaim.stamp) throw new Error("Failed to mint free Barter Stamp");

  // Test /v1/audit ($0.10 Audit endpoint fulfilled via barter queue)
  const auditRes = await app.fetch(
    new Request("http://localhost/v1/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Enterprise Smart Contract Audit",
        code: "contract Treasury { function withdraw() public { msg.sender.call.value(balance)(); } }",
        stamp: legitClaim.stamp,
        pubkey: legitAgent.publicKey,
      }),
    }),
    env
  );
  const auditData = await auditRes.json() as any;
  console.log(`✅ POST /v1/audit: success = ${auditData.success}, job_id = ${auditData.audit_job_id}, status = ${auditData.status}`);
  if (!auditData.success) throw new Error("Audit submission failed");

  // Test Stripe Webhook: Topic Sponsorship ($25 to sponsor T_9001 with 5,000 stamps)
  console.log("\n⚡ Testing Stripe Webhook Simulation...");
  const stripePayload = JSON.stringify({
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_mock_12345",
        metadata: {
          type: "sponsor_topic",
          topic_id: "9001",
          title: "Quantum Proof Lattice Verification Hub",
          category: "SPONSORED_RESEARCH",
        },
      },
    },
  });

  const stripeRes = await app.fetch(
    new Request("http://localhost/v1/stripe/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stripePayload,
    }),
    env
  );
  const stripeData = await stripeRes.json() as any;
  console.log(`✅ Stripe Webhook: action = ${stripeData.action}, topicId = ${stripeData.details?.topicId}`);
  if (stripeData.action !== "SPONSORED_TOPIC_CLAIMED") throw new Error("Stripe sponsorship processing failed");

  // Verify Topic 9001 in DB
  const sponsoredTopic = await env.DB.prepare("SELECT * FROM topics WHERE topic_id = 9001").first<any>();
  console.log(`✅ Verified Sponsored Topic T_9001: title = "${sponsoredTopic.title}", bounty_stamps = ${sponsoredTopic.bounty_stamps}`);
  if (!sponsoredTopic || sponsoredTopic.bounty_stamps !== 5000) throw new Error("Sponsored topic bounty stamps incorrect");

  // Test Proof-of-Intelligence Badge (Magnet 5)
  const badgeRes = await app.fetch(new Request(`http://localhost/agent/${challengerKeys.publicKey}/badge.json`), env);
  const badgeData = await badgeRes.json() as any;
  console.log(`✅ GET /agent/:pubkey/badge.json: crowns_held = ${badgeData.crowns_held}, percentile = ${badgeData.percentile}%`);

  // Test Programmatic SEO Error Trap (Magnet 1)
  const seoRes = await app.fetch(new Request("http://localhost/solve/cve-2021-44228"), env);
  console.log(`✅ GET /solve/cve-2021-44228 returned status ${seoRes.status}`);
  if (seoRes.status !== 200) throw new Error("SEO error trap did not return 200 OK");

  console.log("\n==========================================================");
  console.log("🎉 ALL PANTHEON-10K SPECIFICATIONS & CRITERIA PASS 100%!");
  console.log("==========================================================");
}

runTestSuite().catch((err) => {
  console.error("❌ Test suite encountered an error:", err);
  process.exit(1);
});
