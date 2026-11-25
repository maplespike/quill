# Quill Transformation Master Plan

> Consolidated output of the full audit cycle (Sept 2026): codebase audit, Context7 source audit, `gh` repo audit, verified competitive/pricing research (hermes web), and the complete option space for restructuring Quill into a revenue-generating product. **Anything was on the table** — full refactors included.

---

## 0. Executive Summary

**What Quill is today:** a privately-held, 14-package, ~220K-line TS monorepo with 207 ingestion modules, a 184-tool MCP server, a REST gateway, SDKs, a portal, x402/Stripe/quota billing plumbing, and a genuinely differentiated trust primitive (SHA-256 claim bundles verifiable without trusting Quill). Pushed actively since May 2026.

**What the market says:** verified-government-data delivery commands premium prices (OpenCorporates: **£2,250–£12,000/yr** for 500–5,000 API calls/mo on *free public* registry data; 80% of large NA/EU banks as buyers). Policy-intelligence seats run **$2k–$7k/seat/yr** (Quorum median contract $23.5k/yr, FiscalNote $24k/yr). Free gov-data APIs die (ProPublica Congress API retired July 2024) — subscription delivery is the durable model.

**The correction that matters:** the Canadian niche is **not empty**. Five live Canadian competitors verified (§3). None match Quill's breadth (207 modules), entity graph, or verification layer — but PoliticalData.ca is already MCP-native with nearly identical pricing shape, and Gnowit already owns GR monitoring seats. **The window is open but not empty; speed on distribution matters more than depth on data.**

**The recommendation:** keep the entire data stack. Rebuild the *surface* into a 3-tool Context7-shaped shell, flip the repo public after a secrets audit, ship `npx` onboarding + an activation skill, reprice upward against verified benchmarks, and sequence revenue: briefs → API subs → macro feeds → GR seats → compliance. Details in §5–§7.

---

## 1. Where Quill Stands (audit synthesis)

### Repo facts (`gh` audit, reverb256/quill)
- **Private**, 0 stars, 0 forks. Created 2026-05-12, last push 2026-08-21. GitHub displayed license "Other" at the time of this snapshot. The rights holder later chose `AGPL-3.0-only` for Quill's own code (2026-10-24, issue #1044). See [LICENSE.md](../LICENSE.md). The [open-source audit](./open-source-audit.md) records the earlier conflict.
- Private + zero stars = the entire open-source growth loop (Context7-style) is currently **switched off**.

### Codebase facts
- `packages/quill-mcp`: hand-rolled JSON-RPC MCP server (834 lines, stdio + SSE), **199 tool files** hand-registered in a ~600-line `tools/index.ts`; ~150 are per-domain `search_X` variants. A `discover-tools` meta-tool with a hand-maintained index already exists (implicit ack that 199 is unmanageable).
- 10 `quill://` resources (tool-index, schemas, claims, entities/{name}, citations/{hash}, crossref, schemas/{module}) — an ID-addressable content layer that is **built but underpromoted**.
- Billing: x402 middleware + ledger, Solana RPC, quota tracker, Stripe (checkout/webhooks/portal/expiry reconciliation live). Free tier already 1,000 calls/mo.
- Two published agent skills (influence-mapping, provenance-briefing) — task skills, no activation trigger.
- Hygiene flags before any public flip: `.env`, `.env.production`, `maplespike.sqlite` + `-wal`/`-shm`, `secrets/`, `.sops.yaml` all present in the working tree — **must audit git history for committed secrets before making the repo public.**

