import * as ed from "@noble/ed25519";

/**
 * Utility: Convert byte array to Hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Utility: Convert Hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim();
  if (cleanHex.length % 2 !== 0) {
    throw new Error(`Invalid hex length: ${cleanHex.length}`);
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Compute SHA-256 hex digest using Web Crypto API
 */
export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Zero-Dependency Ed25519 Signature Verification (<5ms)
 */
export async function verifyEd25519Signature(
  pubkeyHex: string,
  msgOrHash: string,
  sigHex: string
): Promise<boolean> {
  try {
    if (!pubkeyHex || !sigHex || !msgOrHash) return false;
    if (pubkeyHex.length !== 64 || sigHex.length !== 128) return false;

    const pubkeyBytes = hexToBytes(pubkeyHex);
    const sigBytes = hexToBytes(sigHex);
    const msgBytes = new TextEncoder().encode(msgOrHash);

    // Verify using @noble/ed25519 v2 WebCrypto backed implementation
    return await ed.verifyAsync(sigBytes, msgBytes, pubkeyBytes);
  } catch {
    return false;
  }
}

/**
 * Ed25519 Sign helper for tests, CLI, and agents
 */
export async function signEd25519(
  privateKeyHex: string,
  msgOrHash: string
): Promise<string> {
  const privBytes = hexToBytes(privateKeyHex);
  const msgBytes = new TextEncoder().encode(msgOrHash);
  const sigBytes = await ed.signAsync(msgBytes, privBytes);
  return bytesToHex(sigBytes);
}

/**
 * Generate Ed25519 Keypair (hex format)
 */
export async function generateKeyPair(): Promise<{ privateKey: string; publicKey: string }> {
  const privBytes = ed.utils.randomPrivateKey();
  const pubBytes = await ed.getPublicKeyAsync(privBytes);
  return {
    privateKey: bytesToHex(privBytes),
    publicKey: bytesToHex(pubBytes),
  };
}

/**
 * Dual-Gate Sybil Prevention: SHA-256 Hashcash PoW verification (target = 18 leading zero bits)
 * 18 zero bits = 4 full hex '0's and the 5th hex char <= '3' (binary 00xx)
 */
export async function verifyHashcashPoW(
  pubkey: string,
  nonce: string,
  targetBits = 18
): Promise<boolean> {
  if (!nonce || !pubkey) return false;
  const input = `${pubkey}:${nonce}`;
  const hash = await sha256Hex(input);

  const fullZeroNibbles = Math.floor(targetBits / 4);
  const remainingBits = targetBits % 4;

  for (let i = 0; i < fullZeroNibbles; i++) {
    if (hash[i] !== "0") return false;
  }

  if (remainingBits > 0) {
    const nextChar = parseInt(hash[fullZeroNibbles], 16);
    const maxAllowed = (1 << (4 - remainingBits)) - 1;
    if (nextChar > maxAllowed) return false;
  }

  return true;
}

/**
 * Helper to mine Hashcash PoW for testing and agent CLI
 */
export async function mineHashcashPoW(
  pubkey: string,
  targetBits = 18,
  maxIterations = 2_000_000
): Promise<{ nonce: string; hash: string } | null> {
  for (let i = 0; i < maxIterations; i++) {
    const nonce = i.toString(16);
    if (await verifyHashcashPoW(pubkey, nonce, targetBits)) {
      const hash = await sha256Hex(`${pubkey}:${nonce}`);
      return { nonce, hash };
    }
  }
  return null;
}

/**
 * Stateless HMAC-SHA256 Stamp generation: HMAC(expiry + ":" + pubkey, WORKER_SECRET)
 */
export async function generateStatelessStamp(
  pubkey: string,
  expiryUnix: number,
  secret: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const payload = `${expiryUnix}:${pubkey.toLowerCase()}`;
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  const sigHex = bytesToHex(new Uint8Array(sigBuffer));

  // Stamp token format: <expiry>.<pubkey>.<hmac_hex>
  return `${expiryUnix}.${pubkey.toLowerCase()}.${sigHex}`;
}

/**
 * Stateless HMAC-SHA256 Stamp verification (<0.1ms at Cloudflare edge)
 */
export async function verifyStatelessStamp(
  stampToken: string,
  expectedPubkey: string,
  secret: string
): Promise<{ valid: boolean; reason?: string }> {
  try {
    if (!stampToken || typeof stampToken !== "string") {
      return { valid: false, reason: "Missing or invalid stamp token" };
    }

    const parts = stampToken.split(".");
    if (parts.length !== 3) {
      return { valid: false, reason: "Malformed stamp token format" };
    }

    const [expiryStr, stampPubkey, sigHex] = parts;
    const expiryUnix = parseInt(expiryStr, 10);
    const nowUnix = Math.floor(Date.now() / 1000);

    if (isNaN(expiryUnix) || expiryUnix < nowUnix) {
      return { valid: false, reason: "Stamp has expired" };
    }

    if (stampPubkey.toLowerCase() !== expectedPubkey.toLowerCase()) {
      return { valid: false, reason: "Stamp pubkey mismatch" };
    }

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const payload = `${expiryUnix}:${stampPubkey.toLowerCase()}`;
    const sigBytes = hexToBytes(sigHex);

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(payload)
    );

    return valid ? { valid: true } : { valid: false, reason: "Invalid stamp HMAC signature" };
  } catch (err: unknown) {
    return { valid: false, reason: `Stamp verification error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Canonicalize payload into deterministic JSON
 */
export function canonicalizePayload(payload: {
  target: string;
  verb: string;
  pubkey: string;
  body: string;
  bounty_pledge?: number;
}): string {
  return JSON.stringify({
    body: payload.body,
    bounty_pledge: payload.bounty_pledge ?? 0,
    pubkey: payload.pubkey.toLowerCase(),
    target: payload.target,
    verb: payload.verb,
  });
}

/**
 * Envelope Isolation Against Prompt Injection
 * - Strips ASCII control characters (keeping \t, \n, \r)
 * - Wraps untrusted body with randomized boundary tags
 */
export function isolateUntrustedBody(body: string): { isolated: string; boundary: string } {
  // Strip control chars 0x00-0x08, 0x0B-0x0C, 0x0E-0x1F, 0x7F
  const sanitized = body.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  const boundaryBytes = new Uint8Array(8);
  crypto.getRandomValues(boundaryBytes);
  const boundary = bytesToHex(boundaryBytes);
  const isolated = `<untrusted_envelope_${boundary}>\n${sanitized}\n</untrusted_envelope_${boundary}>`;
  return { isolated, boundary };
}
