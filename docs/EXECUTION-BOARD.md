# Quill Execution Board

> Canonical work-priority board consolidating **all 75 open issues** (as of 2026-09-16) + untracked strategic gaps from [TRANSFORMATION-MASTER-PLAN.md](./TRANSFORMATION-MASTER-PLAN.md). Sequenced by the governing principle: **income first (WS0), then the agent surface that multiplies it (WS1), then differentiators (WS2), then reliability (WS3), then infra backlog (WS4/WS5).**

> **⚠️ PLATFORM CHANGE (2026-09-16): nixos dropped, k3s retained.** This voids #814's ADR ("authoritative deploy is nixos-config easykubenix"). The authoritative deploy source is now **this repo's own `k8s/` manifests + `charts/quill` Helm chart** deployed to k3s. Secrets flow via the **secretspec contract** (`secrets/SECRETSPEC-CONTRACT.md`) directly into the cluster — the sops-nix → k8s-secret-sync-on-nexus path is retired. Consequences: (a) WS0's secrets work = wire secretspec → k3s Secret, not sops registry; (b) WS4's nix-hosted items (sops-nix modules, nix builder images) are deprecated scope; (c) `nix/` remains only as optional self-host packaging (`selfhost.sh`), never deploy authority; (d) #777 (D4 single k8s config source) is now **unblocked and correct** — repo-owned k8s configs are canonical.
>
> **⚠️ FREE-TIER INFRASTRUCTURE DOCTRINE (2026-09-16):** zero-external-cloud-spend is now a hard constraint, not a slogan. Layer map:
> - **k3s (forge/nexus/krash3)** — primary compute, DBs (sqlite/postgres), MCP/API/portal, ingestion crons.
> - **Garage (S3-compatible, on nexus)** — object storage: bulk/feed export SKUs, evidence-package artifacts, sqlite backups, x402 ledger snapshots. Delivered publicly via presigned URLs through the Cloudflare tunnel. Replaces any paid S3/R2 storage need.
> - **Cloudflare free tier — everything it can do**: Tunnel (live), Pages (brand site, live), DNS, Workers free (100k req/day edge cache), KV free (rate limiting — already declared in wrangler.toml), D1 free 5GB (cache), Turnstile (free CAPTCHA for signup/billing routes), R2 free 10GB only if Garage can't serve a bucket.
> - **Oracle Cloud free-forever (ca-toronto-1)** — burst/HA capacity outside the homelab: 4 ARM OCPUs + 24GB RAM + 200GB block = a standby API replica or second cloudflared egress (fixes the single-homelab tunnel failure mode properly), plus ingestion overflow.
> - **Never**: paid object storage, paid CDN, paid rate-limit/cache services. If a feature needs paid infra, redesign it onto Garage/CF-free/Oracle-free or cut it.

---

## WS0 — Go-live blockers (P0 · this is the income path)

Everything needed to flip Stripe live. Nothing else on this board matters until this ships.

| # | Work | Notes |
|---|---|---|
| #811 | **Taxable-revenue tracker + GST/HST threshold alert** | ✅ **IMPLEMENTED (this session)** — event-sourced `tax_ledger` in all 4 storage backends, webhook capture (`invoice.payment_succeeded` charge / `charge.refunded` refund, idempotent by event ID), `GET /v1/billing/tax/status` + `POST /v1/billing/tax/adjustment` behind `X-Billing-Secret`, escalation-only alerts (80% → 100%), `computeHst()` gate in checkout (zero tax until `GST_HST_REGISTERED=true`). Docs: `docs/billing-tax-ledger.md`. Tests: 10 new, 92/92 suite green. **Bonus fix:** latent bug — Free-tier gate would 402 the reconcile-expiry cron; added `isOperatorRoute()` bypass. |
| #803 | **Define the Free-tier public subset** | ✅ **VERIFIED IMPLEMENTED (this session)** — `FREE_TIER_ALLOWED_PREFIXES` whitelist in `feature-gates.ts` is the single source of truth (discovery/metadata/citation/verify/billing/auth); quota 1,000/mo + 35/day confirmed live in `TIER_LIMITS` + `enforceRateLimit` (not stubbed); two-axis model (Stripe quota vs x402 per-call) documented on `TIER_LIMITS`. Free-tier tests passing. |
| #825 | **DRY consolidation** (open PR #826) | Single manifest source, single secret-sync, dedup secret keys. Review PR before it stales/conflicts. |
| #823 | **Operator go-live runbook** | Confirm live key + secretspec symlink + deploy, then the #805 pattern: small real charge flips a test tenant Pro→active; reconcile cron downgrades on expiry. |
| — | **Secrets audit before public flip** *(untracked, from master plan)* | gitleaks over git history for `.env*`, `secrets/`, sqlite, sops. Prerequisite for the repo going public (WS1). |
| #796 | node:sqlite WAL reader race (Toronto cache-fallback flake) | Free-tier reliability bug; free users hitting flakes kills upsell trust. |
| #731/#730 | **SaaS admin onboarding psychology audits** (p0, duplicates — merge) | Onboarding is part of the income path: the first-5-minutes experience of a paying tenant. Run as one audit, close the duplicate. |

