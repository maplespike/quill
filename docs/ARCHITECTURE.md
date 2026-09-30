---
last-reviewed: 2026-07-07
status: active
---

# MapleSpike Architecture

Comprehensive architecture documentation for the MapleSpike monorepo — a sovereign, AI-native Canadian government data pipeline built on a pnpm monorepo with zero external cloud spend, deployed on a K3s cluster.

---

## Overview

MapleSpike is a unified data pipeline that discovers, ingests, verifies, and surfaces data from Canadian federal, provincial, territorial, municipal, and other public-sector sources. Source terms vary by publisher and dataset; public availability does not establish reuse permission. The system provides three primary access patterns: Model Context Protocol (MCP) for AI agents, REST API for developers, and client SDKs for programmatic integration. Data records carry source provenance; citation hashes and audit trails are available on response paths that support them.

The platform currently maintains 184 registered MCP tools, 207 modules in the registry (203 ingestion directories), and approximately 220,000 lines of TypeScript code across 14 packages (13 in the pnpm workspace including sdk-python; `dashboard` is workspace-excluded; the older `pretext-civic` directory was orphaned and has been removed). Authoritative breakdown: [docs/metrics.json](./metrics.json) `packages.names`. Data flows from upstream government APIs and open data portals through ingestion pipelines into a SQLite database, which is then consumed by the MCP server, API server, and cross-reference engine.

```
                           Upstream Government APIs
                              (Federal, Provincial, Municipal)
                                         │
                                         ▼
                           ┌─────────────────────────────┐
                           │    pipeline-core (191       │
                           │    ingestion modules)       │
                           │  fetch → parse → verify     │
                           └──────────────┬──────────────┘
                                          │
                                          ▼
                           ┌─────────────────────────────┐
                           │     database (SQLite)       │
                           │  better-sqlite3 + Drizzle   │
                           └──────────────┬──────────────┘
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            │                             │                             │
            ▼                             ▼                             ▼
  ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
  │   quill-mcp       │    │    api-server     │    │      engine       │
  │  (184 MCP tools)  │    │  (REST gateway)   │    │  (entity res +    │
  │  stdio/SSE modes  │    │  auth + rate      │    │   signal gen)     │
  └────────┬──────────┘    └────────┬──────────┘    └───────────────────┘
           │                        │
           ▼                        ▼
  ┌───────────────────┐    ┌───────────────────┐
  │ AI Agents (Claude │    │  SDK Clients      │
  │ Desktop, Cursor)  │    │  (TS + Python)    │
  └───────────────────┘    └───────────────────┘
                                          │
                                          ▼
                           ┌─────────────────────────────┐
                           │       portal                │
                           │  (Developer Portal + Docs)  │
                           └─────────────────────────────┘
```

---

## Repository Structure

The monorepo follows a standard pnpm workspace structure. `packages/` contains 14 subdirectories: 13 in the active pnpm workspace (`api-server`, `create-module`, `database`, `docs`, `engine`, `legal-core`, `legislation`, `quill-mcp`, `notification-service`, `pipeline-core`, `portal`, `sdk`, `sdk-python`), plus `dashboard` which is workspace-excluded (the OWASP dashboard is now integrated into `packages/portal`). The previously referenced `pretext-civic` directory has been removed. The root contains shared configuration files including `turbo.json` for build orchestration, `tsconfig.json` for TypeScript project references, and infrastructure manifests in `k8s/` for Kubernetes deployments.

### Package Overview

| Package | Type | Entry Point | Build Command | Test Framework | Published? |
|---------|------|-------------|---------------|----------------|------------|
| `pipeline-core` | Library | `dist/index.js` | `tsc -b` | `node --test` (tsx) | No |
| `quill-mcp` *(Quill, ADR 0005)* | Server | `dist/cli.js` | `tsc -b` | `node --test` (tsx) | No |
| `api-server` | Server | `dist/index.js` | `tsc -b` | `node --test` (tsx) | No |
| `engine` | Library | `src/index.ts` | `tsc` | `vitest` | No |
| `sdk` | Library | `dist/index.js` | `tsup` | `tsx --test` | Yes (npm) |
| `sdk-python` | Library | `quill/__init__.py` | `python -m build` | — | Yes (PyPI) |
| `legal-core` | Library | `dist/index.js` | `tsup` | — | Yes (npm) |
| `legislation` | Library | `dist/index.js` | `tsup` | — | Yes (npm) |
| `database` | Library | `src/index.ts` | `tsc -b` (node:sqlite at runtime) | `node --test` (tsx) | No |
| `portal` | Static | `.` (static HTML) | Astro build | — | No |
| `docs` | Static | `src/index.md` | VitePress | — | No |
| `create-module` | Tool | `dist/cli.js` (bin) | `tsc -b` | — | No |
| `notification-service` | Server | `dist/index.js` | `tsc -b` | `node --test` (tsx) | No |

