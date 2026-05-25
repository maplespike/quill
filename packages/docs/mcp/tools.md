---
last-reviewed: 2026-05-25
status: active
---

# MCP Tools — Complete Reference

The MapleSpike MCP server exposes **34 tools** for AI agents to query, search, and verify Canadian government data. All tools return real data from live databases with citations and quality metadata.

## Tool Categories

| Category | Tools |
|----------|-------|
| **Data Query** | `query_gov_data`, `fact_check`, `get_citation`, `latest_releases` |
| **Parliamentary** | `search_committees`, `search_gazette`, `search_gic`, `search_elections` |
| **Corporate & Influence** | `search_corporate`, `search_influence`, `search_provincial_lobbying` |
| **Legal & Immigration** | `search_canlii`, `search_lmia`, `search_immigration`, `search_tribunals`, `search_criminal_justice` |
| **Oversight & Science** | `search_oversight`, `search_science`, `search_health`, `searxng_health` |
| **Defence & Veterans** | `search_defence`, `search_veterans` |
| **Transport & Safety** | `search_transport_safety` |
| **Indigenous Relations** | `search_indigenous_relations` |
| **Media & Narratives** | `search_ngo_rss`, `search_narrative_tracker` |
| **Knowledge Graph** | `search_knowledge_fabric`, `resolve_entity`, `find_connections` |
| **Geospatial** | `search_lode` |
| **AI Tools** | `ai_ask`, `ai_analyze`, `ai_search_semantic` |
| **System** | `system_health` |

---

## 1. query_gov_data

Query Canadian government data releases, datasets, and records across StatCan, CKAN, and provincial portals.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search keyword (e.g., "GDP", "housing starts", "CPI") |
| `jurisdiction` | string | No | `all` | Enum: `federal`, `ontario`, `british-columbia`, `alberta`, `quebec`, `all` |
| `category` | string | No | `all` | Enum: `economy`, `demographics`, `health`, `justice`, `environment`, `education`, `social`, `spending`, `all` |
| `limit` | number | No | `10` | Max results (1-50) |

**Response:** `{ results: [...], totalCount: number }`

---

## 2. fact_check

Check a specific claim, statement, or statistic against official Canadian government data sources (StatCan, open.canada.ca, federal spending records). Returns corroborating or contradicting evidence with citations, trust scores, and confidence ratings.

**Input Schema:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `claim` | string | Yes | The claim to fact-check (e.g., "unemployment rate rose to 6.5%") |

**Response:** `{ keywords: [...], result: { status, confidence, evidence: [...], summary } }`

---

## 3. get_citation

Retrieve a citation record by its SHA-256 content hash. Returns the original data, timestamp, source attribution, and a ready-to-run shell command for independent hash verification.

**Input Schema:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `hash` | string | Yes | SHA-256 citation hash (e.g., "sha256-abc123...") |

**Response:** `{ citation: { hash, timestamp, source, verified, data }, verifyCommand }`

---

## 4. latest_releases

Get the most recent government data releases, economic indicators, and announcements from Statistics Canada and federal/provincial portals.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `category` | string | No | `all` | Filter by data category |
| `jurisdiction` | string | No | `federal` | Jurisdiction filter |
| `limit` | number | No | `5` | Max results (1-20) |

---

## 5. search_committees

Full-text search over House of Commons and Senate committee evidence, meeting transcripts, and proceedings. Covers standing committees (FINA, OGGO, ETHI), special committees, joint committees, and in-camera meeting records.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search terms (e.g., "carbon tax", "arrivecan") |
| `chamber` | string | No | `all` | Enum: `house`, `senate`, `joint`, `all` |
| `committee` | string | No | — | Specific committee code (e.g., "FINA", "OGGO", "ETHI", "SOCI") |
| `limit` | number | No | `10` | Max results (1-50) |

---

## 6. search_corporate

Search Canadian corporate registry data, federal procurement contracts, lobbying registrations, and executive statements. Tracks insider transactions, sole-source contracts, and corporate-government interactions.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Company name, executive, or keyword |
| `dataset` | string | No | `all` | Enum: `lobbying`, `procurement`, `statements`, `all` |
| `limit` | number | No | `10` | Max results (1-50) |

