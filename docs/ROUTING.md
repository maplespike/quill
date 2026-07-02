---
last-reviewed: 2026-07-01
status: active
---

# MapleSpike — Routing matrix

Operator-facing quick reference. The rationale lives in [decisions/0004-split-hostname-routing.md](./decisions/0004-split-hostname-routing.md). The data-layer MCP product name is **Quill** — see [products/quill.md](./products/quill.md) and [decisions/0005-quill-product-name.md](./decisions/0005-quill-product-name.md).

## The split at a glance

| Host family | Entry point | Backends |
|---|---|---|
| `*.maplespike.lan` | k3s Traefik Ingress on the LAN | `maplespike-portal:8080`, `maplespike-api:8082`, `maplespike-quill:3001` |
| `*.maplespike.ca` | Cloudflare Edge → Tunnel → `cloudflared` pod in k3s | same three Services |

Both entry points terminate at the SAME three k3s Services — there is one upstream to maintain.

## Host-to-Service routing

| Host | Service |
|---|---|
| `maplespike.lan` | `maplespike-portal:8080` |
| `portal.maplespike.lan` | `maplespike-portal:8080` |
| `dev.maplespike.lan` | `maplespike-portal:8080` (dev layout) |
| `api.maplespike.lan`, `dev-api.maplespike.lan` | `maplespike-api:8082` |
| `mcp.maplespike.lan`, `dev-mcp.maplespike.lan` | `maplespike-quill:3001` *(Phase D: 301 redirect to `quill.maplespike.lan`; keep for backward compat)* |
| `quill.maplespike.lan` | `maplespike-quill:3001` *(canonical LAN hostname; Phase D)* |
| `maplespike.ca` | Cloudflare Pages (landing — out of cluster scope) |
| `api.maplespike.ca` | `cloudflared` → `maplespike-api:8082` |
| `mcp.maplespike.ca` | `cloudflared` → `maplespike-quill:3001` *(Phase D: 301 redirect to `quill.maplespike.ca`; keep for backward compat)* |
| `data.maplespike.ca` | `cloudflared` → `maplespike-portal:8080` *(Phase D: 301 redirect to `quill.maplespike.ca`; legacy alias)* |
| `quill.maplespike.ca` | `cloudflared` → `maplespike-quill:3001` *(canonical public hostname; see [decisions/0006-quill-hostname-alias.md](decisions/0006-quill-hostname-alias.md))* |

## TLS strategy

- **`.lan`** — cert-manager + step-issuer plugin issues a 90d wildcard `*.maplespike.lan` cert signed by a **local step-ca**. Same trusted root as the rest of the LAN. Auto-renewed at 30d.
- **`.ca`** — issued and rotated by Cloudflare itself (Cloudflare Universal SSL). No cluster-side cert work.

## Hostname aliases (Phase D)

The legacy `mcp.maplespike.{ca,lan}` and `data.maplespike.ca` hostnames 301-redirect to the canonical `quill.maplespike.{ca,lan}` to preserve bookmarks and external integrations while completing the Quill rename (ADR 0005, Phase D). Drop-in configs are in [decisions/0006-quill-hostname-alias.md](decisions/0006-quill-hostname-alias.md).

| Status | Hostname pattern | Behavior |
|---|---|---|
| **Canonical · Live** | `quill.maplespike.ca` · `quill.maplespike.lan` | All real traffic |
| **Alias · Live (Phase D)** | `mcp.maplespike.ca` · `mcp.maplespike.lan` · `data.maplespike.ca` | 301 redirect → canonical |

## One-time bootstrap order

> **Strict dependency:** only step 4 (`kubectl apply`) requires all of
> steps 0–3 to be complete. Steps 0–3 (prereqs + cert-manager install +
> step-ca init + LAN DNS wire) can each be run *independently* in any
> order. Step 5 is the post-flight smoke test.