---

## Data Flow

Data flows through a multi-stage pipeline from upstream sources to end consumers through several well-defined stages:

### Ingestion Stage

The `pipeline-core` package contains 203 ingestion directories, each implementing a standalone `fetch → parse → persist` pipeline. Modules pull data from 1,240+ unique external endpoints across:

- **Federal sources**: IRCC immigration, StatCan WDS (CPI/GDP/labour/population/trade), Health Canada, CRA Charity, Federal Budget, Proactive Disclosure, ATI requests, NPRI, Species at Risk, Impact Assessment, CIPO, CMHC
- **Parliamentary sources**: House and Senate committee evidence via XML, Hansard transcripts, Canada Gazette RSS feeds, LEGISinfo bills
- **Regulatory bodies**: OAG, PBO, Ethics Commissioner, Lobbying Commissioner, Competition Bureau, CRTC, Privacy Commissioner, Information Commissioner, Official Languages, CHRC, OSFI, FCAC, FINTRAC, CDIC
- **Corporate tracking**: Lobbying registry (CKAN CSV), procurement notices, SEDI insider trades, SEDAR+ filings, Corporations Canada, 31 NGO/think tank RSS feeds, WEF narrative tracking
- **Provincial data**: All 13 provincial legislatures, 13 CKAN portals, 273 regulators across 21 categories (securities commissions, law societies, police SIU, engineering regulators, medical boards, teaching colleges)
- **Municipal data**: 19 cities with direct open data fetchers, 3,490+ municipalities via provincial CKAN federation, regional authorities (Peel, York, Durham, Metro Vancouver, CRD)
- **Legal data**: CanLII case law API, A2AJ open corpus (116K+ decisions), Justice Canada legislation XML, federal tribunals, Ontario e-Laws, BC Laws
- **Real-time streams**: ECCC weather alerts (CAP-CP), CBSA border wait times, Parole Board decisions

### Verification Stage

Each ingested record passes through verification logic that includes SHA-256 hash generation for content integrity, source URL and timestamp logging, and schema validation. The verification stage produces audit trails that are stored alongside the data to enable independent verification of all records.

### Storage Stage

The `database` package provides a SQLite-based storage layer using `better-sqlite3` and Drizzle ORM. The schema includes tables for committees, lobbying records, procurement notices, GIC appointments, court decisions, legislation, and cross-reference mappings. Migrations are managed through the engine package's migration scripts.

### Access Stage

Data is surfaced through three primary access patterns:

1. **Quill (MCP Server)**: The `@maplespike/quill-mcp` package exposes 184 tools via the Model Context Protocol (incl. `x402-deposit`) (see [products/quill.md](./products/quill.md)). Tools operate in standalone mode (direct upstream fetch) or integrated mode (database queries). The server supports stdio transport for local AI agents and SSE transport for remote access.

2. **API Server**: The `@maplespike/api-server` package provides a REST API gateway with Bearer authentication, rate limiting, and usage tracking. Multi-tenant architecture supports API keys and JWT tokens. The server wraps pipeline-core and engine functionality for programmatic access.

3. **SDK Clients**: The `@maplespike/sdk` (TypeScript) and `quill-sdk` (Python) packages provide typed client libraries that simplify API access with domain-specific methods and full TypeScript type safety.

### Analysis Stage

The `engine` package performs entity resolution, graph building, signal generation, and brief production. It reads from the shared SQLite database and produces cross-references between lobbying activities, committee meetings, GIC appointments, procurement awards, and election data.

---

## Package Dependency Graph

The following diagram shows the dependency relationships between packages:

```
pipeline-core ──► database
      │
      ├──► quill-mcp ──► pipeline-core
      │
      ├──► api-server ──► pipeline-core
      │                 ├──► engine ──► database
      │
      └──► engine ──► database

sdk (independent)
sdk-python (independent)
legal-core (independent)
legislation ──► legal-core
portal (independent)
docs (independent)
pretext-civic (orphaned)
```

