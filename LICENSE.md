---
last-reviewed: 2026-10-24
status: final
---

# Quill licensing statement

## Decision

Quill is licensed under the **GNU Affero General Public License, version 3 only**
(`AGPL-3.0-only`). The rights holder made this decision on 2026-10-24. It
replaces every earlier declaration in this repository, including the previous
`AGPL-3.0-or-later` manifest values and the Apache-2.0 and MIT values that some
packages declared.

This statement is the repository's licence grant for Quill's own code. Where this
file and an older declaration disagree, this file records the current decision.

## Sources of truth

| What | Where | Value |
| --- | --- | --- |
| Licence text | [`LICENSE`](./LICENSE) | AGPL-3.0 |
| Root manifest | [`package.json`](./package.json) | `AGPL-3.0-only` |
| Workspace manifests | `packages/*/package.json` | `AGPL-3.0-only` (all 13) |
| Per-package licence text | `packages/*/LICENSE` | Byte-identical copy of the root text |
| Python package | [`packages/sdk-python/pyproject.toml`](./packages/sdk-python/pyproject.toml) | `AGPL-3.0-only` |
| Rust workspace | [`rust/Cargo.toml`](./rust/Cargo.toml) | `AGPL-3.0-only` |
| First-party source headers | `SPDX-License-Identifier` in `.ts`, `.tsx`, `.js`, `.mjs`, `.astro`, `.py`, `.rs` | `AGPL-3.0-only` |
| Third-party and data notices | [`NOTICE`](./NOTICE) | Attribution and copyright notices |

`scripts/test-license-coherence.mjs` reads the repository and fails when any of
these disagree. CI runs it on every pull request.

## What the licence covers

The licence covers Quill's own source code, generated artifacts built from that
code, and the OCI images that Quill publishes. It covers no other material.

- **Published artifacts** carry the same licence. This includes the npm packages
  (`@maplespike/quill-mcp`, `@maplespike/sdk`, `@maplespike/legal-core`,
  `@maplespike/legislation`) and the PyPI package `quill-sdk`. Each such package
  ships a `LICENSE` copy in its archive. Versions already published under
  Apache-2.0 keep that licence. `@reverb256/mcp-server` 0.2.0 is the published
  npm release. Releases of `@maplespike/quill-mcp` from version 0.4.0 on are
  `AGPL-3.0-only`. See [`NOTICE`](./NOTICE).
- **Network use.** AGPL section 13 applies. A person who runs a modified Quill as
  a network service must offer the corresponding source to the users of that
  service.
- **No warranty.** The licence provides the software "as is", without warranty.
- **No trademark grant.** The licence grants no right to the MapleSpike or Quill
  names, logos, or marks.

This file is not legal advice. Read the licence text for the exact terms. Get
qualified counsel for a distribution or commercial question.

## What the licence does not cover

### Source data

Public data is not software. Quill does not license its source data, and the
licence above grants no rights in it. Publisher terms govern each dataset and
they vary by publisher, dataset, and use. The required attribution and copyright
statements are in [`NOTICE`](./NOTICE) and [`DATA-LICENSES.md`](./DATA-LICENSES.md).
The machine-readable inventory is
[`data-source-licenses.json`](./data-source-licenses.json); every entry records
`no_quill_reuse_grant`, which means Quill grants no independent rights. It does
not mean that the publisher forbids reuse. See
[`docs/licensing-audit.md`](./docs/licensing-audit.md).

### Third-party software

Third-party code keeps its own licence. This includes vendored material (for
example `.agents/skills/review-animations/`, MIT, © 2026 Emil Kowalski), the
adapted Contributor Covenant text in `CODE_OF_CONDUCT.md` (CC BY-SA 4.0
upstream), and every npm and PyPI dependency. The notices are in
[`NOTICE`](./NOTICE). The dependency inventory is in
[`CREDITS.md`](./CREDITS.md) and `pnpm-lock.yaml`. An image or archive can
include dependencies that the repository manifest does not show; generate the
artifact SBOM with [`scripts/generate-sbom.sh`](./scripts/generate-sbom.sh)
before you redistribute an image.

## What this document does not decide

This document does not determine derivative-work status, compatibility, fair use,
ownership, contributor authority, a third-party component's inclusion in a
shipped artifact, the scope of AGPL obligations, or whether a data use is
permitted. Get qualified legal advice for those decisions.

## History

Before 2026-10-24 the tree declared several licences at once: AGPL-3.0-or-later
in the root and two packages, Apache-2.0 in four packages, MIT in six packages,
and no declaration in two packages. Four hundred and fifty-three tracked source
files carried a non-`AGPL-3.0-only` SPDX header. Issue
[#1044](https://github.com/maplespike/quill/issues/1044) recorded the conflict.
The decision converted those headers to `AGPL-3.0-only`. The public contact in
the User-Agent, the Helm maintainer, and the Python authors field is
`hello@maplespike.ca`. The earlier audit record is
[`docs/open-source-audit.md`](./docs/open-source-audit.md); its observations
describe the tree as it was before the decision.
