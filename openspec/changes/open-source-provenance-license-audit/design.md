# Design: Open-Source Provenance and License Audit

## Context

The repository is a pnpm monorepo. Its package manifests, package-local license texts, file SPDX headers, root license documents, and existing credits do not currently present one consistent license picture. The MCP package in particular has Apache-2.0 package metadata and license text while source files declare AGPL-3.0-or-later and MIT; the API package also has AGPL-marked source under Apache-2.0 metadata. These declarations are evidence of a conflict, not permission to choose one automatically.

The project uses many internal workspace dependencies. `quill-mcp` and `api-server` import `pipeline-core`; `pipeline-core` imports `database`; and `engine` imports `database`. The files may therefore form a combined work whose licensing implications require qualified review. A lockfile-only license report cannot settle that question.

## Goals

- Make project-authored code provenance claims traceable and appropriately qualified.
- Compare the likely predecessor `reverb256/mcp-canada` locally against Quill's relevant modules, while retaining licenses and upstream notices.
- Inventory every resolved npm package from `pnpm-lock.yaml` without installing/updating dependencies or relying on registry network access.
- Validate package manifest/license-file consistency and report file-level SPDX disagreements.
- Explain review coverage, heuristics, false positives, and unresolved legal questions.

## Non-goals

- Do not relicense source files or packages.
- Do not claim a legal opinion, certify copyright ownership, infer permission from a GitHub license badge, or determine derivative-work status.
- Do not conflate public data terms with software licenses.
- Do not treat common APIs, protocols, schemas, facts, or standard algorithms as evidence of copying by themselves.

## Decisions

### D1: Facts before conclusions

The audit report labels statements as `observed`, `candidate`, or `needs owner/counsel decision`. Reports include exact file paths, package versions, upstream commit identifiers, and commands used. A text/header match is not automatically a copyright conclusion.

### D2: Use lockfile and installed metadata, not a new dependency

Use the committed pnpm lockfile as the source for resolved package identities and versions. Resolve package metadata from the existing local pnpm store/node_modules when present; do not run install, update, or network download as part of the audit. If metadata is unavailable, mark the license `unknown` and record the gap. Generate a deterministic JSON inventory with a checked-in generator.

### D3: Compare local repository checkouts

If the sibling `Projects/mcp-canada` checkout exists, compare Quill and that repo using similarity tooling available locally, with generated files, lockfiles, vendored data, docs, fixtures, and boilerplate treated separately. If there is no local checkout or no usable similarity tool, record that limitation and do not download/clone without approval. Inspect high-similarity candidates manually and report exact file pairs and relevant license state.

### D4: No automatic license edits

Preserve all current SPDX, package.json, and LICENSE file declarations. Generate a conflict report and ask for a policy decision before changing those statements. Do not add SPDX tags merely to silence the conflict checker.

### D5: Notices remain package-specific

Generate dependency inventory first. Do not synthesize final package NOTICE files from an incomplete or ambiguous inventory. The report should say which distributed packages still lack notices and identify direct/transitive dependencies with declared license data.

## Risks

- License fields may be absent, deprecated, compound, custom, or inconsistent; preserve raw values and avoid over-normalizing.
- Lockfile dependencies include dev/build-only packages; the report must show the scope and not imply all are shipped.
- Similarity tools produce false positives for generated schemas, repeated boilerplate, API structures, and common expressions.
- GitHub branch tips may not be the version historically available when Quill code was written. Pin upstream revisions and use local history when available.
- Package manifests may not define the legal licensing of a combined product that imports workspace code. Flag for counsel.