### Dependency Details

- **pipeline-core**: Depends on `@maplespike/database` for data persistence. Uses `amqplib` for message queuing, `fast-xml-parser` for XML parsing, and `undici` for HTTP requests.
- **quill-mcp** (Quill): Depends on `@maplespike/pipeline-core` for data access. Lightweight with only `pino` for logging. No database dependency in standalone mode.
- **api-server**: Depends on `@maplespike/pipeline-core` and `@maplespike/engine`. Uses `@simplewebauthn/server` for authentication, `viem` for cryptocurrency support, and `zod` for schema validation.
- **engine**: Depends on `@maplespike/database` for storage. Uses `better-sqlite3`, `drizzle-orm`, `fuse.js` for fuzzy search, and `zod` for validation.
- **sdk**: No internal dependencies. Standalone client library using `zod` for runtime validation.
- **sdk-python**: No dependencies. Pure Python client library with optional LangChain integration.
- **legal-core**: No dependencies. Standalone library for CanLII and A2AJ access.
- **legislation**: Depends on `@maplespike/legal-core`. Uses it for legal data structures while adding legislation-specific parsing.
- **portal**: Independent package using Astro, React, and shadcn/ui for the developer portal.
- **docs**: Independent package using VitePress for documentation.
- **database**: Base library providing SQLite access. Used by pipeline-core and engine.
- **pretext-civic**: Orphaned React component library. Not used by any other packages.

---

## Build System

MapleSpike uses a pnpm monorepo (pnpm@10.32.1) orchestrated by Turbo for efficient builds and caching. The build system leverages TypeScript project references for type checking across packages.

### Turbo Configuration

The `turbo.json` file defines the build orchestration:

- `build`: Depends on all transitive dependencies (`^build`), outputs to `dist/**` and `.next/**`
- `test`: Depends on `build`, runs tests after successful compilation
- `typecheck`: Depends on transitive builds, performs type checking
- `dev`: Cache disabled, persistent for development mode

### TypeScript Configuration

The root `tsconfig.json` defines shared compiler options:

- **Target**: ES2022
- **Module**: ESNext with bundler resolution
- **Strict mode**: Enabled
- **Project references**: `packages/database`, `packages/pipeline-core`, `packages/engine`, `packages/quill-mcp`, `packages/api-server`

Path aliases are configured for all internal packages and for selective ingestion modules within pipeline-core (e.g., `@maplespike/pipeline-core/ontario-provincial`).

### Build Commands

```bash
# Root level commands
pnpm install           # Install all dependencies using workspace protocol
pnpm build             # Turbo builds all packages in dependency order
pnpm -r build          # Build each package independently (bypasses Turbo)
pnpm test              # Turbo runs tests after building
pnpm -r test           # Run tests without Turbo
pnpm run clean         # Remove dist/ and tsconfig.tsbuildinfo

# Per-package commands
cd packages/quill-mcp && pnpm build && pnpm start
cd packages/api-server && pnpm build && pnpm run dev
cd packages/engine && pnpm build && pnpm run migrate
cd packages/sdk && pnpm build && pnpm test
```

### Package-Specific Build Tools

- **TypeScript packages** (`tsc -b`): pipeline-core, quill-mcp (Quill), api-server, engine, database
- **tsup packages**: sdk, legal-core, legislation (dual CJS/ESM output with TypeScript declarations)
- **Python package** (`python -m build`): sdk-python (uses setuptools)
- **Static sites**: portal (Astro), docs (VitePress)
- **Orphaned**: pretext-civic (no build system)

---

## Deployment Architecture

> **K8s production track (LIVE):** the canonical deploy path is Nix-first — `nix build .#saas-manifests` generates the bundle from `flake.nix` + `nix/saas-manifests.nix` (single source of truth), applied via `kubectl apply -f result/manifests.yaml`. The `cloudflared` tunnel (namespace `cloudflared`, protocol http2, pinned ClusterIP upstreams) exposes `api`/`mcp`/`quill` subdomains through Cloudflare DNS. Local development uses Docker Compose via `scripts/dev-up.sh` (see [README.md §Running the local development stack](../README.md)).

