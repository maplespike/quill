## ADDED Requirements

### Requirement: Per-source ingest outcomes are recorded and surfaced

Every scheduled ingestion run SHALL record, for each upstream source it attempted, an outcome of `ok` (records parsed), `empty` (reachable, zero records), or `error` (fetch/parse failure with reason), and `GET /v1/ingest/status` SHALL expose those per-source outcomes per pipeline.

#### Scenario: Source failure is visible without pod logs

- **GIVEN** a pipeline run where a source fetch returned 404
- **WHEN** the run completes and the run row is written
- **THEN** the run row SHALL carry a `sources` entry with `status: "error"` and the HTTP status in `error`
- **AND** `GET /v1/ingest/status` SHALL show that source with `status: "error"` for the pipeline

#### Scenario: All sources erroring cannot report success

- **GIVEN** a pipeline run where every source errored
- **WHEN** the runner classifies the run
- **THEN** the run status SHALL be `failed` with the aggregated source errors
- **AND** the pipeline SHALL appear in `stalePipelines`

### Requirement: Zero-record successes must be declared

A run that reports zero records with `status: "success"` SHALL carry a declared zero reason (e.g. `no-new-records-since-last-run`); a zero-record run with no declared reason SHALL be classified `failed` with error `zero-records-without-declared-reason`.

#### Scenario: Legitimate quiet upstream

- **GIVEN** a module whose every source answered `ok` but parsed zero new records
- **WHEN** the run completes
- **THEN** the run status SHALL be `success` with `zeroReason: "no-new-records-since-last-run"` recorded on the run row and surfaced by `/v1/ingest/status`

#### Scenario: Silent collector failure fails the run

- **GIVEN** a module that returns a count-shaped result of zero with no source outcomes and no declared reason
- **WHEN** the runner classifies the run
- **THEN** the run status SHALL be `failed` with error `zero-records-without-declared-reason`

### Requirement: Skips and module-reported failures are never successes

A run that was skipped (upstream health-check refusal) or whose module result reports `success: false` or an `error` SHALL be classified `failed` with that reason, never `success`.

#### Scenario: Health-check skip

- **GIVEN** a module whose registry `healthCheckUrl` probe fails
- **WHEN** `runModule` returns `{skipped: true, reason}`
- **THEN** the run status SHALL be `failed` and the error SHALL contain the skip reason

### Requirement: Record counts reflect module count verbs

The runner's record counting SHALL read the count verbs the scheduled modules actually emit (`meetingsIngested`, `reportsIngested`, `recordsIngested`, `actorsFound`, `connectionsFound`, `fundingFlowsFound`, and the `*Found` discovery verbs), so a working run no longer reports `records=0`.

#### Scenario: Committees full run counts its meetings

- **GIVEN** a committees result shaped `Record<acronym, {meetingsIngested: 3, interventionsIngested: 40, …}>`
- **WHEN** the runner counts records
- **THEN** the count SHALL be the sum of the ingested verbs, greater than zero

### Requirement: The three dead realtime sources are repaired

The realtime pipeline SHALL fetch ECCC weather alerts from the GeoAPI items endpoint (`api.weather.gc.ca/collections/weather-alerts/items`), border wait times from the CBSA HTML table (`#bwttaf`), and SHALL address the AMQPS broker at `dd.weather.gc.ca` — not the dead `q.weather.gc.ca` host or the dead flat CAP index and JSON endpoints.

#### Scenario: ECCC alerts via GeoAPI

- **GIVEN** the GeoAPI weather-alerts collection is reachable
- **WHEN** the realtime pipeline fetches alerts
- **THEN** it SHALL parse the GeoJSON features into realtime records and the source outcome SHALL be `ok` when features return

#### Scenario: CBSA HTML table parsing

- **GIVEN** the CBSA menu page serves the `#bwttaf` table
- **WHEN** the realtime pipeline fetches border wait times
- **THEN** it SHALL parse one record per `<tr>` crossing row and the source outcome SHALL be `ok` when rows parse

#### Scenario: AMQPS broker address

- **GIVEN** the AMQPS subscription is enabled
- **WHEN** the subscriber connects
- **THEN** it SHALL connect to `dd.weather.gc.ca` with the documented anonymous credentials and the `q_anonymous.*` queue convention
- **AND** a connection failure SHALL surface as an `error` source outcome, not a silent fallback
