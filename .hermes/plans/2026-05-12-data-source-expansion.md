# Data Source Expansion Plan — CivInt Canada Pipeline

> **For Hermes:** implement source-by-source using this plan as reference.

**Goal:** Add 7 new government data source ingestion modules to the CivInt pipeline, following the established patterns in `packages/pipeline-core/src/ingestion/`.

**Architecture:** Each new source gets its own subdirectory under `ingestion/` (like `committees/`, `corporate/`, `influence/`) with the standard module pattern: `types.ts`, `constants.ts`, a fetcher, a parser, an index that exports the public API. Each source is wired into the barrel export at `ingestion/index.ts`.

**Design principles:**
- RSS-first where available (lowest friction, aligns with existing `rss.ts`)
- CKAN API for open.canada.ca datasets (aligns with existing `gov-api.ts`)
- Each module follows the existing pattern (constants → types → fetcher → parser → index)
- No external dependencies beyond what pipeline-core already uses (undici, fast-xml-parser)
- SHA-256 citation hashing on all fetched records (reuse `verification/hashing.ts`)

**Tech Stack:** TypeScript, undici (HTTP), fast-xml-parser (XML), Node built-ins

---

## Sources ordered by implementation priority

| # | Source | Access | Effort | Value |
|---|--------|--------|--------|-------|
| 1 | Canada Gazette (Parts I+II) | RSS/XML | Low | Very high — proposed regs before media reports |
| 2 | GIC Appointments | CKAN CSV | Low | High — patronage tracking, who gets power |
| 3 | Senate committees | XML (identical to HoC) | Low | High — another 20+ committees, drop-in pattern |
| 4 | Third-party advertiser registry | Elections Canada CSV | Low | High — dark money in elections |
| 5 | CanLII court decisions | REST API | Medium | Very high — legal challenges to gov policy |
| 6 | Federal beneficial ownership registry | API (new) | Medium | Very high — who actually owns companies |
| 7 | Provincial lobbying registries | CKAN/HTML | Medium | High — ON/BC/AB lobbying, different from federal |

---

## Task 1: Canada Gazette (Parts I & II)

**Objective:** Ingest proposed and enacted regulations from the Canada Gazette before they hit mainstream news.

**Data format:** RSS feeds for Part I and Part II, linking to full HTML/XML regulatory impact analysis statements (RIAS).

**Files to create:**
```
packages/pipeline-core/src/ingestion/gazette/
├── constants.ts    # Feed URLs, source metadata
├── types.ts        # GazetteRecord, GazettePart, IngestionResult
├── fetcher.ts      # fetchFeed, fetchRegulationDetail
├── parser.ts       # parseGazetteRSS, extractRIALink
└── index.ts        # export: ingestGazette, ingestAllParts
```

**Files to modify:**
- `packages/pipeline-core/src/ingestion/index.ts` — add barrel exports

**Key considerations:**
- Canada Gazette Part I = proposed regulations (60-day comment period) — high-value for "what's coming"
- Canada Gazette Part II = enacted regulations — high-value for "what just changed"
- Part III = Acts in force (less urgent, can defer)
- Each regulation has a Regulatory Impact Analysis Statement (RIAS) with cost-benefit analysis
- Link to the full HTML and also the XML version (use fast-xml-parser for SOR/ text)

**Example RSS structure:**
```xml
<item>
  <title>Regulations Amending the Food and Drug Regulations...</title>
  <link>https://gazette.gc.ca/rp-pr/p1/2026/2026-05-09/html/reg1-eng.html</link>
  <description>Regulatory impact analysis statement...</description>
  <category>Part I</category>
  <pubDate>Sat, 09 May 2026 00:00:00 EDT</pubDate>
</item>
```

**Implementation approach:** Start with `types.ts` + `constants.ts` (simple), then `fetcher.ts` wrapping `fetchFeed()` from `rss.ts`, then `parser.ts` for RIAS extraction, then `index.ts` for orchestration. Wire into barrel. One function: `ingestGazette(db, options?)`.

