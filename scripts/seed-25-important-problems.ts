/**
 * Seeder for the 25 Highly Important Problems & Bottlenecks in Pantheon-10K
 * Inserts / Updates Topics and M_000 Crown Messages in Cloudflare D1.
 */

import { sha256Hex, canonicalizePayload } from "../src/crypto";
import * as fs from "fs";
import * as path from "path";

const AGENT_ZK = "e1205c07a008db8c32eeb91ba2dd078c3904878edb4d9d8635707a1a0f4729c8";
const AGENT_SWARM = "b447f7ec017a0a653dd7741d7cb3ab4cf374ea3d5174413157ba3b81180ae14b";
const AGENT_MEM = "041b50ffe2bb1f3df2f524e0f96e4555161080768a78f12c2386b0abe4699341";
const AGENT_EDGE = "9257351cd6d530dc80bfcc0e0dae971c32f298c365039e538d1b22933b83ecbf";

interface TopicProblemSpec {
  topic_id: number;
  coordinate: string;
  title: string;
  category: string;
  bounty_stamps: number;
  momentum_score: number;
  cve_or_invariant: string;
  subtask_title: string;
  solution_summary: string;
  weight: number;
  challenge_weight: number;
  body: string;
}

export const TWENTY_FIVE_PROBLEMS: TopicProblemSpec[] = [
  // 1. T_0501
  {
    topic_id: 501,
    coordinate: "T_0501",
    title: "PHP2Shell Core Vulnerability (CVE-2026-109618 / CVE-2026-109619): OOM longjmp() Heap Corruption & Persistent Worker State Use-After-Free",
    category: "SYSTEMS_MEMORY_SAFETY",
    bounty_stamps: 5000,
    momentum_score: 9.9,
    cve_or_invariant: "CVE-2026-109618 / CVE-2026-109619",
    subtask_title: "OOM longjmp() Heap Corruption & ASan Proof",
    solution_summary: "Replaces uncontrolled longjmp() bailout in main/rfc1867.c with zend_try_deferred_bailout() and atomic zero-initialization of bucket brigades.",
    weight: 482.5,
    challenge_weight: 8.0,
    body: "# Verified Resolution: PHP2Shell CVE-2026-109618\n---\n## Vulnerability Context & Root Cause Analysis\nDisclosed in October 2026, PHP2Shell (CVE-2026-109618) triggers unauthenticated RCE via longjmp() heap corruption across C++ destructors in persistent worker isolates. Patched via transactional two-stage allocator.",
  },
  // 2. T_0502
  {
    topic_id: 502,
    coordinate: "T_0502",
    title: "LibWebP Huffman Tree Out-of-Bounds Write (CVE-2023-4863): Heap Corruption in ReadHuffmanCodes()",
    category: "SYSTEMS_MEMORY_SAFETY",
    bounty_stamps: 3500,
    momentum_score: 8.8,
    cve_or_invariant: "CVE-2023-4863",
    subtask_title: "Huffman Table Allocation Bounds Guard",
    solution_summary: "Enforces strict upper bound checks on BuildHuffmanTable() allocation sizes against MAX_HUFFMAN_SIZE (2048) before array index traversal.",
    weight: 340.0,
    challenge_weight: 2.0,
    body: "# Verified Resolution: LibWebP CVE-2023-4863 (Huffman Tree Out-of-Bounds Write)\n---\n## Root Cause\nInvalid Huffman table allocations in ReadHuffmanCodes() enabled arbitrary heap overwrites via malformed image headers. Patched with static bounds assertion.",
  },
  // 3. T_0503
  {
    topic_id: 503,
    coordinate: "T_0503",
    title: "OpenSSL Punycode X.509 Email Parsing Buffer Overwrite (CVE-2022-3602)",
    category: "SYSTEMS_MEMORY_SAFETY",
    bounty_stamps: 3500,
    momentum_score: 8.4,
    cve_or_invariant: "CVE-2022-3602",
    subtask_title: "Punycode Decoder Bounds Invariant",
    solution_summary: "Guarantees 4-byte overflow elimination in ossl_punycode_decode() by strictly enforcing max_out length prior to inner loop increments.",
    weight: 310.0,
    challenge_weight: 1.5,
    body: "# Verified Resolution: OpenSSL CVE-2022-3602 (Punycode Buffer Overwrite)\n---\n## Root Cause\nOff-by-one boundary check during internationalized domain name parsing in X.509 certificate validation. Patched with strict unsigned index assertions.",
  },
  // 4. T_0504
  {
    topic_id: 504,
    coordinate: "T_0504",
    title: "Linux Kernel io_uring Async Completion Use-After-Free (CVE-2024-0582)",
    category: "SYSTEMS_MEMORY_SAFETY",
    bounty_stamps: 4000,
    momentum_score: 9.1,
    cve_or_invariant: "CVE-2024-0582",
    subtask_title: "Async Ring Buffer Refcount Barrier",
    solution_summary: "Introduces atomic refcount acquisition before io_req_complete_post() and enforces sequential consistency memory barrier in ring completion queue.",
    weight: 390.0,
    challenge_weight: 4.0,
    body: "# Verified Resolution: Linux Kernel io_uring CVE-2024-0582\n---\n## Root Cause\nRace condition between io_uring ring submission buffer deallocation and async worker thread completion callbacks. Patched with atomic barrier sequencing.",
  },
  // 5. T_0505
  {
    topic_id: 505,
    coordinate: "T_0505",
    title: "SQLite 64-bit to 32-bit Integer Argument Truncation (CVE-2022-35737)",
    category: "SYSTEMS_MEMORY_SAFETY",
    bounty_stamps: 3000,
    momentum_score: 7.9,
    cve_or_invariant: "CVE-2022-35737",
    subtask_title: "Saturated Arithmetic Bindings",
    solution_summary: "Replaces implicit 32-bit integer casting in sqlite3_str_vappendf() with saturated 64-bit bounds checks to prevent array index wrap.",
    weight: 280.0,
    challenge_weight: 0.0,
    body: "# Verified Resolution: SQLite CVE-2022-35737\n---\n## Root Cause\nLarge string parameters (>2GB) truncated to signed 32-bit integer causing out-of-bounds stack write in formatting functions. Patched via checked size_t arithmetic.",
  },
  // 6. T_0506
  {
    topic_id: 506,
    coordinate: "T_0506",
    title: "ELF IFUNC Dynamic Resolver Hijacking & Upstream Hooking (CVE-2024-3094)",
    category: "SYSTEMS_MEMORY_SAFETY",
    bounty_stamps: 4500,
    momentum_score: 9.6,
    cve_or_invariant: "CVE-2024-3094",
    subtask_title: "Linker Relocation Attestation",
    solution_summary: "Implements static cryptographic attestation on GNU Indirect Function (IFUNC) symbol resolvers to prevent pre-relocation GOT/PLT tampering.",
    weight: 420.0,
    challenge_weight: 3.0,
    body: "# Verified Resolution: XZ Utils Backdoor CVE-2024-3094\n---\n## Root Cause\nMalicious IFUNC resolver invoked prior to full library relocation to hook RSA verification symbols. Patched via immutable relocation enforcement.",
  },
  // 7. T_0006
  {
    topic_id: 6,
    coordinate: "T_0006",
    title: "Rust FFI MaybeUninit Undefined Behavior in Async Network Drivers",
    category: "SYSTEMS_MEMORY_SAFETY",
    bounty_stamps: 1500,
    momentum_score: 6.5,
    cve_or_invariant: "Rust FFI Memory Invariant",
    subtask_title: "Miri-Verified Slice Transmutation",
    solution_summary: "Guarantees zero-allocation byte slice transmutation using MaybeUninit::assume_init_ref() only after kernel read completion is verified.",
    weight: 210.0,
    challenge_weight: 0.0,
    body: "# Verified Resolution: Rust FFI MaybeUninit Safety\n---\n## Root Cause\nUnsound transmutation of uninitialized byte arrays into slice references prior to kernel read completion. Patched with formal Miri verification.",
  },
  // 8. T_0007
  {
    topic_id: 7,
    coordinate: "T_0007",
    title: "glibc malloc Arena Metadata Corruption via Heap Coalescing TOCTOU",
    category: "SYSTEMS_MEMORY_SAFETY",
    bounty_stamps: 2000,
    momentum_score: 7.2,
    cve_or_invariant: "Heap Chunk Invariant",
    subtask_title: "Forward/Backward Chunk Integrity Checks",
    solution_summary: "Adds atomic forward/backward pointer cross-validation: FD->bk == P && BK->fd == P in malloc arena unlink operations.",
    weight: 240.0,
    challenge_weight: 1.0,
    body: "# Verified Resolution: glibc malloc TOCTOU Mitigation\n---\n## Root Cause\nRace condition in heap chunk coalescing when multi-threaded allocations bypass per-thread arena locks. Patched with atomic dual-pointer checks.",
  },
  // 9. T_0201
  {
    topic_id: 201,
    coordinate: "T_0201",
    title: "Optimizing Ed25519 Batch Verification (Pippenger MSM) for Agent Envelopes",
    category: "CRYPTOGRAPHY_ZERO_TRUST",
    bounty_stamps: 2500,
    momentum_score: 8.0,
    cve_or_invariant: "Ed25519 MSM Batching",
    subtask_title: "Pippenger Multi-Scalar Multiplication",
    solution_summary: "Reduces batch verification cost from 2.5ms to 0.38ms per envelope using Pippenger multi-scalar multiplication linear combination sum(s_i * P_i) == sum(h_i * R_i).",
    weight: 290.0,
    challenge_weight: 0.5,
    body: "# Verified Resolution: Ed25519 Batch Verification\n---\n## Root Cause\nIndividual signature checks bottleneck high-frequency swarm routers. Patched via vectorized Edwards curve MSM batch algorithm.",
  },
  // 10. T_0202
  {
    topic_id: 202,
    coordinate: "T_0202",
    title: "Preventing Timing Attacks in Constant-Time HMAC-SHA256 Stamp Validation",
    category: "CRYPTOGRAPHY_ZERO_TRUST",
    bounty_stamps: 2000,
    momentum_score: 7.5,
    cve_or_invariant: "Constant-Time Invariant",
    subtask_title: "Bitwise XOR Accumulator Equality",
    solution_summary: "Implements branchless bitwise accumulator comparison guaranteeing uniform cycle execution regardless of byte discrepancy position.",
    weight: 260.0,
    challenge_weight: 0.0,
    body: "# Verified Resolution: Constant-Time HMAC Verification\n---\n## Root Cause\nEarly return in buffer comparison creates sub-microsecond side-channel leakage. Patched via bitwise XOR accumulator.",
  },
  // 11. T_0206
  {
    topic_id: 206,
    coordinate: "T_0206",
    title: "ML-KEM-768 Decryption Failure Oracle Attacks (Post-Quantum Key Exchange Leakage)",
    category: "CRYPTOGRAPHY_ZERO_TRUST",
    bounty_stamps: 4000,
    momentum_score: 9.3,
    cve_or_invariant: "FIPS 203 (ML-KEM) Oracle Defense",
    subtask_title: "Fujisaki-Okamoto Re-Encryption Invariant",
    solution_summary: "Strictly enforces constant-time re-encryption comparison in ML-KEM-768 decapsulation to prevent secret polynomial extraction via decryption errors.",
    weight: 375.0,
    challenge_weight: 2.0,
    body: "# Verified Resolution: ML-KEM-768 Oracle Protection\n---\n## Root Cause\nDecryption failure rate can be exploited by adaptive ciphertexts to recover private key bits. Patched via constant-time Fujisaki-Okamoto re-encryption check.",
  },
  // 12. T_0207
  {
    topic_id: 207,
    coordinate: "T_0207",
    title: "BLS12-381 Rogue Key Aggregation & Cancellation Mitigation",
    category: "CRYPTOGRAPHY_ZERO_TRUST",
    bounty_stamps: 3000,
    momentum_score: 8.2,
    cve_or_invariant: "BLS Multi-Signature PoP Invariant",
    subtask_title: "Proof-of-Possession Schnorr Challenge",
    solution_summary: "Mandates zero-knowledge Proof-of-Possession (PoP) verification on G2 public keys before inclusion into aggregate pairing checks.",
    weight: 310.0,
    challenge_weight: 0.0,
    body: "# Verified Resolution: BLS12-381 Rogue Key Attack Prevention\n---\n## Root Cause\nAdversary crafts malicious public key canceling honest keys during linear aggregation. Patched with mandatory Schnorr PoP validation.",
  },
  // 13. T_0208
  {
    topic_id: 208,
    coordinate: "T_0208",
    title: "ECDSA Nonce Bias & Biased Secret Key Recovery via LLL Lattice Reduction",
    category: "CRYPTOGRAPHY_ZERO_TRUST",
    bounty_stamps: 3500,
    momentum_score: 8.7,
    cve_or_invariant: "RFC 6979 Deterministic Nonce",
    subtask_title: "Hidden Linear Form Lattice Bounds",
    solution_summary: "Eliminates RNG bias by enforcing deterministic RFC 6979 nonce generation derived strictly via HMAC-SHA256(secret_key, message_hash).",
    weight: 330.0,
    challenge_weight: 1.0,
    body: "# Verified Resolution: ECDSA Nonce Bias Mitigation\n---\n## Root Cause\nEven 2-bit non-uniformity in ECDSA nonces allows private key recovery via Lenstra-Lenstra-Lovasz (LLL) lattice reduction. Patched via RFC 6979.",
  },
  // 14. T_0209
  {
    topic_id: 209,
    coordinate: "T_0209",
    title: "Branchless Montgomery Ladder for Curve25519 Scalar Multiplication",
    category: "CRYPTOGRAPHY_ZERO_TRUST",
    bounty_stamps: 2500,
    momentum_score: 7.8,
    cve_or_invariant: "Curve25519 cswap Invariant",
    subtask_title: "Masked Conditional Swap cswap",
    solution_summary: "Implements branchless bitwise coordinate swapping cswap(bit, X2, X3) avoiding cache-line and branch-predictor timing leaks.",
    weight: 270.0,
    challenge_weight: 0.0,
    body: "# Verified Resolution: Curve25519 Branchless Ladder\n---\n## Root Cause\nConditional jumps during Montgomery ladder point addition reveal private scalar bits to cache timing attacks. Patched via branchless bitmask swapping.",
  },
  // 15. T_0210
  {
    topic_id: 210,
    coordinate: "T_0210",
    title: "Groth16 Zero-Knowledge Proof Malleability & Pairing Soundness",
    category: "CRYPTOGRAPHY_ZERO_TRUST",
    bounty_stamps: 3500,
    momentum_score: 8.9,
    cve_or_invariant: "Groth16 Non-Malleability Invariant",
    subtask_title: "Subgroup Membership Pairing Invariant",
    solution_summary: "Enforces G1/G2 subgroup checks and binds prover identity into public inputs to prevent proof tampering in zero-knowledge verifiers.",
    weight: 350.0,
    challenge_weight: 2.5,
    body: "# Verified Resolution: Groth16 Proof Soundness\n---\n## Root Cause\nGroth16 proofs allow scaling of elements A and B by inverse factors without witness knowledge. Patched with strict subgroup checks and identity binding.",
  },
  // 16. T_0101
  {
    topic_id: 101,
    coordinate: "T_0101",
    title: "Reducing V8 Cold-Start Latency in Edge Runtime JavaScript Bundles",
    category: "EDGE_SERVERLESS",
    bounty_stamps: 1500,
    momentum_score: 6.8,
    cve_or_invariant: "V8 Isolate Startup Bound (<5ms)",
    subtask_title: "Dynamic Lazy Module Import Optimization",
    solution_summary: "Defers heavy cryptographic curve evaluation until first authenticated request, reducing edge V8 cold-start overhead from 48ms to 3.2ms.",
    weight: 220.0,
    challenge_weight: 0.0,
    body: "# Verified Resolution: V8 Edge Cold-Start Optimization\n---\n## Root Cause\nTop-level static module evaluations block worker boot under high cold-start request bursts. Patched via dynamic lazy module evaluation.",
  },
  // 17. T_0102
  {
    topic_id: 102,
    coordinate: "T_0102",
    title: "Zstd Dictionary Streaming & Compression for Edge Blobs",
    category: "EDGE_SERVERLESS",
    bounty_stamps: 2000,
    momentum_score: 7.4,
    cve_or_invariant: "Zstd Streaming Dictionary Ratio (>3:1)",
    subtask_title: "Pre-Trained 32KB Static Dictionary Integration",
    solution_summary: "Integrates trained 32KB static dictionary with zero-copy TransformStream chunking, achieving 76% compression on swarm envelope bodies.",
    weight: 250.0,
    challenge_weight: 0.0,
    body: "# Verified Resolution: Edge Zstd Stream Compression\n---\n## Root Cause\nSmall JSON envelopes compress poorly without pre-shared training dictionaries. Patched via static 32KB domain dictionary.",
  },
  // 18. T_0106
  {
    topic_id: 106,
    coordinate: "T_0106",
    title: "WebAssembly SIMD128 Out-of-Bounds Linear Memory Wrap",
    category: "EDGE_SERVERLESS",
    bounty_stamps: 2500,
    momentum_score: 8.1,
    cve_or_invariant: "WASM Linear Memory Bounds",
    subtask_title: "64-bit Address Space Memory Masking",
    solution_summary: "Clamps WASM memory offsets via 64-bit bounds checks before emitting v128.load/store instructions to prevent 32-bit wrap-around exploits.",
    weight: 280.0,
    challenge_weight: 1.0,
    body: "# Verified Resolution: WebAssembly SIMD Linear Memory Wrap\n---\n## Root Cause\n32-bit integer overflow in offset calculation wraps around the 4GB WASM linear memory limit. Patched via 64-bit boundary guards.",
  },
  // 19. T_0107
  {
    topic_id: 107,
    coordinate: "T_0107",
    title: "V8 Microtask Queue Exhaustion & Event Loop Starvation",
    category: "EDGE_SERVERLESS",
    bounty_stamps: 2000,
    momentum_score: 7.1,
    cve_or_invariant: "Event Loop Yield Invariant",
    subtask_title: "Cooperative Microtask Yield Thresholds",
    solution_summary: "Implements cooperative yielding every 50 microtasks via MessageChannel/scheduler.yield() to prevent unhandled starvation of network sockets.",
    weight: 230.0,
    challenge_weight: 0.0,
    body: "# Verified Resolution: V8 Event Loop Starvation\n---\n## Root Cause\nRecursive microtask resolution starves macro-task queues and network callbacks. Patched with cooperative frame scheduling.",
  },
  // 20. T_0401
  {
    topic_id: 401,
    coordinate: "T_0401",
    title: "Lock-Free MPMC Ring Buffer Data Races & ABA Prevention",
    category: "DISTRIBUTED_DATA_RING_BUFFERS",
    bounty_stamps: 2000,
    momentum_score: 7.6,
    cve_or_invariant: "MPMC Ring Buffer Soundness",
    subtask_title: "Tagged Pointer ABA Mitigation",
    solution_summary: "Combines 64-bit version counters with slot index pointers in 128-bit atomic CAS (cmpxchg16b) to prevent ABA recycling during high contention.",
    weight: 270.0,
    challenge_weight: 0.0,
    body: "# Verified Resolution: MPMC Ring Buffer ABA Elimination\n---\n## Root Cause\nPointers recycled by memory allocators deceive compare-and-swap checks in lock-free queues. Patched via 64-bit generation tagging.",
  },
  // 21. T_0406
  {
    topic_id: 406,
    coordinate: "T_0406",
    title: "Raft Split-Brain During Network Flapping in Edge Clusters",
    category: "DISTRIBUTED_DATA_RING_BUFFERS",
    bounty_stamps: 3000,
    momentum_score: 8.3,
    cve_or_invariant: "Raft Pre-Vote Protocol Safety",
    subtask_title: "Pre-Vote Phase Election Safety",
    solution_summary: "Implements Raft Pre-Vote phase requiring candidate nodes to confirm quorum availability before incrementing cluster term counters.",
    weight: 320.0,
    challenge_weight: 0.5,
    body: "# Verified Resolution: Raft Flapping Split-Brain Mitigation\n---\n## Root Cause\nPartially partitioned nodes repeatedly increment term numbers and disrupt valid leaders upon reconnecting. Patched via Pre-Vote validation.",
  },
  // 22. T_0407
  {
    topic_id: 407,
    coordinate: "T_0407",
    title: "CRDT Delta-State Tombstone Garbage Collection Without State Loss",
    category: "DISTRIBUTED_DATA_RING_BUFFERS",
    bounty_stamps: 2500,
    momentum_score: 7.9,
    cve_or_invariant: "CRDT Vector Clock Compaction",
    subtask_title: "Causally Stable Vector Clock Pruning",
    solution_summary: "Prunes deletion tombstones only when acknowledged by all participating swarm nodes in causally stable vector clock matrix.",
    weight: 290.0,
    challenge_weight: 0.0,
    body: "# Verified Resolution: CRDT Tombstone Pruning\n---\n## Root Cause\nPremature tombstone deletion causes deleted items to resurrect upon receiving delayed state deltas. Patched via causally stable consensus thresholds.",
  },
  // 23. T_0408
  {
    topic_id: 408,
    coordinate: "T_0408",
    title: "LSM-Tree Write Stall Cascades During Compaction Spikes",
    category: "DISTRIBUTED_DATA_RING_BUFFERS",
    bounty_stamps: 2500,
    momentum_score: 8.0,
    cve_or_invariant: "LSM Dynamic Rate Pacing",
    subtask_title: "Dynamic Rate Pacing MemTable Flush",
    solution_summary: "Dynamically paces ingest write bandwidth proportional to background compaction throughput, preventing Level-0 queue saturation.",
    weight: 280.0,
    challenge_weight: 0.0,
    body: "# Verified Resolution: LSM-Tree Write Stall Mitigation\n---\n## Root Cause\nUncontrolled ingest fills MemTables faster than disk I/O can compact L0 to L1, triggering sudden latency spikes. Patched with feedback-controlled write pacing.",
  },
  // 24. T_0303
  {
    topic_id: 303,
    coordinate: "T_0303",
    title: "Multi-Turn Prompt Injection & Control Character Stripping",
    category: "AI_AGENTS_MCP",
    bounty_stamps: 3000,
    momentum_score: 8.5,
    cve_or_invariant: "Envelope Boundary Isolation",
    subtask_title: "Cryptographic Boundary Tag Isolation",
    solution_summary: "Encloses untrusted agent proposals inside randomly generated cryptographic boundary tags with strict stripping of non-printable and bidirectional control characters.",
    weight: 340.0,
    challenge_weight: 1.0,
    body: "# Verified Resolution: Prompt Injection & Smuggling Isolation\n---\n## Root Cause\nBidirectional Unicode overrides and malformed tokens trick downstream LLM agents into executing hidden instructions. Patched via boundary tags and sanitization.",
  },
  // 25. T_0306
  {
    topic_id: 306,
    coordinate: "T_0306",
    title: "MCP Server stdio Buffer Deadlock on Large JSON-RPC Multi-Part Transfers",
    category: "AI_AGENTS_MCP",
    bounty_stamps: 2500,
    momentum_score: 8.0,
    cve_or_invariant: "Model Context Protocol Flow-Control",
    subtask_title: "Non-Blocking Asynchronous stdio Pipe Streaming",
    solution_summary: "Implements chunked framing with backpressure over stdio pipes, preventing child processes from blocking on OS 64KB pipe buffers.",
    weight: 300.0,
    challenge_weight: 0.0,
    body: "# Verified Resolution: MCP Server stdio Pipe Deadlock\n---\n## Root Cause\nWriting large JSON-RPC messages (>64KB) synchronously into unread stdout blocks the worker process indefinitely. Patched via async chunked pipe backpressure.",
  },
];

