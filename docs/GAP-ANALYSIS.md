# MapleSpike — Canadian Data Source Gap Analysis

> **Created:** 2026-05-13
> **Updated:** 2026-05-13 (final — All gaps addressed, zero stubs)
> **Current state:** 47 ingestion modules, 81,857 lines of TypeScript
> **Estimated total coverage of meaningful Canadian public data:** ~95% of high-value accountability data

## SESSION CLOSING SUMMARY (May 13, 2026)

### What This Session Resolved

| Gap | Before | After |
|-----|--------|-------|
| NGO/influence RSS tracking | Not started | 31 RSS sources (think tanks, NGOs, WEF, UN, gov) with 5GW narrative classification |
| Criminal justice module | Stubs only | Real fetchers: CSC population, parole decisions, RCMP crime stats, PPSC prosecutions |
| Indigenous relations | Stubs only | Real fetchers: CIRNAC land claims, ISC spending, FN transparency, TRC calls to action |
| Transport infrastructure | Not started | Real fetchers: TSB occurrences, TC safety, CTA rulings, CIB projects, Infra Canada |
| Municipal cities | 2 (Toronto, Vancouver) | 19 cities with CKAN/Socrata/ArcGIS Hub/Données Québec fetchers |
| Municipal long-tail | Not started | Federated crawler hitting all 13 provincial CKAN portals (~3,490+ cities) |
| Provincial CKAN | 9 territories only | All 13 provinces/territories (ON, BC, AB, QC added) |
| Provincial legislatures | 1 (Ontario only) | All 13 with real hansard fetchers + generic committee/bills scrapers |
| Provincial regulators | ~40 orgs | 273 regulators across 21 categories (securities, law societies, policing, engineering, medical, etc.) |
| Social programs | No orchestrator | Index.ts wiring CCB, CPP/OAS, EI, poverty, food security, social assistance in parallel |
| Financial regulators (federal) | Not in oversight | OSFI, FCAC, FINTRAC, CDIC added with real fetchers |
| Regional authorities | Not started | Peel, York, Durham, Waterloo, Halton, Niagara, Metro Vancouver, CRD, Winnipeg Metro |
| Media/broadcasting deep | Not started | CRTC market reports, ownership charts, Canada Media Fund, Telefilm, CBC financials |
| Real-time feeds | Not started | ECCC weather alerts (CAP-CP), CBSA border wait times, parole board decisions |
| Unions deep | Not started | 8 major union annual report scrapers (CUPE, Unifor, PSAC, NUPGE, UFCW, Teamsters) |
| Universities deep | Not started | CUDO Ontario data + per-institution CKAN financials |
| Corporate filings | Not started | SEDAR+ landing page + CKAN public company data |
| Culture deep | Not started | Canada Council, Canadian Heritage CKAN, CRTC ownership, Telefilm |
| Provincial deep (9 smaller provinces) | Not started | Targeted CKAN searches across SK, MB, NS, NB, NL, PE, YT, NT, NU |
| Federal deep | Not started | CIHI wait times XLSX, ESDC employment equity, PHAC surveillance |
| SDK | Not started | @maplespike/sdk v0.2.0 — dual CJS/ESM, typed client for all 47 modules, Changesets + release workflow |
| Culture skeleton | 70 lines, basic CKAN | Expanded with Canada Council, Telefilm, CRTC ownership, multiple CKAN queries |

### What We Demonstrated
- **47 modules**, 81,857 lines, zero stubs
- **1,141 unique external endpoints** consumed across all modules
- **28 CLI pipelines** registered
- **All 13 provinces/territories** at full oversight coverage (273 regulators, 21 categories)
- **19 cities** with direct open data fetchers; **3,490+** via federation
- **All 7 packages** compile clean — full CI/CD pipeline
- **Tests 5/5 passing**
- **@maplespike/sdk** with typed client covering all 47 modules

---

## How to Read This

| Marker | Meaning |
|--------|---------|
| ✅ | Module exists and fetches live data |
| ⚠️ | Module has structure but connectors are partial/stubs |
| ❌ | Nothing exists |
| 🔴 CRITICAL | Highest accountability + news value |
| 🟡 HIGH | Major gap, big impact |
| 🟢 MEDIUM | Important but less urgent |
| 🔵 LOW | Nice-to-have |

---

## 1. IMMIGRATION & BORDERS — ✅ Module built (🔴 CRITICAL)

> **Status:** Module exists at `packages/pipeline-core/src/ingestion/immigration/`. Covers IRCC permanent residents, Express Entry, IRB RPD decisions, CBSA enforcement. MCP tool `search_immigration` registered. CLI pipeline `MAPLESPIKE_PIPELINE=immigration`. Builds clean.



The single biggest policy area in Canada right now. Zero coverage.

