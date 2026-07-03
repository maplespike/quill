---
last-reviewed: 2026-07-04
status: active
---

# @maplespike/quill-mcp — NOTICE

Copyright 2026 MapleSpike contributors

This product includes software developed at
MapleSpike (https://maplespike.ca).

> **Licensing interaction:** When this package (Apache-2.0) is statically
> or dynamically linked to `@maplespike/database` or `@maplespike/pipeline-core`
> (both AGPL-3.0-or-later per `LICENSE.md` three-tier model), the combined
> work inherits AGPL network-copyleft obligations. Apache-2.0 §3 (patent
> grant) does NOT override the AGPL §13 network clause. Downstream
> republishers must comply with AGPL-3.0-or-later or purchase a
> commercial license — see `LICENSE.md` §"Commercial License".

## Upstream Data Sources

This product fetches data from **203 upstream data modules** spanning
Canadian open-data sources. All upstream data is licensed under the
[Open Government Licence — Canada](https://open.canada.ca/en/open-government-licence-canada).

Specific upstream source families (full list in `src/modules/`):

| Source family | Example modules | OGL-CA attribution |
|---------------|-----------------|--------------------|
| Statistics Canada (StatCan) | `statcan-cpi`, `statcan-gdp`, `statcan-population` | Statistics Canada |
| Open Parliament | `openparliament-bills`, `openparliament-mps`, `openparliament-votes` | Open Parliament |
| Canada Gazette | `gazette-part-i`, `gazette-part-ii` | Government of Canada |
| Open.Canada.ca CKAN portal | `ckan-federal-registry`, `ckan-open-canada` | Government of Canada |
| SEDI / SEDAR+ | `sedi-insider-filings`, `sedar-corp-filings` (planned) | CIRO / CSA |
| Health Canada / agencies | `health-canada-drugs`, `cihi-wait-times`, `cfia-recalls` | Health Canada et al. |
| Federal regulators | `npri-pollution`, `sara-species`, `dfo-fisheries` | ECCC / DFO |
| Provincial (Lobbyists, Legislatures) | `ontario-lobbyists`, `bc-lobbyists`, `qc-assnat` | Province of Ontario / BC / QC |
| Other (CKAN, Socrata, ArcGIS) | per-source `README.md` | Per-source attribution |

For per-source attribution requirements, see the README/docstring of
each module in `src/modules/<source>/`. OGL-CA attribution must be
preserved wherever derived outputs are republished (see
[`LICENSE.md`](../../LICENSE.md) "Data vs. Code License").

## Third-Party Dependencies

### Workspace-internal (MapleSpike contributors)

This product depends on internal workspace packages, also by MapleSpike
contributors:

- `@maplespike/database` — AGPL-3.0-or-later (Core tier; see `LICENSE.md`)
- `@maplespike/pipeline-core` — AGPL-3.0-or-later (Core tier; see `LICENSE.md`)

### External (3rd-party)

This product includes software developed by third parties:

| Dependency | License | Upstream |
|------------|---------|----------|
| [`pino`](https://getpino.io/) | MIT | pinojs |
| [`pino-pretty`](https://github.com/pinojs/pino-pretty) | MIT | pinojs |
| `three` (transitive, via `pipeline-core`) | MIT | mrdoob |

For the complete transitive dependency list, see `package.json` and
the resolved tree in `pnpm-lock.yaml`. A full SBOM (CycloneDX or
SPDX) is generated as part of Phase 3 row "Run license-checker on
`pnpm-lock.yaml`; verify no GPL deps in commercial tier".

## Modifications

This is a derivative work of the upstream dependencies listed above.
Modifications are tracked in the git history at
<https://github.com/reverb256/quill>.

## License

This product is licensed under the Apache License, Version 2.0.
See `LICENSE` in this package for the full license text.
