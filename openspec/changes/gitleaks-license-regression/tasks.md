## 1. Guard

- [x] 1.1 Add `scripts/check-gitleaks-license.py` to fail when a gitleaks action step loses `GITLEAKS_LICENSE` from secrets
- [x] 1.2 Add `scripts/fixtures/gitleaks-license-ok.yml` and `scripts/test-gitleaks-license.mts`

## 2. CI

- [x] 2.1 Run the check and the test from `build-and-test`
- [x] 2.2 Run the check in `secrets-event-range` before `gitleaks/gitleaks-action`
- [x] 2.3 Add `test:gitleaks-license` to the root test script
