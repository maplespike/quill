# Canadian Open Data Portal Coverage Analysis

Generated: 2026-05-29

## Summary

| Metric | Count |
|--------|-------|
| Total portals cataloged | 114 |
| Covered by MapleSpike | 6 |
| Not covered | 108 |
| Coverage rate | 5.3% |

## Coverage by Jurisdiction

### Federal
| Status | Count | Percentage |
|--------|-------|------------|
| Covered | 1 | 100% |
| Not covered | 0 | 0% |
| **Total** | **1** | **100%** |

**Covered:** Canada (open.canada.ca)

### Provincial
| Status | Count | Percentage |
|--------|-------|------------|
| Covered | 5 | 38.5% |
| Not covered | 8 | 61.5% |
| **Total** | **13** | **100%** |

**Covered:**
- Newfoundland and Labrador (opendata.gov.nl.ca)
- Nova Scotia (data.novascotia.ca)
- Quebec (donneesquebec.ca)
- Alberta (open.alberta.ca)
- British Columbia (catalogue.data.gov.bc.ca)

**Not Covered:**
- Prince Edward Island (princeedwardisland.ca)
- New Brunswick (snb.ca)
- Ontario (ontario.ca) - via data.ontario.ca
- Saskatchewan (data.saskatchewan.ca) - in MODULE_SOURCES but no portal in CSV
- Manitoba (data.gov.mb.ca) - in MODULE_SOURCES but no portal in CSV
- Yukon (data.yukon.ca) - in MODULE_SOURCES but no portal in CSV
- Northwest Territories (www.gov.nt.ca/data) - in MODULE_SOURCES but no portal in CSV
- Nunavut (data.gov.nu.ca) - in MODULE_SOURCES but no portal in CSV

### Municipal
| Status | Count | Percentage |
|--------|-------|------------|
| Covered | 0 | 0% |
| Not covered | 100 | 100% |
| **Total** | **100** | **100%** |

## Top-10 Uncovered Portals (by Population)

| Rank | Name | Type | Population | URL |
|------|------|------|------------|-----|
| 1 | Toronto (Ont.) | City | 2,615,060 | http://www.toronto.ca/open |
| 2 | Montreal (Que.) | Ville | 1,649,519 | http://donnees.ville.montreal.qc.ca/ |
| 3 | Calgary (Alta.) | City | 1,096,833 | https://data.calgary.ca/ |
| 4 | Ottawa (Ont.) | City | 883,391 | http://data.ottawa.ca/ |
| 5 | Edmonton (Alta.) | City | 812,201 | https://data.edmonton.ca/ |
| 6 | Mississauga (Ont.) | City | 713,443 | http://www.mississauga.ca/portal/residents/publicationsopendatacatalogue |
| 7 | Winnipeg (Man.) | City | 663,617 | https://data.winnipeg.ca/ |
| 8 | Surrey (B.C.) | City | 468,251 | http://data.surrey.ca/ |
| 9 | Brampton (Ont.) | City | 523,911 | http://open.brampton.ca/ |
| 10 | Vancouver (B.C.) | City | 603,502 | http://data.vancouver.ca/datacatalogue/index.htm |

**Note:** Ontario portal (ontario.ca) covers 12.8M people but requires special analysis as it's provincial, not municipal.

## Recommendations

### High Priority (Population > 1M)
1. **Ontario** (provincial) - 12.8M people - Add data.ontario.ca module
2. **Toronto** - 2.6M people - Add toronto.ca open data module
3. **Montreal** - 1.6M people - Add donnees.ville.montreal.qc.ca module
4. **Calgary** - 1.1M people - Add data.calgary.ca module

### Medium Priority (Population 500K-1M)
5. **Ottawa** - 883K people - Add data.ottawa.ca module
6. **Edmonton** - 812K people - Add data.edmonton.ca module
7. **Mississauga** - 713K people - Add mississauga.ca module
8. **Winnipeg** - 664K people - Add data.winnipeg.ca module

### Provincial Gaps
9. **New Brunswick** - 751K people - Add geonb.snb.ca module
10. **Prince Edward Island** - 140K people - Add princeedwardisland.ca module

## Gap Analysis

**Critical Gaps:**
- Ontario provincial portal (largest province, 38% of population)
- Top 5 municipal portals (Toronto, Montreal, Calgary, Ottawa, Edmonton) = 6.5M people
- Via provincial-ckan module we technically cover some municipal data, but direct modules would be better

**Coverage Strategy:**
1. Add Ontario provincial module immediately
2. Add top 3 municipal portals (Toronto, Montreal, Calgary)
3. Leverage existing provincial-ckan for smaller municipalities
4. Prioritize by population served per development effort
