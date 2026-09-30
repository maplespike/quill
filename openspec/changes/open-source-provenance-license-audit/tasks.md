## 1. License facts and reconciliation

- [x] 1.1 Inventory all workspace package manifests, license files, Python metadata, and key source SPDX declarations. — Observed 2026-09-30 across 13 package manifests, package-local license texts, `packages/sdk-python/pyproject.toml`, and per-package SPDX tag counts; recorded in `docs/open-source-audit.md` "Critical: package-license policy is internally inconsistent" and the `LICENSE.md` / `CREDITS.md` tables. Re-derivable with `node scripts/audit-open-source.mjs`.
- [x] 1.2 Update CREDITS.md package table to accurately distinguish package metadata, absent metadata, and conflicting file-level declarations. — `CREDITS.md` "Quill software license declarations" now carries a per-package table with observed file-level SPDX counts and explicit status; states that a missing `license` field is absent metadata rather than an implicit grant or prohibition.
- [x] 1.3 Update LICENSE.md summary only where claims can be tied to current repository metadata; preserve unresolved policy decisions. — `LICENSE.md` front-matter and prose re-dated to 2026-09-30; corrected the `sdk-python` row (it does have an MIT `LICENSE`, contrary to the earlier "no package-local license file found" claim); added observed file-level SPDX counts and the textual-comparison limitation. `status: audit-required` and all unresolved decisions preserved verbatim.
- [x] 1.4 Add a repository-local consistency audit that reports conflicts without making changes. — `scripts/audit-open-source.mjs` (read-only; `scripts/test-audit-open-source.mjs` asserts it does not rewrite declarations).

## 2. Third-party dependency inventory

- [x] 2.1 Implement a deterministic report generator from the committed pnpm lockfile and locally available package metadata. — `scripts/audit-open-source.mjs` via `pnpm licenses list --json`; records are sorted by name/versions/license and repeat runs are asserted byte-identical apart from the timestamp. Exposed as `pnpm audit:open-source`, `pnpm audit:open-source:prod`, `nix run .#audit-open-source`, and `.github/workflows/open-source-audit.yml`.
- [x] 2.2 Produce machine-readable output containing package/version, raw license expression, resolution/source, and metadata gaps. — JSON report (`--format json`, `--output PATH`) with `installedDependencies[]` carrying name, versions, raw license expression, author, homepage; missing metadata is preserved as missing rather than inferred. Resolution/path attribution is recorded as prose from `pnpm why` in `docs/open-source-audit.md`, not per-record — the pnpm command does not expose it.
- [x] 2.3 Document runtime/dev scope and distinguish a repository dependency report from per-artifact SBOM/NOTICE compliance. — `docs/open-source-audit.md` "Audit method and reproducibility" states the 942/654 record split, the `--prod` scope, the per-image Syft SBOM procedure, and the explicit limitation that this is not an SBOM. `dependencyInventoryScope` and `dependencyInventoryLimitation` carry the same distinction in the JSON report.
- [x] 2.4 Test generator behavior against lockfile fixtures, including missing and compound license fields. — `scripts/test-audit-open-source.mjs`: synthetic workspace fixtures with a stubbed `pnpm licenses list` covering an absent per-entry `license` field, a compound `MIT OR Apache-2.0` expression, and an unidentifiable license; asserts group-key fallback, verbatim compound preservation, deterministic ordering, and `--prod` forwarding to pnpm. 4/4 passing.

## 3. Provenance review