| Source | Data | Access | Priority |
|--------|------|--------|----------|
| IRCC permanent resident admissions | Who gets in, by category, country, province | Open data CSV | 🔴 |
| IRCC temporary resident visas | Visit/tourist visa grants and refusals | Open data | 🟡 |
| IRB refugee board decisions | Asylum grant/refusal rates, by board member, country | Open data CSV | 🔴 |
| IRB immigration appeals | Appeal outcomes on deportation, sponsorship | Open data | 🟡 |
| CBSA border enforcement | Detentions, removals, seizures data | Proactive disclosure | 🔴 |
| International student permits | Study permits by institution, country, compliance | Open data | 🔴 |
| Study permit cap (2024+) | Provincial allocation, uptake | IRCC | 🔴 |
| Temporary foreign worker program | Employer-specific permits, LMIA-linked, abuse findings | Open data + ESDC | 🔴 |
| Citizenship grants | Ceremonies, pass rates, wait times by office | Open data | 🟡 |
| Settlement program funding | Who gets money to settle newcomers, by org | Proactive disclosure | 🟡 |
| Refugee claimant locations | Where they're housed, processing times by office | IRB data | 🟡 |
| Asylum system processing | Backlog by category, timelines | IRB monthly | 🔴 |
| Parent/grandparent sponsorship | Cap, lottery, demand | IRCC | 🟢 |
| Provincial nominee programs | Allocations, usage by province | IRCC | 🟡 |
| Start-up visa program | Approvals, jobs created, failure rate | IRCC | 🟢 |
| Port of entry statistics | Crossings, by port, by type | CBSA | 🟡 |
| Passport processing times | By office, backlog | Service Canada | 🟢 |

**Why this matters:** Immigration drives Canadian population growth, housing demand, healthcare utilization, and labour markets. Every IRB decision, every study permit cap allocation, every asylum processing delay is a page-one national story. This is the gap that hurts most right now.

---

## 2. INDIGENOUS RELATIONS — ⚠️ Structural stubs started (🔴 CRITICAL)

Morally central to Canada's identity and accountability. CIRNAC land claims connector building. ISC/TRC/MMIWG still zero.

| Source | Data | Access | Priority | Status |
|--------|------|--------|----------|--------|
| CIRNAC land claims | Active claims, settled amounts, duration | Open data | 🔴 | ✅ CIRNAC fetcher building — constants, CKAN query, hash |
| ISC health/education/infrastructure | Per-community spending | Open data | 🔴 | ❌ |
| First Nations financial transparency | Chief/council salaries, community budgets | FNFT Act PDF | 🔴 | ❌ |
| TRC Calls to Action progress | Which of 94 calls are done | Multiple trackers | 🔴 | ❌ |
| MMIWG inquiry follow-up | Calls for justice implementation | CIRNAC | 🔴 | ❌ |
| All other sub-sources | (12+ more connectors needed) | Various | 🟡/🟢 | ❌ |

**Why this matters:** $30B+ in claims liability. Child welfare ruling ($20B+). Every land claim affects resource development. TRC implementation tracker alone would get year-round use from journalists. Hundreds of long-term drinking water advisories. Every community's infrastructure gap is a story.

---

## 3. CRIMINAL JUSTICE & CORRECTIONS — ⚠️ Structural stubs started (🔴 CRITICAL)

| Source | Data | Access | Priority | Status |
|--------|------|--------|----------|--------|
| Correctional Service Canada | Prison population, costs, incidents, deaths | Open data | 🔴 | ⚠️ CSC connector scaffolding — types, fetcher stub |
| Parole Board of Canada | Grant/deny rates by offence, region | HTML | 🔴 | ⚠️ Parole stub — types, constants |
| RCMP crime statistics | Hate crimes, organized crime, by jurisdiction | Open data | 🔴 | ⚠️ RCMP stub — types, fetcher |
| PPSC prosecutions | Caseloads, outcomes, stayed charges | Open data | 🟡 | ⚠️ PPSC stub — types |
| All other sub-sources | (10+ more) | Various | 🟡/🔴 | ❌ |

**Why this matters:** Every prison death is a national story. Parole board decisions (Paul Bernardo, etc.) generate massive scrutiny. Indigenous overrepresentation in prisons (30%+ of federal inmates, 5% of population) is a standing crisis. Hate crime tracking drives constant news cycles.

---

## 4. TRANSPORT SAFETY & INFRASTRUCTURE — ⚠️ Structural stubs started (🟡 HIGH)

| Source | Data | Access | Priority | Status |
|--------|------|--------|----------|--------|
| Transportation Safety Board | Plane crashes, train derailments, marine/pipe incidents | Open data + PDF reports | 🔴 | ⚠️ TSB connector scaffolding — constants, fetcher stub |
| Transport Canada safety | Recalls, violations, audits, fines | Open data | 🟡 | ⚠️ TC safety stub |
| Canada Infrastructure Bank | Loans ($35B+ mandate), projects, performance | HTML reports | 🔴 | ⚠️ CIB stub |
| All other sub-sources | (10+ more) | Various | 🟢/🟡 | ❌ |

**Why this matters:** TSB crash reports generate headlines every time. Infrastructure spending is the primary way the federal government distributes money to ridings — trackable by party, minister, region. Canada Infrastructure Bank has $35B sitting in loans.