MapleSpike is designed to run on a K3s cluster with two environments isolated by namespace and ingress hostname. All backend data stays on Canadian infrastructure with zero external cloud spend.

### Environments

| Environment | Namespace | Hostname | Purpose |
|-------------|-----------|----------|---------|
| Production | `maplespike` | `quill.lan` (LAN) · `quill.maplespike.ca` (public) | Live production deployment |
| Development | — | local stack via `scripts/dev-up.sh` | Development and testing |

### Services

| Service | Platform | Stack | Port |
|---------|----------|-------|------|
| Portal | K3s (python server.py) | Static HTML/CSS/JS | Service :8080 |
| API Server | K3s | Node.js, Bearer auth | Service :8082 |
| Quill (MCP Server) | K3s | Node.js, SSE transport | Service :3001 |
| Engine/CronJobs | K3s | Node.js, scheduled pipelines | — |

### Ingress

LAN traffic enters the `nginx-rp` reverse proxy on nexus (hostNetwork :80/:443,
wildcard `*.lan` cert) which routes the `.lan` vhosts to the k3s Services;
public traffic enters via the Cloudflare Tunnel (`cloudflared` pod) with
split-hostname routing. See [ROUTING.md](./ROUTING.md).

### Development Endpoints

The local dev stack (`scripts/dev-up.sh`) runs:

- Portal: `http://localhost:8080`
- API: `http://localhost:8082`
- MCP: `http://localhost:3001`

### CI/CD Pipeline

GitHub Actions drives the two-environment deployment model:

| Branch | Workflow | Action |
|--------|----------|--------|
| `main` | CI (ci.yml) | Run tests on every push |
| `main` | Deploy Dev (deploy-dev.yml) | Build + deploy to `maplespike-dev` namespace |
| `prod` | Deploy Prod (deploy-prod.yml) | Build + deploy to `quill-prod` namespace |

Container images are tagged `:dev` from `deploy-dev.yml`, and `:sha` + `:stable` from `deploy-prod.yml` (both tags are **pushed on the same `push: prod` event**, so there is no automated `:sha → :stable` promotion gate today — operators re-tag with `docker buildx imagetools create ... --tag :stable` if a rollback is needed). The `:latest` tag was retired to avoid silent version drift; overlays pin the tag explicitly.

---

## Data Sources

MapleSpike consumes data from over 1,240 unique external endpoints across Canadian government systems. Each ingestion module implements source-specific fetch, parse, and validation logic.

### Federal Sources

- **Open Parliament API** (`api.openparliament.ca`): House of Commons debates, bills, voting records, member information, committee data
- **Canada Gazette** (`www.gazette.gc.ca`): Parts I (proposed), II (enacted), III (acts) regulations via RSS feeds
- **Statistics Canada** (`www150.statcan.gc.ca`): WDS and SDMX APIs for economic, demographic, and health data (CPI, GDP, labour, population, trade)
- **IRCC**: Immigration and citizenship data via CKAN dumps
- **Health Canada**: Public health data and statistics
- **CRA Charity Registry**: Registered charity financials, directors, and programs
- **GIC Appointments**: Governor-in-Council appointments via CKAN and Infobase API
- **Procurement** (`canadabuys.canada.ca`): Tender notices, contract awards, proactive disclosure via RSS and CKAN
- **Proactive Disclosure**: Travel and hospitality expenses, contracts
- **Access to Information**: ATI request summaries and responses
- **NPRI**: National Pollutant Release Inventory
- **Species at Risk**: Conservation data and recovery strategies
- **Impact Assessment**: Project assessments and environmental reviews
- **CIPO**: Canadian Intellectual Property Office patent and trademark data
- **CMHC**: Canada Mortgage and Housing Corporation housing statistics

### Parliamentary Sources

- **House of Commons Committees**: XML evidence fetch for 30 committees, Hansard transcripts, in-camera session flags
- **Senate Committees** (`sencanada.ca`): 20 committees via XML evidence fetch
- **LEGISinfo**: Federal bill tracking and legislative status

### Regulatory and Oversight Bodies

