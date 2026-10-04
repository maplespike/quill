## ADDED Requirements

### Requirement: GitOps-managed Quill monitoring
The monitoring configuration SHALL be stored in media-k8s and use the existing VictoriaMetrics, blackbox-exporter, and Grafana stack.

#### Scenario: Metrics services are discovered
- **WHEN** API and MCP metrics Services are healthy in the `maplespike` namespace
- **THEN** VictoriaMetrics SHALL scrape both services at a 30-second interval
- **AND** the resulting jobs SHALL be named `quill-api` and `quill-mcp`

#### Scenario: Public endpoint becomes unavailable
- **WHEN** the public portal, API health route, or MCP health route fails its blackbox probe
- **THEN** VictoriaMetrics SHALL expose the failed probe and a Quill endpoint alert SHALL fire after its configured hold time

#### Scenario: Grafana loads the dashboard
- **WHEN** the monitoring rules app applies the Quill dashboard ConfigMap
- **THEN** Grafana's dashboard sidecar SHALL discover the `grafana_dashboard: "1"` label
- **AND** the embedded dashboard SHALL be valid JSON with API, MCP, endpoint, ingestion-job, and freshness panels

### Requirement: Safe structured logs and operational queries
Quill service logs SHALL remain structured and SHALL not log secrets, customer credentials, customer identifiers, query payloads, or raw untrusted exception text in the observability paths changed by this feature.

#### Scenario: Investigate service errors
- **WHEN** an operator queries VictoriaLogs for recent Quill errors
- **THEN** the operator SHALL be able to filter by the service field and time window
- **AND** Kubernetes pod metadata SHALL remain available for locating the source container

#### Scenario: Retention and collection scope are documented
- **WHEN** an operator reads the Quill deployment guide
- **THEN** it SHALL state VictoriaLogs retention and disk cap
- **AND** it SHALL state that the configured Kubernetes collector does not collect host journald logs
