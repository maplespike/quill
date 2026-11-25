## ADDED Requirements

### Requirement: Quill images are registry digests
Each Quill workload MUST run
`registry.registry.svc.cluster.local:5000/quill/<svc>@sha256:<digest>`
with `imagePullPolicy: IfNotPresent`. `<svc>` is api, mcp, portal, ingest,
or search. `imagePullPolicy: Never` MUST NOT appear in the rendered
production chart. The deploy MUST NOT copy images over ssh.

#### Scenario: Helm render
- **Given** `helm template` renders `charts/quill` with `values-prod.yaml`
- **When** the image lines are read
- **Then** each Quill service reference is a digest on that registry host
- **And** no container sets `imagePullPolicy: Never`

#### Scenario: Registry check
- **Given** the pin commit has not been pushed
- **When** deploy-prod queries `GET /v2/quill/<svc>/manifests/<digest>`
- **Then** a missing manifest or a different `Docker-Content-Digest` fails the job

### Requirement: Old registry tags are pruned
deploy-prod MUST delete registry manifests other than the pinned digest and
the five newest tags of each service. The job MUST say that blob space is
freed only by a server-side registry garbage-collect.

#### Scenario: Six old tags
- **Given** a service has more than five tags and one older tag still points
  at the pinned digest
- **When** prune runs with `--keep 5`
- **Then** the pinned digest is kept
- **And** tags outside the five newest, and not the pinned digest, are deleted

### Requirement: Redis probes tolerate a slow ping
The rendered `quill-redis` Deployment MUST set `timeoutSeconds: 5` on
startup, readiness, and liveness. Liveness MUST set `failureThreshold: 5`.
A startupProbe MUST run `redis-cli ping` before liveness can kill the
container. Limits MUST stay `200m`/`192Mi` and maxmemory MUST stay
`128mb`. Request sizes live in `values-prod.yaml`. The historical request
pair (`50m`/`64Mi`) is checked against
`scripts/fixtures/values-prod-redis-budget.yaml`, so a production request
change does not fail this gate.

#### Scenario: Helm render
- **Given** `helm template` renders `charts/quill` with `values-prod.yaml`
- **When** the chart probe gate reads the quill-redis Deployment
- **Then** the probe timings match this requirement
