# Learnings — Issue #208 AMQPS subscriber

- `amqplib` `connect()` returns `Promise<ChannelModel>`, not `Promise<Connection>`.
  - `ChannelModel` has `.connection` (property), `.createChannel()`, `.close()`.
  - The callback API (`callback_api.d.ts`) has a different `Connection` with callback-style methods — avoid confusing with promise API.
- `ConsumeMessage` extends `Message` — use `ConsumeMessage` type for consume callback parameter.
- `@types/amqplib@0.10.8` installed automatically (satisfies `^0.10.7` range).
- Build: `tsc -b` with `strict: true` enforces proper import/type usage — no `any` escapes allowed.
- Dual-path pattern: AMQPS push cache checked first, HTTPS polling as fallback. Cache TTL matches existing `REALTIME_CACHE_TTL_MS`.
- `ensureAmqpsSubscription()` uses singleton promise pattern — idempotent, race-condition-safe.