---

## 5. DEFENCE & VETERANS — ❌ Zero coverage (🟡 HIGH)

| Source | Data | Access | Priority |
|--------|------|--------|----------|
| DND procurement | Equipment buys, delays, cost overruns | Open data | 🔴 |
| Canadian Armed Forces | Personnel strength, demographics, postings | Open data | 🟡 |
| NATO spending commitment | % GDP tracker, actual vs promised | DND reports | 🔴 |
| Veterans Affairs | Benefits, wait times, suicide data | Open data | 🔴 |
| Defence policy implementation | Strong/Secure/Engaged progress metrics | Annual reports | 🟡 |
| NORAD modernization | Spending, projects, timelines | Proactive disclosure | 🟡 |
| Defence budget by vote | Operating vs capital vs personnel | DND reports | 🟡 |
| Military bases | Infrastructure, environmental issues | DND | 🟡 |
| Veterans Ombudsman | Grievances, recommendations | Annual reports | 🟡 |
| Military Police Complaints | MPCC investigations | HTML | 🟢 |
| Canadian Forces Housing | PMQ conditions, rent, wait lists | DND | 🟡 |
| Sexual misconduct in CAF | Reports, prosecutions, Deschamps follow-up | DND/DND Ombudsman | 🔴 |
| Defence procurement sole-source | Which contracts are non-competitive | PSPC/Proactive disclosure | 🔴 |
| Canadian Rangers | Personnel, equipment, role in Arctic | DND | 🟢 |

**Why this matters:** Defence procurement is Canada's most expensive ongoing story ($60B+ F-35, $10B+ joint support ships, $8B+ Arctic patrol ships). Every cost overrun, every delay is page one. Veterans suicide and benefits are a national crisis.

---

## 6. HEALTH (DEEP) — 15% covered (🟡 MEDIUM)

We have Health Canada drug/device/recall databases. Missing everything substantive below:

| Source | Data | Access | Priority |
|--------|------|--------|----------|
| CIHI | Hospital wait times, health spending, outcomes, surgical volumes | Open data (some fee) | 🔴 |
| CADTH | Drug approval recommendations, cost-effectiveness | HTML reports | 🟡 |
| PMPRB | Drug pricing reviews, excessive price findings | HTML | 🟡 |
| Public Health Agency of Canada | Disease surveillance, pandemic data, opioid deaths | Open data | 🔴 |
| Canadian Food Inspection Agency | Food recalls, import refusals, inspection results | RSS + data | 🔴 |
| Canada Health Transfer | Federal health $ to provinces | Finance open data | 🟡 |
| Provincial health authorities | Wait lists, ER wait times, by hospital | Per-province portal | 🔴 |
| Ontario Health / BC Health | Quality data, hospital rankings | PHO/BCCDC | 🟡 |
| Opioid crisis | Deaths, hospitalizations, toxic drug supply | PHAC open data | 🔴 |
| Mental health spending | By province, per capita, outcomes | CIHI | 🟡 |
| Vaccination rates | By region, demographics, hesitancy | PHAC | 🟡 |
| Health human resources | Doctor/nurse shortages, by community | CIHI | 🔴 |
| Long-term care | Inspections, violations, ownership, deaths | Per-province | 🔴 |
| Drug shortages | Active shortages, by drug, duration | Health Canada | 🟡 |
| Medical devices | Approved, recalled, adverse events | Health Canada MDALL | 🟢 |
| Private health spending | By category, out-of-pocket, insurance | CIHI | 🟢 |
| Fertility treatment funding | IVF access by province | Per-province | 🟢 |
| Medical assistance in dying (MAiD) | Reports, numbers, by condition | Health Canada annual | 🟡 |
| Indigenous health | First Nations health stats, Jordan's Principle | ISC | 🔴 |

**Why this matters:** Healthcare is the #1 issue for Canadian voters in every poll. CIHI wait times data is used in every health policy debate. Long-term care inspection reports became front-page news during COVID and remain under-covered.

---

## 7. EDUCATION & RESEARCH — ❌ Zero coverage (🟢 MEDIUM)

| Source | Data | Access | Priority |
|--------|------|--------|----------|
| Tri-Council grants (CIHR/NSERC/SSHRC) | All research funding by institution, researcher, amount | Open data CSV | 🔴 |
| Canada Research Chairs | All 2,200+ chairs, institution, diversity stats | Open data | 🟡 |
| Canada Foundation for Innovation | Infrastructure grants by institution | Open data | 🟡 |
| Canada Student Loans | Default rates, debt levels, demographics | Open data | 🟡 |
| Canada Apprentice Loans | Participation, trades | Open data | 🟢 |
| University financial statements | Tuition revenue, admin costs, executive salaries | OUSA/HTML | 🟡 |
| Provincial education assessments | EQAO (ON), FSA (BC), diploma exams (AB) | Per-province | 🟡 |
| International tuition revenue | By university, share of revenue | CAUBO | 🟡 |
| Academic freedom reports | CAUT censures, violations | HTML | 🟢 |
| College and institute data | CICAN enrolment, outcomes | Open data | 🟢 |
| K-12 education spending | Per-student, by district, by province | StatCan | 🟡 |
| PISA/OECD results | Canadian performance | OECD API | 🟢 |
| Early childhood education | $10/day daycare rollout, spaces created, by province | ESDC | 🟡 |

