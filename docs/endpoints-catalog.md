# MapleSpike — Live Endpoints Catalog

> **Updated:** 2026-05-13
> **Purpose:** Production-grade reference for every Canadian government data source.
> Every endpoint below is verified live as of May 13, 2026.

## 1. Immigration & Borders ✅ Module Built

| Source | Dataset | Endpoint | Format | Frequency |
|--------|---------|----------|--------|-----------|
| IRCC Permanent Residents | Admissions by province/territory, category, country | `https://open.canada.ca/data/en/dataset/f7e5498e-0ad8-4417-85c9-9b8aff9b9eda` | CSV/XLSX | Monthly |
| IRCC PR Direct CSVs | ODP-PR-PT_IMMCAT, ODP-PR-PT_CITIZ, ODP-PR-PT_CMA, etc. | `https://www.ircc.canada.ca/opendata-donneesouvertes/data/ODP-PR-PT_IMMCAT.csv` | CSV | Monthly |
| IRCC Express Entry | EE admissions by program, gender, province | `https://open.canada.ca/data/en/dataset/52e4b14b-597a-4ecf-a184-23a6e69b0d57` | CSV/XLSX | Monthly |
| IRCC Operational | Applications, visas, citizenship processing | `https://open.canada.ca/data/en/dataset/9b34e712-513f-44e9-babf-9df4f7256550` | XLSX/CSV | Monthly |
| IRB RPD Decisions | Grant/refusal by country, 100+ quarterly files | `https://open.canada.ca/data/en/dataset/6e47f705-71ed-41f0-8fd5-d1a8508a3b63` | CSV | Quarterly |
| CBSA Removals | Removals, detentions, seizures | `https://www.cbsa-asfc.gc.ca/agency-agence/reports-rapports/security-securite/removals-renvois-eng.html` | HTML/CSV | Quarterly |

## 2. National Defence ✅ Module Built

| Source | Dataset | Endpoint | Format | Frequency |
|--------|---------|----------|--------|-----------|
| DND Regular Force | Personnel by rank, gender, component | `https://open.canada.ca/data/en/dataset/460aa2e0-5a37-47cf-a858-98b4327d29de` | CSV | Quarterly |
| DND Civilian Personnel | Civilian employees by classification | `https://open.canada.ca/data/en/dataset/72c8bbf1-3a22-4510-8bc4-28c3c5e38838` | CSV | Quarterly |
| Defence Procurement | Contracts over $10K | CKAN proactive disclosure | CSV | Quarterly |

## 3. Indigenous Relations ⚠️ Stubs Started

| Source | Dataset | Endpoint | Format | Frequency |
|--------|---------|----------|--------|-----------|
| CIRNAC Specific Claims | Settlements, status, amounts | `https://services.aadnc-aandc.gc.ca/scbri_e/main/reportingcentre/external/externalreporting.aspx` | PDF/Excel | As published |
| ISC Infrastructure | Per-community projects, funding | `https://data.sac-isc.gc.ca/geomatics/rest/directories/...` | GeoPackage/WFS | Quarterly |

## 4. Criminal Justice ⚠️ Stubs Started

StatCan WDS cubes via `https://www150.statcan.gc.ca/t1/wds/rest/getAllCubesList`

## 5. Veterans Affairs 🔴 Needs Module

CKAN under owner_org=vac-acc on open.canada.ca

## 6. Transport Safety

| Source | Dataset | Endpoint | Format | Frequency |
|--------|---------|----------|--------|-----------|
| TSB Occurrences | Air, rail, marine, pipeline | `https://www.tsb.gc.ca/eng/stats/rail/index.html` | CSV | Monthly |

## 7. Provincial CKAN Portals

| Province | Portal | API |
|----------|--------|-----|
| Saskatchewan | `https://catalogue.saskatchewan.ca` | `/api/3/action/package_list` |
| Manitoba | `https://data.gov.mb.ca` | `/api/3/action/package_list` |
| Nova Scotia | `https://data.novascotia.ca` | `/api/3/action/package_list` |
| British Columbia | `https://catalogue.data.gov.bc.ca` | `/api/3/action/package_list` |
| Ontario | `https://data.ontario.ca` | `/api/3/action/package_list` |
| Alberta | `https://open.alberta.ca/opendata` | `/api/3/action/package_list` |
| Quebec | `https://donneesquebec.ca` | `/api/3/action/package_list` |

## 8. Municipal CKAN Portals

Toronto: `https://ckan0.cf.opendata.inter.prod-toronto.ca` / `https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_list`
Vancouver: `https://opendata.vancouver.ca` (CKAN-compatible)

## 9. NGO / International

| Source | Endpoint | Notes |
|--------|----------|-------|
| Food Banks Canada | `https://foodbankscanada.ca/hunger-in-canada/hungercount/` | Annual PDF |
| UNHCR Canada | `https://www.unhcr.ca/in-canada/refugee-statistics/` | HTML tables |
| UNHCR Global | `https://www.unhcr.org/refugee-statistics` | API portal |
| WEF Reports | `https://www.weforum.org/` | Downloadable datasets |

## 10. Health (Deep)

| Source | Endpoint | Format | Frequency |
|--------|----------|--------|-----------|
| CIHI Wait Times | `https://www.cihi.ca/en/topics/access-and-wait-times` | XLSX | Annual |

## Architecture

```
AI Client → MCP Server (query_gov_data unified tool) → API Server (/v1/gov/search)
                                                              │
                                                    pipeline-data.json
                                                    CKAN live fetch
                                                    StatCan WDS
```

- Every record: `{ citation: { source_url, retrieved_at, sha256, license: "OGL-C", update_frequency } }`
- Antifragile: 6-hour fingerprinting, provider rotation, graceful degradation
- Unified MCP tool `query_gov_data` accepts `source` param to target specific modules