---

## 7. search_influence

Search influence tracking records including international organizations, NGOs, think tanks, and consultancies operating in Canada. Traces government funding flows, CRA charity status, and grants data.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Organization name or keyword |
| `category` | string | No | `all` | Enum: `international_organization`, `ngo`, `think_tank`, `consultancy`, `all` |
| `limit` | number | No | `10` | Max results (1-50) |

---

## 8. search_gazette

Search the Canada Gazette — proposed regulations (Part I), enacted regulations (Part II), and Acts of Parliament (Part III). Includes Regulatory Impact Analysis Statements (RIAS).

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Regulation search terms |
| `part` | string | No | `all` | Enum: `part1`, `part2`, `part3`, `all` |
| `limit` | number | No | `10` | Max results (1-50) |

---

## 9. search_gic

Search Governor-in-Council (GiC) appointments to federal agencies, boards, commissions, and Crown corporations. Includes salary ranges, departmental categories, and appointment types.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Appointee name, department, or body |
| `department` | string | No | — | Filter by department or portfolio |
| `limit` | number | No | `10` | Max results (1-50) |

---

## 10. search_elections

Search Elections Canada third-party advertiser registry and financial reports. Tracks advertising spending, platforms used, and election periods.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Third-party name, advertiser, or platform |
| `electionPeriod` | string | No | — | Filter by election period year or label |
| `limit` | number | No | `10` | Max results (1-50) |

---

## 11. search_provincial_lobbying

Search provincial lobbying registries across Canada. Covers Ontario, BC, Alberta, and Quebec. Cross-references with the federal lobbying registry.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Lobbyist name, organization, or subject |
| `province` | string | No | `all` | Enum: `ontario`, `british-columbia`, `alberta`, `quebec`, `all` |
| `limit` | number | No | `10` | Max results (1-50) |

---

## 12. search_oversight

Search independent oversight body reports, investigations, and decisions. Covers OAG, PBO, Ethics Commissioner, Lobbying Commissioner, Competition Bureau, and CRTC.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Topic, body, or keyword |
| `body` | string | No | `all` | Enum: `oag`, `pbo`, `ethics`, `lobbying`, `competition`, `crtc`, `all` |
| `limit` | number | No | `10` | Max results (1-50) |

---

## 13. search_canlii

Search Canadian court decisions via CanLII. Covers Supreme Court of Canada, Federal Court, Federal Court of Appeal, and provincial courts.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Case name, party, citation, or keyword |
| `court` | string | No | — | Filter by court (e.g., "scc", "fca", "onca", "bcca") |
| `limit` | number | No | `10` | Max results (1-50) |

---

## 14. search_lmia

Search Labour Market Impact Assessment (LMIA) data from ESDC. Quarterly statistics on employer use of the Temporary Foreign Worker program.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Employer name, occupation, or NOC code |
| `stream` | string | No | `all` | Enum: `high_wage`, `low_wage`, `agriculture`, `caregiver`, `all` |
| `limit` | number | No | `10` | Max results (1-50) |

---

## 15. search_immigration

Search Canadian immigration data including IRCC permanent resident admissions, Express Entry summaries, IRB Refugee Protection Division decisions, and CBSA enforcement statistics.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Country, province, category, or year |
| `source` | string | No | `all` | Enum: `ircc`, `irb`, `cbsa`, `all` |
| `year` | number | No | — | Filter by year |
| `limit` | number | No | `10` | Max results (1-50) |

---

## 16. search_science

Search Canadian science, space, and research data — CSA missions, Mitacs grants, Ocean Networks Canada observations, Polar Data Catalogue records.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search term for science/research records |
| `limit` | number | No | `20` | Max results |

---

## 17. search_tribunals

Search federal tribunal appointments and decisions — GIC appointments to federal tribunals including IRB, CHRT, Competition Tribunal, CITT, Specific Claims Tribunal, and more.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Appointee name, tribunal name, or department |
| `tribunal` | string | No | — | Filter by tribunal acronym (e.g., IRB, CHRT, CITT) |
| `limit` | number | No | `10` | Max results |

