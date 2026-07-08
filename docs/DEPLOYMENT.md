# Deployment Guide

> **Local development:** Docker Compose via `scripts/dev-up.sh` (this guide).
> **Production:** K3s manifests in `k8s/base/` + Cloudflare Tunnel expose `*.maplespike.ca`. Production cutover under [ROADMAP.md Phase 4](./../ROADMAP.md); DNS CNAME records tracked under [issue #746](https://github.com/reverb256/maplespike/issues/746).

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
#       "command": "npx",
#       "args": ["@maplespike/quill-mcp"]
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

## Planned K8s Deployment

K8s deployment is planned for ROADMAP.md Phase 3. See:
- `docs/K8S-NIX-MANIFESTS.md` — Planned K8s manifests (Nix-based)
- `k8s/` — K8s configuration files (not currently deployed)
- `ROADMAP.md` — Implementation timeline

**Current Status:** K8s manifests exist but deployment infrastructure was never implemented.

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
   - Implement health checks
   - Set up logging aggregation
   - Configure alerts (planned Phase 6)
   - Monitor resource usage

4. **Backup**
   - Regular database backups
   - Configuration version control
   - Disaster recovery plan

## Next Steps

- See `ROADMAP.md` for deployment phases
- Review `packages/docs/guide/` for API documentation
- Check `packages/docs/api/` for endpoint details
- Monitor `docs/STALE-CONTENT-SUMMARY.md` for outstanding issues