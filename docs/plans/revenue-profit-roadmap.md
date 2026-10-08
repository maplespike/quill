# Quill Revenue & Profit Roadmap

> **Scope:** how Quill gets from coded billing to proved revenue and then profit. Billing evidence, blockers, and verification gates live in the [go-live runbook](../go-live-runbook.md). Other issue priorities below are the earlier planning snapshot, not a current deployment or legal audit.

## 0. Live status reconciliation — 2026-10-07

Checked against `maplespike/quill` (the repository moved from `reverb256/quill` and is now private).
Where this section disagrees with a table further down, this section is correct; the tables below
are the planning snapshot and were not rewritten.

**Closed since this plan was written — no longer revenue-blocking:**

| Item | Was listed as | Live state |
|------|---------------|-----------|
| [#804](https://github.com/maplespike/quill/issues/804) legal/financial posture | Tier 1, needs a decision | **CLOSED** |
| [#800](https://github.com/maplespike/quill/issues/800) cloudflared 521/404 flakiness | Tier 1, prioritize | **CLOSED** |
| [#891](https://github.com/maplespike/quill/issues/891) 402 self-explanatory + own usage | Tier 1, prioritize | **CLOSED** |
| [#839](https://github.com/maplespike/quill/issues/839) quality scores on claim bundles | Tier 2, prioritize | **CLOSED** |
| [#665](https://github.com/maplespike/quill/issues/665) MVP tracker | cited as ~30% ready | **CLOSED** |
| [#268](https://github.com/maplespike/quill/issues/268), [#318](https://github.com/maplespike/quill/issues/318), [#130](https://github.com/maplespike/quill/issues/130), [#138](https://github.com/maplespike/quill/issues/138) | "defer until after first revenue" | **CLOSED** — the defer table below is stale for these |

The [#1038](https://github.com/maplespike/quill/issues/1038) row is not on the closed list: it is a
new open `p0` item that partly replaces the closed #804 as the live legal/compliance concern.

**New open work not in this plan** (all verified open):

| Issue | Priority | Why it matters here |
|-------|----------|---------------------|
| [#1038](https://github.com/maplespike/quill/issues/1038) privacy/compliance: data disclosures, CASL notices, renewal terms | `p0` `agent-ready` | Renewal checkout terms — a live-revenue gate. |
| [#1039](https://github.com/maplespike/quill/issues/1039) Cluster Health Issues Detected | `p1` `infrastructure` | Paying customers fail on infrastructure faults. |
| [#922](https://github.com/maplespike/quill/issues/922) portal `/mcp` tool-family grid empty cell | `p2` `frontend` | Customer-facing surface defect. |

**Still open and correctly prioritized below:** #988, #1032 (with PR #1034), #1022, #1021,
#890, #897, #837, #847, #845, #848, #991, #854 (`p0` security, still blocked), #814, #811, #790.

**Not resolvable:** `#1112` returns no issue or PR — it does not exist in this repository.
`#137` also returned no record when checked.

Open counts at this check: **61 open issues, 22 open PRs.**


---

## 1. The revenue model as the project describes it today

Quill has **two payment rails**. Only one is anywhere near live.

### A. Stripe subscriptions — the chosen primary rail

From [#814](https://github.com/reverb256/quill/issues/814) (spec: Quill → Production + Live Income) and [#790](https://github.com/reverb256/quill/issues/790) (MVP scope):

| Tier | Price (CAD, monthly) | What you get |
|------|----------------------|--------------|
| Free | $0 | Discovery/metadata only: catalog, module list, health, citations, `/v1/claims/*`, `llms.txt`. No data queries, no AI, no entity-resolution tools. |
| Pro | $50 | All modules + all MCP tools: data queries, AI ask/analyze, entity resolution, cross-reference. |
| Business | $200 | Pro + SSO, team seats, journalism mode, higher limits. |

**Free-tier enforcement is real and wired** — `packages/api-server/src/feature-gates.ts` (`isFreeTierRoute`, `FREE_TIER_ALLOWED_PREFIXES`) is the single source of truth for the Free/Pro line, and the MCP server's `quota.ts` enforces 1,000 calls/month per identity before falling through to x402. The portal renders 402s today (though with no upgrade path — see gaps).

**Billing implementation is not revenue proof.** Use the [go-live runbook](../go-live-runbook.md#evidence--2026-10-07) for the observed configuration, endpoint results, and deployment revision. Its [unresolved blockers](../go-live-runbook.md#unresolved-blockers) and [verification gates](../go-live-runbook.md#next-verification-gates) replace the earlier secret-provisioning, image-repin, and live-flip assumptions in this plan. Prices are minted inline at checkout in CAD (Pro $50, Business $200), without hardcoded Stripe Price IDs.

### B. x402 Solana USDC micropayments — secondary per-tool rail

From [#750](https://github.com/reverb256/quill/issues/750) (Phase 1 done, Phase 2/3 open) and [#836](https://github.com/reverb256/quill/issues/836):

- **Phase 1 (done):** `packages/quill-mcp/src/pricing.ts` — static price map for all 175+ tools: free / micro $0.001 / standard $0.01 / premium $0.10 / enterprise $1.00. `x402-middleware.ts` parses `X-PAYMENT` header, returns 402 with USDC price. Gated behind `X402_ENABLED=true`. `x402-deposit` MCP tool exists for pre-pay credits. `server.ts` enforces the quota gate then the x402 gate.
- **Phase 2 (open):** full Solana tx verification (introspect → simulate → submit via `@x402/svm`), Helius webhook, replay protection (dedup by tx signature).
- **Phase 3 (open):** pre-pay credits with server-side credit balance (`credit-balance.ts` partially exists).
- **[#836](https://github.com/reverb256/quill/issues/836):** x402 proof is parsed from tool args (`_payment`), not the standard `_meta["x402/payment"]` shape. A standard x402 wallet can't call a paid Quill tool without Quill-specific shims. No settlement receipts.
- **[#751](https://github.com/reverb256/quill/issues/751):** Solana devnet smoke for Phase 2/3 final close — open.

**Reality check:** [#814](https://github.com/reverb256/quill/issues/814) says x402 is "explicitly not the revenue mechanism (Stripe subscriptions chosen)." Phase 2/3 must not block Stripe verification. No x402 customer or settlement behavior was audited in this billing pass.

### Who pays, what they get

- **Free users** get discovery/metadata — the top-of-funnel, and it works today.
- **Pro users** ($50/mo) get the full MCP + API data surface — the thing AI agents actually use.
- **Crypto-native users** could pay per-call in USDC once x402 Phase 2 lands, but this is a niche within a niche for a Canadian-government-data MCP server.

**The revenue thesis (from the repo's own vision):** developers/AI agents querying Canadian public data are the customer. The MCP server is the primary interface (per [#790](https://github.com/reverb256/quill/issues/790) MVP). A journalist or policy analyst connecting Claude Code / Codex / Cursor to `mcp.maplespike.ca` and asking "track Bill C-69 through the Senate" should get a cited report — and if they want more than the free discovery tier, they subscribe at $50/mo.

---

## 2. Gaps that block revenue or profit, ranked

Ranked by **revenue impact × probability the gap kills a sale or trust decision**, then by effort. "Blocks first paying customer" is the highest tier.

### Tier 1 — blocks first paying customer (close before #805 go-live verify)

| Gap | Issue | One-line reason | Effort |
|-----|-------|----------------|--------|
| **Revenue and expiry behavior unproved** | [Go-live runbook](../go-live-runbook.md) | Resolve its security and expiry blockers, then prove checkout and payment. Closed issues do not satisfy these gates. | Local verification first; production and live-payment approval required. |
| **Public endpoint flaky** (521/404 from Cloudflared tunnel; tunnel targets hardcoded ClusterIPs not Service DNS) | [#800](https://github.com/reverb256/quill/issues/800), [#988](https://github.com/reverb256/quill/issues/988) | A paying customer hits a 521 and the product is dead. Trust dies on first outage. [#814](https://github.com/reverb256/quill/issues/814) user story #1. | Medium (Service-DNS tunnel target, maxUnavailable:0, replicas≥2, cloudflared≥2, finish rename wave) |
| **No legal/financial posture for taking CAD revenue** — no entity to hold Stripe, GST/HST plan missing, data-licensing audit missing, 2 age private keys in git history block public flip | [#804](https://github.com/reverb256/quill/issues/804), [#811](https://github.com/reverb256/quill/issues/811), [#854](https://github.com/reverb256/quill/issues/854) | Can't take money compliantly without an entity, a GST/HST plan, a Crown-copyright audit, and (for public flip) a history rewrite. [#811](https://github.com/reverb256/quill/issues/811) (taxable-revenue tracker + 80%-of-$30k alert) is a go-live gate. | Small–medium (tracker is small; history rewrite is destructive + needs a coordinated window + j_kro GO) |
| **Free→Pro conversion path broken** — portal 402s are dead ends (no upgrade CTA, no plan comparison, no checkout link), API key is minted silently into localStorage at signup (never shown) | [#891](https://github.com/reverb256/quill/issues/891), [#890](https://github.com/reverb256/quill/issues/890) | A free user hitting a 402 sees nothing actionable; a signing-up user gets a key they never see. Both lose conversions the free tier is supposed to generate. | Small |
| **Portal has zero tests** — the surface every customer touches first has no regression protection | [#897](https://github.com/reverb256/quill/issues/897) | The signup key-reveal fix (#890) and 402 upgrade rendering (#891) both need portal tests to pin behavior. | Small–medium |

### Tier 2 — blocks profit at scale / trust at volume (close in the first 1–3 customers)

| Gap | Issue | One-line reason | Effort |
|-----|-------|----------------|--------|
| **CI silently hangs** (4 instances, ~4 runner-hours burned, gate passed while a check was hung) | [#996](https://github.com/reverb256/quill/issues/996), PR [#1022](https://github.com/reverb256/quill/pull/1022) | Burned CI capacity + a gate that passed while hung = unreliable ship. At revenue, a bad merge to prod is a real incident. | Small (stall watchdog) + root-cause one hang |
| **`check-image-pins` gate and CI test disagree** (false green on date-only tags; caused the stale-pin incident) | [#1032](https://github.com/reverb256/quill/issues/1032), PR [#1034](https://github.com/reverb256/quill/pull/1034) | A stale/wrong image pin can ship undetected — directly relevant to the stale 2026-05-16 tag problem. | Small (negative lookahead in `IMMUTABLE_TAG_RE` + regression test) |
| **Claim bundles retained digest but (until PR #1021) retained no bytes** — "verify by Quill" promise was weak | [#989](https://github.com/reverb256/quill/issues/989), PR [#1021](https://github.com/reverb256/quill/pull/1021) | Re-verification depended on the publisher still serving byte-identical content. PR #1021 adds `rawBody` to ClaimBundle. | Small (already implemented; merge it) |
| **Quality scores on claim bundles are provenance-only** — freshness + completeness axes from `quality/types.ts` not computed (GAP-12 residual from this thread) | [#839](https://github.com/reverb256/quill/issues/839) | The "verified by Quill" differentiator has only 1 of 3 quality axes. Freshness (age vs cadence) + completeness (field presence) are computable from existing types + ingestion metadata. | Small–medium |
| **Citation accuracy has no benchmark** — "verified by Quill" is a claim, not a measured property | [#845](https://github.com/reverb256/quill/issues/845) | The trust story's weakest link. Feeds the free-tier trust narrative. | Medium |
| **`withClaims` on 7 tools only** — 168 other upstream-returning tools emit no claim bundles | [#848](https://github.com/reverb256/quill/issues/848) | "Every response carries verifiable claim bundles" (the [#790](https://github.com/reverb256/quill/issues/790) MVP promise) is not true today. | Medium–large |
| **41k legacy citation rows carry no evidence** — degrade the trust signal of `/v1/claims/latest` | [#991](https://github.com/reverb256/quill/issues/991) | Old rows weaken the citation store's trust signal. | Small (disposition: flag/drop/backfill subset) |
| **Portal status page + `status.maplespike.ca` not wired** — `/v1/status` exists and is auth-exempt, but the customer-facing SLA page isn't | [#847](https://github.com/reverb256/quill/issues/847) | A paying customer has no status page. | Small |
| **Data-licensing audit for monetization** — per-source Crown-copyright audit is a go-live gate per [#814](https://github.com/reverb256/quill/issues/814) | [#804](https://github.com/reverb256/quill/issues/804), [#1038](https://github.com/reverb256/quill/issues/1038) | Can't monetize a dataset you can't legally restrict/redistribute. Separate from the user-privacy CASL/renewal work in [#1038](https://github.com/reverb256/quill/issues/1038). | Medium |

### Tier 3 — monetization hardening, retention, polish (close after first revenue, before scaling)

| Gap | Issue | Why it matters later | Effort |
|-----|-------|----------------------|--------|
| **x402 spec alignment + settlement receipts** | [#836](https://github.com/reverb256/quill/issues/836) | Makes x402 usable by standard wallets; receipts are the crypto-revenue audit trail. | Small |
| **x402 Phase 2/3** (Solana verification + credits) | [#750](https://github.com/reverb256/quill/issues/750), [#751](https://github.com/reverb256/quill/issues/751) | Only relevant if x402 becomes a real revenue contributor. | Medium–large |
| **Price map + free-tier scope published** | [#837](https://github.com/reverb256/quill/issues/837) | Customers and agent authors need to know what's free vs paid. Docs, not code. | Small |
| **Quill Lite product** | [#831](https://github.com/reverb256/quill/issues/831) | Zero-DB `npx` mode as a documented tier — adoption lever, not revenue-blocking. | Small–medium |
| **SDK examples + reusable ingestion patterns + white-label recipe** | [#832](https://github.com/reverb256/quill/issues/832), [#833](https://github.com/reverb256/quill/issues/833), [#834](https://github.com/reverb256/quill/issues/834) | Enablement for self-serve and white-label; scale revenue, not first customer. | Small–medium each |
| **RESTful billing: invoices, full accounting tooling** | [#814](https://github.com/reverb256/quill/issues/814) follow-up | Needed for B2B/profit at scale, not for first $50/mo. | Medium |
| **Email notifications + journalism mode + SEDAR+** | [#130](https://github.com/reverb256/quill/issues/130), [#138](https://github.com/reverb256/quill/issues/138), [#137](https://github.com/reverb256/quill/issues/137) | Retention + new surfaces; not revenue-blocking for the core MCP subscription. | Large each |
| **Coverage growth 103→150 modules** (ROADMAP 5.2/5.3) | Product depth, not a go-live gate. The MVP is one end-to-end workflow. | Large (172h cumulative) |

### Tier 4 — do not do yet (explicitly de-prioritized)

1. **x402 Phase 2/3 as a revenue gate.** Stripe subscriptions are the chosen rail. x402 is complementary; don't let Solana verification work block Stripe go-live.
2. **AI Ask (#268) / Sovereign LLM fine-tuning (#318).** [#268](https://github.com/reverb256/quill/issues/268) needs a PRD; blocks #318; large. Not a first-revenue enabler.
3. **150-module coverage before first paying customer.** The MVP is one end-to-end workflow, not a complete library.
4. **Public flip (#854 history rewrite) as a prerequisite for taking $50.** You can take money before the repo is fully public — but don't flip public with keys in history. Keep these as parallel tracks.
5. **Invoice generation / full accounting tooling.** [#814](https://github.com/reverb256/quill/issues/814) lists this as follow-up, not a go-live gate.
6. **A second payment surface (donations, Interac) before Stripe converts.** Don't add payment rails before the primary one works.

---

## 3. Concrete next steps

### Path to "first paying customer" (the shortest credible line)

**Steps 1–2 — Resolve the [runbook blockers](../go-live-runbook.md#unresolved-blockers).**
Follow its security review, isolated expiry tests, and GitOps verification gates. Do not repeat the obsolete secret-provisioning or image-repin tasks. Production rollout is a separate approval, not part of documentation repair.

**Step 3 — Stabilize the public endpoint ([#800](https://github.com/reverb256/quill/issues/800), [#988](https://github.com/reverb256/quill/issues/988), ~medium).**
- Tunnel targets Service DNS, not hardcoded ClusterIPs.
- API/MCP deployments: `maxUnavailable: 0, maxSurge: 1`, replicas ≥ 2.
- `cloudflared` replicas ≥ 2.
- Finish the `quill-*` ↔ `maplespike-*` rename wave so selectors don't drift (mentioned in [#814](https://github.com/reverb256/quill/issues/814) ADR).
- After an approved GitOps rollout, measure public-endpoint availability. Do not assume zero downtime from rollout settings alone.

**Step 4 — Legal/financial posture ([#804](https://github.com/reverb256/quill/issues/804), [#811](https://github.com/reverb256/quill/issues/811), [#854](https://github.com/reverb256/quill/issues/854), ~small–medium, some j_kro decisions).**
- Entity: sole proprietorship minimum to hold the Stripe account (a j_kro decision — who is the legal holder).
- GST/HST: ship the taxable-revenue tracker + 80%-of-$30k alert from [#811](https://github.com/reverb256/quill/issues/811). Until registered, checkout does NOT add a GST/HST line (config flag — already coded in `tax-ledger.ts` / `billing-stripe.ts`).
- Data licensing: per-source Crown-copyright audit across the modules you intend to monetize — a go-live gate per [#814](https://github.com/reverb256/quill/issues/814).
- Public flip prep: [#854](https://github.com/reverb256/quill/issues/854) history rewrite — coordinate a window, force-push with `--force-with-lease`, confirm no still-valid credential was vaulted on 2026-05-17. Destructive; don't run casually.

**Step 5 — Make the free→Pro conversion path real (#891, #890, #897, #837, ~small).**
- Portal shows the API key at signup with a copy affordance + "this is the only time" note + curl example ([#890](https://github.com/reverb256/quill/issues/890)).
- Portal 402 renders an upgrade path, not a dead-end error ([#891](https://github.com/reverb256/quill/issues/891)).
- Published price map + free-tier scope ([#837](https://github.com/reverb256/quill/issues/837)).
- Add portal tests first so these behaviors are pinned ([#897](https://github.com/reverb256/quill/issues/897)) — SignupForm key reveal, 402 upgrade rendering, `smoke:dist` promoted to a real test.

**Step 6 — Go-live verify ([#805](https://github.com/reverb256/quill/issues/805), AFK/HITL).**
Follow the [runbook's verification gates](../go-live-runbook.md#next-verification-gates). Do not treat issue closure as a successful payment or assume a live flip is still needed. Obtain explicit live-payment approval before the agreed charge.

### Path to "profitable"

Profit = revenue > cost. The cost side here is mostly labor (one-person + agents on a home-lab K3s cluster with zero external cloud spend per the vision doc). So "profitable" is really "revenue > operator time invested," which means:

1. **First revenue (Step 6) proves the surface converts** before optimizing. Prove someone will pay $50/mo.
2. **Retention > acquisition early.** The free→Pro conversion path (#891/#897/#837) matters more than more modules, because a converting free user is already using the product. Track: free users hitting 402s, free→Pro conversion rate, Pro churn.
3. **Trust compounds retention.** The claim-bundle quality story is the differentiator. Close the residual GAP-12 (freshness + completeness axes, [#839](https://github.com/reverb256/quill/issues/839)), ship the citecheck analog ([#845](https://github.com/reverb256/quill/issues/845)), and finish the claim-bundle sweep ([#848](https://github.com/reverb256/quill/issues/848)) so "every response carries verifiable claim bundles" is actually true.
4. **Reduce the surface that can take a paying customer down.** CI reliability ([#996](https://github.com/reverb256/quill/issues/996), [#1032](https://github.com/reverb256/quill/issues/1032)/[#1034](https://github.com/reverb256/quill/pull/1034)), secret hygiene (sops on nexus), and the deployment decoupling (#808) all reduce the odds that a revenue-generating deploy is broken.
5. **Scale revenue levers (later):** x402 Phase 2/3 for crypto-native micropayments ([#750](https://github.com/reverb256/quill/issues/750)), Business tier upsell, white-label/enterprise tenants ([#833](https://github.com/reverb256/quill/issues/833)), coverage depth ([#137](https://github.com/reverb256/quill/issues/137) SEDAR+, [#138](https://github.com/reverb256/quill/issues/138) journalism mode), API invoicing. None of these matter before the $50/mo Pro tier converts.

---

## 4. GH issues and PRs to close, prioritize, or defer

### Close ASAP (before or alongside first revenue)

| # | Title | Action | Why |
|---|-------|--------|-----|
| Billing verification (#808/#806/#807/#805) | [Go-live runbook](../go-live-runbook.md) | Follow the unresolved gates, not the old issue priorities. | The runbook owns the evidence and remaining actions. |
| [#800](https://github.com/reverb256/quill/issues/800) | Reliable public ingress (521/404 fix) | **Prioritize.** | Paying customer can't tolerate 521. |
| [#988](https://github.com/reverb256/quill/issues/988) | Gate fails when a pinned image is behind main (stale-pin detection) | **Prioritize.** | Compare live pins with the revision ArgoCD actually renders, not an older local checkout. |
| [#1034](https://github.com/reverb256/quill/pull/1034) | fix(gates): reject date-only image tags in check-image-pins | **Merge.** | Fixes [#1032](https://github.com/reverb256/quill/issues/1032) gate/Test disagreement. |
| [#1022](https://github.com/reverb256/quill/pull/1022) | ci: stall watchdog for silently-hanging test steps | **Merge.** | Fixes [#996](https://github.com/reverb256/quill/issues/996) CI burn + gate-pass-on-hang. |
| [#1021](https://github.com/reverb256/quill/pull/1021) | provenance: retain raw response bodies in claim records (#989) | **Merge.** | Closes [#989](https://github.com/reverb256/quill/issues/989); makes "verify by Quill" real. |
| [#890](https://github.com/reverb256/quill/issues/890) | Reveal the API key at signup | **Prioritize — small.** | First customer experience; paired with #897 tests. |
| [#891](https://github.com/reverb256/quill/issues/891) | Free tenant can read its own usage + upgrade path | **Prioritize — small.** | Free→Pro conversion path. |
| [#897](https://github.com/reverb256/quill/issues/897) | Portal has tests | **Prioritize — small.** | Pins #890/#891 behavior; the portal is the only surface with zero coverage. |
| [#837](https://github.com/reverb256/quill/issues/837) | Publish price map + free-tier scope | **Prioritize — small.** | Customers need to know what's free vs paid. |
| [#847](https://github.com/reverb256/quill/issues/847) | Wire portal status page + status.maplespike.ca | **Prioritize — small.** | Paying customer gets a status page; uses existing `/v1/status`. |
| [#839](https://github.com/reverb256/quill/issues/839) | Quality scores on claim bundles | **Prioritize — small–medium.** | Trust differentiator; the GAP-12 residual (freshness + completeness) is the remaining bit. |
| [#845](https://github.com/reverb256/quill/issues/845) | Citation-accuracy benchmark (citecheck analog) | **Prioritize — medium.** | Makes "verified by Quill" measurable. |
| [#848](https://github.com/reverb256/quill/issues/848) | Extend claim bundles to remaining search tools | **Prioritize — medium–large.** | Makes the "every response carries claims" promise true. |
| [#991](https://github.com/reverb256/quill/issues/991) | Disposition 41k legacy rows with no evidence | **Prioritize — small.** | Cleans up the citation store's trust signal. |

### Close in the first 1–3 customers (retention + hardening)

| # | Title | Action |
|---|-------|--------|
| [#836](https://github.com/reverb256/quill/issues/836) | x402 spec alignment + settlement receipts | Small; makes x402 usable by standard wallets. Do after Stripe is live. |
| [#751](https://github.com/reverb256/quill/issues/751) | Solana devnet smoke for #750 Phase 2/3 | Only if x402 becomes a real revenue contributor. |
| [#831](https://github.com/reverb256/quill/issues/831) | Ship Quill Lite as a product | Adoption lever; not revenue-blocking. |
| [#832](https://github.com/reverb256/quill/issues/832), [#833](https://github.com/reverb256/quill/issues/833), [#834](https://github.com/reverb256/quill/issues/834) | SDK patterns / white-label / examples | Enablement for scale; defer until after first revenue. |

### Defer until after first revenue (large, not blocking $50/mo)

| # | Title | Why defer |
|---|-------|-----------|
| [#268](https://github.com/reverb256/quill/issues/268) | AI Ask — natural language Q&A | Needs PRD; blocks #318; large. Not a go-live gate. |
| [#318](https://github.com/reverb256/quill/issues/318) | Sovereign LLM fine-tuning | Blocked on #268. |
| [#130](https://github.com/reverb256/quill/issues/130), [#137](https://github.com/reverb256/quill/issues/137), [#138](https://github.com/reverb256/quill/issues/138) | Email notifications / SEDAR+ / journalism mode | Retention + new surfaces; large; not blocking first $50. |
| ROADMAP 5.2/5.3 | 22 missing modules + coverage growth to 150 | Product depth, not go-live. The MVP is one end-to-end workflow. |
| [#840](https://github.com/reverb256/quill/issues/840), [#841](https://github.com/reverb256/quill/issues/841), [#843](https://github.com/reverb256/quill/issues/843), [#844](https://github.com/reverb256/quill/issues/844), [#846](https://github.com/reverb256/quill/issues/846) | Outcome spines / FOI-ATI / PDF extraction / watchers / news-archive | Memo P1/P2 data pushes; valuable but not revenue-blocking for the subscription. |
| [#741](https://github.com/reverb256/quill/issues/741)–[#743](https://github.com/reverb256/quill/issues/743) | i18n phases | French-data depth; valuable for Canadian credibility but not a first-revenue gate. |
| [#797](https://github.com/reverb256/quill/issues/797) | Activate ?jurisdiction=indigenous filter | Documented no-op today; scope separately. |

### Exists but is blocked / needs a j_kro decision (don't self-authorize)

| # | Title | Note |
|---|-------|------|
| [#854](https://github.com/reverb256/quill/issues/854) | BLOCKED public flip — 2 age private keys in git history | Destructive history rewrite; needs a coordinated window + explicit GO from j_kro. Separate from "take first $50" but mandatory before a full public flip. |
| [#811](https://github.com/reverb256/quill/issues/811) | Taxable-revenue tracker + GST/HST threshold | Code is small; the **decision** to register/not-register and the entity to hold Stripe are j_kro's. |
| [#804](https://github.com/reverb256/quill/issues/804) | Legal/financial posture (entity, data licensing, privacy, refunds) | Grilling issue; some items are counsel/jurisdiction decisions. |
| Live-payment verification | [Runbook gates](../go-live-runbook.md#next-verification-gates) | A closed ticket does not grant live-payment authorization. |

### Active PRs to merge (small, uncontroversial, improve reliability)

- **[#1037](https://github.com/reverb256/quill/pull/1037)** — shell-quote CVE patch. Security-relevant; merge.
- **[#1036](https://github.com/reverb256/quill/pull/1036)**, **[#1035](https://github.com/reverb256/quill/pull/1035)** — dependabot bumps (sharp, shell-quote). Routine.
- **[#1027](https://github.com/reverb256/quill/pull/1027)** — exclude `.worktrees` from build context. Directly relevant to the worker-hygiene incident ([#1023](https://github.com/reverb256/quill/issues/1023)); merge.
- **[#1018](https://github.com/reverb256/quill/pull/1018)** — bench index-dir clear. Small correctness fix.
- The rest of the dependabot PRs (#1017, #1016, #1015, #1014, #1013, #1012, #1011, #1010, #1008, #966, #965, #960) are routine dependency bumps; batch-merge per normal cadence.

---

## 5. Cross-reference with gaps surfaced in this thread's prior passes

- **GAP-12 residual (this thread):** `ClaimBundle.quality` is now wired via `buildClaimBundle` → provenance score, exposed on `get_citation`, `GET /v1/claims/verify/:hash`, and (newly) `GET /v1/claims/latest`. But the score is **provenance-only**. The `FreshnessScore` and `CompletenessScore` types in `quality/types.ts` exist and are unused. **→ [#839](https://github.com/reverb256/quill/issues/839) + the freshness/completeness extension.** This is the single highest-value trust differentiator and it's mostly code-existing.
- **search_* wrapper labeling (GAP-11, [#838](https://github.com/reverb256/quill/issues/838)):** deferred to Tier 3 — enablement/polish, not revenue-blocking.
- **registerCitation quality consistency (this thread):** closed by the `buildClaimBundle` delegation in `get-citation.ts`. No longer a gap.
- **Portal zero tests (this thread, [#897](https://github.com/reverb256/quill/issues/897)):** prioritized Tier 1 — it pins the #890/#891 customer-facing behaviors.
- **CI hang + gate false-green (this thread, [#996](https://github.com/reverb256/quill/issues/996)/[#1032](https://github.com/reverb256/quill/issues/1032)):** prioritized Tier 2 — burned runner-hours and a gate that passed while hung are reliability risks that matter at revenue.

---

## 6. Do not do yet

1. **x402 Phase 2/3 as a revenue gate.** Stripe subscriptions are the chosen rail. x402 is complementary; don't let Solana verification work block Stripe go-live.
2. **AI Ask (#268) / LLM fine-tuning (#318).** Large, PRD-needed, not a first-revenue enabler.
3. **150-module coverage before first paying customer.** The MVP is one end-to-end workflow, not a complete library.
4. **Public flip (#854 history rewrite) as a prerequisite for taking $50.** You can take money before the repo is fully public — but don't flip public with keys in history. Keep these as parallel tracks with their own owners/decisions.
5. **Invoice generation / full accounting tooling.** [#814](https://github.com/reverb256/quill/issues/814) explicitly lists this as follow-up, not a go-live gate.
6. **A second payment surface (donations, Interac) before Stripe converts.** Don't add payment rails before the primary one works.

---

*Document source:* grounded in `docs/GAP-MAP.md`, `docs/VISION.md`, `ROADMAP.md`, `GATES-gaps-20260922.md`, `AGENTS.md`, the open GH issues/PRs as of this writing, and the gaps surfaced in this thread's prior exploration passes. Not a substitute for counsel on the legal/financial items (#804, #811, #854) — those need j_kro + qualified counsel decisions.

---

## 7. First task to attack now (from this plan)

Use the [go-live runbook](../go-live-runbook.md) as the single billing evidence record.
Its [next verification gates](../go-live-runbook.md#next-verification-gates) define the remaining work.

The smallest application task is isolated expiry authentication and downgrade verification,
followed by Helm-owned scheduling. Keep operator security action, production rollout approval,
and live-payment approval separate. Documentation repair grants none of those approvals.

Do not build x402 settlement, the three-axis quality model, or new ingestion in this task.
