# Audit: LODE-ECDO Data-Type Coverage Gap Analysis

> Issue: #569
> Status: Cross-reference of MapleSpike 91 modules against LODE-ECDO data-type categories completed.

---

## 1. Reference Data

**Source**: CSBP-CPSE/LODE-ECDO — `MasterList_OpenDataPortals.csv`
- 80+ Canadian open data portals
- Categorized by **data type** (Libraries, Hospitals, GTFS, Buildings, Businesses, Police, Fire, Education, Parks, Community Centers)
- Produced by Statistics Canada's Data Exploration and Integration Lab (DEIL)

---

## 2. Coverage Map

### Data Types Tracked by LODE-ECDO

| Data Type | Portals with this type | MapleSpike Module | Coverage Status |
|-----------|:---------------------:|:-----------------:|:---------------:|
| **Libraries** | 17 portals (ON: Ottawa, Toronto, Kingston, Kitchener, etc.; QC: Montreal, Quebec City, Gatineau, etc.) | ❌ **None** | 🚫 **GAP** |
| **Hospitals** | 16 portals (BC, AB, ON, QC, NL, NS, NB, PE, SK) | ⚠️ Health Canada, CIHI (partial) | ⚠️ Partial — no structured hospital facility data |
| **GTFS Transit** | 29 portals (municipal transit agencies across ON, QC, BC, AB) | ❌ **None** | 🚫 **GAP** |
| **Buildings** | 70+ portals | ❌ **None** (ODB exists but not ingested) | 🚫 **GAP** |
| **Businesses** | 20+ portals (Toronto, Brampton, Edmonton, Calgary, Surrey, etc.) | ✅ Corporate registry, CRA Charity | ✅ Covered |
| **Police** | 16 portals (Toronto, Calgary, Edmonton, Winnipeg, Peel, etc.) | ❌ **None** (emergency module removed) | 🚫 **GAP** |
| **Fire** | 15 portals (Toronto, Calgary, Edmonton, Mississauga, etc.) | ❌ **None** | 🚫 **GAP** |
| **Education** | 17 portals (Ontario, BC AB, QC, SK, etc.) | ⚠️ Education research, statistics (partial) | ⚠️ Partial |
| **Parks** | 12 portals (Calgary, Mississauga, Surrey, Gatineau, etc.) | ❌ **None** | 🚫 **GAP** |
| **Community Centers** | 10 portals (Calgary, Mississauga, Surrey, etc.) | ❌ **None** | 🚫 **GAP** |

---

## 3. Gap Analysis

### Critical Gaps (0 coverage, high public impact)

| Gap | Portals Available | Impact |
|:---:|:-----------------:|:------:|
| **Libraries** | 17+ (Toronto, Ottawa, Montreal, etc.) | **High** — civic infrastructure tracking |
| **GTFS Transit** | 29+ (TTC, STM, TransLink, OC Transpo, etc.) | **Very High** — mobility patterns, urban influence |
| **Police Data** | 16+ (Toronto Police, Calgary, Edmonton, etc.) | **Very High** — accountability tracking (already removed from registry) |
| **Fire Stations** | 15+ (major cities) | **Medium** — emergency infrastructure |
| **Parks & Recreation** | 12+ | **Medium** — urban planning, public goods |

### Secondary Gaps (partial coverage, could be enhanced)

| Gap | Current Coverage | Enhancement Needed |
|:---:|:----------------:|:------------------:|
| **Hospitals / Healthcare** | CIHI data, Health Canada drug approvals | No facility-level hospital data |
| **Education Facilities** | Statistics Canada, education research | No school-level facility data |
| **Buildings** | Corporate addresses only | Open Database of Buildings (14.4M features) not ingested |

---

## 4. Top-5 Priority New Module Recommendations

Based on public impact, data availability, and alignment with MapleSpike's mission:

### P1 — GTFS Transit Module
- **Why**: 29+ transit agencies publish GTFS data. Essential for urban mobility tracking, transit equity analysis, and Canadian infrastructure intelligence.
- **Data**: TTC (Toronto), STM (Montreal), TransLink (Vancouver), OC Transpo (Ottawa), plus 25+ more
- **Format**: Standard GTFS (CSV/ZIP) — well-documented, consistent schema
- **Effort**: Medium — GTFS parser needed, but format is standard

### P1 — Library Data Module
- **Why**: Libraries are key civic infrastructure. 17+ portals have data. Low-hanging fruit.
- **Data**: Location, hours, services, circulation
- **Format**: CKAN/Socrata (most major city portals)
- **Effort**: Low — reuses existing portal detection logic

### P2 — Police Data Module (Reinstate)
- **Why**: Police data was previously removed. 16+ portals have use-of-force, crime stats, budget data.
- **Data**: Crime statistics, use-of-force reports, police budgets
- **Format**: CKAN/Socrata
- **Effort**: Medium — data quality varies by jurisdiction

### P2 — Open Database of Buildings Integration
- **Why**: LODE's Open Database of Buildings (ODB v3) has 14.4M building features from 530 datasets. Massive geospatial intelligence opportunity.
- **Data**: Addresses, footprints, use types
- **Format**: CSV (already harmonized by StatCan)
- **Effort**: Low-Medium — CSV import, data is pre-cleaned

### P2 — Parks & Recreation Module
- **Why**: 12+ portals with park, trail, and recreation data. Important for urban quality-of-life indicators.
- **Data**: Location, amenities, size
- **Format**: CKAN/Socrata
- **Effort**: Low-Medium

---

## 5. Methodology

1. Extracted all portal entries from `MasterList_OpenDataPortals.csv`
2. For each portal, checked which data types (`Libraries`, `Hospitals`, `GTFS`, etc.) have "Yes" 
3. Cross-referenced each data type against MapleSpike's `registry.ts` module list
4. Classified coverage as: ✅ Full, ⚠️ Partial, 🚫 Gap
5. Prioritized gaps by: data availability (# of portals), public impact, alignment with mission

---

## 6. Next Steps

- [ ] File issue for **GTFS Transit** module (P1)
- [ ] File issue for **Library Data** module (P1)
- [ ] File issue for **Police Data** module (P2) — reinstatement with scope limitations
- [ ] File issue for **ODB Buildings** integration (P2)
- [ ] File issue for **Parks & Recreation** module (P2)
- [ ] Add `docs/data-type-coverage.md` to track progress
- [ ] Update CI gate to include data-type coverage check
