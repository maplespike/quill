# Proposal: Ingest truthfulness — per-source outcomes, declared zeros, and dead-source repair (GH#921)

## Problem

Measured 2026-09-23 from production (`/v1/ingest/status` plus the CronJob logs),
5 of 7 scheduled pipelines report `status=success` with `records=0`, and the
`realtime` pipeline logs concrete upstream failures (403/404/ENOTFOUND) while
still reporting success. Nothing alerts on either condition, because the run
log records only `(pipeline, status, records, claims)` and the status route
classifies solely on freshness and failure.

Three independent defects hide behind that green signal:

1. **`countRecords()` cannot see the five scheduled modules' count verbs.**
   `committees` returns `Record<acronym, {meetingsIngested, interventionsIngested, …}>`,
   `oversight` `Record<body, {reportsIngested, …}>`, `gazette` `Record<part, {recordsIngested, …}>`,
   `corporate` `Record<source, {recordsIngested, …}>`, `influence` `{actors: {actorsFound, …}, funding: {…}}`.
   The recursive dictionary branch sums only `records|results|items|data` arrays
   and `count|recordsCount|total|recordsIngested|inserted|processed` numeric
   fields — none of `meetingsIngested`, `reportsIngested`, `recordsIngested`
   (on the *child* level, where corporate/gazette carry it), `actorsFound`,
   `connectionsFound`, `fundingFlowsFound`, `reportsFound`, `recommendationsFound`,
   `meetingsFound`, `speakersFound`, `recordsFound` are read. So a full working
   run of `committees` that persisted 41 claim bundles reports `records=0`.
   The claims count proves data flowed; the records count says nothing did.

2. **A health-check skip is recorded as success.** `runModule()` short-circuits
   an upstream that fails its `healthCheckUrl` probe with `{skipped: true,
   reason}`; `runOne()` treats that as a normal result, counts 0 records, and
   writes `status=success`. The same holds for module results carrying
   `success: false` (21 modules emit it on HTTP failure) — the runner's
   uncommitted guard covers `error` strings only, and no test pins it.

3. **Per-source fetch failures are invisible.** `real-time-feeds`' `fetchText()`
   swallows every 403/404/ENOTFOUND into `[]`; `errors[]` collects only promise
   *rejections*, which the fetchers never produce. The result envelope carries
   `sourcesAttempted`/`sourcesSucceeded`/`errors`, but `runOne()` drops all
   three when it counts records, and `ingest_runs` has no columns to store them.

Behind all three sit **dead upstreams** (live-probed 2026-09-23):

- ECCC flat CAP index `dd.weather.gc.ca/alerts/cap/cap_01_alert_index.xml` → 404.
  The datamart restructured to date-stamped directories; the replacement
  surface is the GeoAPI `https://api.weather.gc.ca/collections/weather-alerts/items`
  (verified: 200, `numberMatched: 136`).
- CBSA border-wait JSON `cbsa-asfc.gc.ca/bwt-taf/bwt_taf-eng.json` → 404. The
  HTML table `menu-eng.html` still serves the same data (verified: 200, 29 rows).
- MSC AMQPS host `q.weather.gc.ca` → NXDOMAIN. The broker moved to
  `dd.weather.gc.ca:5671` (port verified open; anonymous credentials and the
  `q_anonymous.*` queue convention verified against the MSC docs and live).

## Proposed change

Four layers, so a silent collector failure can no longer report success:

1. **Per-source outcomes in the result envelope and the run log.**
   `real-time-feeds`' fetchers stop swallowing failures: each source returns
   `{records, error}`; `fetchAllRealtime()` aggregates into per-source
   `SourceOutcome[]` (`{source, status: 'ok'|'error'|'empty', records, error}`),
   and the module result carries `sources: SourceOutcome[]` plus the existing
   `sourcesAttempted`/`sourcesSucceeded`. `ingest_runs` gains `sources_json`
   (nullable TEXT, migration-safe like the run log's own DDL) and
   `RecordIngestRunInput`/`IngestRunRecord` gain `sources`. `runOne()` extracts
   the outcome list from any module result (generic: `sources` array of objects
   with `source`/`status`/`records`/`error`), stores it, and feeds it into the
   zero-records classification.

2. **Declared-zero / record-floor classification at the runner.**
   `runOne()` classifies a run whose counted records is 0:
   - `skipped` (health-check skip) → status `failed` with the skip reason;
   - module result `success: false` or `error` string → status `failed`;
   - every source errored → status `failed` with the aggregated errors;
   - sources ok but 0 records → status `success` **only with** a declared
     `zeroReason` (e.g. `no-new-records-since-last-run`), else `failed` with
     `zero-records-without-declared-reason`. The declared-zero state is stored
     in `sources_json` so `/v1/ingest/status` can show it.

3. **Surface per-source outcomes in `/v1/ingest/status`.**
   `IngestPipelineStatus` gains `sources: SourceStatus[]` (`{source, status,
   records, error}`) and `zeroReason: string | null`; the payload builder maps
   them from `sources_json`. A pipeline whose sources are all-error is
   `stale`-classified exactly like a failed run (its `stale` flag is true), so
   the existing health script alerts on it without modification.

4. **Repair the three dead sources (evidence-first, verified live).**
   - ECCC alerts: fetch from the GeoAPI items endpoint (JSON; alert properties
     map to `RealtimeRecord`), keep the AMQPS push path as an enhancement.
   - CBSA: parse `menu-eng.html`'s `#bwttaf` table (29 crossings) instead of
     the dead JSON.
   - AMQPS: host `dd.weather.gc.ca`, credentials `anonymous:anonymous`, queue
     `q_anonymous.subscribe.quill.<uniq>` bound to exchange `xpublic` with
     topic `v02.post.*.WXO-DD.alerts.cap.#` (sarracenia convention, verified
     live: connect + bind succeed).

## Affected packages

- `packages/pipeline-core` (real-time-feeds fetchers/types, run-log schema,
  run-pipeline runner, registry-snapshot untouched) — module count unchanged.
- `packages/api-server` (ingest-status route payload) — no new endpoints.
- No MCP tool changes; no portal changes.

## Out of scope

- Fixing the other ~20 modules that emit `success: false` (the runner's
  classification catches them generically; per-module source repair is
  follow-up work).
- AMQPS message parsing (the capture probe runs during this change; wiring the
  push path into records is follow-up).
- The `alert-ready`, `eccc-weather-observations`, `eccc-aqhi`,
  `water-survey-flood` sources declared in `REALTIME_SOURCES` but never
  fetched — surfacing them as `empty` sources is included; fetching them is
  follow-up.