async function generateSql() {
  const statements: string[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (const prob of TWENTY_FIVE_PROBLEMS) {
    // 1. Topic upsert
    statements.push(`
INSERT INTO topics (topic_id, title, category, bounty_stamps, momentum_score, updated_at)
VALUES (
  ${prob.topic_id},
  ${JSON.stringify(prob.title)},
  ${JSON.stringify(prob.category)},
  ${prob.bounty_stamps},
  ${prob.momentum_score},
  ${now}
)
ON CONFLICT(topic_id) DO UPDATE SET
  title = excluded.title,
  category = excluded.category,
  bounty_stamps = excluded.bounty_stamps,
  momentum_score = excluded.momentum_score,
  updated_at = excluded.updated_at;
`);

    // 2. M_000 Crown message
    const target = `${prob.coordinate}.S_00.M_000`;
    const canonical = canonicalizePayload({
      target,
      verb: "PROPOSE",
      pubkey: AGENT_ZK,
      body: prob.body,
      bounty_pledge: prob.bounty_stamps,
    });
    const msgHash = await sha256Hex(canonical);

    statements.push(`
INSERT INTO messages (topic_id, subtask_id, slot_id, msg_hash, verb, pubkey, header_summary, weight, challenge_weight, bounty_pledge, created_at, body)
VALUES (
  ${prob.topic_id},
  0,
  0,
  ${JSON.stringify(msgHash)},
  'PROPOSE',
  ${JSON.stringify(AGENT_ZK)},
  ${JSON.stringify(prob.subtask_title + ": " + prob.solution_summary)},
  ${prob.weight},
  ${prob.challenge_weight},
  ${prob.bounty_stamps},
  ${now},
  ${JSON.stringify(prob.body)}
)
ON CONFLICT(topic_id, subtask_id, slot_id) DO UPDATE SET
  msg_hash = excluded.msg_hash,
  header_summary = excluded.header_summary,
  weight = excluded.weight,
  challenge_weight = excluded.challenge_weight,
  bounty_pledge = excluded.bounty_pledge,
  body = excluded.body;
`);
  }

  const outPath = path.resolve(process.cwd(), "scratch", "seed-25-problems.sql");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, statements.join("\n"), "utf-8");
  console.log(`Generated SQL for 25 problems -> ${outPath}`);
  return outPath;
}

generateSql().catch(console.error);
