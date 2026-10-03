## ADDED Requirements

### Requirement: Private metrics exposition
The API and hosted MCP services SHALL expose Prometheus-format metrics only on dedicated metrics listeners and SHALL NOT expose metrics through their public request listeners.

#### Scenario: Scrape a service metrics listener
- **WHEN** a monitoring client sends `GET /metrics` to the configured API or MCP metrics port
- **THEN** the service SHALL return Prometheus text exposition with the appropriate content type
- **AND** any other path or method on that listener SHALL return 404

#### Scenario: Metrics remain private
- **WHEN** a client requests `/metrics` through the API or MCP public listener
- **THEN** the request SHALL return 404
- **AND** the chart SHALL expose metrics through ClusterIP Services and allow ingress only from the monitoring namespace

### Requirement: Bounded service metrics
The API and MCP services SHALL emit counters and duration histograms using bounded, non-sensitive labels.

#### Scenario: API request completes
- **WHEN** an API request completes, including a rate-limited or failed request
- **THEN** it SHALL increment one request counter and observe one finite duration
- **AND** its route label SHALL be a registered route template or `unmatched`
- **AND** method and status labels SHALL use bounded normalized values

#### Scenario: MCP tool call completes
- **WHEN** a registered MCP tool call succeeds, fails, or is rejected
- **THEN** the service SHALL increment exactly one outcome counter for the registered tool
- **AND** handler outcomes SHALL observe a finite duration
- **AND** unknown tool names SHALL map to `unregistered`

#### Scenario: Sensitive input is present
- **WHEN** a request or tool call contains customer IDs, tokens, query text, arguments, or error details
- **THEN** those values SHALL NOT appear in metric labels or metric exposition

### Requirement: Ingestion freshness gauges
The API metrics exposition SHALL report the latest run outcome and the last successful run timestamp separately for each known pipeline.

#### Scenario: Latest run fails after an earlier success
- **WHEN** a pipeline has a successful run followed by a failed run
- **THEN** `quill_ingest_last_run_success` SHALL report zero
- **AND** `quill_ingest_last_success_timestamp_seconds` SHALL retain the timestamp of the earlier successful run

#### Scenario: Pipeline label is unknown
- **WHEN** a run-log row has an unknown pipeline name
- **THEN** it SHALL be excluded from the metrics exposition
