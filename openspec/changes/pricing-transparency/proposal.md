# pricing-transparency

## Why

Quill sells tier totals, not prices. A buyer cannot answer "what will this job cost?" before running it, and no per-operation rate card exists (competitive audit, 2026-09-16: Enigma publishes a credit table and pre-run estimates; OpenCorporates publishes plain annual pricing; Quill's own plans.json carries limits but no operation costs). Decision 0008 fixed the policy: keep the tier ladder and the calls unit, publish the rate card, add pre-run estimates. This change implements that policy.

## What Changes

- **Rate card endpoint**: `GET /v1/pricing/operations` (public) — operation categories and their call weights (default lookup/search 1; cross-source/cross-reference 2; analysis/AI 5), generated from a new `operations` block in `plans.json`.
- **Pre-run estimate**: `POST /v1/pricing/estimate` — `{operation, params}` → estimated calls; cheap, no side effects; safe for agents to call before expensive work.
- **Per-response cost echo**: operations with weight > 1 return `meta.cost` (calls) in the response envelope so agents can see what they paid.
- **Surface the table**: pricing page renders the rate card from `plans.json`; `generate-llms.mjs` adds a pointer to `/v1/pricing/operations`.
- **No metering change**: existing meters continue to count calls; weights are advisory pricing language until they need to become enforcement (separate future change).

## Impact

- Affected specs: `pricing-transparency` (new capability)
- Affected code: `packages/api-server/src/routes/billing*` (two read-only endpoints), `packages/portal/scripts/generate-plans.mjs` (`operations` block), `packages/portal/src/pages/pricing` (render), `packages/portal/scripts/generate-llms.mjs` (pointer)
- Depends on: Decision 0008; nothing else in flight
- Not in scope: credit reform, tier repricing, usage-based invoicing changes