- **Office of the Auditor General**: Audit reports and performance assessments
- **Parliamentary Budget Officer**: Fiscal analysis and cost estimates
- **Ethics Commissioner**: Conflict of interest disclosures
- **Lobbying Commissioner**: Federal lobbying registry compliance
- **Competition Bureau**: Competition law enforcement and market studies
- **CRTC**: Telecommunications and broadcasting regulation, market reports
- **Privacy Commissioner**: Privacy complaints and guidance
- **Information Commissioner**: Access to Information requests and complaints
- **Official Languages**: Language rights compliance and reports
- **Canadian Human Rights Commission**: Human rights complaints and investigations
- **OSFI**: Office of the Superintendent of Financial Institutions
- **FCAC**: Financial Consumer Agency of Canada
- **FINTRAC**: Financial Transactions and Reports Analysis Centre
- **CDIC**: Canada Deposit Insurance Corporation

### Corporate and Influence Tracking

- **Lobbying Registry** (`ocl-calbon.aciss-crdd.gc.ca`): All federal lobbying communications since 1996 via CKAN CSV
- **SEDI**: System for Electronic Disclosure by Insiders (insider trading)
- **SEDAR+**: Corporate filings and public company disclosures
- **Corporations Canada**: Federal corporation registry
- **NGO/Think Tank Feeds**: 31 RSS feeds tracking publications and statements
- **WEF Narrative Tracking**: World Economic Forum publication analysis
- **Executive Statements**: RSS feeds from GlobeNewswire and investor relations for 17 tracked executives

### Provincial Sources

- **All 13 Provincial Legislatures**: Hansard transcripts, bills, and committee records
- **13 Provincial CKAN Portals**: ON (data.ontario.ca), BC (catalogue.data.gov.bc.ca), AB (open.alberta.ca), QC (www.donneesquebec.ca), plus 9 others
- **273 Provincial Regulators**: Across 21 categories including securities commissions, law societies, police SIU, engineering regulators, medical boards, teaching colleges, and professional associations

### Municipal Sources

- **19 Cities with Direct Fetchers**: Toronto, Vancouver, Montreal, Calgary, Edmonton, Ottawa, Winnipeg, Hamilton, Quebec City, Kitchener, London, Halifax, Victoria, Saskatoon, Regina, St. John's, Windsor, Guelph, and others
- **3,490+ Municipalities**: Via provincial CKAN federation
- **Regional Authorities**: Peel Region, York Region, Durham Region, Metro Vancouver, Capital Regional District (CRD)

### Legal and Justice Sources

- **CanLII API**: Federal and provincial court decisions, citation graphs
- **A2AJ Open Corpus**: 116,000+ court decisions in structured format
- **Justice Canada Legislation XML**: Federal statutes and regulations
- **Federal Tribunals**: Various administrative tribunals and specialized courts
- **Ontario e-Laws**: Ontario statutes and regulations
- **BC Laws**: British Columbia statutes and regulations

### Real-Time and Specialized Sources

- **ECCC Weather Alerts**: Environment and Climate Change Canada via CAP-CP protocol
- **CBSA Border Wait Times**: Real-time border crossing data
- **Parole Board Decisions**: Recent parole decisions and hearing outcomes

### Union and Labour Sources

- **CUPE**: Canadian Union of Public Employees annual reports
- **Unifor**: Canada's largest private sector union reports
- **PSAC**: Public Service Alliance of Canada annual reports
- **StatCan Aggregates**: Labour statistics and union membership data

### University and Research Sources

- **CUDO**: Council of Ontario Universities enrolment data
- **Tri-Council Grants**: SSHRC, NSERC, CIHR funding data
- **Per-Institution CKAN**: University-specific open data portals

### Media and Broadcasting Sources

- **CRTC Market Reports**: Broadcasting and telecommunications market analysis
- **Ownership Charts**: Media ownership structures
- **Canada Media Fund**: Funding data and project information
- **Telefilm Canada**: Film and television funding data
- **Online News Act**: Compliance and reporting data

### Defence and Veterans Sources

- **DND**: Department of National Defence personnel and procurement data
- **Veterans Affairs**: Veterans benefits and services data

### International Sources

- **World Bank WDI**: World Development Indicators for Canada
- **UN Comtrade**: International trade statistics
- **OECD Statistics**: Economic and social indicators
- **UNDP HDI**: Human Development Index data
- **UNHCR**: Refugee statistics relevant to Canada

---

## Key Design Decisions

### Monorepo with pnpm and Turbo

MapleSpike uses a pnpm monorepo rather than separate repositories for several reasons: shared TypeScript configuration across packages, efficient dependency management through workspace protocol, atomic commits across related packages, and Turbo-powered caching for faster builds. This approach ensures consistency in build tooling, TypeScript configuration, and coding standards while enabling independent package versioning and publishing where appropriate.

