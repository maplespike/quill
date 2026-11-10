# Review: Public export

## Spec Compliance

- [x] The allowlist names the five server packages and `sdk-*`.
- [x] Excludes cover SEDI, private-only tests, disabled files, and the private trees.
- [x] The overlay Dockerfiles do not copy the whole context or the portal.
- [x] The script plans install, build, and test, and a scan-only mode stops first.
- [x] The script source has no remote write command.

## Design Alignment

- [x] SDK licence metadata changes only in the temp tree.
- [x] SSRF `192.168` matches are allowed by explicit path.
- [x] The four private-only tests are tagged and listed.

## Risk Assessment

- [x] A dirty scan exits non-zero and prints a grouped report.
- [x] Rollback is a revert. No schema or route change.

## Completeness

- [x] `docs/oss-export.md` names the Infra steps that are still missing: deploy key, private workflow, and GHCR.
- [x] The unit test does not copy the repository.

VERDICT: APPROVED