---

## Task 2: GIC Appointments (Governor-in-Council)

**Objective:** Track who is appointed to federal boards, tribunals, commissions, and agencies — the patronage pipeline.

**Data format:** CKAN package on open.canada.ca. The dataset contains appointment details including position, appointee name, term dates, and compensation.

**Files to create:**
```
packages/pipeline-core/src/ingestion/gic/
├── constants.ts    # CKAN package ID, source metadata
├── types.ts        # GICAppointment, GICCategory, IngestionResult
├── fetcher.ts      # fetchGICAppointments (wraps fetchCKANPackages)
├── parser.ts       # parseGICAppointment, categorizeByDepartment
└── index.ts        # export: ingestGIC, searchGIC, getRecentAppointments
```

**Files to modify:**
- `packages/pipeline-core/src/ingestion/index.ts` — add barrel exports

**Key considerations:**
- GIC appointments cover ~1,500+ positions across ~20+ departments
- High-value categories: CRTC commissioners, Canada Energy Regulator board, Competition Tribunal members, Federal Court judges
- Dataset includes: position title, appointee name, appointment date, expiry date, salary range, organization
- Cross-reference with lobbying data: did the appointee lobby before being appointed? (revolving door)
- Cross-reference with corporate tracking: does the appointee sit on any tracked company boards?

**Implementation approach:** Build on `fetchCKANPackages` from `gov-api.ts` (already exists). Parse CKAN resource → fetch CSV → convert to typed records. Add filter methods for department/organization.

---

## Task 3: Senate Committees

**Objective:** Extend existing committee coverage from House of Commons to the Senate, which uses the same evidence XML system.

**Data format:** Identical XML format to HoC — `https://sencanada.ca/DocumentViewer/en/{Parl}-{Session}/{ACRONYM}/meeting-{N}/evidence?format=xml`

**Files to modify (not create):**
- `packages/pipeline-core/src/ingestion/committees/constants.ts` — add Senate committees to COMMITTEES array
- `packages/pipeline-core/src/ingestion/committees/fetcher.ts` — add factor for different base URL
- `packages/pipeline-core/src/ingestion/committees/index.ts` — add `ingestSenateCommittees()` export

**Key considerations:**
- Senate committees have the same XML evidence schema — the existing `parseEvidenceXml()` works
- Different base URL: `sencanada.ca` instead of `ourcommons.ca`
- Senate committees include: SOCI (Human Rights), RIDR (Indigenous Peoples), SCME (Media), SLCI (Legal), SSOC (Social Affairs), SBAF (Banking/Commerce), NFFN (Fisheries), SEEE (Energy), SEGD (Agriculture), SREV (Values/Ethics)
- Same meeting list HTML structure but at `https://sencanada.ca/Committees/en/{ACRONYM}/Meetings`
- About 20 standing Senate committees to add

**Implementation approach:** This is the simplest task — mostly config/data, very little new code. Add senate committee definitions to `constants.ts`, tweak `fetcher.ts` to accept a `chamber` option, add an orchestrator function. The parser and types are 100% reusable.

**Effort:** ~1 hour, 80% reuse of existing committee code.

---

## Task 4: Third-Party Advertiser Registry (Elections Canada)

**Objective:** Track who is spending money on Canadian election advertising outside of political parties — unions, corporations, issue groups.

**Data format:** Elections Canada publishes CSV/Excel reports of registered third parties, their spending, and who they're targeting.

**Files to create:**
```
packages/pipeline-core/src/ingestion/elections/
├── constants.ts    # Elections Canada data URLs, source metadata
├── types.ts        # ThirdPartyAd, ThirdPartySpending, ElectionPeriod
├── fetcher.ts      # fetchThirdPartyRegistry, fetchSpendingReports
├── parser.ts       # parseThirdPartyCSV, categorizeByType
└── index.ts        # export: ingestThirdPartyAds, getTopSpenders
```

