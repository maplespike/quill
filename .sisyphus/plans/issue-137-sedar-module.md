> ⚠️ **Historical artifact** — This document is preserved for context. The single source of truth for the active backlog is [`ROADMAP.md`](./ROADMAP.md). Do not edit without also updating ROADMAP.md.


# Plan: Issue #137 — SEDAR+ Corporate Filings Module

**Status**: Draft
**Created**: 2026-05-18
**Owner**: Sisyphus
**Issue**: https://github.com/reverb256/quill/issues/137
**Labels**: `enhancement`, `p2`, `module`

---

## Overview

Canadian public company filings (annual reports, MD&A, material change reports) are not ingested. SEDAR+ is the primary source for corporate disclosure in Canada. No free API exists — requires HTML crawl.

### Current State

| Aspect | Detail |
|--------|--------|
| Module location | `packages/pipeline-core/src/ingestion/corporate-filings/` |
| Existing files | 4 files (constants.ts, fetcher.ts, index.ts, types.ts) — thin stub |
| parser.ts | ❌ Missing |
| db.ts | ❌ Missing |
| Registry registration | ✅ Already registered at `registry.ts:506-515` |
| ingestFunctions | `['ingestAllFilings']` — placeholder |
| Sources | SEDAR+ regulatory filings (HTML) |
| GAP-ANALYSIS.md status | "Not started" |
| ROADMAP.md status | Marked DONE (stub) |

### Template: SEDI Module

The SEDI insider trading module (`packages/pipeline-core/src/ingestion/sedi/`) is the best pattern — same constraints (no API, HTML crawl, form POST, table parsing):

```
sedi/
├── constants.ts  # URLs, headers, MAJOR_TSX_ISSUERS, SEDI_DDL
├── types.ts      # SearchParams, RawRow, Result types
├── fetcher.ts    # HTTP POST form simulation, HTML table extraction (441 lines)
├── parser.ts     # Date/number normalization, dedup, SHA-256 hashing (340 lines)
└── index.ts      # Orchestrator: batch ingestion, concurrency, dry-run, DB ops (517 lines)
```

---

## Execution Plan

### Step 1: Expand `constants.ts`

Extend from current 4 lines to:
- SEDAR+ base URL, search endpoints, form field names/values
- Issuer taxonomy (TSX, TSX-V, CSE, etc.)
- Filing type categories (Annual Report, MD&A, Material Change, Prospectus, etc.)
- DEFAULT_HEADERS (same pattern as SEDI)
- DDL for `corporate_filings` table
- MAJOR_TSX_ISSUERS list (like SEDI's) — top 100 by market cap
- Concurrency limit, page size, retry settings

### Step 2: Expand `types.ts`

```typescript
interface RawFilingRow {
  issuerName: string;
  issuerCik?: string;
  filingType: string;
  filingDate: string;
  documentUrl: string;
  description?: string;
  formType?: string;
}

interface CorporateFilingsSearchParams {
  issuer?: string;
  cik?: string;
  filingType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
}

interface CorporateFilingsIngestionResult {
  records: CorporateFiling[];
  source: string;
  totalFetched: number;
  totalNew: number;
  errors: string[];
}
```

### Step 3: Implement `fetcher.ts`

Follow SEDI pattern:
- `postSedarSearch(params)` — HTTP POST simulating form submission, return HTML
- `extractFilingRows(html)` — regex-based `<table>` extraction returning `RawFilingRow[]`
- `searchSedarPlus(params)` — orchestrate search + pagination
- `fetchSedarForIssuer(issuerName)` — single-issuer fetch pipeline
- Graceful degradation: return `[]` on failure, log errors
- Timeout: 30s per request, 3 retries

### Step 4: Implement `parser.ts`

Follow SEDI parser pattern:
- `parseFilingDate(raw)` — normalize dates to `YYYY-MM-DD`
- `normalizeFilingType(raw)` — map raw text to canonical categories
- `normalizeFilingRow(raw)` — `RawFilingRow → CorporateFiling` with SHA-256 content hash
- `parseFilingReport(html)` — orchestrate: extractRows → normalize each → return
- `deduplicateFilings(records)` — Set-based dedup by CIK + date + type hash

### Step 5: Implement `db.ts`

- `initializeCorporateFilingsTable(db)` — CREATE TABLE IF NOT EXISTS
- `upsertFiling(db, filing)` — INSERT OR REPLACE by CIK + filing date + type
- `searchFilings(db, params)` — filter by issuer, date range, filing type
- `getLatestFilingDate(db, issuerName)` — for incremental ingestion
- `deleteOldFilings(db, beforeDate)` — TTL-based cleanup

### Step 6: Implement `index.ts`

- `ingestAllFilings(db, options?)` — orchestrate: table init → iterate issuers → summary
- `ingestFilingsForIssuer(db, issuer, options?)` — single-issuer pipeline
- Dry-run mode when `db = null`
- Concurrent issuer sweep with concurrency limit (like SEDI's `concurrentIssuerSweep`)
- Progress logging: `[SEDAR] Processed 15/100 issuers (150 filings, 12 errors)`

### Step 7: Update registry `ingestFunctions`

Update `registry.ts` entry for `corporate-filings`:
```typescript
ingestFunctions: ['ingestAllFilings', 'ingestFilingsForIssuer', 'searchFilings'],
```

### Step 8: Add tests

- **Unit tests**: parser (date normalization, filing type mapping, dedup), fetcher (mock HTML extraction)
- **Live test** (gated by `LIVE_DATA_TEST`): fetch a known issuer (e.g., Shopify, RBC) and verify 1+ records returned
- **Edge cases**: empty results, malformed HTML, partial columns, pagination boundary

---

## Verification

- [ ] `ingestAllFilings(null, { limit: 5 })` returns 5+ parsed records in dry-run mode
- [ ] `ingestFilingsForIssuer(db, 'Shopify Inc.')` persists records to DB
- [ ] `searchFilings(db, { issuer: 'Shopify' })` returns records
- [ ] Parser handles all major filing types (Annual Report, MD&A, Material Change, Prospectus, etc.)
- [ ] Dedup works: same filing fetched twice produces one DB row
- [ ] Registry entry updated with correct `ingestFunctions`
- [ ] `pnpm test` passes in pipeline-core
- [ ] metrics.json updated (lines + files)

---

## Risks

| Risk | Mitigation |
|------|------------|
| SEDAR+ site structure changes (no API, fragile) | Use broad selectors, log parsing errors, add weekly CI check of 1 known issuer |
| Rate limiting / IP blocking | Respect `robots.txt`, add delays between requests, single-thread per issuer |
| Filing volume too large for initial crawl | Start with top 20 TSX issuers, expand on success |
| SEDAR+ uses CAPTCHA | Fallback to open.canada.ca CKAN corporate data (existing fallback in stub fetcher) |