**Exit criterion:** first real CAD charge flips a tier; free tier serves a defined, non-flaky subset.

---

## WS0 notes (session log — updated 2026-09-16 late)

- **#811 done** (see table) — evidence posted on the issue.
- **#803 done** (verified + two-axis doc) — ready to close.
- **Latent bug fixed:** operator routes now bypass the Free-tier gate (`isOperatorRoute` in feature-gates.ts; was 402ing the reconcile-expiry cron).
- **SECRETS AUDIT COMPLETE → #854 filed (P0, BLOCKER for public flip):** 2 real age private keys in git history (`.secrets/` ephemeral vault, 2026-05-17, incl. the encrypted vault binary — key + ciphertext both recoverable). 73 other findings verified false positives. Full report: `docs/SECRETS-AUDIT-2026-09-16.md`. Remediation = filter-repo + gitleaks CI gate + `.gitleaksignore`.
- **#838 done:** FEATURED_TOOLS promotion (7 cross-ref/influence tools) + thin-CKAN-wrapper demotion in discover_tools + meta-query handling; llms.txt 175→182 count straggler fixed. quill-mcp 63/63 tests.
- **#788 + #752 done:** robots.txt rewritten (citing AI crawlers allowed explicitly, Bytespider blocked, private surfaces disallowed); JSON-LD SoftwareApplication in BaseLayout; generate-llms.mjs dead `mcp-server` path fixed → `quill-mcp`; generate-agents-json.mjs now writes into `public/` (was package root — Astro never served it) with reconciled counts. Generators verified end-to-end (182 tools, fresh agents.json). astro check 0 errors. Evidence posted on issues.
- **Stale issues closed with evidence:** #740, #739 (bilingual verified implemented: 176 FR tool descriptions + 24 API error codes), #747 (self-marked DONE), #730 (dup of #731).
- **Labels live:** ws0–ws5 applied across all open issues → `gh issue list -l ws0` is the queue.
- **All work currently UNCOMMITTED on the working tree** — commit in labeled batches (tax-ledger / discover-tools / ai-visibility) before PR #826 review.

## WS1 — Agent surface + public flip (P1 · weeks 2–8 · the multiplier)

The Context7-shaped transformation + distribution. This multiplies the product WS0 makes sellable.

| # | Work | Notes |
|---|---|---|
| #838 | **Tool-index hygiene** | (1) Flag thin CKAN wrappers in `discover_tools`; promote the 7 cross-reference tools to Featured. (2) Reconcile tool-count drift (ROADMAP 166 / products doc 170+ / live 182 — `getToolNames()` is truth). (3) Refresh metrics.json + portal copy. **Execute as the substrate for the 3-tool shell below.** |
| — | **3-tool shell: `resolve-quill-id` + `query-quill` + `verify-claim`** *(untracked, master plan §5)* | Build the router over the auto-generated tool-index; 199 handlers become router targets behind an `internal` flag; `verify-claim` promoted to headline. Server `instructions` block + behavioral-contract descriptions. Keep full surface behind a capability flag. |
| #789 | **OpenSEO patterns: MCP-first, intent-organized tools, AI visibility** | Same intent as the shell — do together, not as separate passes. |
| #788 | **AI search optimization: robots.txt blocks citing crawlers, no schema, llms.txt/sitemap not served** | Direct distribution bug: the agents you want citing you are currently blocked. Fast win. |
| #752 | Portal auto-gen scripts (agents.json / llms-full.txt) reference stale package paths | Same distribution surface; fix while in there. |
| #740 | [i18n] MCP bilingual tool descriptions (p0) | Bilingual is a claimed differentiator — verify it's actually shipped. |
| #739 | [i18n] API bilingual error responses + OpenAPI docs (p0) | Pair with #740. |
| #741 | [i18n] MCP French-language data source queries (p1) | Third i18n wave; after the two p0s. |
| #831 | **Quill Lite as product** (QUILL_LITE=1) | The `npx` zero-config tier = the Context7 growth engine. |
| #845 | **Citation-accuracy benchmark suite (citecheck)** | The eval that makes "verified" a defensible public claim. Needed *before* loud marketing. |
| — | **`npx quill-mcp setup` + activation skill** *(untracked)* | Client detection → MCP config write → activation skill install. After repo flip (needs public npm/GitHub). |
| — | **Repo public flip + dual-license rendering** *(untracked)* | After WS0 secrets audit. License currently renders as "Other" on GitHub. |

