# Pre-public security audit

> ## ⚠️ CORRECTION (2026-10-09) — the "full history" result below is WRONG
>
> This run concluded "Phase 3 — full git history: **none**" and blocked the flip
> on a single benign `.envrc` filename. That conclusion was a **false negative**.
>
> This audit's pattern set did not include age key material. Six weeks later,
> `gitleaks` over the same history found **two age private keys** committed at
> `.secrets/keygen-output.txt` and `.secrets/vault.age.pub` (`d3526781`,
> 2026-05-17) — see `SECRETS-AUDIT-2026-09-16.md`. A regex sweep whose patterns
> miss a whole key class will always report a clean history; the "none" here
> says nothing about the repo.
>
> Also superseded: the block-everything verdict. A default-rules scan on
> 2026-10-09 finds **17 findings**, and the credential that looked most
> dangerous decrypts to `FIXME` placeholders (verified by decryption — see the
> #854 thread). This count is scope-dependent by construction: an earlier note
> in this file said 20, because that run scanned a clone holding three stale
> `origin/wt/*` refs (branches already deleted upstream). The enforced scope is
> the origin remote's refs plus HEAD, so 17 is the number that CI acts on; see
> the header of the baseline for why the scope is pinned rather than `--all`.
>
> **The living authority is now executable, not a report:**
> `scripts/check-secrets-history.sh` enforces
> `docs/secrets-history-baseline.txt` over the origin refs plus HEAD on every CI
> run. Treat this document as a dated snapshot of a superseded method.

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

Patterns: PEM private keys, AWS access keys (`AKIA…`/`ASIA…`), aws_secret_access_key, GitHub PATs (`ghp_…`/`gho_…`/`github_pat_…`), OpenAI/Stripe/Slack tokens, QUILL_PII_HASH_SECRET literal, AKASH_MNEMONIC/SEED/PASSWORD/KEY/OPERATOR_ADDRESS/CHAIN_ID literals.

(none)

## Phase 3 — Secret-shaped content (full git history)

Runs the same secret regex against every commit on every branch.

(none)

---

## Verdict: HITS

Findings detected across 1 phase(s). DO NOT flip the repo to public until these are resolved.

> **This verdict is superseded — see the correction at the top of this file.**
> Its `HITS` came from the `.envrc` filename heuristic, while its history phase,
> which was supposed to be the real check, produced a false negative.
