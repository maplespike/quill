# MapleSpike — maplespike.ca Deployment Checklist

> **Goal:** Get Core MCP live and accepting paying customers.
> **Domain:** maplespike.ca (registered, connecting to Cloudflare)

---

## Step 1: DNS + Tunnel Setup

### 1a. Domain (maplespike.ca)
- [ ] Domain `maplespike.ca` registered
- [ ] Added to Cloudflare (nameservers updated)
- [ ] DNS propagation confirmed (`dig maplespike.ca`)

### 1b. Choose Tunnel Strategy

**Option A: Cloudflare Tunnel (Recommended for Production)**
- Pros: DDoS protection, WAF, caching, analytics, professional
- Cons: Requires Cloudflare account, tunnel token management

```bash
# On your K3s node:
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
cloudflared tunnel login
cloudflared tunnel create maplespike
cloudflared tunnel route dns maplespike api.maplespike.ca
cloudflared tunnel route dns maplespike mcp.maplespike.ca
```

Then deploy via K3s: `kubectl apply -f k8s/manual/05-cloudflared.yaml`

**Option B: Tailscale Funnel (Simpler, Already Running)**
- Pros: You already have Tailscale on your cluster, zero config, direct
- Cons: No DDoS protection, no caching, limited to Tailscale's infrastructure

```bash
# On your K3s node (requires Tailscale running):
tailscale funnel --bg 8082   # exposes api.maplespike.ca
tailscale funnel --bg 3001   # exposes mcp.maplespike.ca
```

**Option C: Both (Tailscale for dev, Cloudflare for prod)**
- Use Tailscale Funnel for quick testing and internal access
- Switch to Cloudflare Tunnel for production launch

### 1c. DNS Records (Cloudflare)

| Subdomain | Type | Target | Purpose |
|-----------|------|--------|---------|
| `maplespike.ca` | CNAME | Cloudflare Pages / GitHub Pages | Landing page + docs |
| `api.maplespike.ca` | CNAME | tunnel → K3s API | REST API |
| `mcp.maplespike.ca` | CNAME | tunnel → K3s MCP | MCP SSE server |

### 1d. Static Site (Landing Page)

**Option A: Cloudflare Pages (Recommended)**
- Free, fast global CDN, auto-deploy from GitHub
- Connect repo → auto-build on push to main
- Custom domain: `maplespike.ca` (root)

**Option B: GitHub Pages**
- Free, auto-deploy from GitHub Actions
- Custom domain: `maplespike.ca` (root)
- Slightly slower than Cloudflare Pages globally

Both options deploy the `packages/portal` Astro build as a static site.

---

## Step 2: Deploy to K3s

```bash
# 1. Create namespace (if not exists)
kubectl apply -f k8s/manual/00-namespace.yaml

# 2. Build and load Docker images
docker build --target api-server -t maplespike-api:prod .
docker build --target mcp-server -t maplespike-mcp:prod .
# If using local images on K3s (no registry):
# docker save maplespike-api:prod | ssh nexus docker load
# docker save maplespike-mcp:prod | ssh nexus docker load

# 3. Create production secrets
kubectl create secret generic maplespike-secrets \
  --from-literal=JWT_SECRET=$(openssl rand -hex 64) \
  --from-literal=MAPLESPIKE_BILLING_SECRET=$(openssl rand -hex 32) \
  -n maplespike

kubectl create secret generic cloudflared-token \
  --from-literal=TUNNEL_TOKEN=<your-tunnel-token> \
  -n maplespike

# 4. Deploy
kubectl apply -f k8s/manual/05-cloudflared.yaml
kubectl apply -f k8s/manual/10-api-deploy.yaml
kubectl apply -f k8s/manual/11-mcp-deploy.yaml

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
kubectl logs -f deployment/maplespike-api -n maplespike

# View MCP logs
kubectl logs -f deployment/maplespike-mcp -n maplespike

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
