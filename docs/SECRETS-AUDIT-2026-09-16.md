# Secrets Audit — 2026-09-16 (gitleaks full history)

> ## ⚠️ PARTIALLY SUPERSEDED (2026-10-09)
>
> Read this together with `secrets-history-baseline.txt` and `#1043`.
>
> 1. **Scope has drifted.** This scan covered 1,017 commits / ~51 MB. The repo
>    is now 2,579 commits / 104 MB, and a default-rules scan without the
>    allow-list returns **144** findings (**20** survive `.gitleaks.toml`).
>    "73 false positives + 2 real" no longer describes the tree.
> 2. **The conclusion "exactly two real findings" is incomplete.** A real
>    preview OAuth client secret (`site/src/lib/auth/preview.ts`, deleted at
>    HEAD but live in history) and a literal CI `JWT_SECRET` across ~8 commits
>    were never listed. Tracked in #1043.
> 3. **§1 finding #2 is now resolved by decryption, not by inference.** The
>    leaked key does open one vault version (blob `384f549c`), and its plaintext
>    is **entirely `FIXME` placeholders** — so the checklist item "confirm no
>    still-valid credential was vaulted" is **confirmed clean**. No leaked key
>    opens `secrets/github-pat.age` at HEAD. See the #854 thread.
>    **Update 2026-10-28:** `secrets/github-pat.age` has been retired and
>    deleted from the tree.
> 4. **The enforcement moved out of this document.**
>    `scripts/check-secrets-history.sh` + `docs/secrets-history-baseline.txt`
>    now fail CI on any full-history finding that is not enumerated, in either
>    direction. A report cannot gate a repo; this file is history.

**Scope:** 1,017 commits, ~51.4 MB scanned. Tool: gitleaks v8 (`gitleaks detect --source . --redact`).

**Verdict: ⛔ PUBLIC FLIP BLOCKED** pending remediation of exactly **two real findings** (§1). Everything else is false positives (§3).

## 1. Real findings — BLOCKERS

Both are age **private** keys committed on **2026-05-17** during the ephemeral JIT secret-vault work (#44/#86), then deleted same-day in `a1cabade` — but deletion does not remove them from history.

| # | Finding | Commit(s) | File | Evidence |
|---|---|---|---|---|
| 1 | age private key | `d3526781` | `.secrets/keygen-output.txt` | Full `AGE-SECRET-KEY-1M8C23AG…` in plaintext (keygen stdout pasted into the repo) |
| 2 | age private key **+ encrypted vault binary** | `d3526781`, `a1cabade` | `.secrets/vault.age`, `.secrets/vault.age.pub` | `vault.age.pub` contained the private key in its header comment; worse, `vault.age` (612 B binary) itself is in history — anyone holding the leaked key can decrypt the vault plaintext straight from git |

**Mitigating context (does not unblock the flip):**
- Both keys belong to a dead, ephemeral subsystem (the JIT vault was abandoned days later; "zephyr generates its own").
- Neither key is a current sops recipient (`.sops.yaml` recipients: `age1fwmxs…`, `age1p98yp…`).
- The nexus-prod sops key was rotated on 2026-08-15 after the old one was lost (documented in `.sops.yaml`).
- The vault was short-lived; likely contents were ephemeral dev credentials — **still verify** no still-valid credential was vaulted that day (checklist).

## 2. Remediation checklist → tracked in #854

- [ ] **History rewrite**: `git filter-repo --path .secrets --invert-paths` + `--replace-text` for both `AGE-SECRET-KEY-…` strings. Coordinate force-push with open PRs (#826) — merge or close them first.
- [ ] Confirm nothing still-valid was vaulted on 2026-05-17 (operator memory / old vault plaintext if recoverable).
- [ ] Add a **gitleaks CI gate** to `.github/workflows/ci.yml` (companion to #851's pnpm-audit gate).
- [ ] Add `.gitleaksignore` entries for the false positives below so the gate stays green.
- [ ] Hygiene: drop `packages/pipeline-core/maplespike.sqlite` from the tree; ensure `.secrets/` is in `.gitignore` forever.
- [ ] Re-run `gitleaks detect` → **0 real findings** → flip the repo public.

## 3. False positives (73 findings — verified, not leaks)

| Rule | Count | Where | Why FP |
|---|---|---|---|
| `curl-auth-header` | 52 | `docs/journalist-quickstart.md`, `packages/docs/**`, `dev-server.ts`, `DEPLOYMENT.md` | `Authorization: Bearer REDACTED` / `<token>` placeholders in docs and dev-server examples |
| `generic-api-key` | 20 | `routes/billing.ts`, `workspace.astro`, markdown docs | Test fixtures (`storedKey || "REDACTED"`), config schemas, placeholder strings |
| `stripe-access-token` | 1 | `__tests__/stripe-billing.test.ts` @ `5d141653` | Test fixture, `REDACTED` placeholder |
| `age-secret-key` | (counted in §1) | `.secrets/` | — |

Also observed during path triage (non-secret hygiene, folded into #854): a dev sqlite database (`packages/pipeline-core/maplespike.sqlite`) was committed early in the repo's life; `.env.example`/`.envrc` and `secrets/*.example` templates are fine.

## 4. Method notes

- gitleaks only scans diffs/contents it can parse; `vault.age` flagged via its armor header. Treat any binary ever committed under `secrets/` as exposed if its key class leaked.
- Sensitive paths ever present in history: `.secrets/**`, `secrets/billing.yaml` (sops-encrypted — safe *iff* recipients uncompromised; the 2026-08-15 rotation holds), `secrets/github-pat.age` (retired and deleted 2026-10-28), `packages/pipeline-core/maplespike.sqlite`.
- Raw report retained at `/tmp/quill-gitleaks.json` (machine-readable); not committed to the repo.