---

## 18. search_lode

Query Statistics Canada LODE (Linkable Open Data Environment) geospatial databases. 12 databases covering addresses, buildings, healthcare, recreation, education, culture, businesses, infrastructure, greenhouses, pedestrian networks, transit networks, and cycling networks.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | No | — | Search terms (e.g., "hospitals Ottawa") |
| `databaseId` | string | No | — | Target specific database: `oda`, `odb`, `odhf`, `odrsf`, `odef`, `odcaf`, `odbusiness`, `odi`, `odg`, `cpnd`, `cptnd`, `ccnd` |
| `province` | string | No | — | Filter by province code (e.g., ON, QC, BC) |
| `municipality` | string | No | — | Filter by municipality name |
| `list` | boolean | No | — | Set true to list all 12 databases with metadata |
| `limit` | number | No | `10` | Max results (1-100) |

**12 LODE Databases:**

| ID | Name | Records | Version |
|----|------|---------|---------|
| `oda` | Open Database of Addresses | ~10,000,000 | 1.0 |
| `odb` | Open Database of Buildings | ~14,400,000 | 3.0 |
| `odhf` | Open Database of Healthcare Facilities | ~7,000 | 1.1 |
| `odrsf` | Open Database of Recreational and Sport Facilities | ~182,000 | 1.0 |
| `odef` | Open Database of Educational Facilities | ~19,000 | 3.0 |
| `odcaf` | Open Database of Cultural and Art Facilities | ~8,000 | 1.0 |
| `odbusiness` | Open Database of Businesses | ~500,000 | 1.0 |
| `odi` | Open Database of Infrastructure | ~100,000 | 2.0 |
| `odg` | Open Database of Greenhouses | ~3,900 | 2.0 |
| `cpnd` | Canadian Pedestrian Network Database | ~500,000 | 1.0 |
| `cptnd` | Canadian Public Transit Network Database | ~1,000,000 | 1.0 |
| `ccnd` | Canadian Cycling Network Database | ~250,000 | 1.0 |

---

## 19. ai_ask

Ask a natural language question about Canadian government data. Uses AI to search across all pipeline sources and return a cited, synthesized answer.

**Input Schema:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Natural language question |
| `source_filter` | string | No | Narrow to specific source type |

---

## 20. ai_analyze

Analyze a document, transcript, or data set using AI. Detects topics, sentiment, entities, and generates a structured summary.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `text` | string | Yes | — | Text content to analyze |
| `analysis_type` | string | No | `full` | Enum: `summary`, `entities`, `sentiment`, `topics`, `full` |

---

## 21. ai_search_semantic

Semantic search across all ingested pipeline data using vector embeddings. Finds conceptually related documents even when keywords don't match.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Natural language search query |
| `limit` | number | No | `10` | Max results (1-50) |
| `source_type` | string | No | — | Filter by source type (e.g., "committee", "lobbying", "court") |

---

## 22. system_health

Check the MapleSpike API service health. Returns service status, version, tenant tier, and current API call usage (daily/monthly). No input parameters required.

---

## 23. search_indigenous_relations

Search Indigenous relations data — CIRNAC specific claims, ISC First Nations financial transparency (chief/council salaries, community budgets), TRC Calls to Action tracker, Jordan's Principle funding, and MMIWG follow-up data.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search terms — community, province, claim type, or year |
| `source` | string | No | `all` | Source filter: CIRNAC, ISC, TRC |
| `limit` | number | No | `20` | Max results |

---

## 24. search_criminal_justice

Search Canadian criminal justice and corrections data — CSC prison population statistics, Parole Board decisions, RCMP crime statistics (hate crimes, organized crime, youth justice), and PPSC prosecution service data.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search terms — institution, province, crime type, or year |
| `source` | string | No | `all` | Source filter: CSC, Parole Board, RCMP |
| `year` | number | No | — | Filter by year |
| `limit` | number | No | `20` | Max results |

---

## 25. search_transport_safety