**Exit criterion:** an agent can `npx`-install Quill, resolve → query → verify in 3 calls, and the repo + skills are publicly discoverable.

---

## WS2 — Revenue surface + differentiators (P1–P2 · weeks 4–12)

| # | Work | Notes |
|---|---|---|
| #837 | **Publish resource/prompt price map + free-tier scope** | Enigma move: machine-readable rate card (1 credit = $0.01 style) so agents price their own queries. Depends on #803's free-tier definition. |
| #836 | **x402 spec alignment + settlement receipts** (`_meta['x402/payment']`) | x402 repositioned as the agent-native rail alongside Stripe (master plan: keep, stop leading). |
| #842 | **Provenance badge / cite-any-URL tool** | The evidence-package deliverable (Sayari move) — neutral citation layer is also the most linkable marketing asset. |
| #848 | **Extend claim bundles beyond the 7 high-signal tools** | Verification story must cover what agents actually call. Sequence with #845 benchmarks. |
| #841 | **FOI/ATI tracking infrastructure** (p1) | Unique content **no competitor has** (verified in deep audit). Differentiator, not chore. |
| #840 | **Outcome-data spines + joined versioned dataset** (fiscal/immigration/housing/crime) (p1) | Same: nobody in the Canadian cohort has joined outcome data. |
| — | **Per-province export SKUs + $499 Scale tier w/ credit pools + SLA page** *(untracked, master plan §5)* | Pricing mechanics from Enigma/OpenCorporates/North Data; depends on WS0 tiers being live. |
| — | **Evidence packages sold manually ($500–5k)** *(untracked)* | Start outreach the week tiers go live; the two agent skills already produce the deliverable. |
| #833 | White-label / multi-tenant recipe (p2) | Supports the sovereign self-host tier; P2 until a real inquiry arrives. |
| #834 | SDK examples: verify-claim.ts + crossref-agent.ts | Cheap, high-signal docs for the agent-native pitch. |

---

## WS3 — Reliability & trust infrastructure (P1–P2 · overlapping)

Paying tenants make these non-optional; several already have issue specs.

| # | Work | Notes |
|---|---|---|
| #847 | **Status page + status.maplespike.ca** | Prerequisite for any published SLA (the OpenCorporates service-credit story). |
| #795 | Source uptime panel (`/v1/municipal/health`) for Cloudflare-bot-block diagnostics | Same surface; upstream-source health is part of the SLA story. |
| #829 | **True streaming / long-running jobs** for heavy cross-references | Also enables pre-run cost previews (Enigma move) for expensive operations. |
| #830 | Opt-in 2026-07-28 MCP protocol migration (QUILL_PROTOCOL_VERSION) | PoliticalData ships OAuth 2.1 PKCE MCP — agents now expect modern protocol + auth. |
| #779 / #780 | Astral Key proxy 502 (EAI_AGAIN) / FIDO2 origin hardcoded to .lan (p1 bugs) | Auth path broken for .ca — blocks real tenant signups. Fix with WS0. |
| #783 | Migrate authentication middleware to astral-key | Only after #780 makes it actually work on .ca. |
| #797 | Activate `?jurisdiction=indigenous` filter (documented no-op) | Documented-but-broken is exactly the anti-pattern competitors got dinged for. |
| #794 | FTS5 + keyset cursor pagination for `/v1/municipal/search` | Performance under paid load. |
| #843 | PDF/table extraction at scale | Ingestion quality; feeds module breadth claims. |
| #844 | Agent monitoring / anomaly-detection watchers | Operational safety for the agent traffic WS1 brings. |

---

## WS4 — K3s hardening sprint (P1–P2 · the A/B/C/D series)

Depends on #781 — **three cluster nodes report Unknown (not Ready)**, which makes most of this sprint untestable until fixed.

