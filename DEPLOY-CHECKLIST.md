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
| `quill.maplespike.ca` | cluster tunnel → `maplespike-portal:8080` | ✅ 200, wired 2026-07-14 |
| `api.maplespike.ca` | cluster tunnel → `maplespike-api:8082` (root returns 404; `/v1/health` returns 200) | ✅ 200 (real E2E), wired 2026-07-14 |
| `mcp.maplespike.ca` | cluster tunnel → `maplespike-mcp:3001` (root returns 404; `/health` returns 200) | ✅ 200 (real E2E), wired 2026-07-14 |
| `data.maplespike.ca` | cluster tunnel → `maplespike-mcp:3001` (legacy alias per ROUTING.md) | ✅ 200, wired 2026-07-14 |
| `mosaic.maplespike.ca` | DNS CNAME pending; cluster tunnel ingress row + `mosaic-svc` Service + Mosaic StatefulSet all pending per [`mosaic/DEPLOY-MAPLESPIKE.md`](./../mosaic/DEPLOY-MAPLESPIKE.md) | 🟡 DNS operator action + 🔴 K8s deploy pending |

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
| `mosaic.maplespike.ca` | CNAME | (same tunnel) | Mosaic (after K8s StatefulSet + new tunnel ingress entry) |

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
  const OAUTH_RE = /oauth_token\s*=\s*["']/ +
    /[^"']+/ + /["']/i;
  const t = fs.readFileSync(path.join(os.homedir(),'.config/.wrangler/config/default.toml'),'utf8')
    .match(OAUTH_RE)![1];
  const cf = new Cloudflare({ oauthToken: t });
  const acc = (await cf.accounts.list()).result[0];
  const zone = (await cf.zones.list({ name: 'maplespike.ca' })).result[0];
  const tgt = `${process.env.TUNNEL}.cfargotunnel.com`;
  const targets = [
    { name: 'quill',       proxied: true },
    { name: 'api',         proxied: true },
    { name: 'mcp',         proxied: true },
    { name: 'data',        proxied: true },
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
left out of this list — see [Step 7](#step-7-mosaic-deploy-on-cluster-phased) for the
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

## Step 7: Mosaic deploy on cluster (phased)

`mosaic.maplespike.ca` is the operator-deployed Mosaic Express+WebSocket
federation server (see [`mosaic/DEPLOY-MAPLESPIKE.md`](./../mosaic/DEPLOY-MAPLESPIKE.md)
for the full manifest +9-step recipe). The cliff-notes:

1. **Build the image** (one-time) and push to `nexus:5000/mosaic:dev` so the
   cluster can pull it:
   ```bash
   cd mosaic && docker build -t nexus:5000/mosaic:dev .
   docker push nexus:5000/mosaic:dev
   ```
2. **Create a PVC** (`10Gi` to start; resize if usage spikes) in the
   `maplespike` namespace for `/data` (SQLite, .env, certs, uploads).
3. **Deploy** a `StatefulSet` (StorageClass local-path) with `nodeAffinity`
   that bans `zephyr` (per local operator policy: "we NEVER deploy to
   zephyr, only the other nodes"). `FORCE_HTTP=true` so Mosaic doesn't
   try to generate its own self-signed cert over the top of Cloudflare's.
4. **Add a ClusterIP Service** `mosaic-svc:3000` in the same namespace.
5. **Patch `cloudflared-config` ConfigMap** to add the `mosaic.maplespike.ca`
   ingress row pointing at `http://mosaic-svc:3000` (above `http_status:404`).
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
   to Mosaic (Express + persistent disk, not static).
9. **Backup / restore** falls out of Mosaic's built-in zip endpoint
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

## Image Pinning Protocol

> **Why pinning matters.** Deploying with `:latest` or any mutable tag (`prod`,
> `v0.3.0-a1b2c3d` can be overwritten by a subsequent push) means two different
> pods can pull different content for the same tag string. A digest pin
> (`sha256:abc123...`) is immutable — it always resolves to the exact same
> image layer. This section documents how to obtain, verify, and deploy
> digest-pinned images.

### Why `:latest` + `IfNotPresent` is a staleness trap

The default `imagePullPolicy` in Kubernetes is `IfNotPresent` when the image
tag is **not** `:latest`, and `Always` when it **is** `:latest`.

This creates a subtle problem:

| Configuration | Behaviour | Risk |
|--------------|-----------|------|
| `:latest` tag, `IfNotPresent` (overridden by policy default) | K8s overrides to `Always` — pulls every time | Slightly slower pod startup; no pin guarantee |
| `:latest` tag, explicit `IfNotPresent` | K8s respects the explicit policy | **Stale image** — once pulled, node never re-pulls. A re-push to `:latest` is invisible. |
| `:v0.3.0-a1b2c3d` tag, `IfNotPresent` (default) | Pulled once per node, cached forever | Tag is mutable — a re-push to the same tag name changes the content without changing the tag string |
| `sha256:abc...` digest, `IfNotPresent` (default) | Pulled once per node, cached forever | **Immutable** — the digest is the content hash |

**Rule:** Never use `:latest` in production manifests. Always pin to a digest
after initial deployment, or at minimum use a unique tag (e.g. the git SHA)
combined with a manual digest-pin step.

### Extracting the manifest digest from a registry

The Docker manifest V2 Schema 2 response includes a
`Docker-Content-Digest` header that contains the SHA256 digest of the
manifest. To get it, you need the correct `Accept` header to request the
right manifest format.

#### From GHCR (or any HTTPS registry)

```bash
# Set variables
REGISTRY="ghcr.io"
OWNER="reverb256"
IMAGE="quill-api"
TAG="v0.3.0-a1b2c3d"

# Get the manifest digest using the Docker manifest format Accept header
DIGEST=$(curl -sS \
  -H "Accept: application/vnd.docker.distribution.manifest.v2+json" \
  -H "Accept: application/vnd.oci.image.manifest.v1+json" \
  -H "Authorization: Bearer $(echo "$GITHUB_TOKEN" | base64 -d 2>/dev/null || echo "")" \
  "https://${REGISTRY}/v2/${OWNER}/${IMAGE}/manifests/${TAG}" \
  -D - -o /dev/null 2>/dev/null \
  | grep -i "Docker-Content-Digest" \
  | awk '{print $2}' \
  | tr -d '\r')

echo "$DIGEST"
# → sha256:abc123def456...
```

> **Important:** The two `Accept` headers tell the registry you accept both
> Docker V2 Schema 2 (`application/vnd.docker.distribution.manifest.v2+json`)
> and OCI (`application/vnd.oci.image.manifest.v1+json`) manifests. The
> registry responds with whichever format is stored, and the digest in
> `Docker-Content-Digest` reflects that format. If you omit the OCI accept
> and the stored manifest is OCI, the registry returns a
> `415 Unsupported Media Type`.

#### From a plain-HTTP registry (nexus:5000)

```bash
# Plain HTTP registries require explicit --insecure and the correct Accept
# header. OCI format is corrupted by the HTTP transport (lack of TLS wrapping
# can cause manifest blob corruption with OCI media types in some registries),
# so request Docker format explicitly.
DIGEST=$(curl -sS --insecure \
  -H "Accept: application/vnd.docker.distribution.manifest.v2+json" \
  "http://nexus:5000/v2/quill-api/manifests/latest" \
  -D - -o /dev/null \
  | grep -i "Docker-Content-Digest" \
  | awk '{print $2}' \
  | tr -d '\r')

echo "$DIGEST"
```

> **⚠️  OCI vs Docker format gotcha.** When pushing images with `docker buildx`
> (which uses BuildKit internally), the default output format is OCI
> (`application/vnd.oci.image.manifest.v1+json`). OCI manifests pushed to a
> plain-HTTP registry (`nexus:5000`) are subject to transport-tampering risk
> because the manifest layers are referenced by digest, but the envelope
> itself has no TLS integrity check. Podman users MUST pass
> `--format docker` on `podman build` to output Docker V2 Schema 2 manifests
> instead of OCI. For Docker BuildKit, use
> `--output type=image,oci-mediatypes=false` or set
> `DOCKER_BUILDKIT=0` as a last resort:
>
> ```bash
> # BuildKit → Docker format (safe for plain HTTP)
> docker buildx build \
>   --output type=image,name=nexus:5000/quill-api:v0.3.0-a1b2c3d,oci-mediatypes=false \
>   .
> ```
>
> GHCR (HTTPS) accepts both formats without corruption, so this only matters
> when pushing to the local `nexus:5000` registry.

### Pinning deployments to a digest

Once you have the digest, update the K8s deployment manifest:

```yaml
# Before (mutable tag — can drift)
image: ghcr.io/reverb256/quill-api:v0.3.0-a1b2c3d

# After (immutable digest — guaranteed content)
image: ghcr.io/reverb256/quill-api@sha256:abc123def456...
imagePullPolicy: IfNotPresent
```

**Steps:**

1. **Extract the digest** using the curl command above.
2. **Update the deployment manifest** or run:
   ```bash
   kubectl set image deployment/maplespike-quill-api \
     -n maplespike \
     "*=ghcr.io/reverb256/quill-api@${DIGEST}"
   ```
3. **Verify the digest locally** (optional):
   ```bash
   docker pull ghcr.io/reverb256/quill-api@sha256:abc123def456...
   docker inspect ghcr.io/reverb256/quill-api@sha256:abc123def456... \
     | jq '.[0].RepoDigests'
   ```
4. **Confirm the deployment rolled out:**
   ```bash
   kubectl rollout status deployment/maplespike-quill-api -n maplespike
   ```

### Specifying the digest in Helm values

When using the Helm chart (`charts/quill/`), set the image digest in
`values.yaml` or override on the command line:

```yaml
# values.yaml
image:
  registry: ghcr.io/reverb256
  tag: ""                    # empty when using digest
  digest: sha256:abc123def456...
  pullPolicy: IfNotPresent
```

Or via `--set`:

```bash
helm upgrade --install quill ./charts/quill \
  --set image.digest=sha256:abc123def456... \
  --set image.tag="" \
  --set image.pullPolicy=IfNotPresent
```

### Quick reference

| Format | Tag example | Digest example | Mutation risk |
|--------|-----------|---------------|-------------|
| `:latest` | `quill-api:latest` | — | High — overwritten by any push |
| SHA tag | `quill-api:v0.3.0-a1b2c3d` | — | Medium — tag can be force-pushed |
| Digest | `quill-api@sha256:abc...` | `sha256:abc...` | **None** — content-addressed |

**Prefer digest pins in production manifests.** Use SHA tags only during
development and canary deployment; pin to digest before promoting to stable.
