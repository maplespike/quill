## Context

`secrets-event-range` in `.github/workflows/ci.yml` runs `gitleaks/gitleaks-action@v3` with `GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}`. `scripts/check-gitleaks-baseline.sh` checks the ignore file and the ruleset. It does not read the action env. The sibling `secrets` job runs the gitleaks binary and does not need the licence.

## Goals / Non-Goals

**Goals:**

- Fail CI when the gitleaks action loses `GITLEAKS_LICENSE` from `secrets.GITLEAKS_LICENSE`.
- Name the missing env var and the consequence (the org-repo scan fails on every PR).
- Prove the failure with a fixture that deletes the line.
- Do not print or read a secret value.

**Non-Goals:**

- Changing the gitleaks baseline, the history gate, or anything under `secrets/`.
- Requiring the licence on the binary-only `secrets` job.

## Decisions

- Parse workflow YAML by indentation, in the style of `scripts/check-workflow-gh-token.py` and `scripts/gates/check-workflow-gh-auth.mjs`. Do not add a YAML dependency.
- Accept the secret reference on the step, the job, or the workflow env. A step value that is not the secret reference fails even when a parent env is correct, because the step value is what the action receives.
- A comment that mentions `GITLEAKS_LICENSE` does not count.
- Run the checker in `build-and-test` with its unit test, next to the other workflow checks, and again in `secrets-event-range` immediately before the action. The second step is the one that travels with the job it guards.
- Default scan target is `.github/workflows`, so a second workflow that adds the action is covered. A path argument lets the test point at a fixture.

## Risks / Trade-offs

- [An unusual YAML shape hides the env key] → The live `ci.yml` step and the fixture use the same one-line mapping the parser accepts. The unit test runs the checker against the real workflows directory.
- [The checker prints a secret] → It never echoes the mapping value. The fixture test plants a literal and asserts the output does not contain it.

## Migration Plan

No deploy. Rollback is reverting the commit. The action env line stays as it is on `main`.

## Open Questions

None.
