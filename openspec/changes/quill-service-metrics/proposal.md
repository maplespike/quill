## Why

Quill has structured service logs but no bounded request/tool metrics. The existing VictoriaMetrics, VictoriaLogs, and Grafana stack can provide service health and operational visibility without adding a third-party service.

## What Changes

- Add private Prometheus-format metrics listeners for the API and hosted MCP services.
- Track bounded API route/status/duration metrics, MCP tool outcome/duration metrics, and ingestion-run freshness.
- Add dedicated ClusterIP Services and narrowly scoped monitoring ingress rules.
- Add VictoriaMetrics scrape/probe/alert rules and a Grafana dashboard through the existing media-k8s GitOps repo.
- Keep logs structured and remove customer-controlled errors, identifiers, and payloads from operational log fields.
- Document metric access, dashboard/log queries, retention, and the current journald collection boundary.

## Capabilities

### New Capabilities
- `service-metrics`: Private and bounded Quill API/MCP metrics and ingestion freshness.
- `service-observability`: Scraping, public endpoint probes, alerts, dashboard, and log operations through existing monitoring infrastructure.

### Modified Capabilities
- None.

## Impact

- Quill API and MCP server packages, ingestion run-log exports, Helm chart templates/values, the existing MCP Grafana dashboard, and deployment documentation.
- `reverb256/media-k8s` monitoring-rules manifests and static monitoring tests.
- No new runtime dependency, public endpoint, cluster deployment, or external monitoring service.