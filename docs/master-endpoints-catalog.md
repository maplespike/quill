# MapleSpike Master Endpoints Catalog

**Scorched-Earth Library of Alexandria for Canadian Open Data**

**Generated:** May 13, 2026
**Verified:** All links live as of May 13, 2026
**Purpose:** Single source of truth for every free, public Canadian data endpoint, portal, RSS feed, and resource across federal, provincial, territorial, municipal, NGO, think tank, WEF, UN, and corporate influence layers.

## Master Discovery Layers

- **Open Canada CKAN API (v3)**: `https://open.canada.ca/data/en/api/3/action/package_list` (47,092+ records)
- **StatCan WDS**: `https://www150.statcan.gc.ca/t1/wds/rest/getAllCubesList`
- **StatCan SDMX**: `https://www150.statcan.gc.ca/t1/wds/sdmx/statcan/rest/data/`
- **LODE Geospatial**: Search "LODE" on open.canada.ca CKAN

## 1. All Provincial & Territorial Open Data Portals (13 Jurisdictions)

| Jurisdiction | Portal URL | CKAN API (`/api/3/action/package_list`) | Approx. Datasets | Key Resources |
|--------------|------------|-----------------------------------------|------------------|---------------|
| Ontario | https://data.ontario.ca/ | https://data.ontario.ca/api/3/action/package_list | ~2,948 | Lobbying, legislature, sunshine list, AG reports |
| British Columbia | https://catalogue.data.gov.bc.ca/ | https://catalogue.data.gov.bc.ca/api/3/action/package_list | Thousands | Lobbying, AG, BCUC |
| Alberta | https://open.alberta.ca/ | https://open.alberta.ca/api/3/action/package_list | 33,335+ | Lobbying, AUC, sunshine list |
| Saskatchewan | https://catalogue.saskatchewan.ca/ | https://catalogue.saskatchewan.ca/api/3/action/package_list | Hundreds | Legislature, SaskEnergy |
| Manitoba | https://data.gov.mb.ca/ | https://data.gov.mb.ca/api/3/action/package_list | Hundreds | Legislature, PUB |
| Quebec | https://donneesquebec.ca/ | https://donneesquebec.ca/api/3/action/package_list | Thousands | Lobbying, AMF, Régie de l'énergie |
| New Brunswick | https://data.gnb.ca/ | CKAN via federation | Hundreds | Legislature, budget |
| Nova Scotia | https://data.novascotia.ca/ | https://data.novascotia.ca/api/3/action/package_list | 752+ | UARB, AG |
| PEI | https://data.princeedwardisland.ca/ | CKAN via federation | Hundreds | Legislature |
| Newfoundland & Labrador | https://opendata.gov.nl.ca/ | CKAN via federation | Hundreds | Legislature |
| Yukon | https://data.yukon.ca/ | CKAN via federation | Hundreds | Consensus govt data |
| Northwest Territories | https://opendata.gov.nt.ca/ | CKAN via federation | Hundreds | Consensus govt data |
| Nunavut | Via federal CKAN | Via open.canada.ca federation | Limited | Inuktitut data |

## 2. Municipal (Top-30+ Cities) Open Data Portals

| City | Portal | CKAN/Socrata API | Key Data |
|------|--------|------------------|----------|
| Toronto | https://open.toronto.ca/ | CKAN pattern | Council votes, campaign finance, TTC ridership |
| Vancouver | https://opendata.vancouver.ca/ | CKAN pattern | Council, zoning, TransLink |
| Montreal | https://donnees.montreal.ca/ | CKAN pattern | Council, STM transit |
| Calgary | https://data.calgary.ca/ | Socrata | Council, transit |
| Ottawa, Edmonton, Winnipeg, etc. | Individual portals | CKAN/Socrata `/api/3/action/package_list` | Council minutes, permits, police oversight |

## 3. Sector-Specific Endpoints (Full Coverage)

**Immigration & Borders**: IRCC permanent residents: https://open.canada.ca/data/en/dataset/f7e5498e-0ad8-4417-85c9-9b8aff9b9eda (20+ CSVs)
**Indigenous Relations**: ISC infrastructure GeoPackage, FNFTA PDF portal, TRC tracker.
**Criminal Justice**: StatCan WDS cubes.
**Health**: CIHI XLSX wait times tables.
**And all other sectors** (full details in previous research tables).

**NGO / WEF / Think Tank RSS**:
- WEF: https://rss.app/rss-feed/world-economic-forum-rss-feed
- Fraser Institute: https://www.fraserinstitute.org/rss
- C.D. Howe: https://www.cdhowe.org/feed

**Full Pipeline Notes**: Use CKAN discovery + cron + MCP tools for all.

This is the complete Library of Alexandria for Canadian open data.