---
last-reviewed: 2026-10-24
status: active
---

# Public-flip readiness

Prepared 2026-09-22. Rewritten 2026-10-24 from the read-only audit in
`QUILL-AUDIT.md` (part 2). This file is the checked-in ledger of what must be
true before this repository's visibility changes. The decision must not depend
on memory of a chat.

## Verdict

**NO-GO. One blocker remains, and it is not in this repository's branches.**

The history rewrite executed on **2026-10-16** and it worked: `origin/main`,
every remote branch and every tag are free of `.secrets/`. What blocks the flip
is what GitHub keeps outside those namespaces — **20 `refs/pull/*/head` refs
still carry commit `d3526781`**, the commit that added the age private key.

## 1. The rewrite is executed — verified 2026-10-24

| Check | Command | Result |
|---|---|---|
| `main` is clean | `git ls-tree -r origin/main -- .secrets/` | 0 entries |
| every remote branch is clean | `git ls-tree -r <ref> -- .secrets/` over all 71 `origin/*` refs | 0 entries |
| every tag is clean | same, over all 3 tags | 0 entries |
| the leaked commit is not an ancestor of `main` | `git merge-base --is-ancestor d3526781 origin/main` | no |
| no local branch holds the old history | `git for-each-ref --contains d3526781` (temporary verification refs excluded) | 0 refs |

The 2026-09-22 list named three things to delete before any push:
`refs/heads/wip/atlas-backup-20261014`, `refs/heads/reverb256-prod-revenue-gap-map`
and `refs/copilot/checkpoints/*`. **All three are gone** from the working clone.

## 2. The remaining blocker: 20 pull-request refs

GitHub keeps every pull-request head under `refs/pull/N/head`. A branch delete
and a force-push do not touch them.

```
git ls-remote origin 'refs/pull/*/head' | wc -l         → 487 refs
20 of them contain d3526781                             → committed 2026-05-17
16 of those 20 carry .secrets/ in their tip tree        → 4 files each
```

The 20: **#153 #155 #156 #157 #161 #163 #164 #166 #167 #170 #183 #217 #218 #221
#222 #223 #553 #555 #561 #643**.