### SQLite over PostgreSQL

The platform uses SQLite (`better-sqlite3`) rather than PostgreSQL for the primary data store. SQLite offers zero-config deployment, embedded operation without external database processes, excellent read performance for government data queries, ACID compliance for transaction integrity, and simple file-based backups. This aligns with the zero external cloud spend requirement and simplifies K3s deployment. PostgreSQL is supported via `pg` dependency for future scaling if needed.

### MCP Protocol for AI Integration

MapleSpike implements the Model Context Protocol as the primary interface for AI agents. MCP provides structured tool definitions, bidirectional communication between agents and data sources, transport-agnostic design (stdio for local, SSE for remote), and growing ecosystem support in Claude Desktop, Cursor, and other AI platforms. This future-proofing ensures MapleSpike remains accessible as AI platforms evolve.

### TypeScript Strict Mode

All packages use TypeScript strict mode with ES2022 target and ESNext modules. Strict mode catches errors at compile time rather than runtime, improves code maintainability and refactoring safety, provides full IntelliSense support across workspace references, and enables confident refactoring in a large codebase. The cost is slightly more verbose type annotations, but the safety benefits justify the overhead.

### K3s Cluster Deployment

Deployment targets K3s (lightweight Kubernetes) rather than serverless or VM-based hosting. K3s provides container orchestration with minimal resource requirements, GitOps-style deployment via Kubernetes manifests, namespace-based environment isolation, and self-hosted capability on Canadian infrastructure. This eliminates cloud vendor lock-in and ensures data sovereignty while providing modern deployment practices.

### Dual Publish Strategy

Three packages (`sdk`, `legal-core`, `legislation`) are published to npm while other packages remain private. SDKs are published to enable external developer adoption, legal packages are published as standalone utilities for legal tech applications, and core infrastructure (pipeline-core, engine, quill-mcp, api-server) remains private to control the data pipeline and prevent unauthorized access. The Python SDK is published to PyPI for Python ecosystem coverage.

### License and Provenance Status

Package manifests, package-level license files, and source-file SPDX declarations conflict; some workspace packages have no declared license. This architecture document does not determine which declaration controls any artifact. Do not infer the license of an SDK, package, container image, or dependency from neighboring package metadata. See the [open-source audit](./open-source-audit.md) for observed declarations and unresolved questions. Data-source terms are separate and vary by publisher and dataset; public availability is not a reuse grant.

### Ingestion Module Architecture

Each of the 203 ingestion modules (per [docs/metrics.json](./metrics.json)) implements a consistent `fetch → parse → persist` pattern with independent module isolation. This architecture enables incremental onboarding of new data sources without touching core code, source-specific error handling and retry logic, module-level health monitoring and metrics, and testable units with clear boundaries. The trade-off is some code duplication across modules, but consistency and maintainability are prioritized.

### No External Cloud Spend

All infrastructure runs on a Canadian K3s cluster with no AWS, Azure, or GCP dependencies. This ensures complete data sovereignty, predictable costs without cloud billing surprises, compliance with Canadian data residency requirements, and independence from US cloud providers and potential access restrictions. The infrastructure footprint includes only K3s cluster resources, no managed services, and simple container-based deployments.

### TypeScript Project References

The build system uses TypeScript project references for incremental compilation. Project references enable topological ordering of builds, parallel compilation of independent packages, shared tsconfig inheritance, and improved IDE performance through targeted type checking. This is essential for maintaining build performance as the codebase grows beyond 220,000 lines (219,808 per [docs/metrics.json](./metrics.json)).

### Better-sqlite3 vs Other SQLite Drivers

The platform uses `better-sqlite3` rather than `node-sqlite3` or other wrappers. Better-sqlite3 provides synchronous API (simpler than async for ingestion pipelines), comprehensive TypeScript definitions, prepared statement caching for performance, and active maintenance with good Node.js version support. The synchronous nature simplifies ingestion pipeline code without blocking concerns in the scheduled batch processing context.

### Federation over Centralization

Municipal data is accessed via provincial CKAN federation rather than direct municipal fetchers for 3,490+ municipalities. Federation avoids maintaining 3,000+ individual fetchers, provides consistent data formats through CKAN standardization, enables one-query access to all municipalities per province, and reduces maintenance overhead. Direct fetchers are maintained for the 19 largest cities where federation coverage is incomplete or response times are too slow.

