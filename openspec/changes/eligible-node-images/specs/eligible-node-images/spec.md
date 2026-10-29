## ADDED Requirements

### Requirement: Never-pulled digests exist on every eligible node
Each digest under `images` in `charts/quill/values-prod.yaml` MUST be
present, under its `repo@sha256` name, in the containerd store of every
heavy affinity host. Those hosts are `nexus` and `sentry-agent`. `forge`
MUST NOT be a required host. `deploy-prod` MUST fail before the pin
commit when any digest is missing on any eligible node.

#### Scenario: Portal schedules on sentry-agent
- **Given** `imagePullPolicy` is `Never`
- **And** the portal may schedule on `sentry-agent`
- **When** deploy-prod finishes the image import
- **Then** sentry-agent containerd lists `docker.io/library/quill-portal@<digest>`
- **And** the same is true for api, mcp, ingest, and search

#### Scenario: Plan rejects forge
- **Given** the heavy host list includes `forge`
- **When** the node-image plan runs
- **Then** it exits non-zero

### Requirement: Redis probes tolerate a slow ping
The rendered `quill-redis` Deployment MUST set `timeoutSeconds: 5` on
startup, readiness, and liveness. Liveness MUST set `failureThreshold: 5`.
A startupProbe MUST run `redis-cli ping` before liveness can kill the
container. Requests and limits MUST stay at the cache budget
(`50m`/`64Mi` request, `200m`/`192Mi` limit).

#### Scenario: Helm render
- **Given** `helm template` renders `charts/quill` with `values-prod.yaml`
- **When** the chart probe gate reads the quill-redis Deployment
- **Then** the probe timings match this requirement
