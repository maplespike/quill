## ADDED Requirements

### Requirement: Each service probes a cheap health path
The rendered chart MUST probe quill-api at `/v1/health`, quill-mcp at `/health`, quill-search at `/health`, and quill-portal at `/health`. API, MCP, and search MUST set a startupProbe. Portal MUST NOT set a startupProbe. No probe MUST use `/sse`, `/mcp`, or `/v1/search`.

#### Scenario: Helm render
- **Given** `helm template` renders `charts/quill` with `values-prod.yaml`
- **When** the probe gate reads each Deployment
- **Then** the paths and startupProbe presence match this requirement
- **And** each `timeoutSeconds` is greater than 0 and lower than `periodSeconds`
