---
last-reviewed: 2026-07-07
status: active
---

# BuildCanada & GovTrace — Cross-Reference Audit

> Issue: #571
> Date: 2026-05-31

## Sources Audited

### BuildCanada (4 repos)
| Repo | Description | MapleSpike Coverage |
|------|-------------|---------------------|
| **CanadaSpends** | Government spending visualization | ✅ Federal Budget, GoC Spending modules exist |
| **OutcomeTracker** | Government promise/progress tracking | 🚫 **GAP** — Nothing like this in MapleSpike |
| **BillsTracker** | Bill analysis from builder perspective | ⚠️ Partial — We have LEGISinfo, Gazette, but not this angle |
| **FederalWorkbench** | AI/RAG for federal parliamentary data | ⚠️ Partial — We have the raw data (Hansard, committees) but no RAG layer |

### GovTrace
| Source | MapleSpike Coverage |
|--------|---------------------|
| Donations | ✅ Provincial lobbying, Elections Canada |
| Contracts | ✅ Procurement, Proactive Disclosure |
| Lobbying | ✅ Lobbying Registry |
| Grants | ⚠️ Partial — Federal budget, some CKAN |
| Votes | ✅ OpenParliament votes |
| GIC | ✅ GIC Appointments |
| Public Accounts | ⚠️ Partial — Federal Budget module exists but shallow |
| **IATI international aid** | 🚫 **GAP** — Not in MapleSpike |

## Gaps Found

### Critical Gaps (no coverage)
1. **Government Promise/Outcome Tracking** — OutcomeTracker tracks government promises and delivery. Nothing in MapleSpike does this.
2. **IATI International Aid Data** — GovTrace references IATI (International Aid Transparency Initiative). Not in MapleSpike.

### Secondary Gaps (improve coverage)
3. **Public Accounts Deep-Dive** — Our federal-budget module exists but is shallow (CKAN search only). GovTrace has more structured public accounts data.
4. **RAG Layer for Parliamentary Data** — FederalWorkbench provides a RAG interface on top of data we already have. This is a product/infrastructure gap, not a data module gap.

## Recommended Actions

### New Modules to Create
- [ ] **`outcome-tracker`** — Government promise/outcome tracking module (P2)
- [ ] **`iati-aid`** — International Aid Transparency Initiative data module (P3)

### Existing Modules to Enhance
- [ ] **`federal-budget`** — Deepen public accounts coverage (P2)
- [ ] **`legislation`** — Add bill analysis angle, cross-reference with committee appearances (P2)

### Outreach
- BuildCanada repos are active and complementary. Consider: data format sharing, API interoperability
- GovTrace has 0 stars but similar mission. Data source sharing could benefit both projects.
