## 1. Run log schema (pipeline-core)

- [x] 1.1 `run-log.ts`: add `sources_json TEXT` column (nullable, in-place `ALTER TABLE` migration) + `SourceOutcome`/`RunSources` types; `RecordIngestRunInput`/`IngestRunRecord` gain `sources`; write/read round-trip
- [x] 1.2 `run-log.test.ts`: pin the new column round-trip and backward compat (old rows read with `sources: null`) + the pre-sources table migration

## 2. Runner classification (pipeline-core)

- [x] 2.1 `run-pipeline.ts` `countRecords()`: read the module count verbs (`meetingsIngested`, `reportsIngested`, `recordsIngested`, `actorsFound`, `connectionsFound`, `fundingFlowsFound`, `*Found` discovery verbs) on every dictionary level
- [x] 2.2 `run-pipeline.ts` `runOne()`: extract `sources` from module results; classify `skipped` / `success:false` / `error` / all-sources-error / undeclared-zero as `failed`; declared zero stays `success` with `zeroReason` recorded in `sources`
- [x] 2.3 `run-pipeline.test.ts`: regression tests for every classification branch (the issue's ask: a test that fails when a collector reports success with zero records and no declared reason)

## 3. Realtime source repair (pipeline-core)

- [x] 3.1 `real-time-feeds/constants.ts`: GeoAPI alerts URL, CBSA HTML URL, AMQPS `dd.weather.gc.ca` + anonymous credentials + `q_anonymous.*` queue + `xpublic`/`v02.post` conventions
- [x] 3.2 `real-time-feeds/fetcher.ts`: fetchers return `{records, error}` per source; ECCC via GeoAPI JSON; CBSA via `#bwttaf` HTML table; `fetchAllRealtime()` aggregates `SourceOutcome[]`
- [x] 3.3 `real-time-feeds/amqps-subscriber.ts`: new host/credentials/queue/exchange; connection failure surfaces as error outcome
- [x] 3.4 `real-time-feeds` tests: parse-shape tests for GeoAPI JSON and CBSA HTML (fixture-based, no network)

## 4. Status route (api-server)

- [x] 4.1 `ingest-status.ts`: `IngestPipelineStatus` gains `sources` and `zeroReason`; map from `sources_json`; all-error sources force `stale: true`
- [x] 4.2 `ingest-status.test.ts`: pin the new fields and the all-error → stale classification

## 5. Verification

- [x] 5.1 `pnpm --filter @maplespike/pipeline-core build && test` — 1149 pass / 0 fail
- [x] 5.2 `pnpm --filter @maplespike/api-server build && test` — 501 pass / 0 fail; quill-mcp 201/0, engine 112/0, sdk 7/0, notification-service 14/0; full workspace `pnpm build` 13/13
- [x] 5.3 Live smoke: realtime pipeline against real upstreams — 169 records (135 ECCC GeoAPI + 29 CBSA HTML + 5 parole) vs production's 5; AMQPS connect+bind verified against dd.weather.gc.ca
- [x] 5.4 CHANGELOG entry