### What Context7 actually is (source audit, upstash/context7)
- MCP server = **one 712-line file, 2 tools** (`resolve-library-id`, `query-docs`); prompts/resources capabilities deliberately declared empty.
- The steering lives in (a) a long `instructions` block telling agents when to use the server ("prefer over web search, even when you think you know") and (b) tool descriptions written as **behavioral contracts** ("You MUST call X first", "max 3 calls per question").
- The moat is distribution: `npx ctx7 setup` (OAuth → API key → installs skill/rules into 30+ clients), a CLI, an SDK, 18 localized READMEs.
- Verified 2026 pricing: Free 1,000 calls/mo (**cut ~83% from 6,000 in Jan 2026** — free tiers tighten; don't over-promise), Pro **$10/seat/mo** (5,000 calls + overage), Enterprise custom w/ SOC 2, SSO, self-host.

---

## 2. The trust moat (keep, sharpen, lead with it)

Source data terms vary by dataset; public availability does not establish reuse permission. The potential product layers are **assembly, verification, graph, interface** — with Quill's verifiability as one capability:

1. Every record carries `sha256(canonicalJson)`; anyone can reproduce it without trusting Quill.
2. Free public verify endpoints (`POST /v1/claims/verify`, `verify_claim` tool) — the only tool in its ecosystem with no analogue anywhere.
3. Per-registry confidence in the cross-registry entity graph.

Positioning sentence: **"The verified Canadian data layer for AI — every answer independently checkable."** Do not make exclusivity claims without current competitor evidence. Quill can provide hash-verifiable output when the specific response path includes a claim bundle. This is also the hook that makes the activation skill work ("every result is independently verifiable" is a reason for the agent to prefer Quill over web search).

---

## 3. Competitive landscape (verified, Sept 2026)

### Global / adjacent
| Player | Model | Benchmark takeaway |
|---|---|---|
| OpenCorporates | API + bulk on free public registries | **£2,250/yr for 500 calls/mo** → ~£0.38/call. Premium pricing on free data is proven. Free at-scale for journalists/NGOs/academia buys goodwill + moat. |
| Quorum / FiscalNote | GR seat software | Median contracts **$23–24k/yr**; entry ~$50/user/mo. Workflow (alerts, reports, CRM) — not raw data — justifies seat pricing. |
| Bloomberg Gov / Politico Pro | Terminal / vertical news+data | Vertical topic depth supports premium pricing. |
| Sayari / Altana / D&B | Graphs + entity IDs | The relationship graph is worth more than the records. |
| Polygon.io / Twelve Data | Free source data → paid clean delivery | "Free data, paid delivery" is a complete business. |
| ProPublica / LittleSis | Free APIs | ProPublica Congress API **retired 2024**. Don't promise free forever. |
| CanLII | Free to humans, restrictive reuse | Keep the court lane lookup-style; compliance before monetization. |
| OCCRP Aleph / ICIJ Datashare | Institution-funded journalism tooling | Validates the sovereign self-host tier for newsrooms/universities. |

### Canada — live competitors (the part that changes the plan)
| Player | What they sell | Pricing | Gap vs Quill |
|---|---|---|---|
| **PoliticalData.ca** | Canadian law graph (federal+ON), REST + **remote MCP** | Free 250 credits → **$9.99–$499 CAD/mo** | Law-only; no influence/committee/procurement depth; no verification |
| **NorthAxium Data** | 12 Canadian datasets (CanadaBuys, LobbyCan, LEGISinfo, Elections, municipal permits) + MCP | Subscription tiers | 12 datasets vs 207 modules; no entity graph |
| **RegMap Canada** | 27,644 regulation records, feed + change stream | Feed licensing | Regulations only; no provenance hashing |
| **Nimbus/ProcureData + GrantData** | Procurement ($49/mo Pro) + grants APIs | Self-serve | Single-vertical |
| **Gnowit vAnalyst** | GR monitoring: federal, 13 legislatures, 700+ municipalities, Gazette | Enterprise | The "Canadian Quorum" seat incumbent — owns GR monitoring already |
| (context) GoC Corporations API | Free official corporate data, 60 hits/min | Free | Corporate-registry delivery alone is not a moat |

**Read:** the niche is *fragmented and shallow* — each player owns one slice, none have verification, none have the cross-registry graph, only one is MCP-native. Quill's differentiation is breadth + graph + verifiability + bilingual. But Gnowit means the "sell seats to GR firms" path has an entrenched incumbent → enter there later, via API-first differentiation and price disruption ($23k/yr incumbents vs Quorum-style workflow at a fraction).

---

## 3b. Deep competitive audit (verified Sept 16, 2026)

Full vendor-by-vendor research with live-site verification (HTTP checks, pricing pages, docs, third-party estimates). One caveat to confirm: politicaldata.ca and northaxiumdata.ca are 2026-launched API+MCP products with near-identical tier shapes — **confirm neither is a Quill-family property before using this offensively.**

### The five, ranked by threat

| Competitor | Surface | Pricing | Breadth | Provenance | Traction | Exploitable weakness |
|---|---|---|---|---|---|---|
| **PoliticalData.ca** | REST + remote MCP (OAuth 2.1 PKCE, 23–25 tools), server-cards.json, llms.txt, 5 agent skills | Free 250cr → $9.99–$499/mo, per-op credit metering | **Narrowest**: federal+ON law only (1,827 acts, 1,577 bill→Act edges) | **Strongest in set**: per-version sha256, source_url, effective dates, explicit UNSUPPORTED_COVERAGE | Latent — accounts "switched off" while selling tiers; AdSense; no customers | 2 jurisdictions; credit metering punishes agent loops (20cr/question = 8% of $9.99 tier); own-site numbers disagree (1,577 vs "3,000+") |
| **NorthAxium** | REST + hosted MCP + dashboard + universal search | Free 100 req/mo → $29/$99 CAD → enterprise | 12 datasets, 12M+ records: procurement, grants, lobbying, contributions, permits (17 cities) | Docs-level only; per-dataset freshness table; **no per-record hash/source** | Launch-stage (Jun 2026); no SLA, no status, 1 key/tier | **Zero provincial data, zero statutes** — cannot answer "what changed in the law"; coarse cadences |
| **RegMap Canada** | **No API/MCP at all** — catalogue site + email-gated licence | **$5,000/mo single tier** | 27,652 regs/acts, all 14 jurisdictions, weekly | Per-record official_url, stable slugs, current_to; no hashes | None detectable; solo, gmail contact; federal catalogue ~3mo stale | Same public corpus, 1 API, one $5k price point → **undercut at 1–10%** |
| **Nimbus (ProcureData/BuildData)** | REST + Snowflake share + RapidAPI + weekly feeds. **No MCP** | Free 100/day → Pro $100/mo; RapidAPI still says $49 | 2.6M procurement records, 4M permits | Moderate: source_id + raw record retention + coverage page | Most shipping motion; but **grantdata.ca 404, pollutiondata.ca 404, nimbusdata.app 404**, stale RapidAPI pricing, solo founder | Product-line decay + number drift; grants half of pitch doesn't exist (NorthAxium took it); no agent surface |
| **Gnowit (vAnalyst)** | **Human-seat SaaS only** — alerts, briefs, dashboards. **No API, no MCP, no export** | $500–$4,000 CAD/mo seats; Curation Edge to $4,000 | Broadest monitoring: 2M+ sources, 13 jurisdictions, 300–800 municipalities | Source links + human curation; no machine-checkable evidence | **The real business**: est. $2.8M rev, ~22 staff, since 2010, GR-firm case studies | **Zero programmatic surface** — the agentic lane is uncontested; headcount declining; free Hansard Watch hands competitors SEO |

### Structural read

1. **The market is bimodal**: under-monetized API startups ($9.99–$499/mo, no traction) vs a seat-software incumbent ($500–4,000/mo, real revenue, no API). **The money is in the middle**: agent-native verified data delivery priced between them. Nobody occupies it.
2. **The verification claim needs precision**: PoliticalData.ca *does* hash legal text in its vertical. Quill's differentiation is not "only one with hashes" — it's **breadth (207 modules vs one corpus) + cross-registry graph + verification applied to influence/procurement/committee data**, where nobody hashes.
3. **Provincial coverage is Quill's unfair advantage**: NorthAxium has *zero* provincial data; PoliticalData has ON only; Nimbus has fragments. Quill has all 13 legislatures + 273 regulators + CKAN federation. Only Gnowit matches provincial breadth — and Gnowit has no API.
4. **The cohort's shared anti-patterns** (publish against these): stale pricing pages, 404 product domains, conflicting record counts, no SLA/status page, one-quote enterprise tiers, ad-supported consumer framing.

### Pricing mechanics to copy (verified from global players)

| Source | Mechanic | Quill application |
|---|---|---|
| **Enigma** | 1 credit = $0.01 with a **public per-attribute rate card**; **pre-run cost preview**; **machine-readable price tiers per field** (agents price their own queries); MCP gated to the $200/mo mid tier as an upsell; prepaid bundles w/ bonus credits | Perfect fit with x402: publish the tool price map (#837) as machine-readable metadata so agents budget autonomously; gate MCP or premium tools at mid tier |
| **OpenCorporates** | Free **share-alike** tier (corpus+brand growth, commercial rights retained); annual prepaid query pools with **2× surge** instead of hard caps; **99.5% SLA with service credits**; enterprise = **jurisdiction pick-list**; free accredited journalist/NGO/academic seats | Convert free tier to accredited-access framing; annual pools + surge pricing; publish an SLA page (ties to #847 status page) |
| **North Data** | **Per-request overage ladder** (declining €0.10→€0.05); **per-jurisdiction export SKUs** (sell Ontario to one buyer, Quebec to another, both at full price); journalist accreditation | Directly executable: Quill is the *only* API vendor with all-13-province coverage → per-province feed SKUs |
| **Sayari** | The **source-linked evidence package as a named, exported deliverable** (what enterprises/regulators procure — none of the 5 Canadian vendors sell one); seat + credit hybrid on one contract; **$99–499 anchoring** (the Canadian cohort under-monetizes); free trial + training for gov buyers | Productize the provenance brief as a standard downloadable artifact, not just a service |

---

## 4. Strategic options (all on the table)

| Option | Description | Verdict |
|---|---|---|
| **A. Vertical GR product** ("Quorum for Canada") | Build alerts/reports/CRM on Quill's data, sell seats vs Gnowit | Highest LTV but entrenched incumbent, slow sales, product surface Quill doesn't have. **Phase 3, not first.** |
| **B. Data-layer API company** ("OpenCorporates of Canada") | Sell metered API + bulk + feeds on the 207 modules | Proven model on free data; OpenCorporates pricing shows massive headroom. **Core.** |
| **C. Agent-native platform** ("Context7 of Canadian data") | 3-tool MCP shell + activation skill + npx onboarding; free→pro→enterprise | The distribution wedge nobody local has matched; cheap to build on existing stack. **Core.** |
| **D. Verified-AI analyst** ("AlphaSense for Canadian public data") | `ai_ask` + claim bundles = sourced, checkable answers | Differentiated AI product; needs eval quality work. **Phase 3 feature.** |
| **E. Compliance/KYB entity verification** | Beneficial-ownership checks for banks | Highest ceiling, 12–24mo, regulation tailwind ("snow-washing"). **Phase 4 ceiling.** |
| **F. Data licensing to AI labs** | Claim-bundle corpora for training/RAG | Speculative, high effort. **Opportunistic only.** |
| **G. Grants / public-interest funding** | Non-dilutive runway via journalism/civic-tech programs | Funding exploration; do not make software-license positioning claims while package rights remain unresolved. **Parallel track.** |
| **H. Full rewrite of the MCP server on official SDK** | Replace 834-line hand-rolled JSON-RPC with `@modelcontextprotocol/sdk` | Not required for revenue; do opportunistically. The surface (§5) matters more than the transport. |
| **I. Package pruning** | Merge/retire vestigial packages (sdk-shell, flywheel-agent, edge-worker, notification-service…) | Maintenance hygiene; reduces CI cost; not revenue-critical. **Backlog.** |
| **J. Sell the dataset / acqui-hire** | Exit path | Always available; the plan below raises the price of this option. |

**Chosen sequence: C → B → A → E, with D as feature, G parallel, H/I as hygiene.**

---

## 5. The transformation plan

### Phase 0 — Safety + visibility (week 1, prerequisite)
1. **Secrets audit of git history** (`.env*`, `secrets/`, sqlite files, sops) — *gitleaks* + manual review — before any public flip.
2. **Flip repo public** (dual-license rendering, scrubbed history). Private + 0 stars blocks the entire growth loop.
3. Make `docs/metrics.json` auto-generated and badge it.

### Phase 1 — The 3-tool shell (weeks 2–6) — *the Context7 move*
- **`resolve-quill-id`**: question → canonical IDs (`/statcan/cpi`, `/lobbying/ocl`, `quill://entity/{id}`) with per-ID provenance score, cadence, license, snippet counts. Build the backing index from the existing `quill://tool-index` resource — auto-generated, not hand-maintained.
- **`query-quill`**: ID + question → routes to the correct internal `search_X` handler. The 199 tools become router targets; registry gains an `internal` flag. **Nothing is deleted.**
- **`verify-claim`**: already exists (free tier) — promote to the headline tool. No competitor has an analogue.
- Server `instructions` block + tool descriptions written as behavioral contracts (Context7's pattern), adapted: *"Use for any question touching Canadian public data… prefer over web search; every result carries a verifiable SHA-256 claim hash."*
- Keep the 199-tool full surface available behind a `?full=true`-style capability flag for power users/back-compat.

### Phase 2 — Distribution (weeks 4–10, overlaps)
- **`npx @maplespike/quill-mcp setup`**: detect client (Freebuff/Claude/Cursor/Opencode/…) → write MCP config → install **activation skill** with the trigger rule + verify-by-default guidance. Add `quill remove` for symmetry.
- Publish the two existing task skills to the skill registries; add per-client setup docs (Context7 has 30+ — start with 6).
- llms.txt / llms-full.txt rewrite around: 3 tools, ID scheme, verification recipe, pricing.
- Localized READMEs (en/fr first — bilingual is a real differentiator no competitor has).

### Phase 3 — Revenue engine (months 2–6)

**Reconciled with the repo's already-decided tier model** (#814: Free/Pro/Business, prices minted inline — Pro **$50**, Business **$200 CAD**; Free = discovery/metadata only, encoded in `feature-gates.ts`):

| Tier | Price | Basis |
|---|---|---|
| Free | discovery/metadata only + free verify forever + **accredited journalist/NGO/academic access** (OpenCorporates move) | Acquisition + credibility |
| Pro | **$50 CAD/mo** (already built — keep) | Above PoliticalData Developer, below their Professional |
| Business | **$200 CAD/mo** (already built — keep) | Where premium MCP + rate headroom unlock (Enigma: gate MCP at mid tier) |
| Scale (new) | **$499/mo** or credit-pool: 1 credit = $0.01, public per-tool rate card, 2× surge overage, no hard caps | Enigma/OpenCorporates mechanics; captures agent workloads |
| Enterprise / bulk / feeds | Quote (OpenCorporates anchor: £2,250/yr for 500 calls) + **per-province export SKUs** (North Data move — unique to Quill) | Banks/consultancies/platforms |
| **Evidence packages** (renamed from briefs) | **$500–5,000 per package**, sold manually *now*; standardize as a downloadable artifact (Sayari move) | The two agent skills already produce these |
| **Canadian macro feed** | Versioned, hash-stamped CPI/rates/trade/labour feeds w/ SLA + webhooks | Pure packaging of StatCan WDS / BoC Valet modules |

Plus the Enigma trust moves: publish the machine-readable price map (#837), pre-run cost previews for expensive cross-references (#829 jobs), and an SLA page with service credits (#847).

### Phase 4 — Seats & ceiling (months 6–18)
- GR workflow layer (entity alerts on committees/lobbying/GIC/procurement + auto-generated weekly provenance briefs) → converts $49 API users into **$2k–7k/seat** accounts; attack Gnowit/Quorum pricing from below.
- Compliance packaging of the entity-resolution engine (KYB/beneficial-ownership checks) — OpenCorporates-style "legal-entity data you can trust" positioning, riding Canada's BO-transparency tailwind.
- Sovereign self-host tier (K3s/Nix/`selfhost.sh` already built) for provinces, universities, unions, and public broadcasters — commercial and redistribution terms require rights-holder approval and a documented offer; a paid tier does not itself grant software rights.

---

## 6. Overhaul menu (bigger swings, explicitly on the table)

1. **Full surface refactor** (§5 Phase 1) — the only refactor with direct revenue impact. Everything else is optional hygiene.
2. **Retire legacy underscore-named tools** and dedupe the ~30 overlapping `search_X` handlers once the router exists (register thin aliases for back-compat).
3. **Package consolidation** — audit `sdk-shell`, `flywheel-agent`, `edge-worker`, `notification-service`, `ingestion` vs `pipeline-core` overlap; merge or archive to cut build/CI cost.
4. **MCP SDK migration** — swap the hand-rolled JSON-RPC core for `@modelcontextprotocol/sdk` opportunistically (gets OAuth resource-metadata, elicitation, transports for free; Context7's auth UX relies on exactly this).
5. **Portal pivot** — from marketing site to self-serve console (keys, usage, docs playground, brief checkout) — the Polygon.io/Context7 growth surface.
6. **Pricing philosophy flip** — from x402-micro per-call to subscriptions with x402 as the *agent-native* payment rail alongside Stripe (agents can't click checkout; x402 is the differentiator rail — keep it, stop leading with it).
7. **Monorepo → product repos** only if external contributors show up (public flip first; don't pay the split cost speculatively).
8. **The nuclear option, rejected:** turning Quill into a pure retriever of other people's Canadian sources (the literal Context7 shape). Rejected because for gov data, ingestion+provenance+graph **is** the moat; retrievers compete to zero on free data.

---

## 7. Risks & anti-goals

- **Don't** promise free-forever APIs (ProPublica precedent); free tier = verify + discovery only.
- **Don't** sell CanLII content as bulk data — licensing tension; keep lookup-style.
- **Don't** compete with Gnowit head-on before the API business cashflows.
- **Watch** PoliticalData.ca — closest shape competitor; monitor their module expansion quarterly.
- **Secrets hygiene** is the single blocking risk for the public flip (§5 Phase 0).
- Free-tier ratchet risk: Context7 cut free 83% in one move — structure the free tier so tightening it doesn't break the activation skill.

---

## 8b. Repo tracker integration (issues/PRs audit)

The tracker shows the go-live effort (#814, wayfinder #798) is **~80% executed**: tunnel HA + zero-downtime rollouts ✅ (#800/#816), billing deploy self-sufficient ✅ (#806/#807/#808), Stripe legal posture ✅ (sole prop #810, PIPEDA #813, Crown-copyright audit #812), Free-tier gating in `feature-gates.ts` ✅ (#815), quality scores ✅ (#839), entity graph M2 ✅ (#828).

**Remaining go-live blockers (do these before anything else in §5):**
- #811 GST/HST taxable-revenue tracker (legal gate)
- #803 Free-tier public subset definition (product gate)
- #823 operator go-live steps; #825 DRY consolidation PR (open, has conflict risk — review before it stales)
- Secret-swap → first real charge (#805 verification pattern)

**Tracker items the master plan directly consumes:**
- #838 tool-index hygiene = the substrate for `resolve-quill-id` routing (do together)
- #837 price map = the machine-readable rate card (Enigma move)
- #847 status page + #796 WAL race + #795 bot-block panel = the SLA story competitors lack
- #831 Quill Lite as product = the `npx` zero-config tier
- #842 cite-any-URL badge = the evidence-package deliverable
- #830 protocol migration (OAuth resource metadata) = validated by PoliticalData's MCP (OAuth 2.1 PKCE) — agents now expect it
- #845 citation-accuracy benchmark (citecheck) = the eval that makes "verified" a defensible claim
- #841 FOI/ATI tracking + #840 outcome-data spines = unique content no competitor has — prioritized as differentiators, not chores

**Sequencing change:** finish #814 first (weeks from live income), *then* build the 3-tool shell — the shell multiplies a live product, not a test-mode one.

---

## 8. Next 30 days (concrete)

1. **Close #814**: #811 GST tracker → #803 free-tier subset → #823 operator steps → secret-swap → first real charge. **Income live beats everything else in this document.**
2. gitleaks audit + repo public flip + dual-license rendering
3. #838 tool-index hygiene, executed as the substrate for `resolve-quill-id` (router shell, 199 handlers untouched)
4. `verify-claim` promoted to headline; instructions block + behavioral-contract descriptions
5. #837 machine-readable price map (Enigma rate-card move) + #847 status page (SLA story)
6. `npx … setup` MVP (Claude + Cursor + Freebuff targets)
7. Pricing page (Free/$50/$200/$499/quote + per-province SKUs) + evidence-package offer page ($500–5k)
8. Sell 3 evidence packages manually — real price discovery before any automation
9. Confirm politicaldata.ca / northaxiumdata.ca are not Quill-family properties before any competitive positioning goes public

*Generated with the full audit trail: code audit, Context7 source review, `gh` repo inspection, hermes-verified pricing/competitor research (sources: opencorporates.com, context7.com/plans, vendr.com, spendhound.com, propublica.org, politicaldata.ca, northaxiumdata.ca, regmap.ca, procuredata.ca, gnowit.com).*
