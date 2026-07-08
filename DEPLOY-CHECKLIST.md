# MapleSpike — maplespike.ca Deployment Checklist

> **Goal:** Get Core MCP live and accepting paying customers.
> **Domain:** maplespike.ca (registered, Cloudflare DNS active)

---

## Step 1: DNS + Tunnel Setup

### 1a. Domain (maplespike.ca)
- [x] Domain `maplespike.ca` registered
- [x] Added to Cloudflare (nameservers updated)
- [x] DNS propagation confirmed (`dig maplespike.ca`)

### 1b. Cloudflare Tunnel (canonical routing)

All `*.maplespike.ca` traffic flows through a single Cloudflare Tunnel
(per ADR 0004). Tailscale Funnel and CF Pages/Workers alternatives are
deprecated.

**Active ingress (cloudflared ConfigMap in K8s):**

```yaml
tunnel: cec1b070-796f-4524-b43e-9b05c32af906
ingress:
  - hostname: maplespike.ca       → portal:8080  (landing page)
  - hostname: www.maplespike.ca   → portal:8080  (alias)
  - hostname: quill.maplespike.ca → portal:8080  (product page)
  - hostname: api.maplespike.ca   → api:8082     (REST API)
  - hostname: mcp.maplespike.ca   → mcp:3001     (MCP SSE server)
  - service: http_status:404      (catch-all)
```

### 1c. DNS Records (Cloudflare)

| Subdomain | Type | Target | Purpose |
|-----------|------|--------|---------|
| `maplespike.ca` | CNAME | tunnel | Portal (landing + docs) |
| `www.maplespike.ca` | CNAME | tunnel | Portal alias |
| `quill.maplespike.ca` | CNAME | tunnel | Quill product page |
| `api.maplespike.ca` | CNAME | tunnel | REST API |
| `mcp.maplespike.ca` | CNAME | tunnel | MCP SSE server |

---

## Step 2: Deploy to K3s

```bash
# 1. Create namespace
#    (auto-created by `kubectl apply -k k8s/base/` via the kustomization
#     `namespace: maplespike` field — the explicit apply was removed
#     2026-07-04 when `k8s/manual/00-namespace.yaml` was deleted)

# 2. Build and load Docker images
docker build --target api-server -t quill-api:prod .
docker build --target quill-mcp -t quill-mcp:prod .
# If using local images on K3s (no registry):
# docker save quill-api:prod | ssh nexus docker load
# docker save quill-mcp:prod | ssh nexus docker load

# 3. Create production secrets
kubectl create secret generic maplespike-secrets \
  --from-literal=JWT_SECRET=$(openssl rand -hex 64) \
  --from-literal=QUILL_BILLING_SECRET=$(openssl rand -hex 32) \
  -n maplespike

# credentials.json is written to ~/.cloudflared/<TUNNEL_ID>.json by the
# `cloudflared tunnel create maplespike-k8s` command in Step 1b above.
# Tunnel ID is verifiable via `wrangler tunnel info maplespike-k8s`.
kubectl create secret generic cloudflared-creds \
  --from-file=credentials.json=$HOME/.cloudflared/66d76492-036b-4177-8fac-8682e0eda37e.json \
  -n maplespike

# 4. Deploy (canonical kustomize path; includes 05-cloudflared.yaml + 11-mcp-deploy.yaml)
kubectl apply -k k8s/base/

# 5. Verify pods
kubectl get pods -n maplespike
```

---

## Step 3: Verify Public Access

```bash
# API health check
curl -s https://api.maplespike.ca/v1/health | jq .

# MCP health check
curl -s https://mcp.maplespike.ca/health | jq .

# Register a test account
curl -X POST https://api.maplespike.ca/v1/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com"}'

# LLMs.txt (AI agent discovery)
curl -s https://api.maplespike.ca/v1/llms.txt | head -20
```

---

## Step 4: Provision First Customer

```bash
# On the production node (or via kubectl exec):
./scripts/provision-user.sh "First Customer" "customer@example.com" pro

# Send them:
# 1. Their API key (shown once by the script)
# 2. The MCP connection config JSON
# 3. Link to /v1/llms.txt for tool discovery
```

---

## Step 5: Set Up Billing

### Option A: Stripe Payment Link (Fastest)
1. Go to Stripe Dashboard → Payment Links → Create
2. Set price: $X/month for "MapleSpike API Access"
3. Copy the payment link URL
4. Share it — when someone pays, you get an email notification
5. Run `./scripts/provision-user.sh` and email them their key

### Option B: e-Transfer (Canadian, Already Scaffolded)
1. Set `MAPLESPIKE_BILLING_EMAIL` in `.env`
2. Customer sends e-Transfer to that email
3. You accept it, then run provisioning script

---

## Step 6: Customer Onboarding Template

```
Subject: Your MapleSpike API Key — 164 Canadian Government Data Tools

Hi [Name],

Welcome to MapleSpike! Here's your API key and connection details.

🔑 API Key (keep this secret):
   maplespike_abc123...

🤖 MCP Connection (for Claude, Cursor, etc.):
{
  "mcpServers": {
    "maplespike": {
      "url": "https://mcp.maplespike.ca/sse",
      "headers": {
        "Authorization": "Bearer maplespike_abc123..."
      }
    }
  }
}

📡 REST API:
   curl -H "Authorization: Bearer maplespike_abc123..." \
     https://api.maplespike.ca/v1/health

📋 Tool Discovery:
   https://api.maplespike.ca/v1/llms.txt

You have access to 164 tools covering:
- House & Senate committees, Hansard transcripts
- Federal lobbying registry, procurement, GIC appointments
- StatCan economic data (CPI, GDP, labour, trade)
- CanLII case law, Canada Gazette, OAG, PBO
- All 13 provincial legislatures + CKAN portals
- And much more...

Questions? Reply to this email.

— The MapleSpike Team
```

---

## Monitoring (After Launch)

```bash
# Check pod health
kubectl get pods -n maplespike

# View API logs
kubectl logs -f deployment/quill-api -n maplespike

# View MCP logs
kubectl logs -f deployment/quill-mcp -n maplespike

# Check Cloudflare tunnel status
kubectl logs -f deployment/cloudflared -n maplespike

# Usage stats (via API)
curl -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  https://api.maplespike.ca/v1/usage
```

---

## What's NOT Needed Yet (Skip These)

| Component | Why Skip |
|-----------|----------|
| Portal / dashboard | Customers connect directly via MCP |
| Self-serve billing | Manual provisioning for first 10 customers |
| K8s CronJobs | Run ingestion manually until volume justifies automation |
| Stripe webhooks | Email notification + manual script is sufficient |
| e-Transfer listener | Manual confirmation is fine at low volume |
| AI Ask feature | Ship without it, add as premium tier later |
| Grafana monitoring | Health checks + logs are enough for now |

---

*Ship fast. Get feedback. Iterate.*