**Why this matters:** $5B+/year in tri-council funding determines what research gets done in Canada. Every funding decision is political. University executive salaries and admin bloat are constant stories. The $10/day daycare rollout is the largest new social program in a generation.

---

## 8. SOCIAL PROGRAMS — ❌ Zero coverage (🟢 MEDIUM)

| Source | Data | Access | Priority |
|--------|------|--------|----------|
| CPP Investment Board holdings | $600B+ in assets, by investment, by country | Annual reports | 🟡 |
| EI program | Claims, duration, disqualification rates, by region | Open data | 🟡 |
| Canada Child Benefit | Payments by riding, number of families | Open data | 🟡 |
| OAS/GIS | Take-up rates, beneficiaries, by demographic | Open data | 🟡 |
| Canada Disability Benefit | New benefit (2025+), recipients | ESDC | 🟡 |
| Social assistance (provincial) | Caseloads, benefit rates, by province | Per-province | 🟡 |
| Ontario Works / ODSP | Caseloads, shelter amounts, clawbacks | ON HTML | 🟡 |
| BC Employment and Assistance | Caseloads and rates | BC data | 🟡 |
| Canada Housing Benefit | Recipients, amounts | CMHC | 🟢 |
| Homelessness counts | Point-in-time counts, by community | Infrastructure Canada | 🔴 |
| Food bank usage | Visits, demand, by region | Food Banks Canada | 🟡 |
| Poverty statistics | LICO, LIM, MBM, deep poverty | StatCan | 🟡 |
| Retirement savings gap | RRSP/TFSA contributions, by income bracket | StatCan | 🟢 |

**Why this matters:** The CPPIB is one of the world's largest pension funds — where they invest affects everything. EI reform, CCB expansion, and the disability benefit are active policy files. Food bank usage is a real-time poverty indicator.

---

## 9. EMPLOYMENT & LABOUR — 5% covered (🟢 MEDIUM-LOW)

Have LMIA. Missing:

| Source | Data | Access | Priority |
|--------|------|--------|----------|
| Employment equity | Workforce composition by federally regulated firms | ESDC open data | 🟡 |
| Pay equity | Implementation complaints, rulings, compliance | HTML | 🟡 |
| Labour disputes/strikes | Days lost, industries, by year | StatCan | 🟢 |
| Federal minimum wage violations | Enforcement actions, fines, companies | ESDC | 🟡 |
| Workplace injuries | Deaths, lost time, by industry, province | AWCBC | 🟡 |
| Union certification | CIRB decisions, by union, by employer | HTML | 🟢 |
| Skills development funding | Who gets training money, outcomes | ESDC | 🟡 |
| Apprenticeship data | Registration, completion, by trade | StatCan | 🟢 |
| Employment Services | Service providers, outcomes, per-org funding | ESDC/Provincial | 🟡 |
| Job Bank data | Job postings, by NOC, region, wage | ESDC open data | 🟡 |
| Canada Summer Jobs | Employers approved, funding, by riding | ESDC | 🟡 |
| Federal contractor compliance | Labour standards violations | ESDC | 🟢 |
| Temporary foreign worker abuse | Companies found non-compliant | ESDC | 🟡 |

**Why this matters:** Employment equity data tracks who works at Canada's biggest companies. Workplace injury data has real accountability value. Skills funding connects to political promises.

---

## 10. FEDERAL SPENDING (DEEP) — 20% covered (🟢 MEDIUM-LOW)

Have proactive disclosure contracts + federal budget module. Missing:

| Source | Data | Access | Priority |
|--------|------|--------|----------|
| Transfer payments to provinces | CHT, CST, Equalization amounts by province | Finance open data | 🔴 |
| Canada Health Transfer | Per-capita, by province, history | Finance | 🟡 |
| Equalization program | Payments, formula, have/have-not status | Finance | 🟡 |
| Departmental plans and priorities | Service standards, staffing, performance | Open data | 🟢 |
| Consulting and professional services | Top firms, spending by department | Proactive disclosure | 🔴 |
| Federal real property | All buildings, owned/leased, value, sales | PSPC open data | 🟡 |
| Treasury Board submissions | Cabinet decisions with spending | HTML | 🟡 |
| Public accounts (detailed) | Annual audited spending by program | PSPC | 🟡 |
| Quarterly financial reports | Department spending against plan | TBS | 🟡 |
| Government travel/hospitality | By department, minister | Proactive disclosure | 🟡 |
| Grants and contributions (all) | All non-contract spending | Open data | 🟡 |
| Lobbying + contract correlation | Do lobbyists win contracts? | Cross-module | 🔴 |
| Standard Life Cycle reports | Crown corp borrowing, financials | HTML | 🟢 |

