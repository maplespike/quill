## Context

`rust/fixtures/sample.jsonl` has 30 documents. `serve` used to open whatever directory `--index` named and log that sidecar count. `/health` then returned 200, so the pod stayed Ready.

Until commit `c51fd039` the search claim was mounted at `/data/index`, so index files were written at the claim root. The deployment now mounts the claim at `/data` and opens `/data/index`. The backup mounts the same claim at `/search` and reads `/search/index/quill-meta.json`. `migrate-search-index.sh` exits 0 when `index/quill-meta.json` is absent. It does not look at the claim root. This change does not edit volume mounts or the backup CronJob.

The search image has the `quill-search` binary only. It cannot export the API SQLite corpus. A rebuild on start runs only when the operator passes a JSONL path.

## Goals / Non-Goals

**Goals:**

- Refuse a missing, sidecar-less, or sample-sized index before listen.
- Rebuild from a supplied corpus and always write `quill-meta.json`.
- Make the backup script say why it wrote nothing.
- Document the hand rebuild, including the claim-root layout.

**Non-Goals:**

- Changing the PVC, the backup CronJob, or `INDEX_DIR`.
- Exporting the SQLite corpus inside the search image.
- Serving the claim-root index automatically.

## Decisions

- The floor is 31 (`FIXTURE_DOC_COUNT + 1`). `--min-docs 0` or `QUILL_SEARCH_MIN_DOCS=0` disables it for the sample corpus.
- A usable index is not rebuilt when a corpus is also set. A restart must not replace a good index.
- The sidecar is written after tantivy commit, via temp file, fsync, and rename.
- The refusal names a claim-root sidecar when one exists. It does not open that directory.

## Risks / Trade-offs

- [The new image crash-loops until a real index is in `index/`] → The runbook is the recovery. The previous Ready state was the 30-doc sample.
- [An operator points `--corpus` at the sample file] → The rebuild still fails the floor and does not listen.

## Migration Plan

1. Merge. Build and roll the search image through the normal deploy path.
2. Before or immediately after the roll, follow `docs/runbooks/search-reindex.md`.
3. Confirm `/health` docs is greater than 30 and the backup job writes an archive.

Rollback: roll the previous search image. That image serves the sample index again. It does not restore a missing production index.

## Open Questions

- None. Where the live claim stores the old index is an on-cluster check. The runbook covers both layouts.
