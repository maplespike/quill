# Deployment Guide

> **⚠️ DEPLOYMENT STATUS:** MapleSpike currently uses **Docker Compose** for local development. K8s deployment is planned for ROADMAP.md Phase 3.

## Current Deployment: Docker Compose

MapleSpike runs locally using Docker Compose with three main services:

### Services

| Service | Port | Description |
|---------|------|-------------|
| **API Server** | 8082 | REST API with Bearer auth, rate limiting |
| **MCP Server** | 3001 | Model Context Protocol server (stdio/SSE) |
| **Portal** | 3000 | Developer portal and documentation |

### Quick Start

```bash
# Build all services
pnpm run build

# Start all services
docker-compose up -d

# Check service health
curl http://localhost:8082/v1/health
curl http://localhost:3000
curl http://localhost:3001/sse

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Environment Variables

Create a `.env` file in the root directory:

```bash
# API Server
MAPLESPIKE_API_KEY=maplespike-dev-key
API_PORT=8082

# MCP Server
MCP_PORT=3001

# Portal
PORTAL_PORT=3000
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
cd packages/mcp-server
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
#       "args": ["@reverb256/mcp-server"]
#     }
#   }
# }
```

#### Portal
```bash
# Build and run portal
cd packages/portal
pnpm run dev  # Starts on http://localhost:3000

# Access documentation
open http://localhost:3000
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
   docker-compose up -d
   ```

5. **Make changes and restart:**
   ```bash
   # After making code changes
   pnpm run build
   docker-compose restart
   ```

### Troubleshooting

#### Port Already in Use
```bash
# Check what's using the port
lsof -i :8082  # API server
lsof -i :3001  # MCP server
lsof -i :3000  # Portal

# Change ports in docker-compose.yml or .env file
```

#### Database Issues
```bash
# Reset database
docker-compose down -v
docker-compose up -d
```

#### Build Failures
```bash
# Clean and rebuild
pnpm run clean
pnpm run build
docker-compose build --no-cache
```

## Planned K8s Deployment

K8s deployment is planned for ROADMAP.md Phase 3. See:
- `docs/K8S-NIX-MANIFESTS.md` — Planned K8s manifests (Nix-based)
- `k8s/` — K8s configuration files (not currently deployed)
- `ROADMAP.md` — Implementation timeline

**Current Status:** K8s manifests exist but deployment infrastructure was never implemented.

## Monitoring and Logs

### Docker Compose Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api-server
docker-compose logs -f mcp-server
docker-compose logs -f portal
```

### Health Checks
```bash
# API server health
curl http://localhost:8082/v1/health

# MCP server health (if available)
curl http://localhost:3001/health

# Portal health
curl http://localhost:3000/health
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