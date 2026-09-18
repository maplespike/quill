# 0008 — Pricing transparency: published operation costs and pre-run estimates

**Status:** ACCEPTED (2026-09-17)
**Date:** 2026-09-17
**Last-reviewed:** 2026-09-17
**Owner:** j_kro
**Driver:** The 2026-09-16 competitive audit found the global data-API benchmark (Enigma, OpenCorporates, Sayari) is priced with a published rate card and, at Enigma, a pre-run cost estimate — while Quill publishes only tier totals (Free 1,000 calls/mo; Pro $50 CAD for 50,000 calls; Business custom) with no per-operation costs and no way to estimate a job before running it. Buyers cannot budget usage; the sales conversation stalls at "it depends."

## Decision

1. **Keep the tier ladder unchanged for now** (Free / Pro $50 / Business). Audit evidence shows the audited local cohort mispriced at both extremes ($9.99/mo unable to fund a company; $5,000/mo single-quote enterprise) while Quill's current shape sits in the unclaimed middle. There is no usage evidence of mispricing — churn it only when 30 days of live usage data exists.
2. **Keep "API calls" as the metering unit.** No credit reform (1¢-style) this cycle — that would silently reprice every tier and require coordinated billing changes. Revisit only as one atomic billing change with migration.
3. **Publish a per-operation rate card** (`GET /v1/pricing/operations`): default lookup/search = 1 call; cross-source/cross-reference reads = 2; analysis/AI operations = 5. Weights become the single ledger for "what does this cost," generated from `plans.json`.
4. **Add a pre-run cost estimate**: `POST /v1/pricing/estimate` maps `{operation, params}` to estimated calls; expensive operations (weight > 1) echo `meta.cost` on their responses so agents see the price they paid.
5. **Copy what works**: Enigma's pattern (credit table + estimate + per-response cost) for the mechanics; OpenCorporates' pattern (plain annual pricing page, no "contact us" maze) for the presentation.

## Consequences

- `plans.json` gains an `operations` block; the pricing page and llms surfaces publish the table; the MCP tool descriptions can cite per-tool weights.
- No existing subscription repriced; no invoice changes.
- Estimation is advisory (weights, not metering): if real compute cost proves a weight wrong, the weight table changes — meters do not.
- New maintenance rule: any tool whose cost weight changes must touch the rate card in the same change (the count-consistency checker pattern extends to weights later).

## Alternatives considered

- **Credit reform (1 credit = 1¢) now** — rejected: repricing without usage data, billing migration cost, zero user-visible benefit before the rate card exists.
- **Tier ladder change** ($49/$199/$999-style repositioning) — deferred: plausible later, but unverifiable today; transparency is strictly additive and ships first.
