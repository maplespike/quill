# RAG Tuning Loop — Spec & Harness Design

> Status: SPEC ONLY (no implementation yet). Read-only investigation of
> `~/Projects/quill` completed 2026-07-12. This document defines the
> eval harness + tuning loop for MapleSpike's Qdrant-backed RAG, applying
> the loop-engineering discipline (automatic verdict, brakes, held-out
> check, jsonl log) from the "Loop That Tunes RAG to a Target Recall" article.
>
> Source of truth for repo layout: `/home/j_kro/Projects/quill/AGENTS.md`.
> All file paths below were verified to exist on disk 2026-07-12.

## 1. Problem

MapleSpike's semantic search / AI Ask currently retrieves from a Qdrant
collection with retrieval parameters that are hardcoded or env-only and have
never been systematically tuned against a measurable recall target. Tuning by
hand is slow and untrackable. We wrap the tuning in a loop with a green-check
verdict (recall@k on a held-out eval) and brakes (max evaluations bounded by
GPU cost).

## 2. Verified current architecture (read from source, not assumed)

### Retrieval (query path)
- `packages/api-server/src/routes/ai.ts`
  - `qdrantVectorSearch(vector, limit = 10)` — line 223. **`k` is hardcoded at 10.**
  - `embedQuery(text)` — line 125. Tries local llama.cpp `/embeddings` on sentry
    first, falls back to AI Gateway.
  - `EMBED_MODEL = process.env.QUILL_EMBED_MODEL || 'nvidia/llama-3.2-nv-embedqa-1b-v2'` — line 34.
  - `QDRANT_ENDPOINT` / `QDRANT_COLLECTION` env-driven; **default collection is
    `brain_wiki`** (line 42), NOT `maplespike`. `.env.deployment` confirms
    `QUILL_QDRANT_COLLECTION=brain_wiki`, `QUILL_QDRANT_ENDPOINT=http://qdrant.ai-inference.svc.cluster.local:6333`.
- `packages/quill-mcp/src/ai/qdrant.ts`
  - `searchCollection(vector, { limit = 10, scoreThreshold, filter })` — line ~176.
    **Also hardcodes `limit = 10`.**
  - `upsertPoints(points, configOverride?)` — line ~219. Writes `{id, vector, payload}`.

### Embedding / population path (THE GAP — stated honestly)
- `grep` for `upsertPoints(` callers in `packages/**/src` (excluding the
  definition + `dist/`) finds **NONE**. The in-repo `quill-mcp` exports the
  upsert primitive but no in-repo module builds document chunks and writes them
  to Qdrant.
- `packages/pipeline-core/src/ingestion/**` modules `upsert` into **Cloudflare D1**
  (e.g. `ab-courts/index.ts:30` `upsertAbCourtsRecord(db: D1Database, ...)`), NOT Qdrant.
- `packages/engine/src/etl/index.ts` exists but is a single index file (not a
  chunk+embed+upsert worker).
- `packages/edge-worker/src/ai-worker.ts` does `/v1/ai/search` (Workers AI
  embeddings → homelab Qdrant) but is a Cloudflare Worker, not the population job.

**Conclusion:** the document→chunk→embed→upsert pipeline that fills `brain_wiki`
is NOT in this checkout. It lives in a separate ingestion process (external to
`quill`, or a script not present here). This spec therefore defines the **oracle
against the LIVE `brain_wiki` collection** so the tuning loop can run and improve
retrieval WITHOUT first rebuilding the populator. Locating/rewriting the populator
is a SEPARATE task (see §7).

### What is tunable TODAY (no new code required)
| Knob | Where | How |
|---|---|---|
| `k` (top-k) | `ai.ts:223` `limit=10`; `qdrant.ts` `searchCollection limit=10` | 1-line change each |
| embedding model | `QUILL_EMBED_MODEL` env (default `nvidia/llama-3.2-nv-embedqa-1b-v2`) | swap to any OpenAI-compatible embed endpoint (e.g. NVIDIA NIM `bge-large`, `e5-large`) |
| `scoreThreshold` | `searchCollection` accepts it; `qdrantVectorSearch` does NOT pass it | wire-through (small change) |
| collection | `brain_wiki` | fixed for now |

### What is NOT present (requires new components — out of scope for v1)
- Chunk size / overlap: no chunker in the query path. Only tunable if we control
  the populator (see §7).
- Reranker: none exists.
- Hybrid (vector + BM25): none exists.

## 3. The eval set (the human-authored cost — must exist before any loop)

Schema (one JSONL file per question):

```jsonc
// eval/recall-eval.jsonl
{
  "id": "fed-committees-001",
  "question": "Which House of Commons committees did Member X serve on in the 44th Parliament?",
  "gold_module": "committees",          // maps to a MapleSpike ingestion module
  "gold_chunk_id": "committees:44th:industry-science",  // the exact Qdrant point id expected
  "split": "train" | "holdout"          // assigned by split script, not hand
}
```

Requirements:
- 40–60 questions minimum (article floor: ≥40 to avoid noise-driven overfit).
- Each question must have a **single** `gold_chunk_id` that exists as a point id
  in `brain_wiki` (verified by querying Qdrant `points/scroll` or `points/get`).
- Questions should span multiple modules (committees, lobbying, procurement,
  gazette, GIC, courts, health, immigration, ...) so the eval reflects real
  cross-module recall, not one module.
- Questions must be answerable ONLY from the gold chunk (no ambiguity), so a
  miss is a genuine retrieval failure.