The first sixteen still carry the files in the tip tree. The last four
(#553, #555, #561, #643) have `.secrets/` removed in the tip tree but keep the
commit in their history — and that is enough. Verified on #153:

```
git rev-list --objects refs/pull/153/head | grep d2a0603    → 1 hit
git log refs/pull/153/head -- .secrets/keygen-output.txt
  ba9eb299 2026-05-17 chore: remove accidental keygen output file
  d3526781 2026-05-17 feat: zero-knowledge JIT secret vault with age encryption
```

A single `git fetch origin refs/pull/153/head` therefore delivers the key file.
A ref is reachable when its history is reachable, not only when its tip adds a
file.

### What is exposed (fingerprints only)

| File at `d3526781` | blob | SHA-256 of blob | size |
|---|---|---|---|
| `.secrets/keygen-output.txt` | `d2a060333d4f12a41f121a9f4cf110b825126713` | `274966df60fa855b8c293bc0e09ae216029273a50c38d17578af422580c9a579` | 264 B |
| `.secrets/vault.age.pub` | `28b4ee18175080668c4e72437a440434d7cd44a9` | `f386a2e3ad80de814780a322ce51a25e45f69442166ec08f984054a7292e3747` | 189 B |
| `.secrets/vault.age` | `384f549cd81aec8f388b1a0ff81aa5be8966a176` | `e7d7c8cb4dea66979306c7d7ce40a7fa2bbf0007837f5e798e6897fd7958967c` | 612 B |

Mitigating and still true: both age keys belong to an abandoned subsystem, and
neither is a current sops recipient (`cluster_age`, `zephyr_age_v2`,
`yubikey_nano`).

### Remediation

1. Ask GitHub Support to purge those 20 PR refs **and** the cached PR views.
   The branch refs are already gone; only the PR namespace remains.
2. If Support refuses, delete and recreate the repository. That costs all issue
   and PR history.
3. Verify, and do not accept a verbal confirmation:

```
git fetch origin refs/pull/153/head
git ls-tree -r FETCH_HEAD .secrets/                 # must print nothing
git rev-list --objects FETCH_HEAD | grep d2a0603    # must print nothing
```

Do not flip visibility while either command prints output.

## 3. Credential rotations still open

Rotation, not deletion, makes the 2026-10-14 WIP-backup leak harmless. Three
issues track it:

| Issue | Credential | State |
|---|---|---|
| **#1070** | live Stripe key, JWT secret, GitHub OAuth secret from `wip/atlas-backup-20261014` | JWT secret rotated 2026-10-24; Stripe live keys rotated 2026-10-24; both recorded on the issue with no values |
| **#1043** | CI `JWT_SECRET` that was a literal in `live-data-check.yml` | rotated with the runtime secret on 2026-10-24 |
| **#1083** | internal runtime secrets | open |

## 4. Decisions still owed

| Item | Issue | Why it blocks a public flip |
|---|---|---|
| Licensing | **#1044** | Root `LICENSE` is AGPL-3.0, `LICENSE.md` says `status: audit-required`, and the packages disagree (MIT / Apache-2.0 / AGPL). The OGL-Canada attribution statement needs one settled story to live in. |
| Dependabot advisories | **#1047** | 32 open advisories, 13 high. Triage them or record an accepted-risk decision in writing. |

## 5. Non-blocking, shipped alongside this rewrite

- `SECURITY.md` report target: the retired `reverb256` namespace → the
  canonical repository, plus a `security@` mailbox.
- Private-network addresses and private-DNS hostnames in the 24 tracked files the
  audit listed: non-deployable docs and scripts are scrubbed; manifests the
  cluster deploys from keep their values, and the fix report lists them.
- The two GitHub Pages workflows fail while the repository is private
  (`gh api repos/maplespike/quill/pages` → 404). Re-verify them after the flip,
  not before.

## 6. Confirmed clean at the last full sweep

- `gitleaks git --log-opts=--all`: 3 842 commits, 22 findings, all reviewed. The
  two real ones are the age keys in §2. The enforced-scope scan
  (`--glob=refs/remotes/origin/* HEAD`, the CI gate) finds 11 and **no age
  keys** — the rewrite cleaned every pushed branch and `main`.
- `secrets/` holds encrypted files only (4/4 tracked YAML carry a `sops:` block).
- Tracked `.env*` files are examples, not values.
- No tracked file exceeds 1 MiB.

## 7. Post-flip actions

1. Enable **secret scanning** and **push protection** (free on public repos).
2. Re-run the two Pages workflows and confirm they pass.
3. Confirm `git ls-remote origin` shows only HEAD and branch refs.
4. Keep `scripts/sops-sync-k8s.sh --check` green — a public repository whose
   secret drift check fails is a credibility problem, not just a bug.

## 8. Open, non-blocking

- The drift-check timer is installed but **refuses to enable on nexus** until an
  age key that decrypts `secrets/runtime.yaml` is present there. It is read-only
  by design, so it cannot corrupt live secrets.
- `npm_and_yarn` `bigint-buffer` remains open with **no upstream fix available** —
  accepted and guarded per ADR 0009 (`scripts/check-no-native-bindings.sh` fails
  CI if the native binding appears or the package becomes buildable).
- Stripe: `STRIPE_ENV=live`, both keys in sops, one webhook endpoint. The live
  keys were rotated 2026-10-24; the previously supplied expiring key should be
  revoked in the dashboard.

## 9. Go / no-go

Flip when, and only when:

1. `git ls-tree -r FETCH_HEAD .secrets/` prints nothing for **all 20** PR refs in
   §2, and the cached PR views are purged.
2. #1070, #1043 and #1083 are closed by rotation, not deletion.
3. #1044 has one licensing story and a `NOTICE` carrying the OGL-Canada
   attribution.
4. #1047 is triaged, or an accepted-risk note is filed.

Nothing else on this page blocks the flip.
