## Why

After the 2026-11-09 restart, quill-search reported 30 docs and the search backup exited because `quill-meta.json` was not in the directory the job reads. Thirty docs is the committed sample corpus. Serve treated that directory as healthy, so `/health` stayed 200 and no rebuild ran.

## What Changes

- `quill-search serve` checks the index before it listens. A missing directory, a missing sidecar, or a doc count below 31 exits non-zero.
- `--corpus` / `QUILL_SEARCH_CORPUS` rebuilds an unusable index before listen and writes `quill-meta.json`.
- Every index build writes `quill-meta.json` after the tantivy commit.
- `search-backup.sh` prints a clear refusal when the sidecar is missing and writes no archive.
- `docs/runbooks/search-reindex.md` is the hand rebuild procedure.

## Capabilities

### New Capabilities

- `search-index-startup`: Serve refuses an unusable index, and an index build always leaves `quill-meta.json`.

### Modified Capabilities

- (none)

## Impact

- `rust/crates/quill-search` binary startup. A production pod whose index is the 30-doc sample exits instead of becoming Ready.
- `charts/quill/files/search-backup.sh` message only. No volume, CronJob, or mount change.
- Operators follow `docs/runbooks/search-reindex.md` to put a real index back.
