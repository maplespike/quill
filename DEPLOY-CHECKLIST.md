# MapleSpike — maplespike.ca Deployment Checklist

> **Goal:** Get Core MCP live and accepting paying customers.
> **Domain:** maplespike.ca (registered, Cloudflare DNS active)
> **Last reconciled:** 2026-07-14 — DNS state, tunnel ID, and Pages binds updated to reflect the live cluster + the Pages-project backup deploy of the portal.

---

## Live state at a glance

| Subdomain | Where traffic goes today | Status |
|-----------|--------------------------|--------|
| `maplespike.ca` | **Cloudflare Pages** (`maplespike-brand` project) | ✅ 200, brand site |
| `www.maplespike.ca` | **Cloudflare Pages** (`maplespike-brand` project) | ✅ 200, brand site |
| `maplespike-quill.pages.dev` | **Cloudflare Pages** (`maplespike-quill` project) | ✅ 200, latest portal deploy alias |
| `main.maplespike-quill.pages.dev` | **Cloudflare Pages** (`maplespike-quill` project, last commit `main`) | ✅ 200 |
| `quill.maplespike.ca` | (cluster tunnel ingress OK → `maplespike-portal:8080`, **DNS CNAME not yet attached**) | 🟡 DNS one-liner pending |
| `api.maplespike.ca` | (cluster tunnel ingress OK → `maplespike-api:8082`, **DNS CNAME not yet attached**) | 🟡 DNS one-liner pending |
| `mcp.maplespike.ca` | (cluster tunnel ingress OK → `maplespike-mcp:3001`, **DNS CNAME not yet attached**) | 🟡 DNS one-liner pending |
| `data.maplespike.ca` | (cluster tunnel ingress OK → `maplespike-mcp:3001`, **DNS CNAME not yet attached**, kept as legacy alias per ROUTING.md) | 🟡 DNS one-liner pending |
| `datafabric.maplespike.ca` | (cluster tunnel ingress OK → `quill-portal:8080`, **DNS CNAME not yet attached**) | 🟡 DNS one-liner pending |
| `mosaic.maplespike.ca` | No DNS, no Service, no tunnel ingress yet | 🔴 Phase-1 deploy (K8s StatefulSet + PVC + tunnel ingress) pending |

### Cloudflare Pages backup for `quill`

The portal's static output (`packages/portal/dist`) is **also** deployed to the
Cloudflare Pages project `maplespike-quill` (alias `main.maplespike-quill.pages.dev`).
This is belt-and-suspenders — the canonical user-facing endpoint is still the
cluster tunnel serving `quill-portal:8080`. To redeploy from source:

```bash
cd quill/packages/portal
pnpm run pages:build       # regenerates dist/ (runs gen:all + astro build)
pnpm run pages:deploy      # wrangler pages deploy dist — picks project from wrangler.toml
```

`packages/portal/wrangler.toml` binds `name = "maplespike-quill"` +
`pages_build_output_dir = "dist"`. Custom domain (`quill.maplespike.ca`)
attachment to the Pages project is intentionally out-of-band and is NOT the
current target — the cluster tunnel is. See "Why both?" below.

### Why both Cloudflare Pages AND cluster tunnel?

The cluster's `quill-portal` Deployment serves the live, source-of-truth HTML
(personalized onboarding banner, dynamic /v1/me calls, fresh `llms.txt`,
Cloudflare-Insights beacon collected from real users, etc.). The Pages project
serves a static snapshot from the most recent build, which is useful as:

- A public reference deploy for the brand (`maplespike-quill.pages.dev` Anyone
  can hit, no auth, no rate-limiting, useful for sharing previews without
  exposing the cluster).
- A safety net if the `quill-portal` pod is down during an incident — Pages
  stays up.

They are NOT a failover pair in DNS terms — `quill.maplespike.ca` only points
to one of them at a time. Today: the tunnel should be the active target (once
the DNS CNAME is added). Pages is only attached via Cloudflare's automatic
`*.pages.dev` pseudo-domain.


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

**Active ingress (cloudflared ConfigMap `cloudflared-config` in the `maplespike` namespace):**

