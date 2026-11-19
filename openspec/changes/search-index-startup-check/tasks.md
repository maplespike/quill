## 1. Startup check

- [x] 1.1 Refuse a missing index, a missing sidecar, or a doc count below 31 before serve listens
- [x] 1.2 Rebuild from `--corpus` / `QUILL_SEARCH_CORPUS` when the index is unusable
- [x] 1.3 Write `quill-meta.json` after every index build

## 2. Backup and runbook

- [x] 2.1 Make `search-backup.sh` explain a missing sidecar and write no archive
- [x] 2.2 Add `docs/runbooks/search-reindex.md`

## 3. Network policy

- [x] 3.1 Allow TCP 8083 on intra-namespace ingress and cluster-service egress, not on the public edge

## 4. Tests

- [x] 4.1 Lib tests for the startup check and the sidecar write
- [x] 4.2 Node test for the backup refusal
