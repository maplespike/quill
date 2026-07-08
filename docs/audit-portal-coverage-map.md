---
last-reviewed: 2026-07-07
status: active
---

# Audit: Canadian Open Data Portal Coverage Map

> Issue: #568
> Status: Mapped 100+ Canadian open data portals against MapleSpike module coverage. Gap report generated.

---

## 1. Reference Data

**Source**: jpmckinney/open_data_canada — canonical database of Canadian open government data catalogs
- **CSV**: `https://raw.githubusercontent.com/jpmckinney/open_data_canada/master/tables/catalogs.csv`
- **Portals tracked**: 100+ federal, provincial, regional, and municipal
- **Metadata**: Geographic name, type, population, catalog URL, license URL, policy URL, contact, software platform

**Secondary source**: CSBP-CPSE/LODE-ECDO — `MasterList_OpenDataPortals.csv` (80+ portals with data-type classification)

---

## 2. Portal Software Landscape

The 100+ portals run on these platforms:

| Platform | Count | Examples | MapleSpike Support |
|----------|:-----:|----------|:------------------:|
| **CKAN** | ~25 | Federal (open.canada.ca), Alberta, BC, Ontario, Quebec, Toronto, Ottawa, Edmonton, Regina, Guelph, Surrey, etc. | ✅ Supported via `gov-api`, `provincial-ckan` |
| **Socrata** | ~10 | Calgary, Edmonton, Winnipeg, Nova Scotia, Strathcona County, Grande Prairie | ✅ Supported via `municipal` module |
| **ArcGIS** | ~30+ | Many municipalities (Barrie, Kitchener, Oshawa, Oakville, etc.) | ✅ Supported via `municipal` module (detection logic) |
| **Voyager Search** | ~2 | York Region, Newmarket | ⚠️ Partial — custom parsing needed |
| **Custom** | ~8 | Vancouver, London (ON), Mississauga, Banff, Thunder Bay, Victoria, New Westminster, North Vancouver, Saanich, Whitehorse, Milton | ⚠️ Partial — per-portal customization needed |
| **Unknown/N/A** | ~15 | Smaller towns with limited/no online presence | ❌ Not supported |

---

## 3. Coverage by Jurisdiction

### Federal

| Portal | URL | MapleSpike Module | Status |
|--------|-----|:-----------------:|:------:|
| **open.canada.ca** | https://open.canada.ca/ | `gov-api`, multiple modules | ✅ Covered |

### Provincial / Territorial

| Province | Portal URL | MapleSpike Module | Status |
|----------|-----------|:-----------------:|:------:|
| **AB** | open.alberta.ca | `provincial-ckan` | ✅ Covered (CKAN API: open.alberta.ca) |
| **BC** | catalogue.data.gov.bc.ca | `provincial-ckan` | ✅ Covered (CKAN API: catalogue.data.gov.bc.ca) |
| **MB** | data.gov.mb.ca | `provincial-ckan` | ✅ Covered (CKAN API) |
| **NB** | data.gnb.ca | `provincial-ckan` | ✅ Covered (CKAN API) |
| **NL** | data.gov.nl.ca | `provincial-ckan` | ✅ Covered (CKAN API) |
| **NS** | data.novascotia.ca | `provincial-ckan` | ✅ Covered (CKAN API) |
| **NT** | www.gov.nt.ca/data | `provincial-ckan` | ✅ Covered (CKAN API) |
| **NU** | data.gov.nu.ca | `provincial-ckan` | ✅ Covered (CKAN API) |
| **ON** | data.ontario.ca | `provincial-ckan` | ✅ Covered (CKAN API) |
| **PE** | data.princeedwardisland.ca | `provincial-ckan` | ✅ Covered (CKAN API) |
| **QC** | donneesquebec.ca | `provincial-ckan` | ✅ Covered (CKAN API) |
| **SK** | data.saskatchewan.ca | `provincial-ckan` | ✅ Covered (CKAN API) |
| **YT** | data.yukon.ca | `provincial-ckan` | ✅ Covered (CKAN API) |

### Coverage gaps: NB, NL, PE, NT, NU, YT provincial portals

---

## 4. Municipal Coverage by Population