Search Canadian transport safety and infrastructure data — TSB occurrence datasets (air, rail, marine, pipeline investigations), Transport Canada recalls and violations, Infrastructure Canada project funding, and CTA decisions.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search terms — mode, province, investigation type, or year |
| `source` | string | No | `all` | Source filter: TSB, TC, Infrastructure Canada |
| `year` | number | No | — | Filter by year |
| `limit` | number | No | `10` | Max results (1-50) |

---

## 26. search_defence

Search Canadian defence data — DND regular force personnel by rank, Defence Capabilities Blueprint procurement data, Veterans Affairs Canada wait times, suicide prevention data, and service statistics.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search terms — branch, rank, procurement category, or year |
| `source` | string | No | `all` | Source filter: DND, VAC |
| `limit` | number | No | `20` | Max results |

---

## 27. search_veterans

Search Canadian veterans and military personnel data — VAC benefits, disability claims, education programs, OSISS clinics, veteran suicide statistics, defence transition programs, and wait times data.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search term (e.g., "disability", "education", "benefits") |
| `limit` | number | No | `20` | Max results |

---

## 28. search_ngo_rss

Search NGO and think tank publications ingested from RSS feeds — policy papers, reports, press releases, and articles from 30+ tracked organizations. Returns article titles, URLs, publication dates, and narrative classification flags.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search term for NGO/think tank publications |
| `limit` | number | No | `20` | Max results |

---

## 29. ngo_narrative_tracker

Analyze NGO and think tank publications for narrative alignment, coordinated messaging, and influence campaigns. Detects when multiple organizations use similar framing across different publications. Assigns 5GW classification flags when applicable.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `organization` | string | No | — | Filter by specific NGO/think tank name |
| `topic` | string | No | — | Filter by topic or theme |
| `timeframe` | string | No | `30d` | Time range: 7d, 30d, 90d, all |
| `narrative_type` | string | No | `all` | Pattern type: coordinated, divergence, all |
| `limit` | number | No | `10` | Max results to analyze (1-50) |

---

## 30. search_health

Search Canadian health data — CIHI hospital wait times, health spending, surgical volumes, PHAC disease surveillance, opioid crisis data, CFIA food recalls, drug shortage alerts, and CADTH drug recommendation reviews.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Search terms — condition, drug, procedure, agency, or province |
| `category` | string | No | `all` | Health data category: wait_times, spending, disease, opioids, food_safety, drug_shortages, drug_reviews |
| `limit` | number | No | `20` | Max results |

---

## 31. searxng_health

Check SearXNG engine health — which engines are failing, suspended, or rate-limited. Returns engine success rates, suspension times, and error counts from the SearXNG /stats endpoint.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `checkEngines` | boolean | No | `true` | Whether to run live engine tests (adds ~5s latency) |
| `maxResults` | number | No | `10` | Max results per engine test (1-50) |

---

## 32. search_knowledge_fabric

Query the Knowledge Fabric vector knowledge base for deep research across brain sessions, wiki pages, and web sources. Returns synthesized answers with source citations from local Qdrant storage and web search via RRF fusion.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Question or search query |
| `file_back` | boolean | No | `false` | Save the answer as a Q&A wiki page |

---

## 33. resolve_entity

Resolve an entity (person/organization/location) across all MapleSpike modules. Returns appearances in committees, lobbying, corporate filings, GIC appointments, and more. Use to find all records mentioning a specific person or organization.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | — | Entity name or partial name to search |
| `entity_type` | string | No | — | Filter: person, organization, location |
| `confidence_threshold` | number | No | `0.6` | Minimum confidence score (0-1) |

---

## 34. find_connections

Find relationships and connections between entities (people, organizations) across modules. Returns a graph of directorships, lobbying relationships, employment links, and more. Use after `resolve_entity` to explore an entity's network.

**Input Schema:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `entity_id` | string | Yes | — | Entity ID (from resolve_entity output) |
| `relationship_type` | string | No | `all` | Filter: works_at, is_director_of, lobbied_for, represents |
| `max_depth` | number | No | `2` | Graph search depth (1-3) |
