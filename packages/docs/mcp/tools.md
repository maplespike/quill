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
