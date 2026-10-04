## Context

The API and hosted MCP services already use structured Pino logs. The cluster already runs VictoriaMetrics, VictoriaLogs, Grafana, and blackbox-exporter, managed from `reverb256/media-k8s`. The chart has default-deny NetworkPolicies. The API route table contains parameterized patterns, and ingestion jobs share the run-log database with the API.

## Goals / Non-Goals

**Goals:**
- Add scrapeable API/MCP and ingestion freshness metrics without a new dependency or public endpoint.
- Keep metric cardinality finite and avoid customer-controlled labels.
- Use existing monitoring services and GitOps manifests.
- Improve safe error logging without changing client-visible MCP error text.

**Non-Goals:**
- Deploy or mutate the cluster in this change.
- Collect host journald logs; current vlagent setup collects Kubernetes container logs only.
- Change public API or MCP protocol response contracts.
- Resolve separate legal, licensing, or credential-history decisions.

## Decisions

1. **Separate listener and Service per process.** API listens on 9464 and MCP on 9465, independently of public ports. The chart exposes each through a ClusterIP Service, and a NetworkPolicy permits the monitoring namespace only. Alternative: public `/metrics`; rejected because it leaks service internals and needs edge-auth changes.
2. **Instrument the production Node entry point once.** API metrics are recorded in `dev-server.ts`, the hosted Node HTTP process, not in the shared Worker handler. Route labels derive from the existing registered route regex and named parameter metadata; unmatched routes collapse to `unmatched`. Alternative: normalize raw path segments; rejected because it can retain high-cardinality static or attacker-controlled values.
3. **Use finite MCP tool registry labels.** Metric names are accepted only from registered definitions within a fixed-size allowlist. Invalid durations are normalized and capped. Rejected or unknown tool requests collapse to `unregistered`.
4. **Keep ingestion latest-run and last-success semantics distinct.** The run-log exports a latest-success-per-pipeline query alongside latest-run data, so a failed recent run does not erase the successful freshness timestamp. Only canonical aliases mirrored in the API's fixed allowlist and known registry module names (including `all:<module>`) are exposed as labels. A parity test checks the API allowlist against the canonical CLI alias map; the API does not import CLI code into its runtime dependency graph.
5. **Use media-k8s VictoriaMetrics CRDs.** A VMServiceScrape discovers labeled Quill metrics Services; VMProbes check the public portal/API/MCP health paths; VMRules alert on missing/down targets, errors, latency, and public probes; a ConfigMap feeds Grafana's dashboard sidecar. No new monitoring service or dependency is introduced.
6. **Sanitize logs at changed error boundaries.** Record bounded error types and operation context, not raw exception objects/messages. MCP client-facing `Error: ${message}` remains unchanged for thrown handlers. Broader unrelated application logs remain out of scope for this change.

## Risks / Trade-offs

- [Metrics listeners bind on pod interfaces] → ClusterIP exposure plus namespace-scoped NetworkPolicy limit access; validate rendered Service and policy.
- [Route registry changes can affect metric cardinality] → A fixed route registration cap collapses additional values to `unmatched`; tests pin parameter redaction.
- [PromQL or CRD field mistakes can silently omit monitoring] → Validate `jobLabel` against the operator API, parse all YAML, validate the embedded dashboard JSON, add source-level tests, and confirm live CRD admission during the normal deployment workflow; local work does not have a cluster admission check.
- [Nojournald collection leaves host-only events unseen] → Document this explicit existing gap; do not install host agents as part of this application change.
- [Rollback of dashboard/rules] → Revert the GitOps manifest and chart changes together; no storage schema migration is required.

## Migration Plan

1. Build and test code and render the Helm chart locally.
2. Review Quill and media-k8s changes and merge them through their normal issue/PR workflows.
3. Deployment is a separate operator action through ArgoCD after review; this change does not run it.
4. Roll back by reverting the monitoring manifest and chart commit; metric state is in-memory and disappears on process restart.

## Open Questions

- Host journald collection requires a separate host-side design and authorization.
- External legal and public-launch decisions are outside this monitoring change.
