# Audit: BuildCanada & GovTrace Cross-Reference

> Issue: #571
> Status: Source audit comparing BuildCanada (31 repos) and GovTrace against MapleSpike registry.

---

## 1. BuildCanada Overview

- **Website**: https://www.buildcanada.com/
- **GitHub**: https://github.com/BuildCanada (31 repos, 146 followers)
- **Focus**: Canadian government transparency — spending, outcomes, bills, policy
- **Tech stack**: TypeScript, Ruby, Datasette, Ruby on Rails

### Key Repositories:

| Repository | Stars | Stack | Focus | Overlap with MapleSpike |
|-----------|:-----:|-------|-------|:----------------------:|
| **CanadaSpends** | 75 | TypeScript, Datasette | Federal spending visualization | **High** — overlaps with `federal-budget`, `goc-spending`, `proactive-disclosure` |
| **OutcomeTracker** | 21 | TypeScript | Government promise tracking | **Low** — ML-based, no structured data source |
| **OutcomeTrackerAPI** | 4 | Ruby | API for OutcomeTracker | Low |
| **BillsTracker** | 7 | TypeScript | Parliamentary bill analysis | **Medium** — overlaps with `legislation` module but different angle |
| **PolicyExplorer** | 2 | TypeScript | Party policy positions | **Low** — manual aggregation |
| **ProjectRequests** | 3 | N/A | Project ideation | N/A |
| **public_accounts_scraper** | — | Python | Public accounts ETL | **Medium** — similar to `federal-budget` but different technical approach |

### CanadaSpends Data Sources:

CanadaSpends ingests from:
- **Federal budget / public accounts** → MapleSpike already covers via `federal-budget`
- **GC spending data** → MapleSpike covers via `goc-spending`
- **First Nations financial statements** → ❌ **Not covered by MapleSpike**
- **Provincial spending** → Partial coverage via `provincial-*` modules
- **Municipal spending** → ❌ **Municipal budget data not covered**
- **StatCan government data** → Already covered

**Gap found:** CanadaSpends has processed financial statements for **First Nations communities** — MapleSpike has no equivalent module.

---

## 2. GovTrace Overview

- **Website**: https://govtrace.ca/
- **GitHub**: https://github.com/guilhermeseckert/GovTrace
- **Focus**: Brazilian/Canadian government transparency

### GovTrace Canadian Data Sources:

| Source | Current MapleSpike Coverage |
|--------|:--------------------------:|
| Campaign donations | ✅ `elections` module covers third-party ads |
| Government contracts | ✅ `proactive-disclosure`, `corporate` modules |
| Lobbying registrations | ✅ `corporate` module (LobbyCanada) |
| Grants and contributions | ✅ `oversight` module |
| Voting records | ⚠️ Partial — House votes via `committees` |
| GIC appointments | ✅ `gic` module |
| Public accounts | ✅ `federal-budget` |
| **IATI International Aid** | ❌ **Not covered** — no Canadian foreign aid tracking |

**Gap found:** **IATI (International Aid Transparency Initiative)** data is not tracked by MapleSpike. GovTrace includes Canadian foreign aid spending data.

---

## 3. Unique Sources BuildCanada Has That We Don't

| Source | Description | Priority |
|--------|-------------|:--------:|
| **First Nations Financial Statements** | Processed financial data for all First Nations in Canada | **P1** — adds Indigenous financial transparency |
| **Municipal budget data** | City-level spending across multiple cities | **P1** — complements existing municipal module |
| **Public Accounts processing pipeline** | Automated ETL from public accounts HTML | **P2** — different approach to existing `federal-budget` |

---

## 4. Unique Sources GovTrace Has That We Don't

| Source | Description | Priority |
|--------|-------------|:--------:|
| **IATI Canadian Aid Data** | International development assistance tracking | **P1** — adds foreign policy dimension |
| **Individual MP voting records** | Per-vote tracking for House of Commons | **P2** — would enhance accountability tracking |

---

## 5. Overlap Summary

| Category | BuildCanada | GovTrace | MapleSpike |
|----------|:-----------:|:--------:|:----------:|
| Federal spending | ✅ | ✅ | ✅ |
| Procurement | ✅ | ✅ | ✅ |
| Lobbying | — | ✅ | ✅ |
| Campaign finance | — | ✅ | ✅ |
| GIC appointments | — | ✅ | ✅ |
| Bills/legislation | ✅ | — | ✅ |
| Public accounts | ✅ | ✅ | ✅ |
| **First Nations finance** | **✅** | — | **❌ MISSING** |
| **IATI foreign aid** | — | **✅** | **❌ MISSING** |
| **MP voting records** | — | **✅** | **❌ MISSING** |
| Municipal spending | ✅ | — | Partial |
| Party policy tracking | ✅ | — | ❌ |

---

## 6. Recommendations

### New modules to create:

1. **`first-nations-finance`** — Import BuildCanada's First Nations financial statement data
   - Sources: CanadaSpends processed FN data, ISC financial transparency portal
   - Priority: **P1**
   - Enables tracking federal transfers to Indigenous communities

2. **`canadian-foreign-aid`** — IATI-standard Canadian international development assistance
   - Sources: IATI Standard (`https://iatistandard.org/`), Global Affairs Canada IATI data
   - Priority: **P1**
   - Enables tracking Canadian foreign policy influence

3. **`mp-voting-records`** — Per-vote records for House of Commons MPs
   - Sources: ourcommons.ca API, GovTrace reference
   - Priority: **P2**
   - Enables accountability and whip analysis

### Collaboration opportunities:

- Reach out to BuildCanada team (hi@buildcanada.com) about data sharing for First Nations financial data
- GovTrace IATI pipeline could be adapted rather than built from scratch
- CanadaSpends Datasette API at `api.canadaspends.com` could be used as an intermediate data source

---

## 7. Next Steps

- [ ] File issue for `first-nations-finance` module
- [ ] File issue for `canadian-foreign-aid` module (IATI)
- [ ] File issue for `mp-voting-records` module (P2)
- [ ] Contact BuildCanada regarding First Nations data sharing
- [ ] Update `docs/metrics.json` with new module targets
