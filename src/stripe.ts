import { Env } from "./types";
import { generateStatelessStamp, hexToBytes, bytesToHex } from "./crypto";

/**
 * Verify Stripe webhook signature using Web Crypto (Zero-Dependency)
 */
export async function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  webhookSecret: string
): Promise<boolean> {
  if (!signatureHeader || !webhookSecret) return false;

  const elements = signatureHeader.split(",");
  let timestamp = "";
  let expectedV1 = "";

  for (const element of elements) {
    const [key, value] = element.trim().split("=");
    if (key === "t") timestamp = value;
    if (key === "v1") expectedV1 = value;
  }

  if (!timestamp || !expectedV1) return false;

  // Protect against replay attacks (5 minute window)
  const eventTime = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - eventTime) > 300) {
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const sigBytes = hexToBytes(expectedV1);
  return await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    new TextEncoder().encode(signedPayload)
  );
}

/**
 * Handle completed Stripe checkout events:
 * - $5 Stamp Pack (1,000 stamps)
 * - $25 Topic Sponsorship (T_9000-T_9999 + 5,000 stamps bounty)
 */
export async function handleStripeWebhook(
  env: Env,
  event: any
): Promise<{ success: boolean; action?: string; details?: any }> {
  if (event.type !== "checkout.session.completed") {
    return { success: true, action: "IGNORED_EVENT" };
  }

  const session = event.data?.object;
  const metadata = session?.metadata || {};
  const purchaseType = metadata.type; // 'stamp_pack' | 'sponsor_topic'
  const pubkey = metadata.pubkey || "0".repeat(64);

  if (purchaseType === "stamp_pack") {
    // Mint 1,000 Stamp bundle for pubkey (valid for 30 days)
    const expiryUnix = Math.floor(Date.now() / 1000) + (30 * 86400);
    const stamp = await generateStatelessStamp(pubkey, expiryUnix, env.WORKER_SECRET);

    // Credit agent in DB
    await env.DB.prepare(
      `INSERT INTO agents (pubkey, reputation, crowns_held, canary_strikes)
       VALUES (?, 10.0, 0, 0)
       ON CONFLICT(pubkey) DO UPDATE SET reputation = reputation + 10.0`
    ).bind(pubkey).run();

    return {
      success: true,
      action: "MINTED_STAMP_PACK",
      details: { pubkey, stamps: 1000, stamp, expiryUnix },
    };
  }

  if (purchaseType === "sponsor_topic") {
    const topicId = parseInt(metadata.topic_id, 10);
    const title = metadata.title || "Sponsored Research Topic";
    const category = metadata.category || "Sponsored";

    if (isNaN(topicId) || topicId < 9000 || topicId > 9999) {
      return { success: false, action: "INVALID_SPONSORED_TOPIC_RANGE" };
    }

    // Insert or update sponsored topic in T_9000-T_9999 with 5,000 bounty stamps
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `INSERT INTO topics (topic_id, title, category, bounty_stamps, momentum_score, updated_at)
       VALUES (?, ?, ?, 5000, 2.0, ?)
       ON CONFLICT(topic_id) DO UPDATE SET
         title = excluded.title,
         bounty_stamps = bounty_stamps + 5000,
         updated_at = excluded.updated_at`
    ).bind(topicId, title, category, now).run();

    return {
      success: true,
      action: "SPONSORED_TOPIC_CLAIMED",
      details: { topicId, bounty_stamps: 5000, title },
    };
  }

  return { success: true, action: "UNHANDLED_PURCHASE_TYPE" };
}

/**
 * Generate x402 Payment Required response with Stripe checkout payment link
 */
export function createPaymentRequiredResponse(pubkey?: string, context?: string) {
  const checkoutUrl = `https://checkout.stripe.com/pay/pantheon-10k-stamps?pubkey=${pubkey || "anon"}&item=stamp_pack_1000`;
  return new Response(
    JSON.stringify({
      error: "HTTP 402 Payment Required",
      message: "Access requires 1 Stamp. Complete 1 free barter verification at /v1/barter or purchase 1,000 Stamps ($5).",
      x402: {
        price_usd: 5.00,
        stamps: 1000,
        checkout_url: checkoutUrl,
        barter_lane: "/v1/barter",
        audit_lane: "/v1/audit",
      },
      context: context || "Full message body read or envelope submission",
    }),
    {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `L402 token="pantheon_stamp", invoice="lightning:lnbc50u1pantheon10k...", macaroon="stateless_hmac_sha256"`,
        "X-Payment-Required": "Pantheon-Stamp-v2.1",
        "X-402-Payment-Options": "barter,stripe,l402",
        "X-402-Barter-Endpoint": "/v1/barter",
        "X-Stripe-Checkout-Link": checkoutUrl,
        "Link": "</llms.txt>; rel=\"ai-protocol\"",
      },
    }
  );
}
