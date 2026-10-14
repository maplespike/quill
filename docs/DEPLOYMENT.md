# Deployment Guide

> **Local development:** Docker Compose via `scripts/dev-up.sh` (this guide).
> **Production:** Nix-generated K8s manifests (`nix build .#saas-manifests` → `kubectl apply -f result/manifests.yaml`) + Cloudflare Tunnel expose `*.maplespike.ca` on the single-node k3s cluster (`nexus`). See `docs/K8S-NIX-MANIFESTS.md` and `docs/deploy-to-k3s.md`.

## Current Deployment: Docker Compose

MapleSpike runs locally using Docker Compose with three main services:

### Services

| Service | Port | Description |
|---------|------|-------------|
| **API Server** | 8082 | REST API with Bearer auth, rate limiting |
| **MCP Server** | 3001 | Model Context Protocol server (stdio/SSE) |
| **Portal** | 8080 | Developer portal and documentation (Astro static + `server.py`) |

### Quick Start

The preferred recipe lives in the repo-root README under **Running the local development stack & smoke test**. Use the wrapper scripts instead of raw `docker compose`:

```bash
# Build all packages (host-side; image build also runs pnpm install internally)
pnpm run build

# Bring the stack up — auto-bootstraps .env, builds images, waits for /v1/health
./scripts/dev-up.sh

# Or detached (return immediately; useful in tmux or CI)
./scripts/dev-up.sh --detach

# Tail logs of a running stack
./scripts/dev-up.sh --logs

# Tear back down (--down removes containers + orphans; .env is preserved)
./scripts/dev-up.sh --down
```

Docker Compose v1 (`docker-compose`) is not installed on hosts that ship only the `docker compose` plugin. The wrapper handles v2-vs-v1 dispatch for you.

### Environment Variables

Create a `.env` file in the root directory:

```bash
# API Server
QUILL_API_KEY=maplespike-dev-key
API_PORT=8082

# MCP Server
MCP_PORT=3001

# Portal
PORTAL_PORT=8080
```

### Service-Specific Commands

#### API Server
```bash
# Build and run API server
cd packages/api-server
pnpm build
pnpm run dev  # Starts on http://localhost:8082

# Test API endpoints
curl http://localhost:8082/v1/health
curl -H "Authorization: Bearer maplespike-dev-key" \
  "http://localhost:8082/v1/gov/search?q=housing&limit=5"
```

#### MCP Server
```bash
# Run MCP server (stdio mode)
cd packages/quill-mcp
pnpm start

# Run MCP server (SSE mode for HTTP access)
PORT=3001 pnpm start:sse
# Access at http://localhost:3001/sse

# Test MCP tools via Claude Desktop
# Add to claude_desktop_config.json:
# {
#   "mcpServers": {
#     "maplespike-canada": {
#       "command": "node",
#       "args": ["/absolute/path/to/quill/packages/quill-mcp/dist/cli.js"]
#     }
#   }
# }
```

#### Portal
```bash
# Build and run portal
cd packages/portal
pnpm run dev  # Astro dev server (hot reload) on http://localhost:4321

# Access documentation
open http://localhost:8080  # when served via ./scripts/dev-up.sh
```

### Development Workflow

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Build all packages:**
   ```bash
   pnpm run build
   ```

3. **Run tests:**
   ```bash
   pnpm test
   ```

4. **Start services:**
   ```bash
   ./scripts/dev-up.sh
   ```

5. **Make changes and restart:**
   ```bash
   # After making code changes
   pnpm run build
   ./scripts/dev-up.sh --rebuild   # force full image rebuild
   ```

### Troubleshooting

#### Port Already in Use
```bash
# Check what's using the port
lsof -i :8082  # API server
lsof -i :3001  # MCP server
lsof -i :8080  # Portal

# Change ports in docker-compose.yml or .env file
```

#### Database Issues
```bash
# Reset database (container + named volume for the API's SQLite db)
./scripts/dev-up.sh --down
./scripts/dev-up.sh
```

#### Build Failures
```bash
# Clean and rebuild
pnpm run clean
pnpm run build
./scripts/dev-up.sh --rebuild         # rebuilds containers --no-cache
```

## Production K8s Deployment (LIVE)

The production cluster is a **single-node k3s** on `nexus` (NixOS 26.11, k3s v1.36.1). The canonical deploy path is Nix-first — there is no `k8s/base/` (that path was retired; the reference manifests live in `k8s/maplespike/` and are kept in lockstep with the Nix generator):

```bash
# Generate the single manifest bundle from Nix (source of truth)
nix build .#saas-manifests -L

# Sync the cluster to it
kubectl apply -f result/manifests.yaml

# Or one-shot
nix run .#deploy-saas
```

