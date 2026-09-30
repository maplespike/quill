---
last-reviewed: 2026-07-07
status: active
---

# UN Data Sources Research — Issue #562

> Historical research snapshot. This report is not dataset-level clearance or legal advice. Verify current UNdata and agency terms, dataset scope, attribution, exclusions, API conditions, and intended uses before reuse. Compatibility assertions below are withdrawn; Quill software license declarations remain unresolved.

**Date**: 2026-06-02
**Status**: ✅ Implementation Complete (Issue #582)
**Research Summary**

---

## Executive Summary

UN data ingestion module is **production-ready** with broad coverage across 7 categories:
- ✅ 10 databases via UN SDMX REST API
- ✅ Categories: population, trade, development, environment, health, education, energy, finance
- ✅ Batch processing (5 databases per batch) with 60s timeout
- ✅ SDMX-ML/XML parsing to JSON with dimension extraction

UNdata portal provides reliable aggregated data, but agency-specific APIs (UNDP, UNCTAD, UNESCO, ILO, FAO) offer richer, specialized datasets not yet integrated.

---

## Existing Implementation

**Location**: `packages/pipeline-core/src/ingestion/un/`

| File | Purpose |
|------|---------|
| `index.ts` | Main ingestion functions (`ingestUnDataset`, `ingestByDatabase`, `ingestAllUn`) |
| `api.ts` | SDMX REST API client with XML parsing |
| `parser.ts` | SDMX observation and series parsing |
| `constants.ts` | Database definitions and URL builders |
| `types.ts` | TypeScript types |

**Key Functions**:
```typescript
ingestUnDataset(dataflowId, options?)           // Single database ingestion
ingestByDatabase(category, options?)            // Category-based batch ingestion
ingestAllUn(options?)                           // Full batch ingestion (10 databases)
parseUnObs(obs, dims, ...)                      // SDMX observation parser
```

**MCP Tool**: `search_un` for querying UN datasets

---

## Research Requirements vs Implementation Status

### Required by Issue #562

| Requirement | Status | Notes |
|-------------|--------|-------|
| UNDP Human Development Reports | ❌ Not implemented | High priority addition |
| UNCTADstat (trade & investment) | ⚠️ Partial | Trade covered, but UNCTAD FDI missing |
| UN Comtrade | ✅ Implemented | UN_DATABASES.TRADE database |
| UN Data portal (data.un.org) | ✅ Implemented | 10 databases via SDMX API |
| UN OHCHR (human rights) | ❌ Not implemented | Medium priority, specialized API |
| UNESCO (education, culture, science) | ⚠️ Partial | Education covered via UIS, but UNESCO-specific data missing |
| ILO (labor statistics) | ❌ Not implemented | Medium priority, dedicated ILO API |
| FAO (food, agriculture, fisheries) | ❌ Not implemented | Medium priority, dedicated FAO API |
| WHO (health) | ⚠️ Partial | Health covered via UN HEALTH database |
| UNHCR (refugees, displacement) | ❌ Not implemented | Low priority, specialized API |
| UNICEF (children, maternal health) | ❌ Not implemented | Low priority, specialized API |
| API endpoints identified | ✅ Documented | SDMX REST API + agency-specific APIs |
| Data formats characterized | ✅ Documented | SDMX-ML/XML parsed to JSON |
| Sample queries tested | ✅ Tested | Trade, population, health databases working |
| Usage terms verified | ⚠️ Historical note only | Review current terms for each dataset and use |

---

## Current Coverage (10 Databases)

### By Category

| Category | Databases | Status |
|----------|-----------|--------|
| **Population** | 2 | ✅ World Population Prospects, Population & Vital Statistics |
| **Trade** | 2 | ✅ UN Comtrade, Trade in Services |
| **Development** | 1 | ✅ Development Indicators |
| **Environment** | 1 | ✅ Environment Statistics |
| **Health** | 1 | ✅ Health Statistics (WHO/UN) |
| **Education** | 1 | ✅ Education Statistics (UIS) |
| **Energy** | 1 | ✅ Energy Statistics |
| **Finance** | 1 | ✅ National Accounts Main Aggregates |

### Database Details

| Database Code | Name | Category | Update Frequency |
|---------------|------|----------|------------------|
| POP | World Population Prospects | Population | Biennial |
| POP_VITAL | Population and Vital Statistics | Population | Annual |
| TRADE | International Trade (Comtrade) | Trade | Annual |
| TRADE_SERVICES | Trade in Services | Trade | Annual |
| NATIONAL_ACCOUNTS | National Accounts Main Aggregates | Finance | Quarterly |
| DEVELOPMENT | Development Indicators | Development | Annual |
| ENVIRONMENT | Environment Statistics | Environment | Annual |
| ENERGY | Energy Statistics | Energy | Annual |
| EDUCATION | Education Statistics (UIS) | Education | Annual |
| HEALTH | Health Statistics (WHO/UN) | Health | Annual |

---

## Coverage Gaps & Recommendations

### High Priority (Add Now)

| Dataset | API | Why | Effort |
|---------|-----|-----|--------|
| UNDP Human Development Reports | Dedicated API | HDI, IHDI, GII — development benchmarking | Medium |
| UNCTADstat (FDI) | Dedicated API | FDI statistics, trade flows — high strategic value | Low |

### Medium Priority (Add After Pilot)

| Dataset | API | Indicators | Why | Effort |
|---------|-----|------------|-----|--------|
| ILO Labour Statistics | ILO API | ~100 indicators | Labor market data gaps | Medium |
| UNESCO (culture, science) | UNESCO API | ~50 indicators | Soft power tracking | Medium |
| FAO (food, agriculture) | FAO API | ~200 indicators | Food security, trade | Medium |

### Low Priority (Defer)

| Dataset | API | Why | Effort |
|---------|-----|------|--------|
| UNHCR Refugee Data | Dedicated API | Refugee tracking important but specialized | Medium |
| UNICEF | Dedicated API | Child welfare, maternal health | Medium |
| UN OHCHR (human rights) | Specialized API | Human rights indices — niche use case | High |

---

## API Details

### UNdata SDMX REST API (Primary)

**Endpoint**:
```
Base: http://data.un.org/ws/rest
Dataflow listing: /dataflow/
Dataset fetch: /data/{agency},{dataflowId},{version}/{key}/{startTime}/{endTime}
```

**Authentication**:
- **None required** for public datasets
- 60s timeout indicates conservative rate limit handling

**Data Formats**:
- **SDMX-ML 2.1 (XML)** (primary) — Parsed to JSON
- JSON also available via format parameter
- CSV export available via UNdata Explorer

**Rate Limits**:
- **Not explicitly documented**
- Batch processing: 5 databases per batch
- Timeout: 60 seconds per request

### Agency-Specific APIs (Not Yet Integrated)

| Agency | API | Auth | Rate Limit |
|--------|-----|------|------------|
| UNDP | REST API 2.0 | API key required | Not documented |
| UNCTAD | SDMX REST | None | Moderate |
| ILO | ILOSTAT API | None | Documented |
| UNESCO | UIS API | None | Documented |
| FAO | FAOSTAT API | None | Documented |
| UNHCR | Refugee Statistics API | None | Documented |
| UNICEF | Data Warehouse API | API key | Not documented |
| OHCHR | No public API | — | — |

---

## Data Quality & Validation

### Strengths
- ✅ SDMX XML parsing robust and validated
- ✅ Dimension extraction from series metadata
- ✅ Error handling for missing/invalid observations
- ✅ SHA-256 hash for citation
- ✅ Batch processing with configurable timeout
- ✅ Category-based ingestion

### Limitations
- ⚠️ Only 10 of 50+ UN databases implemented (~20%)
- ⚠️ No agency-specific APIs integrated
- ⚠️ SDMX parsing is verbose (XML → JSON overhead)
- ⚠️ No historical backfill configured
- ⚠️ No differential updates (full fetch each time)

---

## Licensing — Research Leads, Not Clearance

This report previously characterized UNdata terms as permissive and compatible with Quill; those conclusions are withdrawn. Consult current UNdata terms and the specific agency and dataset notices. Agency terms may differ. Confirm scope, attribution, exclusions, API conditions, and intended uses before reuse. Metadata added by the integration is not proof of publisher permission or dataset coverage.

---

## Sample Data (Tested)

### UN Comtrade Trade Data
```json
{
  "id": "sha256:...",
  "databaseCode": "UNSD/DF_TRADE",
  "databaseName": "International Trade (Comtrade)",
  "category": "trade",
  "value": 1250000000,
  "refArea": "124",
  "refAreaName": "Canada",
  "timePeriod": "2023",
  "year": 2023,
  "unit": "US$",
  "seriesKey": "REPORTER=124|PARTNER=842|COMMODITY=TOTAL",
  "ingestedAt": "2026-06-02T15:30:00.000Z",
  "sourceUrl": "http://data.un.org/Data.aspx?d=TRADE"
}
```

### World Population Prospects
```json
{
  "id": "sha256:...",
  "databaseCode": "UNSD/DF_POP",
  "databaseName": "World Population Prospects",
  "category": "population",
  "value": 38500000,
  "refArea": "124",
  "refAreaName": "Canada",
  "timePeriod": "2024",
  "year": 2024,
  "seriesKey": "LOCATION=124|VARIANT=Medium",
  "ingestedAt": "2026-06-02T15:30:00.000Z",
  "sourceUrl": "http://data.un.org/Data.aspx?d=POP"
}
```

---

## Priority Ranking for Phase 2

| Priority | Dataset/Agency | Indicators | Strategic Value | Integration Effort | Timeline |
|----------|----------------|------------|-----------------|-------------------|----------|
| 1 | UNDP HDR | ~20 | High | Medium | 2-3 weeks |
| 2 | UNCTADstat (FDI) | ~30 | High | Low | 1 week |
| 3 | ILO Labour | ~100 | Medium | Medium | 2-3 weeks |
| 4 | UNESCO (UIS+Agency) | ~50 | Medium | Medium | 2-3 weeks |
| 5 | FAO (FAOSTAT) | ~200 | Medium | Medium | 2-3 weeks |
| 6 | UNHCR Refugee | ~15 | Low | Medium | 2 weeks |
| 7 | UNICEF | ~30 | Low | Medium | 2 weeks |

**Total Phase 2 Effort**: 3-4 months

---

## Recommendations

### Short-Term (Pilot Phase)
1. **Current implementation is production-ready** — 10 databases provide solid baseline
2. No blockers for Phase 1 rollout
3. Trade and population data support core influence tracking

### Medium-Term (Phase 2)
1. Add **UNCTADstat FDI data** — high value, closes trade gap, low effort
2. Add **UNDP Human Development Reports** — development benchmarking complements World Bank data
3. Evaluate ILO integration for labor market tracking

### Long-Term
1. Defer specialized agency APIs (UNHCR, UNICEF) unless specific use cases emerge
2. Consider WHO GHO API if more detailed health data needed
3. Implement differential updates (only fetch new years)

---

## Acceptance Criteria (from Issue #562)

| Criteria | Status |
|----------|--------|
| Documented research findings | ✅ This document |
| API endpoints identified | ✅ SDMX + 8 agency APIs documented |
| Data formats characterized | ✅ SDMX-ML/XML parsed to JSON |
| Sample queries tested | ✅ Trade, population, health databases tested |
| Usage terms verified | ⚠️ Dataset-level scope and current agency terms remain to be checked |
| Priority ranking assigned | ✅ See "Priority Ranking" section |
| Pilot phase recommendation | ✅ Current implementation ready |

---

## Next Steps

1. ✅ Close issue #562 with this research summary
2. Create follow-up issue: "feat: add UNCTADstat FDI data (closes #562 gap)"
3. Create follow-up issue: "feat: add UNDP Human Development Reports API"
4. Schedule Phase 2 implementation after pilot phase success metrics

---

**Research Status**: ✅ COMPLETE
**Implementation Status**: ✅ PRODUCTION READY (baseline)
**Issue Closure**: Ready to close #562