```yaml
tunnel: 66d76492-036b-4177-8fac-8682e0eda37e    # maplespike-k8s
ingress:
  - hostname: maplespike.ca           → http://maplespike-portal:8080
  - hostname: www.maplespike.ca       → http://maplespike-portal:8080
  - hostname: quill.maplespike.ca     → http://maplespike-portal:8080
  - hostname: datafabric.maplespike.ca → http://maplespike-portal:8080
  - hostname: api.maplespike.ca       → http://maplespike-api:8082
  - hostname: mcp.maplespike.ca       → http://maplespike-mcp:3001
  - hostname: data.maplespike.ca      → http://maplespike-mcp:3001   (legacy alias)
  - service: http_status:404
```

> The cluster Service FQDNs use the `maplespike-*` prefix (NOT the older
> `quill-*` Service names from `k8s/base/`). The fix for the prior
> `quill-api.maplespike.svc.cluster.local` mismatch is reconciled in
> [`ROADMAP.md` Known Infrastructure Drift 2026-07-04 entry on
> `k8s/manual/10-api-deploy.yaml`](./ROADMAP.md) and is now reflected in
> the live cluster.

> **`maplespike.ca` and `www.maplespike.ca` have a redundant tunnel ingress**
> but the actual DNS records point at the Cloudflare Pages project
> `maplespike-brand` (so Pages always wins; the tunnel ingress is dormant
> for these two hostnames). This is intentional: Pages for the brand site
> (cleaner CI/CD, branch previews, automatic CDN), cluster for the API +
> other subdomains. Do NOT add the DNS CNAMEs listed below for
> `maplespike.ca` / `www.maplespike.ca` — Cloudflare will reject the
> Pages custom-domain attach because of the conflict.

### 1c. DNS Records (Cloudflare)

**Already attached (live, return HTTP 200):**

| Subdomain | Type | Target | Source |
|-----------|------|--------|--------|
| `maplespike.ca` | CNAME-flattened `A` | `maplespike-brand.pages.dev` (Pages project `maplespike-brand`) | Cloudflare Pages auto-bind on `wrangler pages domain add` |
| `www.maplespike.ca` | CNAME-flattened `A` | `maplespike-brand.pages.dev` | same |

**Attached via Cloudflare Pages (`maplespike-quill` project, but only on the
`*.pages.dev` pseudo-domain today — no custom domain yet):**

| Subdomain | Type | Target | Notes |
|-----------|------|--------|-------|
| `maplespike-quill.pages.dev` | Pages assigned | (Pages project `maplespike-quill`, deploy `9ffb0d2e`) | portal dist deployed 2026-07-14 |
| `main.maplespike-quill.pages.dev` | Pages assigned | (Pages project `maplespike-quill`, branch `main`) | production branch alias |

**MISSING — DNS CNAMEs that need to be added for the tunnel to receive
public traffic.** Run the one-liner below (Section 1d) to add them all in
one shot. The cluster-side ingress is already in place — only the public
DNS side is blocking.

| Subdomain | Type | Target after 1d | Purpose |
|-----------|------|-----------------|---------|
| `quill.maplespike.ca` | CNAME | `66d76492-036b-4177-8fac-8682e0eda37e.cfargotunnel.com` | canonical public hostname for the portal |
| `api.maplespike.ca` | CNAME | (same tunnel) | REST API |
| `mcp.maplespike.ca` | CNAME | (same tunnel) | MCP SSE server |
| `data.maplespike.ca` | CNAME | (same tunnel) | legacy alias (per `ROUTING.md` Phase D, will 301 to `quill.maplespike.ca`) |
| `datafabric.maplespike.ca` | CNAME | (same tunnel) | legacy product alias |
| `mosaic.maplespike.ca` | CNAME | (same tunnel) | Mosiac (after K8s StatefulSet + new tunnel ingress entry) |

### 1d. One-liner to wire DNS (run from `quill/` so the `cloudflare` SDK is on disk)

The wrangler OAuth token in `~/.config/.wrangler/config/default.toml` is
authoritative for API access but **NOT** accepted by raw `curl` (Cloudflare
returns "Invalid format for Authorization header" because the OAuth token
is in JWT-split form, not an API token). The `cloudflare` SDK
wraps it correctly. Run from the `quill/` workspace root so the SDK is
resolvable:

