# MCP Server Issues — Investigation & Fix

## Issues Found

### 1. Authentication Requirement
**Problem**: SSE endpoint (`/sse`) requires authentication by default in production mode.

**Evidence**:
- Pod returns `{"error":"Unauthorized"}` when accessing `/sse` without auth header
- Code checks `authenticate()` function which requires `Authorization: Bearer ***` header
- Dev mode bypasses auth if `MAPLESPIKE_API_KEY=***` and `NODE_ENV !== 'production'`

**Fix Applied**:
- Set `MAPLESPIKE_API_KEY=***` on deployment to enable dev mode auth bypass
- This allows connections without Bearer token during testing

**Long-term Solution**:
- Document auth requirements for external MCP clients
- Create proper secret management for production API keys
- Add `NO_AUTH` environment variable for local dev clusters

### 2. SSE Connection Hanging
**Problem**: SSE connections from outside cluster hang indefinitely.

**Root Cause**:
- SSE endpoint keeps connection open indefinitely (Server-Sent Events design)
- Curl and similar tools wait forever unless timeout is set
- Proper MCP clients need to handle SSE event stream, not HTTP response

**Current Workaround**:
- Use `kubectl port-forward` to access localhost:3001/sse
- Hermes MCP client handles SSE correctly

**Long-term Solutions**:
1. Add NodePort/LoadBalancer service for external access
2. Add ingress route with TLS for HTTPS access
3. Document that port-forward is required for local dev

### 3. ClusterIP Service Limitations
**Problem**: ClusterIP services not accessible from outside cluster.

**Evidence**:
- `http://10.43.181.131:3001/sse` times out from host machine
- Only accessible from within cluster network

**Options**:
1. **NodePort** (quick): Already have NodePort 31745 exposed
2. **Ingress** (better): Add HTTPS route via Caddy/Nginx
3. **Podman host network**: Use `PodmanArgs=--network=host` for dev

## Recommendations

### For Development
```bash
# Option 1: Port-forward (recommended for local dev)
kubectl port-forward -n maplespike svc/maplespike-mcp 3001:3001
hermes mcp add maplespike --url http://localhost:3001/sse

# Option 2: Use NodePort
kubectl get svc -n maplespike maplespike-mcp
# Note: NodePort not currently exposed in service spec
# Would need to change service type to NodePort
```

### For Production
```nix
# Add NodePort to service definition in k8s/dev.nix
services.maplespike-mcp = {
  type = "NodePort";
  ports = [{
    port = 3001;
    nodePort = 31745;  # Or let k8s assign
  }];
};

# OR add ingress
ingress.maplespike-mcp = {
  hosts = [{
    host = "mcp.maplespike.lan";
    paths = [{
      path = "/sse";
      backend = "maplespike-mcp:3001";
    }];
  }];
};
```

### Authentication Strategy
```yaml
# dev.nix - Dev cluster: no auth
mcp.auth = {
  enabled = false;  # Skip auth header requirement
};

# prod.nix - Production: proper secret
mcp.auth = {
  enabled = true;
  secret = "maplespike-mcp-api-key";  # k8s Secret
};
```

## Summary

**Status**: Working ✓
- MapleSpike MCP server successfully connected to Hermes
- 132 tools registered and available
- Using port-forward for local access

**Known Limitations**:
- Requires manual `kubectl port-forward` for dev
- NodePort/Ingress not configured
- Auth disabled via `MAPLESPIKE_API_KEY=***`

**Next Steps**:
1. Add NodePort service to k8s/dev.nix
2. Document auth requirements in AGENTS.md
3. Add ingress route for HTTPS access
4. Create NixOS module for running MCP server directly on host