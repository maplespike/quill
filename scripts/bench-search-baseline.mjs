#!/usr/bin/env node
/**
 * scripts/bench-search-baseline.mjs — the CURRENT (pre-quill-search) search
 * path, measured over the same JSONL corpora the Rust benches use (issue #976).
 *
 * This is a faithful reimplementation of the substring scan in
 * packages/api-server/src/routes/municipal.ts:1218–1224:
 *
 *     // Full-text filter on the cached records JSON blob (excluding the
 *     // provenance block we strip at write time). Cheap substring match;
 *     // future work: FTS5 virtual table over records_json.
 *     if (q) {
 *       const blob = JSON.stringify(cached.records).toLowerCase();
 *       if (!blob.includes(q)) continue;
 *     }
 *
 * Faithfulness notes:
 *   - The route lowercases the WHOLE records blob (JSON.stringify of every
 *     record in the dataset) and runs one `String.includes` per dataset row.
 *     A row-level hit then serves ALL records of that row (the per-record
 *     loop that follows does not re-filter on q).
 *   - The bench keeps that unit of work: one `JSON.stringify(records)` +
 *     one `includes` per (city,dataset) row, over rows exploded from the
 *     same JSONL corpus the Rust benches index.
 *   - For a per-record comparison (substring scan at record granularity),
 *     pass --granularity record.
 *
 * It measures BOTH:
 *   - query latency (p50/p95) of the substring path over N repetitions, and
 *   - reports hit counts, so results can be cross-checked against tantivy.
 *
 * Usage:
 *   node scripts/bench-search-baseline.mjs --corpus rust/fixtures/bench.jsonl
 *   node scripts/bench-search-baseline.mjs --corpus X --queries "a" "b" --runs 200
 *
 * Output: JSON on stdout (consumable by hand or by docs recording).
 */

import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const corpusIdx = args.indexOf('--corpus');
if (corpusIdx === -1 || !args[corpusIdx + 1]) {
  console.error('usage: node scripts/bench-search-baseline.mjs --corpus <jsonl> [--runs N] [--queries q1 q2 ...] [--granularity dataset|record]');
  process.exit(2);
}
const CORPUS = args[corpusIdx + 1];
const runsIdx = args.indexOf('--runs');
const RUNS = runsIdx !== -1 ? parseInt(args[runsIdx + 1], 10) : 200;
const queriesIdx = args.indexOf('--queries');
const QUERIES =
  queriesIdx !== -1
    ? args.slice(queriesIdx + 1).filter((q) => !q.startsWith('--') || q === '--')
    : ['bloor street', 'council budget toronto', 'water'];
const granIdx = args.indexOf('--granularity');
const GRANULARITY = granIdx !== -1 ? args[granIdx + 1] : 'dataset';
if (GRANULARITY !== 'dataset' && GRANULARITY !== 'record') {
  console.error(`--granularity must be dataset|record (got ${GRANULARITY})`);
  process.exit(2);
}

// ── Load corpus, explode into "dataset rows" like the route sees ────────────
// The route's cached unit is (city_id, dataset) -> records[]. The bench corpora
// are flat docs, so we group them by their meta (city,dataset) prefix — the
// same rows a real cache would hold.

const raw = readFileSync(CORPUS, 'utf8');
const docs = [];
for (const line of raw.split('\n')) {
  const t = line.trim();
  if (!t) continue;
  docs.push(JSON.parse(t));
}

// Group into rows: key = "<city>:<dataset>" derived from the doc id prefix
// (id format "<city>:<dataset>:<n>"), falling back to a per-doc row.
const rows = new Map();
for (const d of docs) {
  const parts = String(d.id).split(':');
  let key;
  if (parts.length >= 3) {
    key = `${parts[0]}:${parts[1]}`;
  } else {
    key = String(d.id);
  }
  if (!rows.has(key)) rows.set(key, []);
  rows.get(key).push(d);
}
const rowList = [...rows.values()];

// ── The current path, faithfully ────────────────────────────────────────────
// dataset granularity: one JSON.stringify(records) + includes(q) per row —
// exactly the loop body in municipal.ts:1218–1224.
// record granularity: includes(q) per record's own blob (hypothetical tighter
// scan, kept for comparison).

function scanDataset(q) {
  let hits = 0;
  for (const records of rowList) {
    const blob = JSON.stringify(records).toLowerCase();
    if (blob.includes(q)) hits++;
  }
  return hits;
}

function scanRecord(q) {
  let hits = 0;
  for (const records of rowList) {
    for (const rec of records) {
      const blob = JSON.stringify(rec).toLowerCase();
      if (blob.includes(q)) hits++;
    }
  }
  return hits;
}

const scan = GRANULARITY === 'dataset' ? scanDataset : scanRecord;

// ── Measure ─────────────────────────────────────────────────────────────────

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

const results = {};
for (const q of QUERIES) {
  const needle = q.toLowerCase();
  // Warmup (JIT + page cache)
  for (let i = 0; i < Math.min(20, RUNS); i++) scan(needle);

  const samples = new Array(RUNS);
  const t0 = performance.now();
  let hits = 0;
  for (let i = 0; i < RUNS; i++) {
    const s = performance.now();
    hits = scan(needle);
    samples[i] = performance.now() - s;
  }
  const wall = performance.now() - t0;
  samples.sort((a, b) => a - b);
  results[q] = {
    hits,
    runs: RUNS,
    p50_ms: +percentile(samples, 50).toFixed(3),
    p95_ms: +percentile(samples, 95).toFixed(3),
    mean_ms: +(samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(3),
    wall_ms: +wall.toFixed(1),
    docs: docs.length,
    rows: rowList.length,
    granularity: GRANULARITY,
  };
}

console.log(JSON.stringify({ corpus: CORPUS, node: process.version, results }, null, 2));