```bash
cd /home/j_kro/Projects/quill && \
  TUNNEL=66d76492-036b-4177-8fac-8682e0eda37e && \
  cat > /tmp/wire-dns.mts <<'TSX'
import { Cloudflare } from 'cloudflare'; import fs,os,path from 'node:fs';
(async () => {
  const t = fs.readFileSync(path.join(os.homedir(),'.config/.wrangler/config/default.toml'),'utf8')
    .match(/oauth_token\s*=\s*["']([^"']+)["']/i)![1];
  const cf = new Cloudflare({ oauthToken: t });
  const acc = (await cf.accounts.list()).result[0];
  const zone = (await cf.zones.list({ name: 'maplespike.ca' })).result[0];
  const tgt = `${process.env.TUNNEL}.cfargotunnel.com`;
  const targets = [
    { name: 'quill',       proxied: true },
    { name: 'api',         proxied: true },
    { name: 'mcp',         proxied: true },
    { name: 'data',        proxied: true },
    { name: 'datafabric',  proxied: true },
  ];
  for (const t of targets) {
    const ex = (await cf.dns.records.list({ zone_id: zone.id, type: 'CNAME', name: `${t.name}.maplespike.ca` })).result;
    if (ex.length > 0) {
      await cf.dns.records.update(ex[0].id, { zone_id: zone.id, type: 'CNAME', name: ex[0].name, content: tgt, proxied: t.proxied });
      console.log(`✓ updated ${ex[0].name} → ${tgt}`);
    } else {
      await cf.dns.records.create({ zone_id: zone.id, type: 'CNAME', name: `${t.name}.maplespike.ca`, content: tgt, proxied: t.proxied });
      console.log(`✓ created ${t.name}.maplespike.ca → ${tgt}`);
    }
  }
})();
TSX
TUNNEL=$TUNNEL npx tsx /tmp/wire-dns.mts && \
  echo 'Waiting 60s for edge cert provisioning...' && sleep 60 && \
  curl -sS -o /dev/null -w 'api   → HTTP %{http_code}\n' https://api.maplespike.ca/v1/health && \
  curl -sS -o /dev/null -w 'quill → HTTP %{http_code}\n' https://quill.maplespike.ca/ && \
  curl -sS -o /dev/null -w 'mcp   → HTTP %{http_code}\n' https://mcp.maplespike.ca/health
```