**Files to modify:**
- `packages/pipeline-core/src/ingestion/index.ts` — add barrel exports

**Key considerations:**
- Third parties include: unions (Unifor, PSAC), corporations (Loblaws, Rogers), issue groups (Environmental Defence, Canadian Taxpayers Federation)
- Covers: pre-election period (60 days), election period, and between-election advertising
- Reports include: amount spent, advertising platform, electoral district targeting, issue focus
- Cross-reference with influence tracking: is a tracked IO/NGO also a third-party advertiser?
- Cross-reference with corporate: is a tracked company or its executives associated with a third-party group?

**Implementation approach:** Fetch CSV from Elections Canada, parse with Node's built-in CSV handling or a lightweight parser. Support for between-election periods (ongoing). Filter by date range.

---

## Task 5: CanLII (Canadian Legal Information Institute)

**Objective:** Index court decisions affecting government policy, regulatory decisions, and corporate litigation.

**Data format:** CanLII provides a REST API (`https://api.canlii.org/v1/`) returning JSON with full case metadata, citations, and text.

**Files to create:**
```
packages/pipeline-core/src/ingestion/canlii/
├── constants.ts    # API endpoint, tracked courts, keywords
├── types.ts        # CanliiDecision, Court, LegalCitation, IngestionResult
├── fetcher.ts      # searchCanlii, fetchDecisionDetail
├── parser.ts       # parseDecision, extractCitations, extractParties
└── index.ts        # export: ingestDecisions, searchDecisions, getRecentByCourt
```

**Files to modify:**
- `packages/pipeline-core/src/ingestion/index.ts` — add barrel exports

**Key considerations:**
- CanLII API requires a free API key (register at developer.canlii.org)
- Key courts to track: Federal Court (judicial reviews of gov decisions), Federal Court of Appeal, Supreme Court of Canada, Tax Court
- Search by: department name, agency name, legislation name
- Every decision that reviews a government action or interprets a regulation is a data point
- Cross-reference with: tracked companies (are they litigating?), tracked influence actors (interveners in court cases)
- CanLII provides neutral citations, case names, decision dates, docket numbers
- For now: index metadata + summary; full text can be deferred

**Integration hooks:**
- Keyword alerts for tracked entities (banks, telecom executives, IOs)
- Weekly digest of all Federal Court decisions mentioning government departments
- "This company is currently suing this department" — the graph builder feeds on this

---

## Task 6: Federal Beneficial Ownership Registry

**Objective:** Track who actually owns Canadian corporations — the ultimate solution for the "who is behind this company" question.

**Data format:** Corporations Canada beneficial ownership registry — API-based, phased rollout starting 2024-2025.

**Status:** This source is still evolving. Federal registry is being implemented; BC already has a land owner transparency registry. Plan as a tracker that stays current with developments.

**Files to create:**
```
packages/pipeline-core/src/ingestion/ownership/
├── constants.ts    # Registry URLs, API endpoints, status flags
├── types.ts        # OwnershipRecord, CorporateEntity, BeneficialOwner
├── fetcher.ts      # fetchCorporateRegistry, fetchBeneficialOwnership
├── parser.ts       # parseOwnershipRecord, resolveUltimateOwner
└── index.ts        # export: ingestOwnership, searchEntity, getOwners
```

**Key considerations:**
- NOT yet fully operational — this is a "watchdog ready" module
- BC Land Owner Transparency Registry is operational and searchable
- Federal registry will cover all federally incorporated entities
- Cross-reference with: lobbying records (who lobbied for whom), procurement (who owns the bidding company), influence tracking (who funds which IO)
- This is the crown jewel of corporate accountability data
- Start with BC LOTA since it exists now

---

## Task 7: Provincial Lobbying Registries

**Objective:** Extend federal lobbying coverage to Ontario, British Columbia, Alberta, and Quebec — each province has its own registry with a different schema.