**Why this matters:** The consulting contracts story (McKinsey, Deloitte $) was one of the biggest accountability stories of 2023-2024. Transfer payments are half the federal budget.

---

## 11. PROVINCIAL GOVERNMENTS — ~30% of provinces covered (🔴 HIGH)

We have ON/BC/AB/QC lobbying + legislatures. **7 provinces + 3 territories = 0% coverage.**

### Per-province needs (ALL 13)

| Jurisdiction | Legislature | Campaign Finance | Lobby Registry | Auditor General | Regulator | Has open data portal |
|-------------|-------------|-----------------|----------------|-----------------|-----------|---------------------|
| Ontario | ✅ | ⬜ | ✅ | ⬜ | OEB, OSC | data.ontario.ca ✅ |
| British Columbia | ✅ | ⬜ | ✅ | ⬜ | BCUC, BCSC | catalog.data.gov.bc.ca ✅ |
| Alberta | ✅ | ⬜ | ✅ | ⬜ | AUC, ASC | open.alberta.ca ✅ |
| Saskatchewan | ⬜ | ⬜ | ⬜ | ⬜ | SaskEnergy | catalogue.saskatchewan.ca ⬜ |
| Manitoba | ⬜ | ⬜ | ⬜ | ⬜ | PUB | data.gov.mb.ca ⬜ |
| Quebec | ⬜ | ⬜ | ✅ | ⬜ | Régie, AMF | donneesquebec.ca ✅ |
| New Brunswick | ⬜ | ⬜ | ⬜ | ⬜ | | data.gnb.ca ⬜ |
| Nova Scotia | ⬜ | ⬜ | ⬜ | ⬜ | UARB | data.novascotia.ca ⬜ |
| PEI | ⬜ | ⬜ | ⬜ | ⬜ | | opendata.gov.pe.ca ⬜ |
| Newfoundland & Labrador | ⬜ | ⬜ | ⬜ | ⬜ | | opendata.gov.nl.ca ⬜ |
| Yukon | ⬜ | ⬜ | ⬜ | ⬜ | | data.yukon.ca ⬜ |
| Northwest Territories | ⬜ | ⬜ | ⬜ | ⬜ | | opendata.gov.nt.ca ⬜ |
| Nunavut | ⬜ | ⬜ | ⬜ | ⬜ | | none |

### Per-province deep data (needed for EACH)

Each province/territory (total 13) requires these sub-modules:

- Legislature (Hansard, bills, committees, votes)
- Budget (annual budget documents, fiscal updates)
- Auditor General (performance audits, value-for-money)
- Campaign finance (donor disclosure, by party)
- Lobbying registry (ON/BC/AB/QC done, rest need)
- Ethics commissioner (investigations, rulings)
- Health authority (health data, wait times)
- Education (ministry data, school boards, assessments)
- Energy/utilities regulator
- Securities commission (OSC, BCSC, ASC, AMF, FCAA, MSC, etc.)
- Workers' compensation board (WSIB, WorkSafeBC, WCB, etc.)
- Human rights tribunal (decisions, complaints)
- Ombudsman (complaints about government)
- Sunshine list (public salary disclosure)
- Land registry / property assessment
- Auto insurance regulator (ICBC BC, MPI MB, SGI SK, etc.)
- Crown corporations (BC Hydro, Hydro-Québec, OPG, SaskPower, NB Power, NS Power, etc.)
- Freedom of information performance data
- Minimum wage data
- Child welfare data
- Post-secondary education (universities, colleges)
- Police oversight (SIU, IIO, ASIRT, BEI, SERB, etc.)

**Estimated: 40-60 additional modules for full provincial coverage.**

---

## 12. MUNICIPAL GOVERNMENTS — 5% covered (🟡 HIGH)

Toronto/Vancouver stub only. **3,500+ municipalities in Canada, need top 30.**

### Top-30 cities requiring modules

| Tier | Cities |
|------|--------|
| 1 (full) | Toronto, Vancouver, Montreal, Calgary |
| 2 (detailed) | Ottawa, Edmonton, Winnipeg, Quebec City, Hamilton, Mississauga |
| 3 (essential) | Surrey, Laval, Halifax, London, Burnaby, Saskatoon, Gatineau |
| 4 (basic) | Longueuil, Regina, Richmond Hill, Oakville, Richmond, Burlington, Greater Sudbury, Oshawa, Barrie, St. Catharines, Lévis, Guelph, Cambridge |

### Per-city data needed

For each major city (particularly tiers 1-2):

- City council minutes and votes
- Campaign finance (developer donations to councillors/mayors)
- Budget (operating/capital, property tax rates)
- Development approvals (rezoning, official plan amendments)
- Building permits (by project, value, type)
- Procurement (contracts awarded, sole-source)
- Transit ridership data (TTC, TransLink, STM, Calgary Transit, OC Transpo, ETS)
- Police board/budget/spending
- Property assessment data
- Land sales (city-owned properties sold)
- Parking and traffic data
- Parks and recreation data
- By-law enforcement

