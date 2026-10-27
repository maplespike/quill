# Credits and Attribution

Quill (MapleSpike) is a pnpm monorepo that collects and presents public data. This file is a provenance index. It is not a complete third-party dependency notice, a source-data permission grant, or legal advice. The current machine-generated findings are produced by [`scripts/audit-open-source.mjs`](./scripts/audit-open-source.mjs); see [`docs/open-source-audit.md`](./docs/open-source-audit.md) for scope, commands, and known conflicts.

**Software-licence resolution (2026-10-24).** Quill's own code is `AGPL-3.0-only`
([`LICENSE.md`](./LICENSE.md), [`NOTICE`](./NOTICE), issue
[#1044](https://github.com/maplespike/quill/issues/1044)). The conflict notes below
record what the audit observed before that decision. They remain relevant for
third-party material, which keeps its own licence.

## How license claims in this file were verified

Every license named below was read from the credited project's own `LICENSE` file at the revision cited, not from GitHub API metadata and not from the project's package manifest. This distinction matters: the API reports a `spdx_id` and a `license.template_name` that come from GitHub's own classifier, which is frequently wrong, and a manifest `license` field is a self-declaration that may disagree with the text actually shipped. Where this file says a license was "verified", the `LICENSE` file at the cited revision was fetched and read.

Three cases are deliberately **not** verified, and are marked as such in the table rather than being given a best guess: `Frostbite-Gazette` (private repository, contents and license not accessible), and any package whose manifest and `LICENSE` text disagree — see [`docs/open-source-audit.md`](./docs/open-source-audit.md) for the observed conflicts.

Software-license facts for Quill's own packages are produced by [`scripts/audit-open-source.mjs`](./scripts/audit-open-source.mjs) and image-level facts by `scripts/generate-sbom.sh` (Syft/SPDX). Those tools report what a file, manifest, or built image states; they do not decide which statement is legally operative.

## Project and related repositories

| Project | Relationship and evidence |
|---------|---------------------------|
| [reverb256/mcp-canada](https://github.com/reverb256/mcp-canada) | Acknowledged predecessor and architectural reference for Canadian government MCP tools. **Whole-repository comparison completed 2026-10-02** at commit `f2deb2285ebeb4868a278d1d9189add038afa27d` (MIT, © 2026 Reyem Tech): 111 files / 35,417 Python tokens against Quill's 1,371 files / 432,457 TypeScript tokens. Longest shared token run across all pairs: **8 tokens**; highest coverage of any predecessor file: **0.44%** — at or below Quill's own intra-repo noise floor. No substantial literal copying established at this revision. Method and limitations in [`docs/open-source-audit.md`](./docs/open-source-audit.md) and [`scripts/compare-provenance.py`](./scripts/compare-provenance.py). |
| [reverb256/Frostbite-Gazette](https://github.com/reverb256/Frostbite-Gazette) | Related downstream consumer. The repository is private and its license and source contents were not independently audited. Do not copy its code absent permission. |
| reverb256/ai-inference-gateway | Related service integration. No evidence in this pass establishes source-code reuse. |
| reverb256/astral-key | Related authentication service integration. No evidence in this pass establishes source-code reuse. |

### Direct provenance observations

- Quill explicitly identifies `mcp-canada` as a precursor. That is a provenance lead, not proof that Quill contains no copied code.
- A whole-repository comparison was run on 2026-10-02 (superseding the earlier three-file manual sample). See `docs/open-source-audit.md` for the measured result, the exact method, and the limitations that remain — chiefly that it covers one predecessor revision rather than full history, and that token fingerprinting would not register a semantic reimplementation.
- Several algorithms and structures (HTTP retries, rate limiting, CKAN API calls, StatCan endpoints, response normalization) are common or required by shared public APIs. Similar function names or behavior alone do not prove copying.
- The checked-in [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) says it adapts Contributor Covenant v2.1 and is inspired by Mozilla's enforcement ladder. It attributes those sources in the document. The Covenant is licensed CC BY-SA 4.0; check its share-alike and attribution requirements with counsel before redistributing modified text. The attribution link resolves `mozilla/diversity`, which now **redirects to [`mozilla/inclusion`](https://github.com/mozilla/inclusion)**; that repository is **MPL-2.0** and is where the `Consequence Ladder` and `Mozilla Community Participation Guidelines` documents live. **The link has been updated (2026-10-01).** Which specific historical revision of that material was adopted is still unverified, and MPL-2.0's file-level copyleft scope over adapted text is a counsel question, not a settled fact.

### Bounded attribution sweep (2026-09-30)

A repository-wide text search was run for explicit attribution, `SPDX-FileCopyrightText`, "adapted from / copied from / forked from / inspired by / vendored from / upstream", and generated-file markers, excluding build output, `node_modules`, and the three known stale snapshot directories. This is a **bounded keyword sweep**, not a whole-repository similarity or history analysis.

| Item | Observed statement | Provenance assessment |
|---|---|---|
| [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) | Attributes Contributor Covenant v2.1 and Mozilla's enforcement ladder | **Updated 2026-10-01.** The link pointed at `mozilla/diversity`, which redirects to `mozilla/inclusion` (MPL-2.0). Link retargeted, the MPL-2.0 licence named, a direct deep link to `consequence-ladder.md` added, and the rename recorded so the redirect is not mistaken for a broken link later |
| `.agents/skills/review-animations/{SKILL.md,STANDARDS.md}` | "The substantive bar comes from Emil Kowalski's animation philosophy (animations.dev)" | **Resolved 2026-10-01: this is derivative reuse, not consultation.** A line-by-line comparison against `emilkowalski/skills` `skills/review-animations/` found 73/79 (SKILL.md) and 134/136 (STANDARDS.md) non-blank lines identical. Upstream is MIT, © 2026 Emil Kowalski. The MIT notice has been added at `.agents/skills/review-animations/LICENSE` with the full text, the source URL, the access date, and an itemised list of local modifications. Upstream carries no per-skill licence header, so the root `LICENSE` governs |
| `ops/install-k3s-forge.sh` | "copied from nexus, never regenerated" | Internal first-party operational provenance; no third-party claim |
| `packages/pipeline-core/src/cli/run-pipeline.ts` | Header comment describes why the module was split out | First-party design rationale, not attribution |
| Generated files | `packages/portal/src/data/*.json`, `packages/portal/{v1,public/v1}/openapi.json`, `packages/portal/public/{llms.txt,llms-full.txt,agents.json}`, `docs/metrics.json`, `llms-full.txt` | Produced by in-repo generators (`scripts/generate-*.mjs`, `scripts/build-docs.mjs`, `doc-generator/`). Regenerate rather than hand-edit; a stale generated copy can silently carry outdated claims. The orphaned HTML snapshots that used to demonstrate this (`packages/portal/docs/`, `packages/portal/docs-vitepress/`, `packages/docs/**/*.html`) were deleted on 2026-10-01 — they were served nowhere and no script regenerated them |

No file outside the list above carried a third-party attribution statement. This sweep does not cover file history, deleted content, notebooks, issue/PR text, or code-agent output, and it cannot rule out unattributed reuse.

## Technology credits

Quill uses TypeScript, Node.js, pnpm, Turborepo, Astro, React, Tailwind CSS, Hono, better-sqlite3, Drizzle ORM, Stripe libraries, viem, tweetnacl, jose, pino, Qdrant, Kubernetes/K3s, Nix/nixpkgs, Podman/Docker-compatible OCI tooling, Helm, and ArgoCD. This list is illustrative, not exhaustive. Versions and license expressions change with the lockfiles and deployment inputs. Do not rely on this summary instead of the generated dependency inventory or the upstream license and notice files.

## Research and product credit

- **Product vision owner:** reverb256 (MapleSpike).
- **Research and development assistance:** autonomous research agents and AI coding tools, including Hermes Agent / Nous Research and other assistant systems, contributed to planning, analysis, and implementation. These tools are not code licensors and their involvement does not establish the provenance or ownership of any particular output. See [`docs/VISION.md`](./docs/VISION.md) for historical research attribution.

## Quill software license declarations

The repository currently contains more than one license signal: root [`LICENSE`](./LICENSE) is AGPL-3.0; package manifests, package-local license texts, and source-file SPDX headers are not all consistent.

Observed per package on 2026-09-30. "File-level SPDX" counts `SPDX-License-Identifier` tags in that package's own source tree and is an inventory of *what the files say*, not a determination of what they are.

| Package directory | Manifest `license` | Package-local LICENSE text | File-level SPDX (observed) | Status |
|---|---|---|---|---|
| `packages/api-server` | Apache-2.0 | Apache-2.0 | Apache-2.0 ×28, AGPL-3.0-or-later ×2 | **Conflict**: file tags disagree with the package declaration |
| `packages/portal` | MIT | Apache-2.0 | MIT ×1 | **Conflict**: manifest and adjacent license text disagree |
| `packages/quill-mcp` | Apache-2.0 | Apache-2.0 | AGPL-3.0-or-later ×95, MIT ×28, Apache-2.0 ×8 | **Conflict**: package declaration does not describe most of its own files |
| `packages/pipeline-core` | AGPL-3.0-or-later | AGPL-3.0 text | AGPL-3.0-or-later ×651, MIT ×8 | **Mixed**: MIT-tagged files inside an AGPL-declared package; origin and scope unreviewed |
| `packages/engine` | AGPL-3.0-or-later | AGPL-3.0 text | AGPL-3.0-or-later ×2 | Consistent |
| `packages/docs` | Apache-2.0 | Apache-2.0 | none | Consistent; private workspace package |
| `packages/create-module` | MIT | absent | MIT ×10 | Manifest only; no adjacent license text |
| `packages/sdk` | MIT | absent | MIT ×1 | Manifest only; published `dist` should carry the notice |
| `packages/legal-core` | MIT | absent | MIT ×1 | Manifest only; published `dist` should carry the notice |
| `packages/legislation` | MIT | absent | MIT ×1 | Manifest only |
| `packages/i18n` | MIT | absent | none | Manifest only |
| `packages/database` | **absent** | absent | none | **No license metadata at all**, and a runtime workspace dependency of other packages |
| `packages/notification-service` | **absent** | absent | none | **No license metadata at all** |
| `packages/edge-worker`, `packages/ingestion`, `packages/sdk-python`, `packages/sdk-shell` | no `package.json` | sdk-python has a LICENSE text | n/a | Not independently licensed packages; confirm intended treatment before distribution |

A missing `license` field is **absent metadata, not an implicit grant and not an implicit prohibition**. A package-local LICENSE file that disagrees with its manifest is an unresolved conflict, not a case where the manifest wins by default. None of this table is a rights-holder decision; it records what the repository currently says.

Until the rights holder resolves these discrepancies, **do not treat a package manifest, root license, source header, or this credits file alone as a definitive license grant for every file or combined OCI image**. Do not change or redistribute a disputed combination on the assumption that AGPL automatically applies to all related files or that package metadata overrides file notices. See [`LICENSE.md`](./LICENSE.md) and the detailed [open-source audit](./docs/open-source-audit.md).

## Public data is separate from software

A software license does not license upstream datasets. A dataset being publicly accessible or hosted on an open-data portal does not by itself establish permission for commercial reuse, redistribution, scraping, or derivative databases. Each source's actual terms, rights holder, relevant version/date, attribution text, restrictions, and data fields must be reviewed independently. Quill's current `data-source-licenses.json` is a source-family inventory recording that Quill makes no independent reuse grant. Its registry URLs are review leads, not dataset-level clearance. See [`docs/licensing-audit.md`](./docs/licensing-audit.md).
