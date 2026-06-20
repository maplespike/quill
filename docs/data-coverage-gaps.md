# MapleSpike Data Coverage Gap Analysis
# Top 50 missing modules — prioritized by data value + effort

## Tier 1: Zero-Effort, High Impact (Already in pipeline via CKAN/Socrata)
# These just need registry entries — the fetchers already exist
- provincial-ckan: add missing territories (NU, NT, YT standalones)
- add 15 missing municipal CKAN portals as curated sources

## Tier 2: High Value, Medium Effort (New modules, known API patterns)

### Federal Gaps (10)
| Priority | Module | Description | Source | Format | Why Missing |
|----------|--------|-------------|--------|--------|-------------|
| P1 | federal-procurement-solicitation | PSPC tenders, awarded contracts, amendments | buyandsell.gc.ca | OpenAPI | Only basic procurement exists |
| P1 | federal-grants-contributions | GC Grants, contributions, transfer payments | open.canada.ca | CKAN | 50B+ in transfers — critical for influence tracking |
| P2 | federal-lobbying-monthly-reports | Detailed monthly lobbying communication reports | lobbycanada.gc.ca | JSON | Lobbying registry exists but not monthly filings |
| P2 | federal-conflict-of-interest | Commissioner's registry — gifts, assets, recusals | fcie-scif.gc.ca | HTML | Key for oversight/corruption tracking |
| P2 | federal-auditor-general | OAG reports — performance audits of every dept | oag-bvg.gc.ca | PDF/HTML | Essential for oversight category |
| P2 | federal-parliamentary-budget | PBO cost estimates, fiscal analysis, election platform costing | pbo-dpb.gc.ca | HTML/PDF | Budget watchdog |
| P3 | federal-privacy-commissioner | PIPEDA breach reports, privacy findings, investigations | priv.gc.ca | HTML | Privacy oversight |
| P3 | federal-information-commissioner | Access to Information appeals, complaints, systemic issues | oic-ci.gc.ca | HTML | Transparency |
| P3 | federal-official-languages | OLC complaints, audits, compliance data | clo-ocol.gc.ca | HTML | Language rights |
| P3 | federal-immigration-refugee-board | IRB decisions, appeals, member appointments | irb-cisr.gc.ca | HTML/PDF | Immigration gap |

### Provincial Gaps (15)
| Priority | Module | Description | Source | Format | Why Missing |
|----------|--------|-------------|--------|--------|-------------|
| P1 | ontario-land-registry | Property deeds, liens, transfers (Teranet) | onland.ca | API (paid) | Key for corporate/property influence |
| P1 | bc-assessment | BC Assessment property values, rolls | bcassessment.ca | CSV | Key for municipal finance tracking |
| P1 | ontario-lobbying-registry | Ontario Lobbyists Registry — consultations, reports | lobbyist.oico.on.ca | HTML | 3rd largest lobbying registry in Canada |
| P1 | quebec-lobbying-registry | Quebec lobbyists, communication reports | lobby.quebec | HTML | 2nd largest |
| P2 | alberta-energy-regulator | AER well licenses, production, compliance, spills | aer.ca | API | Energy oversight gap |
| P2 | bc-corporate-registry | BC Corporate Registry — filings, directors | corporateonline.gov.bc.ca | API | Corporate influence |
| P2 | ontario-ontario-securities | OSC filings, enforcement actions, insider trading | osc.ca | HTML | Financial regulation |
| P2 | quebec-requisites-electroniques | REQ — Quebec enterprise registry, corporate filings | registreentreprises.gouv.qc.ca | HTML | Quebec corporate data |
| P2 | ontario-maar-ra | Environmental assessment registry, EA decisions, permit review | maar-ra.ca | HTML | Environment oversight |
| P2 | bc-translink | TransLink — transit performance, ridership, open data | translink.ca | API | Transit data gap |
| P2 | bc-fisheries-dfo | DFO stock assessments, quotas, licensing, oceans | dfo-mpo.gc.ca | OpenAPI | Marine/environmental gap |
| P3 | alberta-wildfire | Wildfire status, bans, danger ratings, historical | wildfire.alberta.ca | API | Climate/environment |
| P3 | ontario-hydro-one | Hydro One — outages, rates, reliability data | hydroone.com | API | Infrastructure |
| P3 | quebec-saaq | SAAQ — driving/vehicle data, accidents, licensing | saaq.gouv.qc.ca | HTML | Quebec transport gap |
| P3 | bc-icbc | ICBC — insurance data, crashes, vehicle registration | icbc.com | API | BC transport gap |