**Data format:** Varies by province:
- Ontario: CKAN portal with CSV exports
- BC: HTML/CSV
- Alberta: CKAN
- Quebec: Registre des lobbyistes with API

**Files to create:**
```
packages/pipeline-core/src/ingestion/provincial-lobbying/
├── constants.ts    # Per-province URLs, source metadata
├── types.ts        # ProvincialLobbyingRecord, Province
├── fetcher.ts      # fetchOntarioLobbying, fetchBCLobbying, fetchAlbertaLobbying
├── parser.ts       # normalizeToFederalSchema, matchProvince
└── index.ts        # export: ingestProvincialLobbying, searchAllProvinces
```

**Key considerations:**
- Each province has different fields but same core data: lobbyist name, client organization, subject matter, target officials
- Normalizing to the federal schema enables cross-jurisdiction queries
- Ontario lobbying registry is the largest and most active — start there
- A company can lobby federally AND provincially on the same issue
- Cross-reference with: federal lobbying (same company, different level), procurement (provincial contracts), influence tracking (which IOs lobby provinces)

---

## Task 8: Independent Oversight Bodies & Tribunals (JCCF, OAG, Ethics Commissioner, CRTC, etc.)

**Objective:** Track what independent oversight bodies and regulatory tribunals are doing — investigations launched, reports published, decisions rendered, and recommendations ignored. These are some of the highest-leverage accountability data sources.

**Status:** Each body has its own publication pattern (PDF reports, RSS feeds, HTML pages). This is a **category** of sources, not a single module — we'll add bodies one at a time as a common `oversight/` module with per-body connectors.

**High-value bodies (ordered by accountability impact):**

| Body | What it produces | Access | Priority |
|------|-----------------|--------|----------|
| **Office of the Auditor General (OAG)** | Performance audits of every federal department — the deepest investigative work on government waste/failure | PDF reports at oag-bvg.gc.ca, RSS feed | CRITICAL |
| **Parliamentary Budget Officer (PBO)** | Cost of government bills, economic/fiscal outlook independent of government | HTML/PDF at pbo-dpb.ca | HIGH |
| **Ethics Commissioner** | Conflict of Interest Act investigations — PM/ministers/MPs | HTML reports at ciec-ccie.parl.gc.ca | HIGH |
| **Lobbying Commissioner** | Lobbying Act investigations — who broke the rules | HTML at lobbycanada.gc.ca | HIGH |
| **Competition Bureau** | Merger reviews, deceptive marketing investigations, abuse of dominance | HTML/PDF at competitionbureau.gc.ca | HIGH |
| **CRTC** | Broadcasting/telecom regulatory decisions — ownership changes, licensing | HTML at crtc.gc.ca, RSS for decisions | HIGH |
| **Information Commissioner** | Access to Information Act compliance — which departments obstruct | Annual reports, investigation summaries at oic-ci.gc.ca | MEDIUM |
| **Privacy Commissioner** | Privacy breach investigations, PIPEDA enforcement | HTML at priv.gc.ca | MEDIUM |
| **Canada Energy Regulator** | Pipeline/energy project approvals, safety orders | HTML at cer-rec.gc.ca | MEDIUM |
| **Canadian Transportation Agency** | Transportation rulings, accessibility complaints | HTML at cta-otc.gc.ca | MEDIUM |
| **JCCF (Judicial Compensation)** | Quadrennial reports on judicial salaries and benefits | PDF at jccf-ccmj.ca | MEDIUM |
| **Commissioner of Official Languages** | Language rights enforcement against federal institutions | HTML at clo-ocol.gc.ca | MEDIUM |
| **Canadian Human Rights Commission** | Human rights complaints against government/federally regulated | HTML at chrc-ccdp.gc.ca | MEDIUM |
| **NSIRA** | National security intelligence review — CSIS, RCMP, CSE oversight | Annual reports, but many redacted | LOW |
| **Military Police Complaints Commission** | Military police misconduct investigations | HTML at mpcc-cppm.gc.ca | LOW |

