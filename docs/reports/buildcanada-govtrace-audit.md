# BuildCanada & GovTrace Data Source Audit

Generated: 2026-05-29

## Executive Summary

Cross-reference audit of BuildCanada (31 repos) and GovTrace data sources against MapleSpike's 92 modules reveals significant overlap in core domains but identifies unique data sources each project covers that MapleSpike misses.

**Key Finding:** Both projects focus on similar influence tracking domains (lobbying, contracts, political donations) but use different upstream sources. GovTrace has several unique data types (IATI aid data, public accounts) that would significantly expand MapleSpike's international/federal coverage.

## BuildCanada Audit

### Repositories Analyzed

**CanadaSpends** (https://github.com/BuildCanada/CanadaSpends)
- **Purpose:** Federal spending transparency
- **Data Sources:**
  - Federal contract awards (via open.canada.ca)
  - Proactive disclosure data
  - Government procurement information
- **MapleSpike Coverage:** ✅ PARTIAL - We have `proactive-disclosure` module
- **Gap:** CanadaSpends may have specialized visualizations and datasets not in our CKAN ingestion

**OutcomeTracker** (https://github.com/BuildCanada/OutcomeTracker)
- **Purpose:** Track program outcomes and government program performance
- **Data Sources:**
  - Program evaluation reports
  - Outcome metrics
  - Performance indicators
- **MapleSpike Coverage:** ❌ NONE - No equivalent module
- **Gap:** Entirely new domain - program outcome tracking

**BillsTracker** (https://github.com/BuildCanada/BillsTracker)
- **Purpose:** Track federal legislation progression
- **Data Sources:**
  - LEGISinfo (law-parl.gc.ca)
  - Parliament website bill tracking
- **MapleSpike Coverage:** ✅ PARTIAL - We have `legislation` module with Justice Canada XML and provincial legislation
- **Gap:** BillsTracker may have more detailed bill status tracking and amendments

**FederalWorkbench** (https://github.com/BuildCanada/FederalWorkbench)
- **Purpose:** Federal workplace analytics (public service data)
- **Data Sources:**
  - Public Service Employee Survey
  - Federal workforce demographics
  - Bargaining information
- **MapleSpike Coverage:** ❌ NONE - No equivalent module
- **Gap:** Entirely new domain - public service workforce analytics

### Other BuildCanada Repos (High-Level Scan)

- Election tracking tools
- Budget analysis tools
- Regulatory monitoring tools
- Data visualization dashboards

## GovTrace Audit

### Data Sources Analyzed

**Political Donations**
- **Source:** Provincial political financing registries (Election BC, Elections Ontario, etc.)
- **Data:** Individual and corporate donations to political parties
- **MapleSpike Coverage:** ❌ NONE - We track federal lobbying but not political donations
- **Gap:** Critical influence tracking gap - political donations directly impact policy

**Government Contracts**  
- **Source:** Procurement portals and CanadaBuys
- **Data:** Federal/provincial contract awards, procurement notices
- **MapleSpike Coverage:** ✅ PARTIAL - We have `corporate` module with procurement via CanadaBuys RSS
- **Gap:** GovTrace may have more comprehensive contract parsing and analysis

**Lobbying Registry**
- **Source:** LobbyCanada (federal) + provincial registries
- **Data:** Lobbyist registrations, communications, subject matters
- **MapleSpike Coverage:** ✅ FULL - We have `corporate` module with federal lobbying + `provincial-lobbying` for all provinces
- **Gap:** Minimal - we have comprehensive coverage

**Grants Database**
- **Source:** Federal/provincial grant announcement portals
- **Data:** Government grants to organizations, research funding
- **MapleSpike Coverage:** ✅ PARTIAL - We have `influence` module that cross-references some funding
- **Gap:** Systematic grants database ingestion missing

**Voting Records**
- **Source:** Parliament voting records (ourcommons.ca)
- **Data:** How MPs vote on bills and motions
- **MapleSpike Coverage:** ❌ NONE - We track legislation but not voting patterns
- **Gap:** Critical for understanding political alignment and party discipline

**GIC Appointments**
- **Source:** Governor-in-Council appointments database
- **Data:** Federal appointments to boards, tribunals, commissions
- **MapleSpike Coverage:** ✅ FULL - We have `gic` module
- **Gap:** Minimal - we have comprehensive coverage

**Public Accounts of Canada**
- **Source:** Public Accounts volumes (federal financial statements)
- **Data:** Detailed federal government financial statements, departmental spending
- **MapleSpike Coverage:** ❌ NONE - We have `federal-budget` for budget documents but not public accounts
- **Gap:** Critical gap - public accounts are the authoritative financial record

## Overlap Summary

### What We Both Cover (✅)

| Data Source | MapleSpike Module | GovTrace Equivalent |
|-------------|-------------------|---------------------|
| Federal lobbying | `corporate`, `provincial-lobbying` | ✅ |
| GIC appointments | `gic` | ✅ |
| Federal contracts | `corporate` (via CanadaBuys) | ✅ |
| Proactive disclosure | `proactive-disclosure` | ✅ (via CanadaSpends) |
| Legislation | `legislation` | ✅ (via BillsTracker) |

### What They Have That We Miss (❌)

| Data Source | Project | Impact | Recommendation |
|-------------|---------|--------|----------------|
| Political donations | GovTrace | 🔴 CRITICAL | Create `political-donations` module |
| Voting records | GovTrace | 🔴 CRITICAL | Create `parliamentary-voting` module |
| Public accounts | GovTrace | 🔴 CRITICAL | Create `public-accounts` module |
| Program outcomes | BuildCanada | 🟡 HIGH | Create `program-outcomes` module |
| Public service workforce | BuildCanada | 🟡 HIGH | Create `federal-workforce` module |
| IATI international aid | GovTrace | 🟡 HIGH | Create `iati-aid` module |
| Grants database | GovTrace | 🟡 HIGH | Create `government-grants` module |
| Advanced contract analysis | Both | 🟢 MEDIUM | Enhance existing `corporate` module |

## New Module Recommendations

Based on this audit, recommend creating 5 new modules:

### 1. `political-donations` (🔴 CRITICAL)

**Data Sources:** Provincial political financing registries
- Election BC (elections.bc.ca)
- Elections Ontario (elections.on.ca)
- Elections Quebec
- All other provincial/territorial registries

**Data to Ingest:**
- Individual donations (name, amount, date, recipient)
- Corporate donations (company, amount, date, recipient)
- Third-party advertising spending
- Leadership race donations

**Strategic Value:** Direct money-in-politics tracking - high influence visibility

**Effort Estimate:** 10-15 days

### 2. `parliamentary-voting` (🔴 CRITICAL)

**Data Source:** ourcommons.ca voting records API
**Data to Ingest:**
- Division (vote) records
- How each MP voted (yea/nay/abstain/pair)
- Bill/motion text and context
- Party voting patterns

**Strategic Value:** Understand political alignment, party discipline, individual MP behavior

**Effort Estimate:** 5-10 days

### 3. `public-accounts` (🔴 CRITICAL)

**Data Source:** Public Accounts of Canada (publicsafety.gc.ca or TBS)
**Data to Ingest:**
- Departmental financial statements
- Federal spending by program
- Revenue sources
- Debt and liabilities

**Strategic Value:** Authoritative federal financial record - budget accountability

**Effort Estimate:** 10-15 days

### 4. `iati-aid` (🟡 HIGH)

**Data Source:** IATI (International Aid Transparency Initiative) registry
**Data to Ingest:**
- Canadian international aid projects
- Aid recipients and amounts
- Sector breakdown
- Implementation partners

**Strategic Value:** Track Canada's global influence through aid - complement domestic influence tracking

**Effort Estimate:** 7-10 days

### 5. `government-grants` (🟡 HIGH)

**Data Source:** Federal/provincial grant announcement portals
**Data to Ingest:**
- Grant recipients and amounts
- Grant categories
- Government departments providing grants
- Temporal trends in grant spending

**Strategic Value:** Track government funding to organizations - key influence mechanism

**Effort Estimate:** 5-10 days

## Collaboration Opportunity

Both BuildCanada and GovTrace are complementary projects focused on Canadian government transparency.

**Potential Collaboration Areas:**
1. Share data ingestion strategies (avoid duplicating effort)
2. Cross-reference datasets (e.g., link donations → lobbying → contracts)
3. Co-develop new modules (political donations, voting records)
4. API interoperability (allow data exchange between platforms)

**Next Steps:**
1. Reach out to both project maintainers
2. Propose shared data standards
3. Identify modules we can co-develop
4. Explore API integration possibilities

## Conclusion

The BuildCanada & GovTrace audit reveals that while MapleSpike has strong coverage of core influence tracking domains (lobbying, contracts, appointments), we miss several critical data sources:

**Critical Gaps (Immediate Priority):**
1. Political donations - direct money-in-politics
2. Voting records - parliamentary behavior tracking  
3. Public accounts - financial accountability

**High Priority Gaps:**
4. Program outcomes - government performance
5. IATI aid - international influence
6. Government grants - funding to organizations

**Total Effort Estimate:** 37-60 days for all 6 modules

**Strategic Impact:** Adding these modules would make MapleSpike the most comprehensive Canadian government influence tracking platform, covering domestic and international influence through multiple channels (lobbying, donations, contracts, grants, voting, appointments).

**Recommendation:** Prioritize political donations and voting records modules immediately, as they provide direct visibility into political influence that we currently lack.