- [x] 3.1 Inventory explicit attribution, copied/template text, generators, and provenance comments within Quill. — Bounded keyword sweep 2026-09-30 (attribution phrases, `SPDX-FileCopyrightText`, copied/forked/inspired/vendored/upstream markers, generated-file markers) recorded as a table in `CREDITS.md` "Bounded attribution sweep", including the generator-to-output mapping and the orphaned-snapshot warning. One item names an external source without licence/version/date (`.agents/skills/review-animations/SKILL.md`, Emil Kowalski / animations.dev). Scope limit stated: no file history, deleted content, notebooks, issue/PR text, or code-agent output.
- [ ] 3.2 Compare `reverb256/mcp-canada` to relevant Quill modules using local history and available similarity tooling; record exact candidates and limitations. — Only the bounded manual sample described in `CREDITS.md` and `docs/open-source-audit.md` "Medium: provenance comparison is bounded, not exhaustive" (HTTP retry, token-bucket limiter, CKAN client at `f2deb228`). No whole-repository similarity tooling or local predecessor checkout was available; the limitation is recorded but the comparison itself is incomplete. **Blocked on obtaining a `mcp-canada` checkout plus similarity tooling.**
- [x] 3.3 Review known external text adaptations (including Code of Conduct) for accurate source/version/license attribution. — `CODE_OF_CONDUCT.md` verified 2026-09-30: it correctly attributes Contributor Covenant v2.1 (CC BY-SA 4.0 per its adoption guidance) and Mozilla's enforcement ladder. **New finding:** its `mozilla/diversity` link now redirects to `mozilla/inclusion`, which is **MPL-2.0** and holds the actual `Consequence Ladder` and `Mozilla Community Participation Guidelines` documents; the link should be updated to the canonical repository. Still open: which historical revision was adopted, and whether MPL-2.0 file-level copyleft attaches to the incorporated text. Both recorded as counsel questions, not asserted either way.
- [x] 3.4 Update CREDITS.md and docs/licensing-audit.md with observed facts and qualified conclusions. — `CREDITS.md` carries the per-package license table (1.2) and the bounded attribution sweep (3.1). `docs/licensing-audit.md` now states the observed software-license state inside its own "Software licensing is separate" section while keeping the data-source conclusions strictly separate, including an explicit statement that no software license in the repository licenses upstream data. The trailing clause of the earlier note ("covers data-source scope only; defers software-licensing conclusions to `docs/open-source-audit.md`") no longer applies. `docs/licensing-audit.md` covers data-source scope only; it still defers software-license conclusions to `docs/open-source-audit.md` rather than restating them.

## 4. Verification and decision points

- [x] 4.1 Run the new license/provenance audit and verify it reports rather than mutates license declarations. — `node scripts/audit-open-source.mjs` → 13 packages, 942 dependency records, 99 findings (8 high, 91 review); `--prod` → 654 records. Non-mutation asserted by `scripts/test-audit-open-source.mjs` (manifest still `Apache-2.0`, source file header still `AGPL-3.0-or-later`).
- [x] 4.2 Run relevant existing documentation checks and tests. — See the verification log below.
- [ ] 4.3 Present any license policy conflicts, possible substantial code overlap, missing upstream license evidence, and counsel questions for owner decision. — The conflicts and counsel questions are written up in `docs/open-source-audit.md` ("Required owner and counsel decisions before public release or a compliance claim") but have **not** been presented to and decided by the rights holder. Items requiring an owner answer: license policy per artifact, `@maplespike/database` / `@maplespike/notification-service` license metadata, portal MIT-vs-Apache conflict, pipeline-core MIT-tagged files under an AGPL package, CLA evidence, per-image SBOM release control, and deletion of the orphaned stale HTML snapshots.
- [ ] 4.4 Validate this OpenSpec change; archive only after outputs and report are reviewed. — Not run.

## Verification log

Recorded 2026-09-30. All commands from the repository root unless noted.

| Command | Result |
|---------|--------|
| `node --test scripts/test-audit-open-source.mjs` | 4/4 pass |
| `node scripts/audit-open-source.mjs` | 13 packages, 942 dependency records, 99 findings (8 high, 91 review) |
| `node scripts/audit-open-source.mjs --prod` | 654 dependency records |
| `packages/pipeline-core`: `tsc -b`, `provenance-evidence.test.ts`, `http.test.ts` | clean; 16/16 |
| `packages/api-server`: `tsc --noEmit`, `verify-claim.test.ts` | clean; 12/12 |
| `packages/quill-mcp`: `tsc -b`, `src/tools/__tests__/index.test.ts` | clean; 14/14 |
| `packages/portal`: `vitest run`, `astro check` | 28/28; `astro check` reports only the two pre-existing TS2352 casts in `src/lib/__tests__/embedded-checkout.test.ts` |
| `node scripts/generate-plans.mjs` (in `packages/portal`) | 184 tools, 17 FR entries refreshed from `fr-tools.json` |
| `node scripts/generate-llms.mjs`, `generate-agents-json.mjs`, `generate-openapi.mjs` (in `packages/portal`) | 184 tools / 29 endpoints / 21 categories; 27 agents / 79 actions; 82 endpoints / 27 agents |
| `git diff --check` | clean |

`pnpm install --prefer-offline` was required before the portal generators: the pnpm store copy of `pipeline-core/dist/claims/` was stale and broke the `quill-mcp` dist import in `generate-plans.mjs`. Without it the generator silently fell back to its 186-entry superset and produced a wrong catalog.
