# Gap Analysis: Issues vs Implementations — 2026-05-31 Sprint

> Generated: 2026-05-31
> Method: Systematic comparison of every closed issue's requirements against actual codebase


## #299 — Financial Regulation Module

### Required vs Implemented

| Requirement | Status | Notes |
|---|---|---|
| `ingestOSFI()` fetches OSFI data | ✅ | CKAN search for "osfi financial institutions" |
| `ingestCDIC()` fetches CDIC data | ✅ | CKAN search for "cdic deposit insurance" |
| `ingestFCACComplaints()` fetches FCAC complaints | ⚠️ | Named `ingestFCAC()` not `ingestFCACComplaints()` — alias or rename needed |
| Handle structured + unstructured data | ⚠️ | CKAN handles structured, PDF handling not implemented |
| CSA (Securities Administrators) | ⚠️ | Added in PR #607 but not in original close |
| OBSI (Banking Ombudsman) | ⚠️ | Added in PR #607 but not in original close |
| Cross-ref banking complaints with lobbying | ❌ | Not implemented |
| Tests with sample data | ❌ | No test file exists |
| `pnpm build` passes | ✅ | |
| Registered in `registry.ts` | ✅ | Under `financial` category |
| Specific types (BankData, InsuranceData, CDICMember, Complaint) | ⚠️ | Types just fixed to match requirements |

### Gaps
1. Rename `ingestFCAC` to `ingestFCACComplaints` or add alias
2. No tests file (`__tests__/financial-regulation.test.ts`)
3. Cross-reference with lobbying data not implemented
4. PDF/unstructured data handling not implemented


## #298 — Energy & Natural Resources Module

### Required vs Implemented

| Requirement | Status | Notes |
|---|---|---|
| `ingestOilProduction()` by province | ✅ | CKAN search for "crude oil production canada" |
| `ingestGasProduction()` | ✅ | CKAN search for "natural gas production canada" |
| `ingestElectricity()` generation data | ✅ | CKAN search for "electricity generation canada" |
| `ingestMining()` mineral production | ✅ | CKAN search for "mineral production canada" |
| Pipeline data (capacity, throughput, incidents) | ❌ | Not implemented |
| Renewable energy (wind, solar, hydro) | ❌ | Not implemented |
| Provincial energy regulators | ❌ | Noted in issue as future scope, not done |
| OGL-Canada license documented | ❌ | Not documented in constants.ts |
| Tests with sample data | ❌ | No test file |
| Registered under `energy` category | ⚠️ | Registered under `infrastructure` not `energy` |
| Specific types (OilProduction, GasProduction, PipelineData, etc.) | ⚠️ | Generic EnergyRecord type only |

### Gaps
1. Pipeline data function missing
2. Renewable energy function missing  
3. No test file
4. Wrong registry category
5. License not documented
6. No specific typed interfaces per data type


## #295 — OpenCorporates API Integration

### Required vs Implemented

| Requirement | Status | Notes |
|---|---|---|
| Full file structure in opencorporates/ | ✅ | constants, types, fetcher, index exist |
| `searchCompanies()` with Canadian filter | ✅ | Returns typed OCCompany results |
| `getOfficers()` directors & officers | ✅ | |
| `getCorporateGroupings()` | ✅ | |
| `getFilings()` | ⚠️ | Was missing, fixed in #607 |
| `getCompanyByCorporationNumber()` | ⚠️ | Was missing, fixed in #607 |
| Rate limit 30s delay | ✅ | OC_REQ_INTERVAL_MS = 30000 |
| API key from env var | ✅ | OPENCORPORATES_API_KEY |
| Graceful error handling | ✅ | All catch blocks return empty |
| OpenCorporates attribution | ✅ | source/license/attribution in every response |
| Tests with mock fixtures | ❌ | No test fixtures |
| Registry entry | ✅ | Under corporate category |
| `.env.example` updated | ✅ | |

### Gaps
1. No tests with mock API responses


## Systemic Quality Issues

### #548 Violation: 33 Modules Without Structured Parsers

Every module MUST have a source-specific parser that extracts structured typed fields.
**33/116 modules (28%) are non-compliant.**

Modules I created without parsers:
- energy, financial-regulation, housing-data, opencorporates, real-estate, utilities, ontario-provincial

### #567 — openparliament.ca Integration ⚠️
Issue requires structured parliamentary data with proper fields. MCP tools `search_debates`, `get_member_info`, `search_bills` exist in tools/ but need verification against the full requirements.

### Key Systemic Problems Found
1. Multiple issues closed with CKAN-search-only "implementations" that don't meet requirements
2. No systematic verification of acceptance criteria before closing
3. Types often don't match what the issue specified
4. Tests missing for most modules I created
5. 33 modules lack structured field parsers (violating #548)
6. Entity resolution (#414) is a standalone module, not integrated into pipeline
7. Journalism mode (#138) has no MCP tool or SQL migration (in-memory only)

## Priority Fixes Needed

| Priority | Fix | Issues Affected |
|---|---|---|
| P0 | Add structured parsers to 33 modules | #548 mandate |
| P0 | Fix function names/types per issue specs | #299, #301, #298 |
| P1 | Add missing tests | #299, #298, #295, #301, #315, #414, #138 |
| P1 | Add SQLite storage to watcher | #315 |
| P1 | Wire PII filter into LLM pipeline | #338 |
| P2 | Add per-city fetcher files | #410 |
| P2 | Add EntityResolutionService class | #414 |

## Raw Audit Data

| Issue | Gaps Found | Status |
|---|---|---|
| #301 | Types, constants, indexes wrong; land registry missing; rental registries missing | 🔴 |
| #299 | Function name wrong; missing CSA/OBSI; no tests; no cross-ref | 🔴 |
| #298 | Missing pipeline/renewable; wrong category; no tests | 🔴 |
| #295 | Missing tests; was missing getFilings/getCompanyByCorporationNumber (fixed #607) | 🟡 |
| #294 | Missing tests; license not in constants; address field | 🟡 |
| #307 | ✅ Complete | 🟢 |
| #308 | ✅ Complete | 🟢 |
| #310 | ✅ Complete | 🟢 |
| #315 | Missing SQLite, re-ingestion trigger, tests | 🔴 |
| #414 | Missing service class, pipeline integration, tests | 🔴 |
| #410 | Missing per-city fetcher files | 🟡 |
| #138 | Missing MCP tool, SQL migration, tests | 🔴 |
| #338 | Not wired into pipeline; MCP tools not scoped | 🔴 |
| #255 | Not in api-server; no trace ID | 🟡 |
| #548 | 33/116 modules lack parsers | 🔴 |

**Tracking issue: #608**