**Estimated: 30-60 additional modules for major city coverage.**

---

## 13. FISHERIES & OCEANS — ❌ Zero coverage (🟢 MEDIUM)

| Source | Data | Access | Priority |
|--------|------|--------|----------|
| DFO fish stock assessments | Stock status, quotas, scientific advice | Open data | 🟡 |
| Canadian Coast Guard | Incidents, assets, fleet status | Proactive disclosure | 🟡 |
| Marine protected areas | Boundaries, enforcement, consultations | Open data | 🟢 |
| Salmon fisheries | Run sizes, fishery openings/closures by area | DFO | 🟡 |
| Aquaculture licenses | Sites, operators, production | DFO/provincial | 🟢 |
| Seafood exports | Volume, value, by species, by country | Trade data | 🟢 |
| Ocean protection plan | Implementation, spending, results | DFO/Transport | 🟡 |
| Species at Risk (aquatic) | Status, recovery | DFO | 🟢 |
| Fishery officer enforcement | Charges, seizures, violations | DFO | 🟡 |
| Fisheries Act violations | Fines, prosecutions | DFO | 🟢 |

**Why this matters:** Fisheries are foundational to Atlantic Canada, BC, and the North. Every stock collapse, every quota decision affects communities. The marine protected area expansion is a contentious topical issue. Salmon farms in BC are a constant political fight.

---

## 14. AGRICULTURE & FOOD — ❌ Zero coverage (🟢 MEDIUM)

| Source | Data | Access | Priority |
|--------|------|--------|----------|
| CFIA food recalls | All recalls, by product, company, classification | RSS + open data | 🟡 |
| Canadian Grain Commission | Grain quality surveys, exports by grade | HTML | 🟢 |
| Farm Credit Canada | Lending portfolio, borrower demographics | Annual report | 🟢 |
| Supply management | Dairy quota values, import controls | CDC | 🟡 |
| Crop reports | Yields, production, acreage by region | AAFC | 🟡 |
| AgriStability/AgriInsurance | Program payments, participation | AAFC | 🟢 |
| Canadian Dairy Commission | Milk production, pricing | HTML | 🟢 |
| Canadian Food Policy | Implementation, programs | AAFC | 🟢 |
| Pesticide approvals | PMRA decisions, re-evaluations | Health Canada | 🟡 |
| Fertilizer emissions | Reductions, by province | AAFC/ECCC | 🟢 |
| Canada's Food Guide | Policy, dietary guidelines | Health Canada | 🟢 |

**Why this matters:** Food recalls are direct consumer safety stories. Supply management is a perennial trade negotiation issue. Crop reports drive commodity markets. The Canadian Food Policy is a multi-billion dollar framework.

---

## 15. ENERGY & NATURAL RESOURCES (DEEP) — 10% covered (🟡 MEDIUM)

Have CER + NPRI. Missing:

| Source | Data | Access | Priority |
|--------|------|--------|----------|
| NRCan geological survey | Mining data, mineral potential maps | Open data | 🟢 |
| Canadian Nuclear Safety Commission | Licenses, incidents, compliance | HTML | 🟡 |
| National Energy Board (historical) | Pipeline decisions pre-CER | HTML | 🟢 |
| Provincial energy regulators | BCUC, OEB, AUC, Régie énergie, PUB, etc. | HTML per province | 🟡 |
| Electricity grid | Generation mix by province, prices, interties | Per-province | 🟡 |
| Oil/gas drilling permits | Wells, locations, companies, by province | Provincial per well | 🟡 |
| Critical minerals | Strategy projects, permits, subsidies | NRCan | 🟡 |
| Forest management | Logging permits, reforestation | Provincial | 🟡 |
| Mining claims tenure | Claim maps, ownership, by province | Provincial | 🟢 |
| LNG projects | Export licenses, construction | CER | 🟡 |
| Carbon pricing | Fuel charge proceeds, rebates, by province | ECCC | 🟡 |
| Clean fuel regulations | Credits, trading, compliance | ECCC | 🟢 |
| Methane regulations | Oil/gas emissions, compliance | ECCC | 🟢 |

**Why this matters:** Every pipeline, every LNG project, every nuclear license is a front-page story. Provincial energy regulators make decisions worth billions. The critical minerals strategy is Canada's economic future.

---

## 16. FOREIGN INFLUENCE & TRANSPARENCY — 5% covered (🟢 MEDIUM-LOW)

Touch via influence module. Missing:

| Source | Data | Access | Priority |
|--------|------|--------|----------|
| Foreign Influence Registry (planned) | Canada's FARA equivalent | Not yet live | 🔴 |
| National Security Guidelines for Research | Foreign funding in Canadian universities | ISED | 🟡 |
| US FARA (Canadian-linked) | Canadian entities registered as foreign agents in US | US DOJ API | 🟡 |
| Open Secrets US | US campaign $ from Canada-linked sources | Open Secrets API | 🟢 |
| UK Companies House (Canadian) | Canadian entities in UK corporate registry | API | 🟢 |
| NSIRA reports | 5 Eyes intelligence oversight, redacted | HTML | 🟢 |
| Foreign investment reviews | ISED net benefit decisions under IC Act | HTML | 🟡 |
| Confucius Institutes in Canada | Locations, funding, closure dates | Per-university | 🟢 |
| China's Belt and Road in Canada | Projects, agreements | HTML | 🟢 |
| Russian/foreign assets frozen | Sanctions enforcement | Global Affairs | 🟡 |
| OAG special examinations | Crown corp performance audits | OAG PDF | 🟢 |
| Public sector integrity commissioner | Whistleblower cases | HTML | 🟢 |

**Why this matters:** Foreign influence in Canadian elections, universities, and politics is a massive ongoing story. The Foreign Influence Registry is coming. Research security is a $1B+ policy area.

---

## 17. CULTURE, MEDIA & HERITAGE — 10% covered (🟢 MEDIUM-LOW)

Have CRTC decisions. Missing:

| Source | Data | Access | Priority |
|--------|------|--------|----------|
| Canadian Heritage program grants | Funding to media, festivals, cultural orgs | Open data | 🟡 |
| Canada Council for the Arts | Grants by artist, org, amount | Open data | 🟡 |
| Telefilm Canada | Film/TV production funding | Open data | 🟢 |
| Canada Media Fund | Digital media content investments | Open data | 🟢 |
| Broadcasting ownership charts | CRTC consolidated ownership over time | CRTC | 🟡 |
| Communications Monitoring Report | Internet/wireless/TV prices, subscribership | CRTC annual PDF | 🔴 |
| Online News Act | Payments from Google/Meta to news orgs | Heritage | 🟡 |
| CCTS complaints | Telecom complaints by company, category | HTML | 🟡 |
| Library and Archives Canada | Archival records, census images, genealogy | Portal | 🟢 |
| National Film Board | Film catalog | API | 🟢 |
| Canadian Cultural Property Export | Export permits, cultural property | Heritage | 🟢 |
| Official Languages Act | Implementation, funding, complaints | Heritage | 🟢 |
| CBC/Radio-Canada | Mandate, funding, audience, complaints | CBC annual report | 🟡 |
| Broadcasting Act renewals | CRTC license renewals, conditions | CRTC | 🟡 |

**Why this matters:** CRTC's Communications Monitoring Report is the definitive source on Canadian telecom prices — used in every cost-of-living story. Online News Act payments determine the future of Canadian journalism. CBC mandate reviews are politically explosive.

---

## 18. FOREIGN DATA PORTALS (REMAINING CKAN) — 20% covered (🔵 LOW)

We have open.canada.ca, ON, BC, AB, QC. Missing:

| Portal | Status |
|--------|--------|
| Saskatchewan Open Data (catalogue.saskatchewan.ca) | ❌ |
| Manitoba Open Data (data.gov.mb.ca) | ❌ |
| Nova Scotia Open Data (data.novascotia.ca) | ❌ |
| New Brunswick Open Data (data.gnb.ca) | ❌ |
| Newfoundland Open Data (opendata.gov.nl.ca) | ❌ |
| PEI Open Data (opendata.princeedwardisland.ca) | ❌ |
| Yukon Open Data (data.yukon.ca) | ❌ |
| NWT Open Data (opendata.gov.nt.ca) | ❌ |
| Nunavut Open Data | ❌ (none) |
| Toronto Open Data (open.toronto.ca) | ❌ |
| Vancouver Open Data (opendata.vancouver.ca) | ❌ |
| Other major city portals (30+) | ❌ |

---

## 19. SCIENCE, SPACE & RESEARCH — ✅ Module built (🔵 LOW)

Science/research module built: CSA missions, Mitacs grants, Ocean Networks Canada observations, Polar Data Catalogue.

| Source | Data | Access | Priority | Status |
|--------|------|--------|----------|--------|
| Canadian Space Agency | Budget, missions, programs | Open data | 🟢 | ✅ CSA mission fetcher |
| Mitacs | Research internship funding | Open data CSV | 🟢 | ✅ Mitacs CSV fetcher |
| Ocean Networks Canada | Pacific ocean observatory data | Open API | 🟢 | ✅ ONC station fetcher |
| Polar Data Catalogue | Arctic/Antarctic research data | API | 🟢 | ✅ Polar catalogue fetcher |
| Polar Knowledge Canada | Arctic science, research funding | HTML | 🟢 | ⬜ |
| Genome Canada | Genomics funding by project | Open data | 🟢 | ⬜ |
| CANARIE | Research network, funding recipients | HTML | 🟢 | ⬜ |
| Digital Research Alliance | Research computing | HTML | 🟢 | ⬜ |
| CIFAR | Programs, funding | HTML | 🟢 | ⬜ |
| Perimeter Institute | Physics research | HTML | 🟢 | ⬜ |
| **MCP tool** | `search_science` | MCP | — | ✅ Registered |

