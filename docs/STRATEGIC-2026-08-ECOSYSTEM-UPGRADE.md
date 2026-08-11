---
last-reviewed: 2026-08-11
status: active
---

# Quill Ecosystem Upgrade — Strategic Memo (2026-08)

**Inputs:** Stand Together For Canada case study (citizen-archivist news archive), Canadian data
ecosystem survey (official + independent + MCP tooling), Katzilla gap analysis (US agent-first
data backbone), and Quill's own ROADMAP / coverage-gap / claim-stack state.

**One-line thesis:** the research independently confirms Quill's Phase 7 strategy — Canada has
abundant raw data but **no unified, citation-disciplined, agent-first backbone**, and that gap
is Quill's lane. The Katzilla comparison validates the shape; the blind-spot analysis names the
specific modules to build; the STFC case shows the *consumer* of the verification layer.

---

## 1. What the research confirms about Quill

| Research finding | Quill reality | Verdict |
|---|---|---|
| "No unified Canadian data backbone exists" | Quill: 200+ modules, one API (166 registered MCP tools per ROADMAP; products doc says 170+ — repo-internal drift to reconcile) | ✅ Lane confirmed |
| "Katzilla-level citation discipline missing in Canada" | Claim bundles (SHA-256 + source + retrieved-at + license), `/v1/claims/verify`, `verify_claim`, `get_citation` | 🟡 Code-complete (ROADMAP Phase 7 M1, 2026-08-09); **live-endpoint verification still blocked** (image churn → PVC Pending → nexus outage). The moat is real but unproven until claims survive a rollout publicly |
| "Provenance/quality metadata missing" | Hashes exist; **quality/confidence score missing** | 🟡 Extend claim envelope (cheap, high value) |
| "MCP tooling is fragmented experiments" | mcp-canada (266–295 tools, no citation discipline) vs Quill (166 registered tools per ROADMAP; products doc says 170+ — repo-internal drift to reconcile) with citations, resources, prompts | ✅ Compose, don't compete on raw tool count |
| "FOI/ATI system is the biggest structural barrier" | OIC module only in gap list (Tier 2 P3) | 🔴 **Biggest new opportunity** — nobody owns it |
| "Local-first / sovereign readiness is weak in ecosystem" | Nix-first images, K3s, SQLite, Quill Lite, zero-cloud posture | ✅ Already the moat — double down |
| "Cross-domain joins are hard" | Engine entity graph, `search_cross_reference`, `linked_entities`, Phase 5.3 §Ph10 | 🟡 Needs populated graph (WS-1b ingestion) |

## 2. The STFC case: the verification layer's customer

Stand Together For Canada is a directional, one-person archive that *invites* verification
("pick any random article and FACT CHECK it yourself"). It is not Quill's politics and never
should be — but its method is exactly Quill's promise.

**The strategic read:** Quill's neutrality is the feature. A verification substrate that serves
left, right, and center is the only durable trust play in a polarized ecosystem. Any archive —
STFC-style citizen chronicles, Frostbite Gazette journalism, Mosaic aggregation, institutional
monitoring — can badge its claims with Quill hashes.

Concrete moves this implies:

1. **Provenance badge / cite-any-URL tool.** A public "verify this URL" that returns a claim
   bundle (hash + source + retrieved-at + license) for any link — the natural successor to the
   existing `/verify` page. Turns Quill into the neutral citation layer for the whole ecosystem.
2. **Media-coverage news-archive module (P2 sketch, not P1).** STFC's manual daily pattern
   (headline + link + date + source) is productizable as a *neutral* news-archive module
   (headline, url, publication, date, topic tags, sha256 per item) that journalists/agents can
   query with provenance instead of Ctrl-F. Complements existing `ngo-influence-rss` and the
   `narrative-shift` prompt. **Guardrail: an explicit inclusion policy (source list, bias
   handling) must be defined before build** — this is the riskiest proposal in the memo and the
   only one with curation-neutrality exposure.
3. **Composition example in `building-on-quill.md`:** "verify any article's claims against
   primary sources" recipe — Quill (claims) + CanLII MCP (case law) + elections MCP + local RAG.

## 3. Blind spots → concrete upgrades (priority-ranked)

### P0 — Reliability first (prerequisite; in flight)

- Nexus node: sshd/k3s unreachable from zephyr AND sentry (ports 22/6443 refused) while the
  site still serves 200 (established tunnel + running pods). Investigate reboot / firewall /
  k3s recovery. **This is the "reliability + informal SLA" item from the original strategy.**
