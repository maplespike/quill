# 0003 — MapleSpike repo visibility

**Status:** PARTIALLY-SHIP (2026-07-01)
**Date:** 2026-07-01
**Owner:** j_kro
**Affected:** github.com/reverb256/quill (currently private; URL returns 404 to web visitors as of 2026-07-01)
**Driver:** the portfolio (`reverb256.github.io`) and the personal profile (`reverb256`) currently surface a link to `https://github.com/reverb256/quill`; that URL is 404 today.

## Status of the 4-step plan

| Step | Status | Evidence (2026-07-01) |
|---|---|---|
| **1 — One-time scrub** | ✅ DONE — CLEAN | `maplespike/scripts/security-audit.sh` ran against `/home/j_kro/Projects/maplespike` (working tree + full git history). Exit code **0**. Report: `maplespike/docs/security-audit-pre-public.md`. |
| ↳ Phase 1 (dangerous filenames) | one hit | `.envrc` flagged. Contents: a single line `use devenv` (Nix-style direnv directive, no literal credentials). **Reviewed 2026-07-01: benign.** |
| ↳ Phases 2 + 3 (secret-shaped content) | clean | No PEM keys, no AWS/GitHub/OpenAI/Stripe/Slack tokens, no `QUILL_PII_HASH_SECRET`, no AKASH_* mnemonics in working tree OR across all git branches. |
| **2 — No history rewrites** | ✅ N/A (constraint) | History unchanged. The scrub caught nothing in the past; nothing to clean. |
| **3 — Revert fallback wording in surface files** | ⏸ PENDING user action | Conditional on a real `gh repo edit --visibility public`. The org-fallback wording in `reverb256/README.md` line ~21 and the `repo: null` on the MapleSpike card in `astro-portfolio/src/pages/index.astro` line ~37 still in place. |
| **4 — CI guard** | ✅ DONE | `reverb256.github.io/astro-portfolio/scripts/audit-cluster-data.sh` + `.github/workflows/audit-cluster-data.yml` shipped earlier in this thread and proven on real inputs (caught the `F_OVERRIDE` bug, correctly identified `leases: 0` and `status: 'Active'` injections). |

## What the user has to do

1. Use GitHub web UI or `gh repo edit --visibility public --repo reverb256/maplespike` (with a token that has admin access) to flip the repo to public.
2. After the flip succeeds, revert the two surface-file fallbacks to direct URLs.
3. Promote this decision's Status from `PARTIALLY-SHIP` to `SHIPPED`.

## Context

- `git -C /home/j_kro/Projects/maplespike remote -v` shows `origin = git@github.com:reverb256/maplespike.git` — the repo exists and is push-able.
- `curl -I https://github.com/reverb256/quill` returns **404**. Two plausible reasons: (a) repo is private; (b) repo doesn't exist yet on GitHub even though the local clone has the URL configured. Either is fixable, but the fix differs.
- Both `reverb256/README.md` line ~21 and `astro-portfolio/src/pages/index.astro` line ~37 currently fall back to the org page (`https://github.com/reverb256`) — they don't lie, but they also don't link directly.

## Decision

Flip the repo to **public**, with these guardrails:

1. **One-time scrub before going public.** Search the working tree (and especially commit history) for `.env*`, `*.pem`, `*.key`, `*.p12`, `id_rsa*`, `id_ed25519*`, `*.kubeconfig`, any literal `QUILL_PII_HASH_SECRET`, any literal `AKASH_*` mnemonic or SEED value, and any other credential material that may have landed there during development. Use `gitleaks` if available; otherwise `git log --all -p | grep` targeted patterns.
2. **Don't rewrite history** unless gitleaks finds something. If it does, prefer **delete-repo-and-repush** over BFG history rewrites — the history is messy enough that BFG won't simplify it.
3. **Bump the README + portfolio card** from the org-fallback wording to direct repo links. Specifically, revert:
   - The `https://github.com/reverb256` placeholder in `reverb256/README.md` line ~21 → `https://github.com/reverb256/quill`.
   - The `repo: null` fallback on the MapleSpike card in `astro-portfolio/src/pages/index.astro` line ~37 → `repo: "maplespike"` (re-pointing at the now-public direct URL).
4. **Add a CI guard** so future refreshes that aren't TODO-marked get caught early. Implemented by `astro-portfolio/scripts/audit-cluster-data.sh` + `.github/workflows/audit-cluster-data.yml`.

## Consequences

- ✅ Public surface can link directly to specific commits / files / lines.
- ✅ External contributors can fork, file issues, submit PRs.
- ⚠️ All commit history becomes visible — DO scrub step 1 before flipping.
- ⚠️ Two current anti-patterns (`leases: 0`, status fields) become more load-bearing once public — the CI guard from step 4 is now a hard requirement, not a nice-to-have.

## References

- `reverb256/README.md` line ~21 — placeholder wording today
- `reverb256.github.io/astro-portfolio/src/pages/index.astro` line ~37 — MapleSpike portfolio card
- `astro-portfolio/scripts/refresh-cluster-data.sh` — verified on 2026-07-01: 78 cores, 124GB RAM, 37 pods, k3s v1.36.1+k3s1
- `astro-portfolio/scripts/audit-cluster-data.sh` — this decision's CI guard (new)
- `astro-portfolio/.github/workflows/audit-cluster-data.yml` — CI wiring (new)
- `infrastructure-data.ts` — current stats block (timestamped 2026-07-01)
