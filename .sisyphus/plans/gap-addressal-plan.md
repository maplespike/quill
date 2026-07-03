> ⚠️ **Historical artifact** — This document is preserved for context. The single source of truth for the active backlog is [`ROADMAP.md`](./ROADMAP.md). Do not edit without also updating ROADMAP.md.


# MapleSpike Gap Addressal Plan — 103→150 Modules

> **Goal**: Address all identified gaps to hit 150 modules across federal, provincial, territorial, and municipal Canadian public data.
> **Current**: 103 registry entries, 126 MCP tools, 84 ingestion pipelines
> **Target**: 150 modules, 160+ MCP tools, 120+ ingestion pipelines
> **Timeline**: 12 phases, ~90 days

---

## Phase 1 — GTFS Transit Expansion ✅ *DONE*
- **31 agencies** across 10 provinces (was 7)
- ZIP extraction, full GTFS parsing (routes, stops, trips, calendar)
- 4 new MCP tools: `list_gtfs_agencies`, `search_gtfs_routes`, `search_gtfs_stops`
- **Issue**: #599

## Phase 2 — Library Data Module (NEW)
**Impact**: High | **Effort**: Low | **Target**: +15 modules

- 17+ municipal portals publish library data
- Reuse existing CKAN/Socrata/ArcGIS Hub detection
- Data: location, hours, services, circulation, branches
- **Cities**: Toronto, Ottawa, Montreal, Vancouver, Calgary, Edmonton, Winnipeg, Hamilton, London, Mississauga, Brampton, Surrey, Burnaby, Kitchener, Halifax
- **MCP tools**: `search_libraries`, `get_library_by_city`

## Phase 3 — Police Data Expansion
**Impact**: High | **Effort**: Medium | **Target**: +10 modules

- 16+ municipal police portals (Toronto, Vancouver, Montreal, Calgary, Edmonton, Ottawa, Winnipeg, Hamilton, Peel, Durham, York, Halifax, Quebec City, London, Windsor, Saskatoon)
- Data: use-of-force reports, local crime stats, budgets, service calls
- **MCP tools**: `search_police_data`, `get_crime_stats`, `compare_crime_rates`

## Phase 4 — Parks & Recreation Module (NEW)
**Impact**: Medium | **Effort**: Low | **Target**: +12 modules

- 12+ portals with park, trail, and recreation facility data
- Data: location, amenities, size, trail networks
- **MCP tools**: `search_parks`, `get_parks_by_city`

## Phase 5 — Real-Time Feed Expansion
**Impact**: High | **Effort**: Low | **Target**: +8 modules

- Amber Alerts, Silver Alerts, emergency broadcast system
- Traffic cameras (city open data portals)
- Air quality monitoring stations
- Flood warnings, earthquake alerts
- Environmental incident real-time feeds
- **MCP tools**: `get_amber_alerts`, `get_air_quality`, `get_traffic_cameras`

## Phase 6 — Provincial Regulator Deep-Dive
**Impact**: High | **Effort**: Medium | **Target**: +10 modules

- Securities commissions (OSC, BCSC, AMF, ASC, FCAA)
- Law societies (LSO, LSBC, Barreau QC)
- Medical colleges (CPSO, CPSBC, CMQ)
- Engineering regulators (PEO, EGBC, OIQ)
- **MCP tools**: `search_regulator_data`, `get_discipline_records`

## Phase 7 — Utilities Infrastructure
**Impact**: Medium | **Effort**: Medium | **Target**: +7 modules

- Hydro/electrical utilities (Hydro One, BC Hydro, Hydro-Québec)
- Natural gas (Enbridge, Fortis)
- Water utilities
- Telecom infrastructure
- Data: outage reports, rate schedules, service territories
- **MCP tools**: `search_utility_outages`, `compare_utility_rates`

## Phase 8 — Housing Market Deep-Dive
**Impact**: Medium | **Effort**: Medium | **Target**: +5 modules

- Rental market trends (CMHC rental market survey)
- Affordable housing inventory
- Vacancy rates by city
- Housing starts completions
- **MCP tools**: `search_housing_data`, `get_rental_stats`

## Phase 9 — Transport Infrastructure
**Impact**: Medium | **Effort**: Medium | **Target**: +5 modules

- Airport operations data (CATSA, NAV CANADA)
- Port statistics (Vancouver, Montreal, Halifax)
- Rail traffic (CN, CP, VIA Rail)
- Shipping data
- **MCP tools**: `search_transport_data`, `get_port_stats`

## Phase 10 — Cross-Reference Engine Enhancement
**Impact**: High | **Effort**: High | **Target**: +5 modules

- GIC ↔ lobbying ↔ committees ↔ parliamentary voting network
- Political donations ↔ lobbying outcomes correlation
- Campaign finance data integration
- Entity resolution across all modules
- **MCP tools**: `get_influence_network`, `find_connections_expanded`

## Phase 11 — Data Quality & Infrastructure
**Impact**: High | **Effort**: High | **Target**: +3 modules

- Data validation framework (schema validation, anomaly detection, dedup)
- Event-driven architecture (webhooks, event bus, change detection)
- Geographic intelligence (census tract integration, postal code mapping)

## Phase 12 — Remaining Modules to 150
**Impact**: Medium | **Effort**: Low | **Target**: +20 modules

- Science & research: NSERC grants, CFI funding, CRC chairs
- Historical data backfilling
- Indigenous communities data
- Smaller municipalities (under 100K)
- Regional district data

---

## Implementation Order

```
Week 1-2:   Phase 2 (Libraries) → Phase 4 (Parks) → Phase 5 (Real-time)
Week 3-4:   Phase 3 (Police) → Phase 6 (Regulators)
Week 5-6:   Phase 7 (Utilities) → Phase 8 (Housing)
Week 7-8:   Phase 9 (Transport) → Phase 12 (Remaining)
Week 9-10:  Phase 10 (Cross-reference) → Phase 11 (Infrastructure)
```

## Success Criteria

- [ ] 150 modules registered in registry.ts
- [ ] All modules pass build with zero errors
- [ ] All modules have ≥80% test coverage
- [ ] 160+ MCP tools registered
- [ ] No duplicate registry entries
- [ ] Module coverage test shows 100% export rate