### Municipal Gaps (15)
| Priority | Module | Description | Source | Format | Why Missing |
|----------|--------|-------------|--------|--------|-------------|
| P1 | toronto-budget | Toronto budget, capital plan, tax-supported debt | toronto.ca | OpenData | Core city finance |
| P1 | toronto-ttc | TTC routes, ridership, delays, streetcar data | ttc.ca | GTFS/API | Transit |
| P1 | toronto-police | TPS — crime stats, stops, use-of-force, budget | torontopolice.on.ca | OpenData | Safety oversight |
| P1 | vancouver-council | Vancouver council meetings, minutes, decisions | vancouver.ca | OpenData | Council oversight |
| P2 | toronto-building-permits | Building permits, zoning, development applications | toronto.ca | OpenData | Development tracking |
| P2 | montreal-council | Montreal city council, borough decisions | montreal.ca | OpenData | Council oversight |
| P2 | calgary-council | Calgary city council, committees, bylaws | calgary.ca | OpenData | Council oversight |
| P2 | ottawa-oc-transpo | OC Transpo routes, ridership, LRT delays | octranspo.com | GTFS | Transit |
| P2 | vancouver-property-tax | Property tax assessments, sales data | vancouver.ca | OpenData | Property data |
| P2 | toronto-land-transfer | Land transfer tax, property sales | toronto.ca | OpenData | Housing market |
| P3 | calgary-transit | Calgary Transit ridership, route performance | calgarytransit.com | GTFS | Transit |
| P3 | edmonton-eps | Edmonton Police crime maps, stats, use-of-force | edmontonpolice.ca | OpenData | Safety |
| P3 | halifax-council | Halifax regional council, committees, decisions | halifax.ca | OpenData | Council oversight |
| P3 | surrey-development | Surrey development permits, zoning, applications | surrey.ca | OpenData | Growth tracking |
| P3 | winnipeg-council | Winnipeg city council, budgets, reports | winnipeg.ca | OpenData | Council oversight |

### Infrastructure & Pipeline Gaps (10)
| Priority | Module | Description | Source | Format | Why Missing |
|----------|--------|-------------|--------|--------|-------------|
| P1 | qdrant-maplespike-collection | Embed pipeline data into dedicated Qdrant collection | n/a | n/a | RAG currently uses brain_wiki (964 points, 
| P1 | real-time-ingest | Stream-based ingest for high-frequency sources | n/a | n/a | Most modules are weekly |
| P2 | embedding-pipeline | Automated embedding of every new pipeline record | n/a | n/a | RAG is always stale |
| P2 | cross-reference-relations | Pre-computed M:N relations between entities across modules | n/a | n/a | Entity resolution is inline/on-demand |
| P2 | signal-detection-train | Train signal detection model on historical pipeline data | n/a | n/a | Signal/agent features are hand-tuned |
| P2 | pipeline-health-dashboard | Real-time health dashboard for all 135 ingestion modules | n/a | n/a | Current: manual kubectl logs |
| P3 | module-test-coverage | e2e tests for each ingestion module | n/a | n/a | Many modules have no tests |
| P3 | pipeline-benchmarks | Throughput, freshness, accuracy benchmarks per module | n/a | n/a | No measurement of pipeline health |
| P3 | audit-trail-module | Immutable audit trail of data ingestion (provenance) | n/a | n/a | Legal requirement for some use cases |
| P3 | schema-registry | Versioned schemas for every ingested data source | n/a | n/a | Schema drift tracking |