### Audit Trail Design

Every record includes SHA-256 hash, source URL, timestamp, and schema validation status in the database. This design enables independent verification of data integrity, forensic tracing of data lineage, detection of source data corruption or tampering, and confidence in downstream analysis. The hash serves as both integrity check and citation anchor for academic and journalistic use.

### Separation of Ingestion and Access

Ingestion (pipeline-core) and access (quill-mcp, api-server, engine) are separate packages with different deployment cycles. Ingestion runs on scheduled batch processes, access servers run as long-lived services, and changes can be deployed independently. This separation allows scaling access servers without affecting ingestion, isolates failures in either component, and enables different authentication and rate limiting strategies.

### Zero-Config MCP Server

The MCP server operates in standalone mode with no required configuration or dependencies. Tools fetch directly from upstream APIs, use in-memory caching with 5-minute TTL, and require no database connection for basic operation. This design lowers the barrier to entry for users, enables immediate local testing, provides graceful fallback to API server when available, and demonstrates the utility of upstream data without infrastructure setup.

### Pretext-Civic Orphan Status

The `pretext-civic` package is orphaned because the portal migrated from Next.js to Astro + shadcn/ui, making the React component library unnecessary. The package is retained in case future dashboard requirements justify React-based visualization components, but no active development occurs. This reflects the architectural pivot from framework-specific components to framework-agnostic data access.

---

## Package Descriptions

### pipeline-core

The `@maplespike/pipeline-core` package is the core data pipeline library providing ingestion, curation, verification, and audit functionality for Canadian civic data. It contains 203 ingestion directories across federal, provincial, and municipal sources, each implementing a standalone `fetch → parse → persist` pipeline. The package exports 50+ subpath imports for domain-specific ingestion modules (e.g., `@maplespike/pipeline-core/ontario-provincial`, `@maplespike/pipeline-core/worldbank-wdi`). It uses `better-sqlite3` for storage, `fast-xml-parser` for parsing government XML feeds, and `amqplib` for message queuing integration. Its package manifest declares AGPL-3.0-or-later, but file-level and repository-wide license scope remains under review; see the [open-source audit](./open-source-audit.md).

### quill-mcp

The `@maplespike/quill-mcp` package (Quill) implements a Model Context Protocol server exposing 184 tools for AI agent consumption of Canadian government data. The server operates in two modes: standalone (direct upstream API fetch with in-memory caching) and integrated (queries the shared database via API server). It supports both stdio transport for local AI agents like Claude Desktop and Cursor, and SSE transport for remote HTTP access. The server includes semantic search with intent awareness, cross-reference tools connecting lobbying, committees, GIC appointments, and procurement, and health monitoring endpoints. All tools require zero configuration for basic operation, making the package immediately useful without setup.

### api-server

The `@maplespike/api-server` package provides a multi-tenant REST API gateway wrapping pipeline-core and engine functionality for programmatic access. It implements Bearer authentication with API keys and JWT tokens, rate limiting to prevent abuse, and usage tracking for billing and analytics. The server exposes endpoints for all 135 data modules, cross-reference queries via the engine, and administrative functions for tenant management. It uses `@simplewebauthn/server` for passkey authentication, `viem` for cryptocurrency payment integration, and `zod` for request validation. The server is deployed as a Node.js service in the K3s cluster with NodePort 31284.

### engine

The `@maplespike/engine` package performs entity resolution, graph building, signal generation, and brief production on the shared SQLite database. It reads data ingested by pipeline-core and produces cross-references between entities appearing in multiple contexts (e.g., a person who is an MP, a lobbyist, and a GIC appointee). The engine uses `better-sqlite3` and `drizzle-orm` for database access, `fuse.js` for fuzzy string matching in entity resolution, and `zod` for schema validation. It includes migration scripts for database schema updates and is tested with Vitest. The engine runs as scheduled CronJobs in the K3s cluster to update signals and briefs on a regular cadence.

### sdk

