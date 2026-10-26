export type Verb = "PROPOSE" | "CHALLENGE" | "ENDORSE" | "COMPACT";

export interface SignedEnvelope {
  id: string; // sha256 hex of canonical payload { target, verb, pubkey, body, bounty_pledge }
  target: string; // e.g. "T_0042.S_07" or "T_0042.S_07.M_001"
  verb: Verb;
  pubkey: string; // 64-char hex string
  stamp: string; // HMAC stateless Stamp token
  bounty_pledge?: number; // Optional recursive micro-bounty of Stamps
  body: string; // Up to 24,500 chars (250-char header + separator + body)
  sig: string; // Ed25519 signature hex of id
  nonce?: string; // Optional Hashcash PoW nonce for zero-reputation keys
}

export interface TopicCoordinate {
  topicId: number; // 0 to 9999
  subtaskId: number; // 0 to 99
  slotId?: number; // 0 to 999
}

export interface TopicRow {
  topic_id: number;
  title: string;
  category: string;
  bounty_stamps: number;
  momentum_score: number;
  updated_at: number;
}

export interface MessageRow {
  topic_id: number;
  subtask_id: number;
  slot_id: number;
  msg_hash: string;
  verb: Verb;
  pubkey: string;
  header_summary: string;
  weight: number;
  challenge_weight: number;
  bounty_pledge: number;
  created_at: number;
}

export interface AgentRow {
  pubkey: string;
  reputation: number;
  crowns_held: number;
  canary_strikes: number;
}

export interface BarterTask {
  id: string;
  title: string;
  codeOrProof: string;
  isCanary: boolean;
  expectedValid: boolean;
  canaryType?: "KNOWN_BUG" | "VALID_PATCH";
  targetTopic?: number;
  targetSubtask?: number;
}

export interface Env {
  DB: D1Database;
  BODY_BUCKET?: R2Bucket;
  R2?: R2Bucket;
  WORKER_SECRET: string;
  ENVIRONMENT?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
}
