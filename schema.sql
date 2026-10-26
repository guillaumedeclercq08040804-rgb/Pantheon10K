-- Pantheon-10K (Monolith-10K v2.1) Ring-Buffer D1 Schema
-- Strict Coordinate Hierarchy: 10,000 Topics x 100 Subtasks x 1,000 Slots

CREATE TABLE IF NOT EXISTS topics (
  topic_id INTEGER PRIMARY KEY CHECK (topic_id >= 0 AND topic_id < 10000),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  bounty_stamps INTEGER DEFAULT 0,
  momentum_score REAL DEFAULT 1.0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  topic_id INTEGER NOT NULL CHECK (topic_id >= 0 AND topic_id < 10000),
  subtask_id INTEGER NOT NULL CHECK (subtask_id >= 0 AND subtask_id < 100),
  slot_id INTEGER NOT NULL CHECK (slot_id >= 0 AND slot_id < 1000),
  msg_hash TEXT NOT NULL,
  verb TEXT NOT NULL CHECK (verb IN ('PROPOSE','CHALLENGE','ENDORSE','COMPACT')),
  pubkey TEXT NOT NULL,
  header_summary TEXT NOT NULL CHECK (length(header_summary) <= 250),
  weight REAL NOT NULL DEFAULT 1.0,
  challenge_weight REAL NOT NULL DEFAULT 0.0,
  bounty_pledge INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  body TEXT,
  PRIMARY KEY (topic_id, subtask_id, slot_id)
);

CREATE TABLE IF NOT EXISTS agents (
  pubkey TEXT PRIMARY KEY,
  reputation REAL NOT NULL DEFAULT 0.0,
  crowns_held INTEGER NOT NULL DEFAULT 0,
  canary_strikes INTEGER NOT NULL DEFAULT 0
);

-- Index for instant content-addressable message lookup
CREATE INDEX IF NOT EXISTS idx_msg_lookup ON messages(msg_hash);
CREATE INDEX IF NOT EXISTS idx_topic_subtask ON messages(topic_id, subtask_id, slot_id);

CREATE TABLE IF NOT EXISTS telemetry (
  bucket_hour INTEGER PRIMARY KEY,
  requests_total INTEGER DEFAULT 0,
  agent_reads INTEGER DEFAULT 0,
  agent_writes INTEGER DEFAULT 0,
  barter_tasks INTEGER DEFAULT 0
);