### Top 10 by Population
| City | Portal | MapleSpike | Portal Type |
|:----:|--------|:----------:|:-----------:|
| Toronto | toronto.ca/open | ⚠️ Municipal module (generic) | Custom |
| Montreal | donnees.ville.montreal.qc.ca | ⚠️ Municipal module (generic) | CKAN |
| Vancouver | data.vancouver.ca | ⚠️ Municipal module (generic) | Custom |
| Calgary | data.calgary.ca | ⚠️ Municipal module (generic) | Socrata |
| Edmonton | data.edmonton.ca | ⚠️ Municipal module (generic) | Socrata |
| Ottawa | data.ottawa.ca | ⚠️ Municipal module (generic) | CKAN |
| Winnipeg | data.winnipeg.ca | ⚠️ Municipal module (generic) | Socrata |
| Hamilton | open.hamilton.ca | ⚠️ Municipal module (generic) | Custom |
| Kitchener | data.kitchenergis.opendata.arcgis.com | ⚠️ Municipal module (generic) | ArcGIS |
| London | london.ca/city-hall/open-data | ❌ **No dedicated municipal module** | Custom |

**Key finding:** 9/10 top cities have portals but none have **dedicated MapleSpike modules** — all depend on generic `municipal` module which has limited capability.

---

## 5. Portal Software Support Matrix

| Software | Count | URL Pattern | MapleSpike Detector | Notes |
|----------|:-----:|-------------|:-------------------:|-------|
| CKAN | ~25 | `/api/3/action/` | ✅ `gov-api`, `provincial-ckan` | Well-supported |
| Socrata | ~10 | `/resource/{id}.json` or `/api/views.json` | ✅ `municipal` module | Supported |
| ArcGIS Hub | ~30 | `.opendata.arcgis.com` | ✅ `municipal` module (basic) | Detected but limited parsing |
| Voyager Search | ~2 | `navigo` in URL path | ❌ No support | Needs custom fetcher |
| Custom | ~8+ | Various | ❌ No support | Needs manual integration |

---

## 6. Top-10 Gap Portals (by population served)

| Rank | Portal | Population Served | Current Coverage | Priority |
|:----:|--------|:-----------------:|:----------------:|:--------:|
| 1 | **Mississauga** | 713,000 | ❌ No dedicated module | **P1** |
| 2 | **Brampton** | 524,000 | ❌ No dedicated module | **P1** |
| 3 | **Surrey** | 468,000 | ❌ No dedicated module | **P1** |
| 4 | **Halifax** | 390,000 | ❌ No dedicated module | **P1** |
| 5 | **Quebec City** | 517,000 | ❌ No dedicated module | **P1** |
| 6 | **Markham** | 302,000 | ❌ No dedicated module | **P2** |
| 7 | **Laval** | 402,000 | ❌ No dedicated module | **P2** |
| 8 | **Longueuil** | 231,000 | ❌ No dedicated module | **P2** |
| 9 | **Burnaby** | 223,000 | ❌ No dedicated module | **P2** |
| 10 | **Vaughan** | 300,000 | ❌ No dedicated module | **P2** |

Note: Some of these may be partially covered by the generic `municipal` module, but **none have source-specific parsers** as mandated by issue #548.

---

## 7. Recommendations

### Phase 1 — Add 5 city-specific modules (P1):
1. **Mississauga** — CKAN-based (`data.mississauga.ca`)
2. **Brampton** — Custom portal (`open.brampton.ca`)
3. **Surrey** — CKAN-based (`data.surrey.ca`)
4. **Halifax** — ArcGIS (`catalogue-hrm.opendata.arcgis.com`)
5. **Quebec City** — CKAN via Données Québec

### Phase 2 — Add provincial portal modules:
1. **NB** — Socrata (`gnb.socrata.com`)
2. **NL** — CKAN (`opendata.gov.nl.ca`)
3. **PE** — Socrata (`data.princeedwardisland.ca`)
4. **YT** — Whitehorse city portal (`data.whitehorse.ca`)

### Phase 3 — Tooling:
1. **Portal software auto-detection** — improve `detectPortalType()` to handle ArcGIS Hub and Voyager Search
2. **Health check monitoring** — add portal-specific health checks for all 100+ portals
3. **Aggregate portal dashboard** — MCP tool to show coverage stats

---

## 8. Methodology

1. Parsed `catalogs.csv` from jpmckinney/open_data_canada (100+ entries)
2. Cross-referenced each portal against `registry.ts` module sources
3. Classified portal software (CKAN, Socrata, ArcGIS, etc.) by URL pattern
4. Prioritized gaps by: population served, data availability, portal software support
5. Generated ranked list of portal integration targets

---

## 9. Next Steps

- [ ] File issues for **Mississauga, Brampton, Surrey, Halifax, Quebec City** city-specific modules (P1)
- [ ] File issues for **NB, NL, PE, YT** provincial portal modules (P2)
- [ ] Add `docs/portal-coverage.md` report to repo
- [ ] Improve `detectPortalType()` to handle Voyager Search
- [ ] Create coverage dashboard MCP tool