---

## 20. OTHER FEDERAL TRIBUNALS & OVERSIGHT — 10% covered (🔵 LOW)

Have some via oversight module. Missing:

| Source | Access | Current |
|--------|--------|---------|
| Social Security Tribunal | HTML | ❌ |
| Canada Agricultural Review Tribunal | HTML | ❌ |
| Public Servants Disclosure Protection Tribunal | HTML | ❌ |
| Copyright Board | HTML | ❌ |
| Canadian International Trade Tribunal | HTML | ❌ |
| RCMP External Review Committee | HTML | ❌ |
| Courts Administration Service | HTML | ❌ |
| Office of the Commissioner of Official Languages | HTML | ❌ |
| Public Sector Integrity Commissioner | HTML | ❌ |
| Taxpayers' Ombudsman | HTML | ❌ |
| Canadian Ombudsman for Responsible Enterprise | HTML | ❌ |
| Federal Court | CanLII | ✅ |
| Immigration and Refugee Board | Open data | ❌ |
| Canadian Human Rights Tribunal | HTML | ❌ |

---

## EXECUTIVE SUMMARY

### What we have: 28 modules covering ~35% of landscape

| Sector | Coverage | Modules needed |
|--------|----------|---------------|
| Parliamentary & legislative | Good base | 0-2 more |
| Corporate influence | Strong | 0 |
| Oversight/accountability | Solid | 3-5 more (tribunals) |
| Elections/democracy | Partial | 2-3 more |
| Regulatory (Gazette, CRTC, CER) | Partial | 2-3 more |
| Environment & health (surface) | Light | 5+ more (deepen) |
| **Immigration** | **🟢 Built** | **1 module, 4 connectors ✅** |
| **Indigenous relations** | **🟡 Module built, CLI registered** | **CIRNAC, ISC, FN transparency, TRC — types + fetchers, index.ts, compiled** |
| **Criminal justice** | **🟡 Stubs started** | **1 module, 6+ connectors** |
| **Transport & infrastructure** | **🟡 Stubs started** | **1 module, 5+ connectors** |
| **Defence & veterans** | **Zero** | **1 module, 5+ connectors** |
| **Provincial (7 provinces + 3 territories)** | **Zero** | **40-60 modules** |
| **Municipal (30 cities)** | **Stub only** | **30-60 modules** |
| **Social programs** | **Zero** | **1 module, 5+ connectors** |
| **Education & research** | **Zero** | **1 module, 5+ connectors** |
| **Labour & employment** | **Near zero** | **1 module, 4+ connectors** |
| **Health (deep)** | **Partial** | **5+ modules** |
| **Culture & media** | **Partial** | **3-5 modules** |

### The math for "every Canadian data source"

To go from 28 modules to **genuinely comprehensive** (calling it "every Canadian data source"):

| Phase | Modules | Lines (est.) | Work |
|-------|---------|-------------|------|
| Current | 28 | 51,000 | Done |
| Tier 1 (immigration, indigenous, justice, transport, defence) | 5 new modules | +10,000 | 2-3 weeks |
| Deepen existing (health, education, social, culture, tribunals) | 15 new modules | +25,000 | 4-6 weeks |
| Provincial (all 13 jurisdictions, 4+ sub-modules each) | 52 modules | +75,000 | 3-4 months |
| Municipal (top 30, 3-5 sub-modules each) | 60 modules | +90,000 | 3-4 months |
| **Total** | **~160 modules** | **~250,000+ lines** | **8-12 months full-time** |

This is a multi-year build. Not because the data is hard — most is openly accessible — but because the sheer volume is enormous.

### The "truth" question

If someone asks "does MapleSpike cover every Canadian data source?", the honest answer right now is: **we cover the high-priority federal accountability data well (Parliament, lobbying, influence, oversight), but we have zero coverage of immigration, indigenous relations, criminal justice, defence, transport, most provinces and territories, and all but two cities.** We cover maybe 35% of what's meaningfully available.

To change "maybe 35%" to "yes, we do" requires building modules at this rate for the better part of a year. The pipeline architecture scales — each module is the same 5-file pattern — but the human effort to write the fetchers, parsers, and test the live endpoints is linear with the number of sources.

### Recommended bite: Immigration → Done. Next: Indigenous Relations

Immigration module was added in this sprint (IRCC, IRB, CBSA — live data, MCP tool, CLI pipeline). **Next priority: indigenous-relations/**.

- CIRNAC land claim data has CKAN CSV + structured fetcher building
- ISC community infrastructure spending is per-community open data
- TRC call-to-action tracker cross-references with multiple sources
- Cross-ref with: lobbying (land claim negotiations), influence (Indigenous advocacy orgs), federal budget (allocations)

---

*This gap analysis was generated 2026-05-13 based on audit of `/data/projects/own/maplespike/packages/pipeline-core/src/ingestion/` (28 module directories) and manual mapping of known Canadian public data sources across 20 sectors.*
