# 0004 — Split-hostname routing (LAN-direct vs. Cloudflare external)

**Status:** READY-FOR-BOOTSTRAP (2026-07-01) — k3s manifests + scripts + docs shipped; local CA + Unbound DNS user-confirmed in place (`we have local CA and dns unbound so we can set up tls for local`); awaiting operator's `kubectl apply` run from the bootstrap order in `ROUTING.md`.
**Date:** 2026-07-01
**Owner:** j_kro
**Driver:** previous monorepo wiring was inconsistent — a host-side Caddyfile for `.lan` (masking the fact that no k8s Ingress existed), a k8s cloudflared.yaml for `.ca`, plus a Cloudflare Worker plan that's now obsolete once cloudflared handles all external traffic. The user explicitly clarified the routing intent ("we'll use maplespike.lan from local (dev) and maplespike.ca from external (prod)") and asked for the k8s-side preparations.

## Status of the plan

| Step | Status (2026-07-01) | Evidence |
|---|---|---|
| **1 — Traefik Ingress for `*.maplespike.lan`** | ✅ WRITTEN | `maplespike/k8s/base/15-ingress-lan.yaml` (7 hosts → 3 services) |
| **2 — LAN TLS via cert-manager + step-ca** | ✅ WRITTEN, ⏸ bootstrap pending | `maplespike/k8s/base/16-cert-issuer-lan.yaml`; `scripts/setup-stepca-lan.sh` init one-time |
| **3 — LAN DNS via Unbound local-zone** | ✅ WRITTEN, ⏸ validation pending | `scripts/wire-lan-dns-unbound.sh` (user confirmed Unbound is in use) |
| **4 — Portal ClusterIP + Deployment** | ✅ WRITTEN | `maplespike/k8s/base/17-portal-service.yaml` (was missing; needed by 15 + cloudflared) |
| **5 — `cloudflared` for `*.maplespike.ca`** | ✅ EXISTS, comments refreshed | `maplespike/k8s/base/05-cloudflared.yaml` |
| **6 — Drop stale external Caddyfile** | ✅ MOVED-ASIDE | `maplespike/config/Caddyfile` → `maplespike/config/Caddyfile.deprecated` |
| **7 — Drop invalid-format `config/k8s/maplespike-ingress.yaml`** | ✅ MOVED-ASIDE | `maplespike/config/k8s/maplespike-ingress.yaml` → `.deprecated` |
| **8 — Fix `wrangler.toml` `HOMELAB_API`** | ✅ EDITED — now `https://api.maplespike.ca` | CF Edge cannot reach `.lan`; `.ca` routes through the tunnel cleanly |
| **9 — Operator smoke test** | ✅ WRITTEN | `scripts/verify-split-routing.sh` (DNS + LAN HTTPS + external HTTPS) |
| **10 — Routing guide** | ✅ WRITTEN | `maplespike/docs/ROUTING.md` |
| **11 — Bootstrap single-step installer** | ✅ WRITTEN | `scripts/install-cert-manager.sh` (cert-manager + smallstep step-issuer plugin in one idempotent install) |
| **12 — Doc assert Cloudflare-only** | ✅ EDITED | `DEPLOY-CHECKLIST.md` Options B/C replaced with a single "Only Option A (Cloudflare Tunnel) is supported" blockquote (per user directive `we will be using cloudflare tunnel`) |
| **13 — User-confirmed prerequisites** | ✅ CONFIRMED 2026-07-01 | local CA reachable at `https://step-ca.maplespike.lan:8443` and Unbound DNS both in place (user: "we have local CA and dns unbound so we can set up tls for local") |

## Networking matrix (canonical)

| Host | Path |
|---|---|
| `maplespike.lan` | LAN → Traefik Ingress → `quill-portal:8080` |
| `portal.maplespike.lan` | LAN → Traefik → `quill-portal:8080` |
| `dev.maplespike.lan` | LAN → Traefik → `quill-portal:8080` (gateway is dev layout) |
| `api.maplespike.lan` | LAN → Traefik → `quill-api:8082` |
| `dev-api.maplespike.lan` | LAN → Traefik → `quill-api:8082` (same backend, dev mode stays on the LAN) |
| `mcp.maplespike.lan` | LAN → Traefik → `quill-mcp:3001` |
| `dev-mcp.maplespike.lan` | LAN → Traefik → `quill-mcp:3001` |
| `maplespike.ca` | Cloudflare Pages landing page (out of cluster scope) |
| `api.maplespike.ca` | CF Edge → Tunnel → `cloudflared` pod → `quill-api:8082` |
| `mcp.maplespike.ca` | CF Edge → Tunnel → `cloudflared` pod → `quill-mcp:3001` |

## Decision

Adopt the matrix above as the authoritative split-version wiring. Two entry points terminate at the same three Services (`quill-portal`, `quill-api`, `quill-mcp`), so there's only one upstream surface to maintain. The Cloudflare Worker (`packages/edge-worker/`) is **not** part of this routing — cloudflared replaces it for `.ca` traffic. The legacy Caddyfile (and the malformed `config/k8s/maplespike-ingress.yaml`) is superseded.

LAN TLS uses a local step-ca + cert-manager step-issuer plugin; the wildcard `*.maplespike.lan` cert is auto-rotated every 90 days. LAN DNS resolution uses an Unbound local-zone written by a one-shot script.

## Consequences

- ✅ LAN clients reach `*.maplespike.lan` directly with no Cloudflare roundtrip — lower latency, no third-party involvement.
- ✅ External clients reach `*.maplespike.ca` via Cloudflare WAF/DDoS without exposing the cluster's public IP.
- ⚠️ LAN TLS now requires a one-time step-ca + cert-manager bootstrap. After that, renewals are automatic.
- ⚠️ LAN DNS resolution requires wiring Unbound once (one-shot script). After that, no manual config.
- ⚠️ If `step-ca.maplespike.lan` itself ever moves, the ClusterIssuer needs the new URL re-pasted.

## What the user has to do

> **Strict dependency:** only step 4 (`kubectl apply`) requires all of
> steps 1–3 to be complete. Steps 1–3 (LAN DNS wire + step-ca init +
> cert-manager install) can each be run *independently* in any order.
> Step 5 is the post-flight smoke test.

1. `sudo ./scripts/wire-lan-dns-unbound.sh <k3s-ingress-ip>` — once per LAN DNS host.
2. `sudo ./scripts/setup-stepca-lan.sh` — once per cluster (gives you the kubectl create-secret snippet, paste it).
3. `./scripts/install-cert-manager.sh` — once (single-step installs cert-manager + smallstep step-issuer).
4. `kubectl apply -f k8s/base/{15,16,17}-*.yaml k8s/base/05-cloudflared.yaml`
5. `./scripts/verify-split-routing.sh`

## References

- `maplespike/k8s/base/15-ingress-lan.yaml`
- `maplespike/k8s/base/16-cert-issuer-lan.yaml`
- `maplespike/k8s/base/17-portal-service.yaml`
- `maplespike/k8s/base/05-cloudflared.yaml` (comment-only edit)
- `maplespike/scripts/wire-lan-dns-unbound.sh`
- `maplespike/scripts/setup-stepca-lan.sh`
- `maplespike/scripts/verify-split-routing.sh`
- `maplespike/docs/ROUTING.md`
- `maplespike/wrangler.toml` (`HOMELAB_API` now `.ca`)
- `maplespike/config/Caddyfile` → `.deprecated`
- `maplespike/config/k8s/maplespike-ingress.yaml` → `.deprecated`
- Related: decision `0003-maplespike-public-visibility.md`
