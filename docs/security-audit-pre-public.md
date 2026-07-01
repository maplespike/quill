# Pre-public security audit

- **Run:** 2026-07-01T06:10:17Z
- **Repo:** maplespike (working tree: \/home/j_kro/Projects/maplespike)
- **Scope:** working tree + full git history
- **Decision driver:** maplespike/docs/decisions/0003-maplespike-public-visibility.md

## Phase 1 — Dangerous filenames (working tree)

Pattern: `.env`, `.pem`, `.key`, `.p12`, `.kubeconfig`, `.netrc`, `id_rsa`, `id_ed25519`, `id_dsa`, `id_ecdsa`.

### ⚠ Hits (1):

```
.envrc
```


## Phase 2 — Secret-shaped content (working tree)

Patterns: PEM private keys, AWS access keys (`AKIA…`/`ASIA…`), aws_secret_access_key, GitHub PATs (`ghp_…`/`gho_…`/`github_pat_…`), OpenAI/Stripe/Slack tokens, MAPLESPIKE_PII_HASH_SECRET literal, AKASH_MNEMONIC/SEED/PASSWORD/KEY/OPERATOR_ADDRESS/CHAIN_ID literals.

(none)

## Phase 3 — Secret-shaped content (full git history)

Runs the same secret regex against every commit on every branch.

(none)

---

## Verdict: HITS

Findings detected across 1 phase(s). DO NOT flip the repo to public until these are resolved.
