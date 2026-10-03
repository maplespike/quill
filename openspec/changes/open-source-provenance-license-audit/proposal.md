# open-source-provenance-license-audit

## Why

Quill's current credits and licensing documents conflict with package manifests and file-level SPDX declarations. They also do not provide a complete resolved dependency-license inventory or a reproducible record of direct-code provenance review. This makes it difficult for maintainers and downstream users to distinguish source-data terms, Quill code terms, third-party dependency obligations, and architectural inspiration.

## What Changes

- Establish one evidence-based audit report that separates declared license metadata from legal conclusions and lists unresolved conflicts without silently changing license terms.
- Reconcile `CREDITS.md` and `LICENSE.md` package summaries with current workspace package metadata and package license files.
- Record provenance leads, direct-code comparison method/results, known adaptations (including the Code of Conduct), and review limits.
- Generate a reproducible dependency-license inventory from the committed pnpm lockfile and package metadata, including direct/transitive and development/runtime distinctions where available.
- Add checks that catch manifest/SPDX/NOTICE inconsistencies and stale audit output.

## Impact

- Affected capability: `repo-credits`.
- Documentation: `CREDITS.md`, `LICENSE.md`, `docs/licensing-audit.md`, and a new code-provenance/dependency audit report.
- Tooling: repository-local audit scripts and generated machine-readable report, using existing runtime/tooling where possible.
- No license declarations, third-party code, or attribution notices will be changed based on inference alone. Any unresolved licensing decision will be presented to the project owner before relabeling files or packages.
- Government data-source licensing remains a separate review from software copyright and dependency licensing.
