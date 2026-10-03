---
last-reviewed: 2026-07-07
status: active
---

# International Data Sources Research Update — Issues #562, #563, #564

> Historical implementation summary, not legal clearance. Its prior compatible-licensing assertion is withdrawn. Confirm current publisher terms and dataset-level scope for every source and use; Quill software license declarations are separately unresolved.

**Date**: 2026-06-02
**Related Issues**: #562 (UN), #563 (World Bank), #564 (OECD)
**Epic**: #557 (International Sources Expansion)

---

## Overview

All three research issues (#562, #563, #564) have been completed. Baseline implementations exist and are production-ready. This update documents the research findings, compares implementation against requirements, and provides prioritized recommendations for Phase 2 expansion.

---

## Summary of Findings

| Source | Implementation Status | Coverage | Gaps | Priority Gap |
|--------|----------------------|----------|------|--------------|
| **OECD** | ✅ Complete (#585) | 2 datasets (NAAG, Health) | Education, Economic Outlook, Tax | Medium |
| **World Bank** | ✅ Complete (#580) | 47 indicators across 6 topics | Agricultural development | High |
| **UN** | ✅ Complete (#582) | 10 databases across 7 categories | UNDP HDR, UNCTAD FDI, agency APIs | High |

---

## Key Recommendations

### Immediate Actions (Pilot Phase)
1. ✅ **All three modules are production-ready** — no blockers for Phase 1
2. Close issues #562, #563, #564 with research summaries
3. Create follow-up issues for high-priority gaps

### Phase 2 Expansion (2-3 months)

| Priority | Source | Addition | Effort | Timeline |
|----------|--------|----------|--------|----------|
| 1 | World Bank | Agricultural Development topic | 1 week | 1 week |
| 2 | UN | UNCTADstat FDI data | 1 week | 1 week |
| 3 | OECD | Education at a Glance dataset | 1 week | 1 week |
| 4 | OECD | Economic Outlook dataset | 1 week | 1 week |
| 5 | UN | UNDP Human Development Reports API | 2-3 weeks | 2-3 weeks |
| 6 | World Bank | Expand to 100 indicators | 2 weeks | 2 weeks |
| 7 | OECD | Tax Database | 1 week | 1 week |
| 8 | UN | ILO Labour Statistics API | 2-3 weeks | 2-3 weeks |
| 9 | UN | UNESCO API | 2-3 weeks | 2-3 weeks |
| 10 | UN | FAO FAOSTAT API | 2-3 weeks | 2-3 weeks |

**Total Phase 2 Effort**: 2-3 months

---

## Implementation Quality Assessment

### Strengths (Common to All)
- ✅ Clean TypeScript with strict mode
- ✅ Proper error handling and validation
- ✅ SHA-256 citation hashes
- ✅ Attribution metadata preserved
- ✅ MCP tools integrated
- ✅ Batch processing with timeouts
- ⚠️ Dataset-level terms and software compatibility remain unverified

### Limitations (Common to All)
- ⚠️ Only baseline coverage (20-50% of available data)
- ⚠️ No differential updates (full fetch each time)
- ⚠️ No historical backfill configured
- ⚠️ Limited country coverage (default 16-50 countries)

---

## Next Steps

### 1. Close Research Issues
- ✅ Close #564 (OECD) with `docs/research-oecd-564.md`
- ✅ Close #563 (World Bank) with `docs/research-worldbank-563.md`
- ✅ Close #562 (UN) with `docs/research-un-562.md`

### 2. Create Follow-Up Issues
```
feat: add World Bank Agricultural Development topic (#563 gap)
feat: add UNCTADstat FDI data (#562 gap)
feat: expand OECD datasets — Education, Economic Outlook, Tax
feat: add UNDP Human Development Reports API (#562 priority)
feat: expand World Bank to 100 indicators
```

### 3. Phase 2 Planning
- Create dedicated epic for international expansion Phase 2
- Schedule after pilot phase success metrics (Q3 2026)
- Prioritize by strategic value (trade → development → governance)

---

## Cross-Source Priority Matrix

| Dataset | Source | Strategic Value | Integration Effort | Impact on Canadian Tracking |
|---------|--------|-----------------|-------------------|----------------------------|
| Agricultural Development | World Bank | High | Low | Food security, trade policy |
| UNCTAD FDI | UN | High | Low | Investment flows, economic influence |
| OECD Education | OECD | High | Low | Education policy benchmarking |
| OECD Economic Outlook | OECD | High | Low | GDP forecasts, fiscal planning |
| UNDP HDR | UN | High | Medium | Development rankings, policy comparison |
| ILO Labour | UN | Medium | Medium | Labor market, union influence |
| WDI Expansion | World Bank | Medium | Low | Broader economic coverage |
| OECD Tax | OECD | Medium | Low | Tax policy comparison |
| UNESCO | UN | Medium | Medium | Soft power, cultural influence |
| FAO | UN | Medium | Medium | Food security, agricultural trade |

---

## Conclusion

All three international data sources are **production-ready for pilot phase**. Baseline implementations provide solid foundation for:
- Economic benchmarking (OECD, World Bank)
- Development tracking (World Bank, UN)
- Trade analysis (UN, World Bank)
- Policy comparison (OECD)

**Phase 2 expansion** will fill identified gaps and provide comprehensive international coverage for Canadian influence tracking.

---

**Research Status**: ✅ ALL COMPLETE
**Implementation Status**: ✅ ALL PRODUCTION READY
**Epic Progress**: Phase 1 complete, ready for Phase 2 planning