# Design

One helper, `presentParliamentary`, lives in `packages/pipeline-core/src/shared/parliamentary-public.ts`. Every parliamentary tool calls `presentParliamentaryToolResult`. `applySourcePolicy` calls the same helper for the `committees` and `parliamentary-voting` families, so a later openparliament source-policy wrap can keep using `applySourcePolicy` without a second notice implementation.

`getToolPrice` returns free for the parliamentary name list before the price map. `server.ts` skips `recordCall` when `parliamentaryToolMetersQuota` is false. The API free-tier check calls `isParliamentaryApiPath`. `enforceRateLimit` takes `meterQuota: false` for those paths so the daily and monthly counters neither block nor increment. Burst limits still apply.

Plan copy and the Stripe product description strings in the repo stop listing this content as a paid benefit. This change does not call the Stripe API.

Storage of committee text is unchanged. SEDI is unchanged.
