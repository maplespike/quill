## ADDED Requirements

### Requirement: Gitleaks action receives the licence env

Every workflow step that uses `gitleaks/gitleaks-action` MUST set `GITLEAKS_LICENSE` to `${{ secrets.GITLEAKS_LICENSE }}` on the step env, the job env, or the workflow env. A step env value overrides a job or workflow value. The repository MUST contain at least one such step.

#### Scenario: Current workflows pass

- **WHEN** the check scans `.github/workflows`
- **THEN** it exits 0 and reports that each gitleaks action step passes `GITLEAKS_LICENSE` from secrets

#### Scenario: Deleting the licence line fails the check

- **WHEN** a workflow uses `gitleaks/gitleaks-action` and the `GITLEAKS_LICENSE` line is deleted
- **THEN** the check exits non-zero
- **AND** the message names `GITLEAKS_LICENSE`
- **AND** the message states that the org-repo scan fails on every PR regardless of contents

#### Scenario: A literal value is rejected and not printed

- **WHEN** `GITLEAKS_LICENSE` is set to a literal string instead of `${{ secrets.GITLEAKS_LICENSE }}`
- **THEN** the check exits non-zero
- **AND** the output does not contain that literal string

### Requirement: CI runs the guard with the action

The CI workflow MUST run `scripts/check-gitleaks-license.py` in the job that runs `gitleaks/gitleaks-action`, before that action. The CI workflow MUST also run `scripts/test-gitleaks-license.mts`.

#### Scenario: The secrets job checks the env before the action

- **WHEN** `.github/workflows/ci.yml` is read
- **THEN** `python3 scripts/check-gitleaks-license.py` appears before `uses: gitleaks/gitleaks-action`
- **AND** the workflow runs `tsx --test scripts/test-gitleaks-license.mts`
