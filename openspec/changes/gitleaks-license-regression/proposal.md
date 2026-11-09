## Why

The secrets CI job failed on every pull request and on `main` until 2026-10-02. `gitleaks/gitleaks-action` requires `GITLEAKS_LICENSE` for an organisation repository. The step passed only `GITHUB_TOKEN`, so the action exited with "License key is required." The env line is present now. Nothing fails the workflow if that line is removed. Issue #1040.

## What Changes

- Add `scripts/check-gitleaks-license.py`. It parses workflow YAML and fails when a `gitleaks/gitleaks-action` step does not receive `GITLEAKS_LICENSE` from `secrets.GITLEAKS_LICENSE`.
- Add `scripts/test-gitleaks-license.mts` and a fixture. Deleting the license line from the fixture fails the check. The check output names `GITLEAKS_LICENSE` and does not print a secret value.
- Run the check and the test from `.github/workflows/ci.yml`, including a step in `secrets-event-range` before the action. Add `pnpm run test:gitleaks-license` to the root `test` script.

## Capabilities

### New Capabilities

- `gitleaks-license-guard`: The CI workflow source must keep `GITLEAKS_LICENSE` on the gitleaks action step.

### Modified Capabilities

- None.

## Impact

- `.github/workflows/ci.yml`, `package.json`, and new scripts under `scripts/`.
- No API, MCP, or dependency change. No files under `secrets/`.