**Files to create:**
```
packages/pipeline-core/src/ingestion/oversight/
├── constants.ts    # Per-body URLs, RSS feeds, publication types
├── types.ts        # OversightBody, OversightReport, Investigation, Recommendation
├── fetcher.ts      # fetchOAGReports, fetchPBOReports, fetchEthicsInvestigations, etc.
├── parser.ts       # parsePDFReport, extractRecommendations, extractFindings
└── index.ts        # export: ingestOversightBody, ingestAllBodies, getRecentReports
```

**Key considerations:**
- Most reports are **PDF-only** — need PDF text extraction (`mupdf` or `pdftotext` from the existing toolchain)
- OAG reports are the gold standard — deeply researched, 6-12 major audits per year
- Ethics Commissioner investigations are the most explosive — each one is a potential political scandal
- PBO reports are the only independent cost estimates of government bills — journalists use them constantly
- Competition Bureau merger reviews reveal corporate power consolidation
- CRTC decisions affect media ownership, telecom prices, net neutrality
- Cross-reference with: committee hearings (did a body's head testify recently?), lobbying (did the studied entity lobby?), procurement (audited contracts)
- Recommendation tracking is a key feature — did the government implement the OAG/PBO/Commissioner's recommendations?

**Integration hooks:**
- "What did the OAG find this quarter?" — digest of new audit reports
- "Which ethics investigations are active?" — per-MP tracker
- "Has the government responded to the PBO's latest report?" — recommendation follow-up
- "Which regulatory decisions affected tracked companies?" — CRTC/CER cross-ref with corporate module

**Implementation approach:**
- Start with bodies that have RSS/Atom feeds (OAG, CRTC, PBO) — reuse existing RSS module
- Then add bodies with HTML publication lists (Ethics, Lobbying Commissioner) — scrape-and-parse pattern
- Most PDFs have HTML versions too — use those rather than doing full PDF extraction
- Each body gets a `fetch{Body}Reports()` function in the fetcher, sharing a common `parseHTMLReportList()` parser

**Effort:** ~3-5 days to cover the top 6 bodies (OAG, PBO, Ethics, Lobbying, Competition Bureau, CRTC). The rest are 0.5-1 day each.

**CivInt dashboard integration:** This category is the most natural fit for the CivInt frontend in `packages/web/` — each body gets a report list view with status tracking (new, read, actioned, ignored). The "oversight dashboard" could be the front page.

---

## Integration Metadata

When adding each source, also extend these shared components:

| Component | What to add |
|-----------|-------------|
| `packages/pipeline-core/src/ingestion/index.ts` | Barrel exports for each new module |
| `schema/d1.sql` | DDL for new tables (one per source) |
| `packages/engine/src/sources/` | Optional: processing pipeline if the engine needs to consume this data |
| `packages/mcp-server/src/tools/` | Optional: new MCP tool for agent access (deferred after ingestion is solid) |

---

## Schema considerations (D1 SQL)

Each new source gets its own table in `schema/d1.sql`:

```sql
-- Canada Gazette
CREATE TABLE IF NOT EXISTS gazette_records (
  id TEXT PRIMARY KEY,                     -- SHA-256 citation hash
  part INTEGER NOT NULL,                   -- 1 = proposed, 2 = enacted, 3 = acts
  title TEXT NOT NULL,
  registration_number TEXT,                -- SOR/2026-XXX or SI/2026-XXX
  department TEXT,
  published_at TEXT NOT NULL,              -- ISO-8601
  html_url TEXT NOT NULL,
  rias_url TEXT,                           -- Regulatory Impact Analysis Statement
  summary TEXT,
  effective_date TEXT,
  comment_deadline TEXT,                   -- Only for Part I
  ingested_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- GIC Appointments
CREATE TABLE IF NOT EXISTS gic_appointments (
  id TEXT PRIMARY KEY,
  position_title TEXT NOT NULL,
  appointee_name TEXT NOT NULL,
  organization TEXT NOT NULL,
  appointment_date TEXT NOT NULL,
  expiry_date TEXT,
  salary_range TEXT,
  is_reappointment INTEGER DEFAULT 0,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Third-party advertising
CREATE TABLE IF NOT EXISTS third_party_ads (
  id TEXT PRIMARY KEY,
  registrant_name TEXT NOT NULL,
  registrant_type TEXT,                    -- union, corporation, group, individual
  spending_amount REAL,
  election_period TEXT,
  electoral_district TEXT,
  platform TEXT,                           -- digital, print, broadcast, etc.
  issue_focus TEXT,
  period_start TEXT,
  period_end TEXT,
  source_url TEXT NOT NULL,
  ingested_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Architectural diagram for new sources

```
RSS feeds ──────────────────┐
  Gazettes, Senate meetings  │
                              ├──→ ingestion/rss.ts (reuse fetchFeed)
                              │
CKAN / open.canada.ca ───────┤
  GIC appointments, elections │──→ ingestion/gov-api.ts (reuse fetchCKANPackages)
                              │
Custom REST APIs ────────────┤
  CanLII, BC ownership        └──→ new fetcher per source
                              │
CSV downloads ───────────────┤
  Third-party ads, provincial ┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  parser.ts       │──→ typed records
                    │  (fast-xml-par.) │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  verification/   │──→ SHA-256 hash
                    │  hashing.ts      │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  D1 database     │──→ queryable
                    │  (SQLite on K3s) │
                    └─────────────────┘
```

---

## Suggested implementation sequence

**Phase 1 — Foundation (Weeks 1-2)**
1. **Gazette** (1-2 days) — RSS, pattern already exists in `rss.ts`, highest news value
2. **Senate committees** (<1 day) — nearly 100% reuse of existing committee code
3. **GIC appointments** (1 day) — CKAN, reuse `gov-api.ts`

**Phase 2 — Elections & Procurement (Weeks 2-3)**
4. **Third-party ads** (1-2 days) — CSV, moderate complexity
5. **Provincial lobbying** (2-3 days/province) — most variation, start with ON

**Phase 3 — Oversight & Legal (Weeks 3-5)**
6. **Oversight bodies: OAG + PBO** (2 days) — RSS/HTML, highest accountability value
7. **Oversight bodies: Ethics + Lobbying Commissioner** (2 days) — HTML, scandal tracking
8. **Oversight bodies: Competition Bureau + CRTC** (2 days) — regulatory decisions
9. **CanLII** (2-3 days) — API key needed, richest integration for legal tracking

**Phase 4 — Deep Tracking (Deferred)**
10. **Beneficial ownership** (watchdog ready, implement when federal API ships)
11. **Remaining oversight bodies** (Information, Privacy, CER, CTA, CHRC, JCCF, OCL, NSIRA, MPCC) — 0.5-1 day each as needed

**Total:** ~15-25 days of focused work across all sources.

---

## Definition of done (per source)

- [ ] `types.ts` defines all interfaces and types
- [ ] `constants.ts` defines all source URLs, configuration
- [ ] `fetcher.ts` successfully fetches data from the source
- [ ] `parser.ts` converts raw data to typed records
- [ ] `index.ts` exposes a clean `ingest{Source}()` function
- [ ] Barrel export added to `ingestion/index.ts`
- [ ] DDL added to `schema/d1.sql`
- [ ] Ad-hoc test run produces records (manual verification)

---

## Rejected / deferred

- **Cross-border US data** — user explicitly excluded
- **Provincial campaign finance** — too many schemas, deferred pending lobbying module stabilizing
- **Municipal lobbying** — Toronto has a registry but HTML-only scraping, deferred
- **MP/MPP voting records** — available but not directly actionable for influence tracking
- **Social media monitoring of MPs** — scope creep, better handled by a separate tool
- **Passport/immigration wait times** — not directly related to accountability
