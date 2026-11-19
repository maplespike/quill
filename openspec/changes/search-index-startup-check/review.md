# Review: search-index-startup-check

## Spec compliance

- [x] Serve refusal covers missing directory, missing sidecar, and the 30-doc sample.
- [x] A corpus rebuild writes `quill-meta.json` and still refuses an undersized result.
- [x] The backup script names the missing sidecar, writes no archive, and points at the runbook.

## Design alignment

- [x] No volume mount, PVC, or backup CronJob edit.
- [x] Claim-root sidecar is reported, not served.
- [x] Floor override exists for the sample corpus.

## Risk

- [x] Rollout needs a hand rebuild or the pod stays down. The runbook is the procedure.
- [x] Tests cover the startup check and the sidecar write in `cargo test -p quill-search --lib`, and the backup message in `scripts/test-backup-restore.mjs`.

VERDICT: APPROVED
