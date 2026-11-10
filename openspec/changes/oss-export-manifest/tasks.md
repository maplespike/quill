## 1. Manifest and overlay

- [x] 1.1 Add `oss/export.yml` with the allowlist, excludes, transforms, and scan rules
- [x] 1.2 Add the public README, contributing guide, security policy, and env example
- [x] 1.3 Add compose, both Dockerfiles, and the public CI workflow

## 2. Exporter

- [x] 2.1 Add `scripts/oss-export.mjs` and the pure helper module
- [x] 2.2 Tag the four private-only tests
- [x] 2.3 Add `pnpm run oss:export` and `docs/oss-export.md`

## 3. Test

- [x] 3.1 Add the fast manifest and scan unit test
- [x] 3.2 Run the scan locally and record the remaining hits