0. **Prereqs (already in place, confirmed 2026-07-01)**:
   - A LAN-internal DNS resolver (Unbound running on the LAN, per user).
   - A local root CA reachable as `https://step-ca.maplespike.lan:8443`
     (user-confirmed 2026-07-01; the assumption is smallstep/step-ca
     bootstrapped via `./scripts/setup-stepca-lan.sh` and the resulting PKI
     running as a systemd unit on a LAN host *or* as a k3s Deployment).
1. **cert-manager + step-issuer plugin** (single command; idempotent):
   ```bash
   ./scripts/install-cert-manager.sh
   ```
   Pinned by default to cert-manager `v1.16.1` and the plugin's `v0.10.0`;
   override with `CERT_MANAGER_VERSION=…` / `STEP_ISSUER_VERSION=…` env vars.
2. **step-ca** itself (LAN root CA; one-time PKI init):
   ```bash
   sudo ./scripts/setup-stepca-lan.sh
   ```
   After init, run step-ca as a systemd unit on a homelab host *or* as a k3s
   Deployment — your call. The script prints the `kubectl create secret`
   snippet for `stepca-lan-bootstrap` regardless.
3. **LAN DNS for `.lan`**:
   ```bash
   sudo ./scripts/wire-lan-dns-unbound.sh <k3s-ingress-ip>
   ```
   Replace `<k3s-ingress-ip>` with your node IP (the one Traefik listens
   on for `:443`). If `step-ca.maplespike.lan` resolves to a different host
   in your setup (a homelab box, say), re-run with that host's IP after
   extending `HOSTS` in the script.
4. **Apply k8s**:
   ```bash
   kubectl apply -f k8s/base/15-ingress-lan.yaml
   kubectl apply -f k8s/base/16-cert-issuer-lan.yaml
   kubectl apply -f k8s/base/17-portal-service.yaml
   kubectl apply -f k8s/base/05-cloudflared.yaml
   ```
5. **Smoke-test**:
   ```bash
   ./scripts/verify-split-routing.sh
   ```

## Cert rotation

cert-manager handles wildcard `*.maplespike.lan` renewals automatically (90d lifetime, 30d renewal threshold). The LAN CA root never expires; intermediate certs rotate based on `step-issuer`'s configured durations.

## DNS rotation

`*.maplespike.lan` records have a 1h TTL (`3600 IN A` in the Unbound local-zone). If Traefik's ingress IP moves, re-run `wire-lan-dns-unbound.sh <new-ip>` — same script, no other config changes needed.

## Mirating away from the old host-side Caddyfile

The legacy `maplespike/config/Caddyfile` accepted LAN traffic on host :443 and forwarded to k3s NodePort `32481` / `:3001`. After this rollout, LAN traffic flows straight to k3s Traefik via the Ingress — there's no host-side proxy to maintain. Confirm the migration:

```bash
# on the k3s node that previously ran Caddy:
ss -tlnp | grep ':443\b'           # → expect Traefik, not Caddy
curl -k -I https://api.maplespike.lan/v1/health   # → 200
```

If both green, you can `git rm maplespike/config/Caddyfile.deprecated`.

## Troubleshooting

| Symptom | Likely cause | Try |
|---|---|---|
| `dig +short maplespike.lan` returns NXDOMAIN | Unbound not reloaded, or local-zone not included | `sudo systemctl reload unbound`; verify `/etc/unbound/unbound.conf` includes `/etc/unbound/conf.d/*.conf` |
| `curl https://api.maplespike.lan/` returns TLS error | step-ca not yet bootstrapped | run `scripts/setup-stepca-lan.sh`; ensure `step-ca` is running |
| `kubectl describe certificate maplespike-lan-wildcard` shows `not ready` | step-issuer Secret wrong | re-run setup, re-do the `kubectl create secret` snippet |
| `https://api.maplespike.ca/` 502 / 521 | cloudflared pod not connected | `kubectl logs -n maplespike deployment/cloudflared` |
| `https://maplespike.lan/` 200 but body 404 | Portal Deployment image not built | `docker build --target portal -t maplespike-portal:dev .` |
