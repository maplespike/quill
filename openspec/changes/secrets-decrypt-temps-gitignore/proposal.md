# Proposal: Make .gitignore cover the SOPS decrypt-temp shapes that leaked in the 2026-10-14 atlas backup (run 38617463045, issue #1070)

## Problem

CI run 38617463045 (main, SHA 189b45e2) failed the `secrets` job's
Full-history secrets gate with 34 findings not in the baseline. All 34 came
from commit `fd4f6e08` ("WIP backup 2026-10-14 (atlas)") on branch
`wip/atlas-backup-20261014` — a machine-state sweep that committed the working
clone's untracked files, including three plaintext decrypts of
`secrets/runtime.yaml` (`secrets/tmp.ZMFRg0.yaml`, `secrets/tmp.y8ns8n.yaml`,
`secrets/tmp2zgn9_f1.yaml`) carrying the live `sk_live_` Stripe secret key and
other runtime secrets. The gate scans all origin refs, so the off-main branch
failed every main CI run.

The operator deleted the branch and tracks credential rotation in #1070; the
rerun of 38617463045 is green, so the CI failure itself is resolved. What
remains is the class gap the incident exposed: `.gitignore`'s decrypt-artifact
rules (`secrets/*.dec`, `secrets/*.plaintext`, `secrets/*.env`,
`secrets/decrypted/`) cover *named* artifact extensions but not the
`mktemp`-shaped names SOPS editors and decrypt pipelines actually produce
(`secrets/tmp.XXXXXXXX.yaml`, `secrets/tmpXXXXXX`, `.sops.yaml.tmp`). #1070
item 7 asserts ".gitignore now covers the leaked classes" — verified false on
main today: `git check-ignore secrets/tmp.ZMFRg0.yaml` returns nothing.

The sweep's trigger is unidentified (#1070 item 6). If it runs again on the
atlas clone, whose disk still holds the plaintext temps, the same files get
committed again, the gate fails again, and if the recurrence lands on a ref
that stays up longer, the exposure window widens.

## Root cause

Two independent gaps, both class-level:

1. **`.gitignore` shape gap.** The decrypt-artifact rules enumerate artifact
   *extensions* (`.dec`, `.plaintext`, `.env`) plus one directory
   (`decrypted/`), but `mktemp` suffixes live in the *middle* of the name
   (`tmp.ZMFRg0.yaml`, `tmp2zgn9_f1.yaml`). No rule matches, so
   `git add -A` sweeps the temps in.
2. **No regression pin.** The incident rule (every failure becomes a test)
   requires a check that fails if the ignore rules regress. None exists; the
   34-finding CI failure is the only thing that would catch it, and only
   after a push and a full-history scan.

## Proposed fix

1. `.gitignore`: after the existing SOPS decrypt-artifact rules, add
   `secrets/tmp*` (covers `tmp.ZMFRg0.yaml`, `tmp2zgn9_f1.yaml`, and any
   `mktemp` suffix shape, including no-extension temps) and
   `secrets/*.tmp` / `.sops.yaml.tmp` / `.sops.yaml.tmp*` for the creation-rule
   editor temps observed in the same commit. Add `sbom/` (generated SBOM
   artifacts; `sbom/` was swept in and tripped 2 findings) and
   `.worktrees/` (agent worktree metadata files, ~120 of them were swept in).
2. Regression test `scripts/test-gitignore-leak-shapes.mts`: drive the REAL
   `git check-ignore` against the repo's REAL `.gitignore` for the exact
   incident paths plus the existing-covered shapes, and pin:
   - every path from the incident commit that could carry a plaintext
     decrypt is ignored (`secrets/tmp.ZMFRg0.yaml`, `secrets/tmp.y8ns8n.yaml`,
     `secrets/tmp2zgn9_f1.yaml`, `.sops.yaml.tmp`);
   - the SOPS editor suffix variants are ignored
     (`secrets/tmpXXXXXX`, `secrets/tmp.ABCDEFGH.yaml`,
     `secrets/tmp2zgn9_f1.yaml`, `secrets/mydecrypt.tmp`,
     `secrets/runtime.yaml.tmp`);
   - sealed/encrypted files are NOT ignored (`secrets/runtime.yaml`,
     `secrets/billing.yaml` must stay committable — SOPS-encrypted files are
     safe to commit by design; the new rules must not over-match);
   - the negative control: a tracked-path shape like `secrets/README.md` is
     not ignored (proves the test can fail).
   Cite the incident (run 38617463045, commit fd4f6e08, issue #1070) in the
   test header.
3. Wire the test into `pnpm test` (`"test:gitignore"` script in package.json,
   appended to the `test` chain) and into CI (`build-and-test`, beside the
   secrets-history gate unit tests, where the other incident-rule tests live).

## Affected packages

- None (`.gitignore`, `scripts/`, `package.json`, CI workflow). No API/MCP
  contract change. No new dependencies. `git` is required on the runner —
  already used by the conflict-marker check in the same job.

## Verification gate

- `pnpm exec tsx --test scripts/test-gitignore-leak-shapes.mts` green on the
  new rules.
- The test red if any incident shape is dropped from `.gitignore`
  (verified by temporarily removing `secrets/tmp*` before writing the test,
  keeping the control honest).
- Existing suites still green: `pnpm exec tsx --test
  scripts/test-secrets-history.mts`, `scripts/test-secret-lockstep.mts`,
  plus `bash scripts/check-gitleaks-baseline.sh` structural checks.
- Full-history secrets gate still passes locally (17/17).