The bundle contains 14 resources: `maplespike` + `ai-inference` + `cloudflared` namespaces, the canonical Calico GNP (`k8s/gnp-default-deny.yaml`, read via `builtins.readFile` — includes TCP+UDP 7844 for the cloudflared edge), the `cloudflared` Deployment + ConfigMap (2 replicas, protocol http2, **pinned ClusterIP upstreams** — see below), the three service Deployments + pinned-ClusterIP Services, and a LAN Traefik Ingress.

Key operational facts (2026-08-10):

- **Image tags are pinned per service in `flake.nix`** (`apiTag`/`mcpTag`/`portalTag`), NOT `latest`. The cluster's `deny-latest-tag-deployments` ValidatingAdmissionPolicy rejects `:latest`. Push new images operator-side with `nix run .#push-images` before applying.
- **All Deployments carry `securityContext`** (`runAsNonRoot: true`, `runAsUser/Group: 1001`, `allowPrivilegeEscalation: false`) — required by the `require-resources-and-security-deployments` admission policy.
- **Cloudflared upstreams are literal pinned ClusterIPs**, NOT DNS names — cloudflared's Go resolver NXDOMAINs `*.svc.cluster.local`, which regresses the tunnel to edge 502s.
- `cloudflared` runs in its own `cloudflared` namespace (label `app.kubernetes.io/name: cloudflared` gates API NetworkPolicy ingress).

See `docs/deploy-to-k3s.md` for the from-scratch walkthrough. CI enforces manifest correctness in `.github/workflows/nix-build.yml` (job `saas-manifests`) and deploys via `.github/workflows/deploy-prod.yml`.

## Monitoring and Logs

### Docker Compose Logs
Use the wrapper, which knows the correct service names:

```bash
# All services (tails all compose logs)
./scripts/dev-up.sh --logs

# Specific service (raw docker compose, once you've identified the container name)
docker compose logs -f api
docker compose logs -f mcp
docker compose logs -f portal
```

### Health Checks
```bash
# API server health
curl http://localhost:8082/v1/health

# MCP server health (if available)
curl http://localhost:3001/health

# Portal health
curl http://localhost:8080/
```

### Production metrics and logs (k3s)

The chart runs API metrics on `9464` and hosted MCP metrics on `9465`. Each
service has a dedicated ClusterIP Service. The public API and MCP listeners
return 404 for `/metrics`. NetworkPolicy allows scrape ingress only from the
`monitoring` namespace. Do not add a public ingress or NodePort for these ports.

The media-k8s `monitoring-rules` ArgoCD app manages the VMServiceScrape,
public HTTP probes, Quill alerts, and Grafana dashboard. The dashboard is
named **Quill Services**. It shows API request rate/latency/5xx, MCP tool
outcomes/latency, public probes, failed ingestion jobs, and last-success age.
Deployment requires the normal GitOps review and a separate operator sync.

VictoriaLogs retains Kubernetes container logs for 7 days and caps storage at
8 GiB. `vlagent` collects container logs from Kubernetes pods; it does not
collect host journald. Use kubectl or the host journal for logs that only exist
in journald. Do not put credentials, request bodies, customer IDs, or raw
secrets into log fields.

Example LogsQL queries in the Grafana VictoriaLogs Explore view:

```text
_time:5m error service:quill-api
_time:5m error service:quill-mcp
_time:1h service:quill-api | sort by (_time) desc | limit 20
kubernetes.pod_namespace:maplespike service:quill-mcp
```

Filter by `kubernetes.pod_name` to narrow a result to one pod. The Pino
services emit structured JSON; VictoriaLogs can search the message and parsed
fields. Avoid logging API keys, bearer tokens, query payloads, or tenant data.

## Production Considerations

When moving to production:

1. **Security**
   - Use strong API keys (not `maplespike-dev-key`)
   - Enable HTTPS/TLS
   - Implement proper authentication
   - Set up firewall rules

2. **Performance**
   - Use proper database sizing
   - Enable caching layers
   - Configure rate limiting
   - Set up load balancing

3. **Monitoring**
   - Use the existing VictoriaMetrics, VictoriaLogs, and Grafana stack
   - Keep `/metrics` private on the dedicated metrics ports
   - Use Quill Services dashboard and Quill service-health alerts
   - Monitor resource usage and review the documented journald collection gap

4. **Backup**
   - Regular database backups
   - Configuration version control
   - Disaster recovery plan

## Next Steps

- See `ROADMAP.md` for deployment phases
- Review `packages/docs/guide/` for API documentation
- Check `packages/docs/api/` for endpoint details
- Monitor `docs/STALE-CONTENT-SUMMARY.md` for outstanding issues