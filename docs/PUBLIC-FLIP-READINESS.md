---
last-reviewed: 2026-09-22
status: active
---

# Public-flip readiness

Prepared 2026-09-22. This is the checked-in ledger of what must be true before
this repository's visibility changes. It exists so the decision does not depend
on anyone's memory of a chat.

## Verdict

**One blocker, and it is historical.** Everything else is ready.

## 1. The blocker: two age private keys in history

Committed 2026-05-17 during the ephemeral JIT secret-vault work (`d3526781`),
deleted the same day (`a1cabade`) — but deletion does not remove history. Both
commits are ancestors of `main` **and reachable from tag `v0.3.0`**.

| Finding | File (in history) | Commit |
|---|---|---|
| age private key, plaintext | `.secrets/keygen-output.txt` | `d3526781` |
| age private key in a pubkey header + the encrypted vault | `.secrets/vault.age(.pub)` | `d3526781`, `a1cabade` |

Mitigating, and verified: both keys belong to an abandoned subsystem, and
**neither is a current sops recipient** (`cluster_age`, `zephyr_age_v2`,
`yubikey_nano`). The **current tree is clean** — `docs/SECRETS-AUDIT-2026-09-16.md`
carries only a 6-character prefix, not a usable key.

**Remediation** (approved in principle; not yet executed):
`git filter-repo --path .secrets --invert-paths --replace-text <captured strings>`,
then force-push **including tags**. The exact leaked strings are captured locally
at `~/.cache/quill-flip-redactions.txt` (mode 600) so they never need to be
echoed again.

**Trap**: force-push does not purge everything. GitHub retains stale
`refs/pull/N/head` from old PRs, so pre-rewrite commits can stay fetchable.
After the rewrite, verify with `git ls-remote origin`; if the old commits are
still reachable, deleting and recreating the repository is the only clean fix
(which costs the 30 issues and all PR history).

## 2. Confirmed clean

- `sk_live_` and `whsec_` at real key length: **0 hits** in the full history.
  Credentials that were pasted into a chat were never committed.
- No PEM private keys, GitHub PATs, or AWS credentials anywhere in history.
- `.secrets/` is gitignored; nothing under it is tracked.
- A gitleaks gate already runs in CI with a `.gitleaksignore` baseline.
- Committed `.env.example`, `.envrc`, `.npmrc` contain templates, not values.

## 3. Known red CI, and why

**The two GitHub Pages workflows fail and cannot pass while the repo is
private.** `gh api repos/reverb256/quill/pages` returns 404 and `has_pages` is
false: Pages is not enabled, and private-repository Pages requires a paid plan.
These runs will be re-verified *after* the visibility change, not before.

Everything else is green or queued: `pnpm build`, the api and MCP suites, the
portal suite (28 specs), README Lint. CI verdicts lag because the runner queue is
deep — Dependabot opened update PRs that consume it.

## 4. Sequencing constraint

Eight pull requests are open. A history rewrite invalidates them, so they must be
landed (if CI-green) or closed first. `#896` is itself the gitleaks-baseline fix.

## 5. Post-flip actions

1. Enable **secret scanning** and **push protection** (free on public repos).
2. Re-run the two Pages workflows and confirm they pass.
3. Confirm `git ls-remote origin` shows only HEAD and branch refs.
4. Keep `scripts/sops-sync-k8s.sh --check` green — a public repo whose secret
   drift check is failing is a credibility problem, not just a bug.

## 6. Open, non-blocking

- The drift-check timer is installed but **refuses to enable on nexus** until an
  age key that decrypts `secrets/runtime.yaml` is present there. Read-only by
  design, so it cannot corrupt live secrets.
- `npm_and_yarn` `bigint-buffer` remains open with **no upstream fix available** — accepted and guarded per ADR 0009 (`scripts/check-no-native-bindings.sh` fails CI if the native binding ever appears or the package becomes buildable).
- Stripe: `STRIPE_ENV=live`, both keys in sops, one webhook endpoint. The
  previously supplied expiring key should be revoked in the dashboard.
