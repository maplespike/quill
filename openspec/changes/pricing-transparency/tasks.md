# tasks — pricing-transparency

## 1. Rate card

- [ ] 1.1 Add `operations` block to `generate-plans.mjs` output: `{ id, label, weight }` for default lookup/search, cross-source, analysis/AI
- [ ] 1.2 `GET /v1/pricing/operations` — public, cached, reads `plans.json`
- [ ] 1.3 Weight lookup helper shared by estimate endpoint and cost echo

## 2. Estimate + echo

- [ ] 2.1 `POST /v1/pricing/estimate` — validates operation id, returns `{operation, calls}`; 400 on unknown operation
- [ ] 2.2 `meta.cost` echo on responses whose operation weight > 1
- [ ] 2.3 Negative controls: unknown operation rejected; estimate is side-effect free (no counter increment)

## 3. Surfaces

- [ ] 3.1 Pricing page renders the rate card table from `plans.json`
- [ ] 3.2 `generate-llms.mjs` adds `/v1/pricing/operations` pointer
- [ ] 3.3 docs/SAAS-TIERING.md links the rate card

## 4. Verification

- [ ] 4.1 Estimate matches executed call weight for a sample operation (fixture test)
- [ ] 4.2 Public rate card matches `plans.json` byte-for-byte on weights
- [ ] 4.3 OpenSpec change validated and archived after implementation