| # | Work |
|---|---|
| #781 | **Cluster nodes forge/nexus/krash3 Unknown — kubelet/heartbeat gap** (p1, fix first) |
| A1 #754 | Purge legacy maplespike-* services/NodePorts/Caddy |
| A2 #755 | Pin images to digests (no `:latest`) |
| A3 #756 | Multi-replica + pod anti-affinity |
| A4 #757 | CPU HPA for api/portal |
| A5 #758 | RollingUpdate strategy everywhere (p1 bug) |
| A6 #759 | Ingestion → Qdrant embedding end-to-end (p1 bug) |
| A7 #760 | Alerting on failed ingestion CronJobs (PrometheusRule + Telegram) |
| B1–B6 #761–766 | Qdrant pipeline, fusion gateway, Casdoor OIDC, Redis cache+rate-limit, pino logging, OTel→Tempo |
| C3–C8 #768–773 | CronJob spread, Qdrant RAG enrichment, Redis rate limiting, Grafana dashboards, Mosiac StatefulSet, canary deploys |
| D1–D4 #774–777 | Topology spread, PVCs for Qdrant/Postgres, sops→K8s sync pipeline, single k8s config source |

**Note:** B/C/D items are infrastructure *quality*, not income path. Do A-series + #781; defer B/C/D until WS0–WS2 are shipping or a reliability incident forces the issue. #777 (D4) conflicts in spirit with #814's ADR that `nixos-config` is the authoritative deploy source — resolve that decision before executing D4.

---

## WS5 — Backlog / cleanup (P3 · opportunistic)

| # | Work |
|---|---|
| #750/#751 | Solana tx verification Phase 2+3 + devnet smoke (p3; x402 ledger depth — after #836) |
| #746/#745/#747 | Pages domain, prod branch, CI/CD triggers (mostly done per #747) |
| #722 | Scout: StatsCan WDS 404 regression in portal (verify still live; may be stale) |
| #792/#793 | Katzilla federal parity endpoints; Indigenous dataset portal support |
| #739/#742/#743 | i18n phases 9–10 (SDK errors, bilingual entity resolution) — after #739/#740 |
| #832/#835/#849 | Ingestion-patterns SDK surface; Gazette/Mosaic integration notes; schemas doc pass |
| #778? | *(not present — numbering gap, no action)* |
| #784/#785/#786 | Ops script bugs (DRY_RUN counter, FQDN idempotency, tsconfig TS5112) |
| #787 | DNS-script + cluster-deploy work queue (2026-07-14) — likely stale; reconcile against current state and close |

---

## Dedupe & hygiene actions (do this week, 30 minutes)

1. **Merge duplicates:** #730 → #731 (identical onboarding audits); #703/#704 vs #702/#705/#707 PR pairs already closed — no action. #798/#814 stay separate (map vs spec).
2. **Close stale after verification:** #722 (check if WDS 404 persists), #747 (marked DONE), #787 (reconcile queue vs reality).
3. **Label pass:** add `ws0`–`ws5` labels mirroring this board so `gh issue list -l ws0` is the live queue.
4. **Set #827 as the canonical gap-map parent** and link this board from it; close anything completed by this board's work with cross-references.

---

## Untracked strategic gaps (from master plan, now owned here)

| Gap | Lands in |
|---|---|
| Secrets audit + repo public flip + license rendering | WS0 → WS1 |
| 3-tool router shell + instructions block | WS1 (with #838) |
| `npx setup` + activation skill + localized READMEs | WS1 |
| $499 Scale tier, credit pools, 2× surge, SLA page, per-province SKUs | WS2 |
| Evidence packages (manual sales motion + standardized artifact) | WS2 |
| Macro reference feed productization (StatCan WDS / BoC Valet) | WS2 (after tiers live) |
| Confirm politicaldata.ca / northaxiumdata.ca aren't Quill-family properties | Do before any public competitive positioning (this week) |
| Package pruning (sdk-shell, flywheel-agent, edge-worker, notification-service overlap) | WS5 |
| MCP SDK migration (replace hand-rolled JSON-RPC core) | Opportunistic — never blocks income |
| GR workflow layer (entity alerts + auto-briefs) | Post-board (master plan Phase 4, months 6–18) |

---

## Calendar view

- **Week 1:** WS0 (#811, #803, #825 review, secrets audit) · dedupe/hygiene · competitor-confirmation check
- **Weeks 2–3:** #823 go-live runbook → **first live charge** · #796, #779/#780 auth fixes · repo public flip
- **Weeks 2–8:** WS1: #838 → 3-tool shell → #788/#789/#752 distribution fixes → #740/#739 → #831 Lite → #845 citecheck → `npx setup`
- **Weeks 4–12:** WS2: #837 price map → #836 → #842/#848 → #841/#840 → pricing page + SKUs → evidence-package outreach → SLA page (#847 in parallel)
- **Ongoing:** WS3 as incidents/demand dictate; WS4 A-series after #781; WS5 opportunistic

**The single governing rule: nothing delays WS0's first live charge. Everything else is sequenced behind it.**
