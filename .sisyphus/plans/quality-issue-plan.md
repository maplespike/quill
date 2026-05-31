# MapleSpike Quality & Issue Addressal Plan

> **Goal**: Zero untested high-risk modules, resolve top P1/P2 issues
> **Scope**: 56 untested modules + 6 priority issues

---

## Phase T1 — Cross-Reference Tests (HIGHEST RISK)
- `cross-reference/index.ts` — entity resolution, searchCrossReference
- Test: entity matching across committees, corporate, lobbying, GIC
- Test: connections between people, organizations, transactions
- Risk: Core engine, no tests at all

## Phase T2 — Corporate & Influence Tests (P1)
- `corporate` — lobbying registry fetch/parse, procurement, exec statements
- `influence` — actor catalog, funding flow detection
- `ngo-influence-rss` — RSS feed ingestion, narrative classification
- Risk: High public interest, complex data pipelines

## Phase T3 — Provincial Modules Tests (P1)
- `provincial-lobbying` — 13 provinces, largest test surface
- `provincial-legislatures` — Hansard, committees, bills
- `provincial-orgs` — agencies, boards, commissions
- `provincial-regulators` — 273 regulators, 21 categories

## Phase T4 — Legal & Health Tests (P2)
- `canlii` — court decisions API client
- `health-canada` — drug approvals, medical devices, recalls
- `health-data` — CIHI, CFIA, PMPRB, PHAC

## Phase T5 — Environment Tests (P2)
- `npri` — pollutant release inventory
- `species-at-risk` — SARA registry
- `fisheries` — DFO fish stocks
- `agriculture` — AAFC crop reports

## Phase T6 — Issue #414: Entity Resolution Automation
- Auto-resolve entities during ingestion pipeline
- Match names across committees ↔ lobbying ↔ GIC ↔ corporate filings
- Confidence scoring with threshold

## Phase T7 — Issue #413: MCP Entity Resolution Tools
- `resolve_entity` tool — resolve by name across all sources
- `find_connections` enhancement — expand to ALL modules
- `get_entity_graph` — full network visualization data

## Phase T8 — Issue #571: Cross-Reference BuildCanada & GovTrace
- Integrate BuildCanada project data
- Integrate GovTrace influence tracking
- Cross-reference with lobbying, GIC, committees

## Phase T9 — Issue #419: Fix NIM Entrypoint
- Fix opencode NVIDIA NIM provider detection
- Update gateway routing config

## Phase T10 — Issue #410: Municipal Fetchers Complete
- Finish ArcGIS Hub implementation
- Test all 33 + new cities
- Validate real fetches work

---

## Modules needing tests (56 total, covering all phases):

```
High Risk (P1): cross-reference, corporate, influence, ngo-influence-rss, provincial-lobbying, canlii
Medium Risk (P2): health-canada, health-data, npri, species-at-risk, fisheries, agriculture, provincial-legislatures
Lower Risk (P3): attestation, gc-standards, lmia, cmhc, bank-of-canada, sedi, crown-corporations, corporate-filings,
  federal-tribunals, impact-assessment, transport-infrastructure, social-programs, unions, utilities, housing-data,
  media-broadcasting, provincial, provincial-orgs, provincial-regulators, culture, science-research,
  education-research, universities, cipo, indigenous-relations, indigenous-services-directory,
  ircc-family-sponsorship, isc-programs, emergency-management, pharmaceuticals, policing-security,
  telecommunications, real-time-feeds, regional-authorities, fire-emergency, police-data,
  parliamentary-voting, political-donations, public-accounts, ontario-provincial
```

## Order of execution

```
Week 1:   T1 (Cross-ref tests) + T2 (Corporate/Influence tests)
Week 2:   T3 (Provincial tests) + T4 (Legal/Health tests)
Week 3:   T5 (Environment tests) + cleanup
Week 4:   T6 (Entity resolution) + T7 (MCP tools)
Week 5:   T8 (Cross-reference) + T9 (NIM fix) + T10 (Municipal)
```
