# Design: Make .gitignore cover the SOPS decrypt-temp shapes (run 38617463045, #1070)

## Approach

One defensive layer at the `git add` boundary. The secrets gate already guards
the far end (it caught the leak and failed CI correctly); this change guards
the near end, where the temps get created. Ignoring the shapes means a
recurrence of the unidentified sweep commits nothing, instead of committing
plaintext and relying on the gate to catch it after a push.

### Rule choice (`.gitignore`)

The existing SOPS block:

```
# SOPS — encrypted .yaml files ARE safe to commit (that's the point).
# Only ignore decrypted/plaintext artifacts:
secrets/decrypted/
secrets/*.dec
secrets/*.plaintext
secrets/*.env
!.env.example
```

gains, inside the same block:

```
secrets/tmp*
secrets/*.tmp
.sops.yaml.tmp
.sops.yaml.tmp*
```

- `secrets/tmp*` — the `mktemp` prefix shape. `mktemp /path/secrets/tmp.XXXXXX`
  yields `tmp.<6 random>`, `mktemp ... .yaml` yields `tmp.<8 random>.yaml`,
  and the incident's third file (`tmp2zgn9_f1.yaml`) shows the random can also
  trail the prefix with no dot. A prefix rule covers all three plus future
  suffix variants, where per-name enumeration cannot.
- `secrets/*.tmp` — a decrypt pipeline that stages as `<name>.tmp` before
  writing the plaintext (`runtime.yaml.tmp`).
- `.sops.yaml.tmp` + `.sops.yaml.tmp*` — SOPS creation-rule editor temps,
  observed in the same incident commit (`.sops.yaml.tmp` was committed).
- No directory exclusion, no `**`, no extension-less catch-all: the rules stay
  inside `secrets/` except the `.sops.yaml.tmp*` top-level pair.

Adjacent hygiene from the same commit, same mechanism (untracked machine
state swept into a backup commit):

- `sbom/` — `scripts/pin-images.sh` generates SBOMs into `<repo>/sbom`
  (`SBOM_DIR` default). Generated artifacts, never source; two of them
  tripped `generic-api-key` in the incident (image digests look like tokens).
- `.worktrees/` — per-worktree branch-name bookkeeping files (~120 committed
  in the incident). Local-only agent state, like `.hermes/` and `.sisyphus/`
  already listed.

### What the rules must NOT match

SOPS-encrypted files are safe to commit by design — the whole secrets model
(`secrets/README.md`, `secrets/*.yaml` sealed via `.sops.yaml` creation rules)
depends on it. The negative cases in the test pin this:

- `secrets/runtime.yaml` (sealed), `secrets/billing.yaml` (sealed),
  `secrets/runtime.yaml.example`, `secrets/README.md` — all must remain
  trackable.
- No rule anchors on `.yaml` generally; only `tmp`-prefixed and `.tmp`/`.yaml.tmp`
  shapes inside `secrets/`.

### Tests (`scripts/test-gitignore-leak-shapes.mts`)

Drive the REAL `git check-ignore -v` against the repo's REAL `.gitignore`,
using `git check-ignore --no-index` semantics from a scratch cwd so the test
does not depend on the runner's git identity or index state:

1. **Incident paths must be ignored** — the three exact leaked temp names plus
   `.sops.yaml.tmp`. This is the regression pin: if any rule is dropped or
   edited away, this block fails with the incident citation in the message.
2. **mktemp variants must be ignored** — `secrets/tmpXXXXXX` (bare),
   `secrets/tmp.ABCDEFGH.yaml`, `secrets/tmp2zgn9_f1.yaml` (no-dot random),
   `secrets/runtime.yaml.tmp`, `secrets/mydecrypt.tmp`.
3. **Sealed/committed files must NOT be ignored** — `secrets/runtime.yaml`,
   `secrets/billing.yaml`, `secrets/README.md`,
   `secrets/runtime.yaml.example`. Over-matching here would silently make the
   SOPS model uncommittable — the exact failure mode the SOPS block's own
   comment warns about.
4. **Negative control for the harness itself** — a path the `.gitignore` does
   not cover (`docs/secrets-history-baseline.txt`): asserts check-ignore
   exits non-zero when nothing matches, proving the "must ignore" assertions
   in blocks 1–2 actually bite.

`git check-ignore` needs a git repository; the test shells `git` with
`-c core.excludesFile=` unset... actually simpler and fully hermetic: the
test runs `git check-ignore` with the repo root as cwd and passes paths
relative to it, relying on the repo's own `.gitignore`. This matches how the
repo's other harness tests work (real gate, real repo). git presence is
already a hard requirement of the same job (the conflict-marker check runs
`git grep`), so no new environment assumption.

### Security / rollout / rollback

- Security: strictly narrows what `git add -A` can pick up. No allow-list or
  gate semantics change; `.gitleaks.toml`/`.gitleaksignore` untouched, so the
  full-history gate keeps the same sensitivity (a future real secret in any
  shape still fails it).
- Rollout: single commit, no migration, no coordination. Works on every clone
  immediately on merge (fetch + checkout).
- Rollback: delete the added lines and the test. If the rules ever
  over-match a file someone needs to track, the negative-case block names the
  file and the rule to fix.
- Out of scope (tracked in #1070 / #854): credential rotation, local-branch
  cleanup on atlas, history rewrite, baseline changes. The baseline stays at
  17 entries — the leaked findings left CI's scan scope when the branch was
  deleted, so adding them would create stale entries and fail the gate in
  the opposite direction.