Authoring is a manual task (the article's "eval set" is the real work). We can
bootstrap it by: (a) sampling `gold_module`/`gold_chunk_id` pairs from the live
collection's payloads, (b) writing a natural-language question per pair. A helper
script `scripts/gen-eval-stub.mjs` can emit skeleton entries from Qdrant payloads
to cut authoring time, but the question text is human-written.

## 4. The oracle (`evaluate`)

Pure function over the LIVE retrieval path. Returns recall@k for a config.

Signature:
```ts
async function evaluate(
  config: TuneConfig,
  cases: EvalCase[],
): Promise<number>  // recall@config.k over `cases`
```

Behavior:
1. For each case: embed `case.question` with `config.embedModel` (same gateway /
   local-llama.cpp path as `embedQuery`), then call the retrieval entrypoint
   (`searchCollection` from `quill-mcp/src/ai/qdrant.ts`, or the api-server route
   via HTTP) with `limit = config.k` and `scoreThreshold = config.scoreThreshold`.
2. Collect returned point ids; hit if `case.gold_chunk_id` ∈ returned ids.
3. `recall = hits / cases.length`.

Why use `quill-mcp/src/ai/qdrant.ts` directly (not the HTTP route): it is the
shared retrieval primitive, already env-driven for endpoint/collection/model,
and exercises the same code the production MCP tools use. The loop sets
`QUILL_QDRANT_ENDPOINT`, `QUILL_QDRANT_COLLECTION` (= brain_wiki), and
`QUILL_EMBED_MODEL` from `config` via `configOverride` / env before each eval.

## 5. The loop (coordinate descent + brakes)

Search space v1 (constrained to what is tunable today, §2):

```ts
const SEARCH_SPACE = {
  k:            [5, 10, 20],
  embedModel:   [
    'nvidia/llama-3.2-nv-embedqa-1b-v2',  // current default
    'nvidia/llama-3.2-nv-embedqa-1b-v2',  // placeholder for NIM bge-large once endpoint verified
    // add 'bge-large', 'e5-large' once the NVIDIA NIM embed endpoints are confirmed live
  ],
  scoreThreshold: [undefined, 0.6, 0.7, 0.8],
};
```

Algorithm: `tune_rag_safe` from the article, adapted:
- Coordinate descent: one knob at a time, keep best, lock in.
- **Goal check** every run: `if best_recall >= target_recall (0.9) return early`.
- **Improvement threshold** `0.02` to ignore noise (eval sets are small → noisy).
- **Brakes** (our cost is GPU-minutes, not USD):
  - `max_evals` (e.g. 40) — hard ceiling on retrieval runs.
  - `max_gpu_minutes` — estimate per eval: `n_questions * (embed cost + k * score cost)` on
    sentry/forge; stop BEFORE the next eval would exceed the budget. (Replaces
    `max_budget_usd`; mining revenue is the displaced cost.)
- **Log**: append every eval to `tune_log.jsonl` (`{config, recall, spent_gpu_min, eval}`).

Held-out check (mandatory, non-negotiable):
- `split_eval(cases, holdout_frac=0.3, seed=42)` → train/holdout.
- Loop tunes on train only.
- After loop: evaluate found config on holdout.
- `gap = train_recall - holdout_recall`; if `gap > 0.10` → WARN "overfit, do not ship".

## 6. Where the code lives (proposed, when implemented)

New package `packages/rag-tuner` (or a script under `scripts/` if a package is
heavier than needed):
- `src/eval-set.ts` — EvalCase type + loaders.
- `src/oracle.ts` — `evaluate()` over `quill-mcp` qdrant client.
- `src/split.ts` — `split_eval()`.
- `src/tune.ts` — `tune_rag_safe()` coordinate descent + brakes + log.
- `src/cli.ts` — `pnpm rag-tune --target 0.9 --max-evals 40`.
- `eval/recall-eval.jsonl` — the authored eval set (git-tracked).
- `tune_log.jsonl` — generated, gitignored.

It imports `searchCollection` + `upsertPoints` types from `quill-mcp` (already a
workspace package), so no duplication of the Qdrant client.

## 7. Out-of-scope for v1 (explicit)

- **Chunk size / overlap tuning**: blocked until the document→chunk→embed→upsert
  populator is located or built. The populator is NOT in this checkout (§2 gap).
  When found, expose `chunkSize`/`chunkOverlap` as tunable knobs and re-run the
  same loop over a re-embedded `brain_wiki`.
- **Reranker / hybrid BM25**: require new components; add as knobs only after
  they exist in the retrieval path.
- **Populating the collection**: the loop tunes retrieval against existing data;
  it does not (re)embed the corpus. Re-embedding is a separate, heavier job.

## 8. Acceptance criteria (for the implementation phase)

1. `eval/recall-eval.jsonl` exists with ≥40 cases, each `gold_chunk_id` verified
   present in `brain_wiki` (script asserts this before any tuning run).
2. `evaluate()` returns a real number on the live collection (proven by running
   it once on the default config and printing recall).
3. `tune_rag_safe()` runs, writes `tune_log.jsonl`, stops at `target_recall` OR a
   brake, and prints train + holdout recall + gap.
4. No fabricated values: every recall number comes from a real Qdrant query in
   the run; the log is the receipt.
5. Brakes cannot be exceeded (assert `evals_used <= max_evals` and
   `spent_gpu_min <= max_gpu_minutes` at return).

## 9. How this maps to loop-engineering discipline

- Automatic verdict: recall@k on held-out — yes, built in.
- Brakes: max_evals + max_gpu_minutes — yes.
- Held-out check: train/holdout split + gap alarm — yes.
- Log: tune_log.jsonl — yes, reproducibility.
- Our brakes use GPU-minutes (displaced mining) instead of USD, because the
  cluster is the cost center, not an API bill.
