# @maplespike/quill-mcp — licence and notices

`@maplespike/quill-mcp` is licensed under the **GNU Affero General Public License,
version 3 only** (`AGPL-3.0-only`). The full text is in the `LICENSE` file in this
directory and in the repository root [`LICENSE`](../../LICENSE). The repository
statement is [`LICENSE.md`](../../LICENSE.md). The repository-wide third-party and
public-data notices are [`NOTICE`](../../NOTICE).

This file is **not** a complete third-party NOTICE or SBOM. It records the notices
that this package must reproduce.

## Copyright

Copyright (C) 2026 MapleSpike contributors.

## Third-party software

Quill uses and adapts third-party software. Each dependency keeps its own licence
and Quill's `AGPL-3.0-only` grant does not extend to it. The resolved set and its
licence expressions are in the repository `pnpm-lock.yaml`; the bounded attribution
sweep is in [`CREDITS.md`](../../CREDITS.md). An npm archive or an OCI image can
contain dependencies that the package manifest does not list. Generate the artifact
SBOM with [`scripts/generate-sbom.sh`](../../scripts/generate-sbom.sh) before you
redistribute a build.

## Source data

Upstream data terms are source- and dataset-specific. Neither this notice nor the
software licence grants rights in external data. Attribution requirements live in
[`NOTICE`](../../NOTICE) and [`DATA-LICENSES.md`](../../DATA-LICENSES.md). The
runtime policy table is
[`packages/pipeline-core/src/shared/source-policy.ts`](../pipeline-core/src/shared/source-policy.ts).