- Finish PVC-backed `/data` (quill-api-data was Pending: built-in PodSecurity `restricted`
  default blocked local-path helper pods; fix = namespace `enforce=privileged` label + VAP
  `matchConditions` exclusion, both applied but unverified — PVC was still Pending when nexus
  went dark) and verify claims survive a rollout.

### P1 — The four outcome-data spines (STFC's themes, made verifiable)

These are the exact "siloed, can't-join" series the research flags. All map to existing plan
items — execute them as one coordinated "outcome data" push:

| Spine | Modules | Existing plan hook |
|---|---|---|
| Fiscal | `federal-grants-contributions` (P1), `federal-procurement-solicitation` (P1), Public Accounts → structured tables | gap list Tier 2 |
| Immigration/population | IRCC batch: `pr-admissions, work-permits, study-permits, express-entry, entry-exit, processing-times, citizenship` | ROADMAP 5.2 |
| Housing | CMHC rental/vacancy (+ starts as an extension beyond the plan row) | ROADMAP 5.3 §Ph8 |
| Crime/safety | 16 municipal police portals (+ UCR as an extension beyond the plan row) | ROADMAP 5.3 §Ph3 |

Deliverable beyond the modules: a **joined, versioned outcome dataset** (immigration + housing +
labour + fiscal + crime) with methodology note — the research's #1 "hard but high-value" item.
**Acceptance criterion = that joined dataset, not module count** — the module additions are only
the means to the joined deliverable, and staying tied to it is what keeps this push from
drifting back into the breadth play §4 rejects.

### P1 — FOI/ATI infrastructure (the structural gap nobody owns)

The Globe's Secret Canada findings (delays, backlogs, over-redaction) are the biggest practical
barrier to feeding primary material into AI. Quill can become the ATI tracking layer:

- `federal-information-commissioner` (OIC appeals/complaints — already in gap list, Tier 2 P3)
- **New:** completed-ATI-request summaries aggregation + proactive disclosure feed + delay
  tracking. Start with a curated index (like SecondStreet's wait-list compilations but neutral).

### P1 — Quality scores on claim bundles (Katzilla parity +)

Extend the claim envelope with a `quality` score (source-reliability tier, freshness, extraction
confidence) so every response carries not just *a* hash but *how trustworthy* the underlying
source is. This is the single cheapest differentiator and directly answers the
"provenance/quality metadata missing" finding.

### P2 — PDF/table extraction at scale

Public Accounts, FOI releases, Hansard, departmental results reports remain PDFs. Canada Spends
proved the pattern. Generalize into `pipeline-core` (LLM-assisted extraction → structured,
citable tables with provenance). Unlocks the "data deserts" (lower courts, provincial spending).

### P2 — Agent monitoring / anomaly detection

Continuous watchers: new open-data releases, spending outliers, permit-volume shifts, wait-list
stats → grounded briefings with citations. Maps onto existing kanban cronjobs +
`notification-service` (Phase 5.1 email alerts). This is the "agents as infrastructure" story.

### P2 — Citation-accuracy benchmark suite (citecheck analog)

Evals for citation accuracy, freshness, hallucination-resistance on Canadian sources, so
"verified by Quill" means something measurable. Feeds the quality plan (ROADMAP 5.4) and the
free-tier trust story.

## 4. What we will NOT do

- **Not** chase raw module count vs mcp-canada's 266–295 tools. Breadth-for-breadth competes
  with lighter specialists; depth + citations win.
- **Not** mirror STFC's or anyone's political framing. Quill verifies claims, not positions;
  neutrality is the moat.
- **Not** re-implement Katzilla's commercial SaaS model. Quill stays sovereign/local-first with
  a generous free discovery tier — that *is* the Canadian differentiation.

## 5. Recommended 90-day slice (fold into ROADMAP when adopted)

1. **Reliability:** restore nexus node access; land PVC persistence + survival proof (the
   `enforce=privileged` label + VAP `matchConditions` exclusion are **applied but unverified** —
   the PVC was still Pending when nexus went dark); informal SLA + status page (Phase 7 M0
   completion).
2. **Claim quality:** add `quality` to claim bundles + `POST /v1/claims/verify` parity on MCP.
3. **Outcome data:** execute the four spines above as one coordinated push (est. 60-80h, reuses
   existing gap plans); publish the first joined dataset + methodology note (**acceptance
   criterion = the joined dataset, not module count**).
4. **FOI seed:** OIC module + curated ATI-index module (neutral, cited).
5. **Provenance badge:** public cite-any-URL surface + news-archive module sketch.
6. **Benchmark:** first citecheck-style eval suite for 10 high-signal tools.

*Fold decisions into ROADMAP.md (single source of truth) via OpenSpec propose→apply→archive.*
