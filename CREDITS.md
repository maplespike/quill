# Credits and Attribution

Quill (MapleSpike) is a pnpm monorepo that collects and presents public data. This file is a provenance index. It is not a complete third-party dependency notice, a source-data permission grant, or legal advice. The current machine-generated findings are produced by [`scripts/audit-open-source.mjs`](./scripts/audit-open-source.mjs); see [`docs/open-source-audit.md`](./docs/open-source-audit.md) for scope, commands, and known conflicts.

## Project and related repositories

| Project | Relationship and evidence |
|---------|---------------------------|
| [reverb256/mcp-canada](https://github.com/reverb256/mcp-canada) | Acknowledged predecessor and architectural reference for Canadian government MCP tools. A direct code-provenance review is in progress; no claim of verified zero-overlap is made. The public `main` tree reviewed for this audit had commit `f2deb2285ebeb4868a278d1d9189add038afa27d` (2026-06-17) and an MIT license. |
| [reverb256/Frostbite-Gazette](https://github.com/reverb256/Frostbite-Gazette) | Related downstream consumer. The repository is private and its license and source contents were not independently audited. Do not copy its code absent permission. |
| [reverb256/ai-inference-gateway](https://github.com/reverb256/ai-inference-gateway) | Related service integration. No evidence in this pass establishes source-code reuse. |
| [reverb256/astral-key](https://github.com/reverb256/astral-key) | Related authentication service integration. No evidence in this pass establishes source-code reuse. |

### Direct provenance observations

- Quill explicitly identifies `mcp-canada` as a precursor. That is a provenance lead, not proof that Quill contains no copied code.
- A bounded source review compared the predecessor's HTTP retry helper, token-bucket limiter, and CKAN shaping/client code with Quill's HTTP utility, rate limiter, and CKAN-related modules. The inspected implementations differ in language, structure, and behavior. This is **not** a full repository similarity analysis and cannot rule out copied expression elsewhere or from an earlier revision.
- Several algorithms and structures (HTTP retries, rate limiting, CKAN API calls, StatCan endpoints, response normalization) are common or required by shared public APIs. Similar function names or behavior alone do not prove copying.
- The checked-in [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) says it adapts Contributor Covenant v2.1 and is inspired by Mozilla's enforcement ladder. It attributes those sources in the document. The Covenant is licensed CC BY-SA 4.0; check its share-alike and attribution requirements with counsel before redistributing modified text. The attribution link resolves `mozilla/diversity`, which now **redirects to [`mozilla/inclusion`](https://github.com/mozilla/inclusion)**; that repository is **MPL-2.0** and is where the `Consequence Ladder` and `Mozilla Community Participation Guidelines` documents live. Update the link to the canonical repository. Which specific historical revision of that material was adopted is still unverified, and MPL-2.0's file-level copyleft scope over adapted text is a counsel question, not a settled fact.

### Bounded attribution sweep (2026-09-30)

A repository-wide text search was run for explicit attribution, `SPDX-FileCopyrightText`, "adapted from / copied from / forked from / inspired by / vendored from / upstream", and generated-file markers, excluding build output, `node_modules`, and the three known stale snapshot directories. This is a **bounded keyword sweep**, not a whole-repository similarity or history analysis.

| Item | Observed statement | Provenance assessment |
|---|---|---|
| [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) | Attributes Contributor Covenant v2.1 and Mozilla's enforcement ladder | Attributed; see note above on the renamed Mozilla repository and unverified revision |
| `.agents/skills/review-animations/SKILL.md` | "The substantive bar comes from Emil Kowalski's animation philosophy (animations.dev)" | **Names the source but states no licence, version, or access date.** Whether any text was reused or only the philosophy was consulted is not recorded. Low observed reuse, but the record is incomplete |
| `ops/install-k3s-forge.sh` | "copied from nexus, never regenerated" | Internal first-party operational provenance; no third-party claim |
| `packages/pipeline-core/src/cli/run-pipeline.ts` | Header comment describes why the module was split out | First-party design rationale, not attribution |
| Generated files | `packages/portal/src/data/*.json`, `packages/portal/{v1,public/v1}/openapi.json`, `packages/portal/public/{llms.txt,llms-full.txt,agents.json}`, `docs/metrics.json`, `llms-full.txt` | Produced by in-repo generators (`scripts/generate-*.mjs`, `scripts/build-docs.mjs`, `doc-generator/`). Regenerate rather than hand-edit; a stale generated copy can silently carry outdated claims (see `packages/portal/docs/DEPRECATED-SNAPSHOT.md`) |

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