After it runs, the five subdomains should all return HTTP 200. (`mosaic` is
left out of this list — see [Step 7](#step-7-mosiac-deploy-on-cluster-phased) for the
K8s deployment that creates the matching Service + tunnel ingress first;
then add `mosaic.maplespike.ca` to the same one-liner.)

### Why this works (and the dashboard alternative)

The wrangler OAuth token scopes are `account (read) + user (read) + workers
(write)` per ROADMAP's Known Drift entry — **NOT** `zone:read` and NOT
`zone:dns:edit`. So:

- **`GET /zones?name=maplespike.ca`** (zone listing) needs `zone:read` (or
  the implicit `account:read` if you have full account access). Fails with
  HTTP 403 if those are missing.
- **`GET /zones/{id}/dns_records`** (upsert lookup) needs `zone:read`. Same
  403 if missing.
- **`POST /zones/{id}/dns_records`** (the actual create/update) needs
  `zone:dns:edit`. Fails with HTTP 403 if missing.

So **both** `zone:read` AND `zone:dns:edit` are required to run the
one-liner above. The script WILL FAIL on the first `(await
cf.dns.records.list(...))` call if `zone:read` is missing, OR on the
`cf.dns.records.update/create` calls if `zone:dns:edit` is missing.
Three ways to unblock:

1. **Dashboard route (no token work)**: open
   <https://dash.cloudflare.com/?to=/:account/:zone/maplespike.ca/dns/records>,
   click *Add record* → Type `CNAME`, Name (e.g. `quill`), Target
   `66d76492-036b-4177-8fac-8682e0eda37e.cfargotunnel.com`, Proxy status
   *Proxied*. Repeat for the five subdomains. Takes ~5 minutes.
2. **Widen wrangler OAuth scopes** (User Profile → API Tokens → Edit
   Wrangler token → add `Zone:Read` + `Zone:DNS:Edit`) then re-run the
   one-liner. Persists across future runs.
3. **New API token with the right scopes**: create at
   <https://dash.cloudflare.com/profile/api-tokens>, store in
   `~/.config/.wrangler/config/default.toml` under
   `api_token = "..."`. Re-run the one-liner. Bypasses the OAuth path.


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

# 3. Create production secrets (via SOPS — see secrets/README.md)
#
# Secrets are now managed with SOPS + age. Plaintext templates live in
# secrets/*.yaml.example. Encrypted copies (secrets/*.yaml) are committed
# to the repo and decrypted at boot by sops-nix on the nexus host.
#
# First-time setup:
#   cp secrets/runtime.yaml.example secrets/runtime.yaml
#   # edit secrets/runtime.yaml with real values
#   SOPS_AGE_KEY_FILE=/etc/nixos/.age/nexus-prod-key.txt \
#     sops --encrypt --in-place secrets/runtime.yaml
#   # repeat for build.yaml + cloudflared.yaml
#
# Sync to K8s (one-shot or via systemd timer):
#   QUILL_REPO=/opt/quill /opt/quill/scripts/sops-sync-k8s.sh
#
# The old manual flow was:
#   kubectl create secret generic maplespike-secrets \
#     --from-literal=JWT_SECRET=$(openssl rand -hex 64) \
#     --from-literal=QUILL_BILLING_SECRET=$(openssl rand -hex 32) \
#     -n maplespike
# (kept above for reference; prefer the SOPS flow going forward)

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
Subject: Your MapleSpike API Key — 166 Canadian Government Data Tools

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

You have access to 166 tools covering:
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

## Step 7: Mosiac deploy on cluster (phased)

`mosaic.maplespike.ca` is the operator-deployed Mosiac Express+WebSocket
federation server (see [`mosiac/DEPLOY-MAPLESPIKE.md`](./../mosiac/DEPLOY-MAPLESPIKE.md)
for the full manifest +9-step recipe). The cliff-notes:

1. **Build the image** (one-time) and push to `nexus:5000/mosiac:dev` so the
   cluster can pull it:
   ```bash
   cd mosiac && docker build -t nexus:5000/mosiac:dev .
   docker push nexus:5000/mosiac:dev
   ```
2. **Create a PVC** (`10Gi` to start; resize if usage spikes) in the
   `maplespike` namespace for `/data` (SQLite, .env, certs, uploads).
3. **Deploy** a `StatefulSet` (StorageClass local-path) with `nodeAffinity`
   that bans `zephyr` (per local operator policy: "we NEVER deploy to
   zephyr, only the other nodes"). `FORCE_HTTP=true` so Mosiac doesn't
   try to generate its own self-signed cert over the top of Cloudflare's.
4. **Add a ClusterIP Service** `mosiac-svc:3000` in the same namespace.
5. **Patch `cloudflared-config` ConfigMap** to add the `mosaic.maplespike.ca`
   ingress row pointing at `http://mosiac-svc:3000` (above `http_status:404`).
   Restart the `cloudflared` pod so it reloads ingress (`kubectl rollout
   restart deploy cloudflared -n maplespike`).
6. **Add the DNS CNAME** for `mosaic.maplespike.ca` — extend the one-liner
   from [Step 1d](#1d-one-liner-to-wire-dns-run-from-quill-so-the-cloudflare-sdk-is-on-disk)
   to include `'mosaic'` in its `targets` list and re-run.
7. **Verify**:
   ```bash
   curl -sS https://mosaic.maplespike.ca/api/health | jq .  # → 200 with server_name populated
   ```
8. **Build Cloudflare Pages backup for the brand site**: not applicable
   to Mosiac (Express + persistent disk, not static).
9. **Backup / restore** falls out of Mosiac's built-in zip endpoint
   (`GET /api/admin/backup?token=...`). No additional plumbing.

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