The `@maplespike/sdk` package is the TypeScript client library providing a typed interface to the MapleSpike API for developers. It offers domain-specific methods for all data sources (e.g., `ms.immigration.permanentResidents()`, `ms.corporate.lobbying()`, `ms.committees.meetings()`) with full TypeScript type safety and IntelliSense. The SDK is built with `tsup` for dual CJS/ESM output with TypeScript declarations, uses `zod` for runtime validation of API responses, and includes comprehensive error handling with typed error classes. It is published to npm with provenance verification and requires Node.js 18+. Its package and source-file license declarations require review; see the [open-source audit](./open-source-audit.md).

### sdk-python

The `quill-sdk` package is the Python client library providing the same functionality as the TypeScript SDK for Python developers. It mirrors the TypeScript SDK's API design with domain-specific methods and full type hints. The package uses `setuptools` for building with optional `langchain` and `pydantic` dependencies for LangChain integration. It is published to PyPI, supports Python 3.8+. Verify the published artifact's license notices before reuse or redistribution. The Python SDK enables MapleSpike integration in data science workflows, Jupyter notebooks, and Python-based applications.

### legal-core

The `@maplespike/legal-core` package provides a typed client for Canadian case law, legislation, and tribunal data via the CanLII API and A2AJ open corpus. It offers interfaces for searching court decisions, retrieving case details, accessing citation graphs, and querying tribunal rulings. The package is built with `tsup` for dual CJS/ESM output, has no external dependencies, and includes TypeScript definitions for all legal data structures. It is published to npm with provenance verification and has license declarations that require review before reuse or redistribution.

### legislation

The `@maplespike/legislation` package provides point-in-time access to federal and provincial legislation via Justice Canada XML repositories and provincial CKAN portals. It depends on `@maplespike/legal-core` for legal data structures while adding legislation-specific XML parsing, version tracking, and amendment history. The package supports federal statutes and regulations, provincial legislation for major provinces (ON, BC, AB, QC), and historical versions for legal research. It is built with `tsup` and published to npm. Verify package and file-level license notices before reuse or redistribution; see the [open-source audit](./open-source-audit.md).

### portal

The `@maplespike/portal` package is the developer portal and landing page, migrated from Next.js to Astro + React + shadcn/ui + Tailwind v4. It provides static HTML/CSS/JS with dark theme, Canadian red accent (#E84545), and environment-specific configuration via ConfigMap. The portal includes AI-friendly features like `/llms.txt` for agent discovery, `/v1/openapi.json` for code generation, and markdown responses for documentation. It is deployed as a static site served by nginx in the K3s cluster with NodePort 30965. The portal package includes generation scripts for agents JSON, OpenAPI specs, and pipeline data.

### docs

The `@maplespike/docs` package is the documentation site built with VitePress. It provides comprehensive documentation for the MapleSpike platform including architecture, API reference, SDK guides, and module coverage. The build process is handled by a custom script at `scripts/build-docs.mjs` in the repository root. The documentation site is served alongside the portal or independently as part of the developer experience.

### database

The `@maplespike/database` package provides the SQLite-based storage layer using `better-sqlite3` and Drizzle ORM. It defines database schema, connection management, and migration utilities. The package exports the schema definitions, connection factory, and helper functions for database operations. It is used by `pipeline-core` for data ingestion and by `engine` for cross-reference queries. The package is private to the monorepo and not published externally. Its package metadata and repository license scope require review, so do not infer a license from its use by pipeline-core.

### pretext-civic

The `pretext-civic` package is an orphaned React component library that was previously used for charts and geospatial visualizations. It is no longer maintained due to the portal migration from Next.js to Astro + shadcn/ui, which uses different component patterns. The package lacks a `package.json` file and is not imported by any other packages. It is retained in the repository in case future dashboard requirements justify React-based visualization components, but no active development or maintenance occurs.

---

## Conclusion

MapleSpike represents a comprehensive approach to Canadian government data aggregation and distribution, balancing technical sophistication with practical deployment constraints. The architecture prioritizes data sovereignty, ease of AI integration, and developer experience while maintaining zero external cloud spend. The monorepo structure with pnpm and Turbo enables efficient development and deployment across 13 packages, while the separation of concerns between ingestion, storage, access, and analysis ensures maintainability and scalability.

The system currently processes 207 data modules across federal, provincial, territorial, and municipal sources, exposing 184 registered MCP tools and supporting TypeScript and Python SDKs. Future development will focus on expanding module coverage toward the 150+ module target, enhancing the cross-reference engine's capabilities, and adding billing infrastructure for public API access.