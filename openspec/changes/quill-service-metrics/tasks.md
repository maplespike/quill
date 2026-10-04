## 1. API Metrics

- [x] 1.1 Add bounded API request counters and duration histograms
- [x] 1.2 Add a private API metrics listener and reject public `/metrics`
- [x] 1.3 Label requests with route templates and normalize methods, status classes, and durations

## 2. MCP Metrics and Logging

- [x] 2.1 Add bounded MCP tool outcome counters and handler duration histograms
- [x] 2.2 Add a private MCP metrics listener and reject public `/metrics`
- [x] 2.3 Preserve MCP thrown-error response text while logging only bounded error type fields

## 3. Ingestion Freshness

- [x] 3.1 Export latest successful run separately from the latest run
- [x] 3.2 Expose allowlisted ingestion freshness and latest-run gauges
- [x] 3.3 Test freshness after a newer failed run

## 4. Kubernetes Monitoring

- [x] 4.1 Add dedicated chart metrics ports, ClusterIP Services, and monitoring-only ingress policy
- [x] 4.2 Add VMServiceScrape and public endpoint probes
- [x] 4.3 Add Quill health/error/latency alerts and align the existing MCP Grafana dashboard with the bounded `outcome` metric label
- [x] 4.4 Validate VMServiceScrape `jobLabel` and VMProbe fields against the VictoriaMetrics operator API, and parse the source manifests (live CRD admission remains unverified)

## 5. Documentation and Verification

- [x] 5.1 Document metrics, dashboard, VictoriaLogs query examples, retention, and journald scope
- [x] 5.2 Add static media-k8s checks for YAML and embedded dashboard JSON
- [x] 5.3 Run pipeline-core build, API typecheck/full unit suite, and MCP typecheck/focused protocol+metrics suite
- [x] 5.4 Run the pipeline alias/chart contract test
- [ ] 5.5 Run pipeline-core run-log SQLite tests (blocked locally: `better-sqlite3` native binding is unavailable after install with scripts disabled)
- [x] 5.6 Lint and render the production Helm chart; inspect metrics Services and NetworkPolicies
- [ ] 5.7 Run media-k8s pytest static suite (blocked locally: `pytest` and PyYAML are not installed)
- [x] 5.8 Parse media manifests/dashboard and run Python syntax and `git diff --check` validations using available local tools

## Verification Notes

- Pipeline-core build passed. API typecheck passed; API unit suite passed on final rerun (526 tests).
- MCP typecheck passed; focused protocol and metrics suite passed (15 tests).
- Pipeline-core TypeScript build and chart alias contract passed (4 tests). The API metrics test verifies every canonical CLI alias against the fixed API metrics allowlist, avoiding a runtime CLI import.
- The run-log test command executed, but its SQLite-backed cases could not pass because this worktree has no compiled `better-sqlite3` binding. The failure is an environment prerequisite, not a passing test result.
- Helm lint passed with one informational icon recommendation; render produced 27 resources. The two metrics Services are ClusterIP, and the dedicated NetworkPolicy allows only monitoring-namespace ingress to ports 9464/9465. Metrics ports are absent from the broad intra-namespace policy.
- Ruby parsed all six media YAML documents and the embedded dashboard JSON. Assertions covered the VMServiceScrape selector/job label, three probes, ten alert rules including missing individual probe detection, eleven dashboard panels, and CronJob owner join. Python source syntax also passed.
- `git diff --check` passed in both repositories. The media pytest suite remains unrun because its Python dependencies are unavailable.
- No live VictoriaMetrics CRD admission test or cluster deployment was performed.
