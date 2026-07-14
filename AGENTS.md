---
last-reviewed: 2026-07-10
status: active
---

# AGENTS.md — MapleSpike (a.k.a. Quill)

> **Mission**: Build the Library of Alexandria for Canadian public data — 150+ modules covering every federal, provincial, territorial, and municipal source.
> **Data-layer MCP product:** [Quill](./docs/products/quill.md) (see ADR [0005](./docs/decisions/0005-quill-product-name.md)).
> **Current metrics**: [docs/metrics.json](./docs/metrics.json) — 208 modules, **175 MCP tools** (runtime `getAllTools()` in `packages/quill-mcp/src/tools/index.ts`), **~200K lines TS** (200,412 exactly — see metrics.json), 14 packages. The auto-generator `scripts/generate-metrics.mjs` now parses `getAllTools()` directly post-fix; prior runs underreported.

Quick reference for agents working in this repo. Don't guess — check here first.

---

## Status (live as of 2026-07-10)

> **Volatile.** The cluster is degraded and the cloudflared tunnel is intermittent — exact route counts and pod statuses drift between probes. Treat the specifics below as a recent snapshot, not a contract.

**Public site:** https://quill.maplespike.ca/ — all 22 main nav routes (`/`, `/explorer`, `/agents`, `/pricing`, `/docs`, `/signup`, `/api-explorer`, `/changelog`, `/signal`, `/watcher`, `/blog`, `/contact`, `/citation`, `/ask`, `/status`, `/privacy`, `/terms`, `/workspace`, `/dashboard`, `/llms.txt`, `/robots.txt`, `/sitemap.xml`) return `200 OK` directly from the pod. Three paths return `404` by design: `/fr/` (trailing-slash variant; see Known Issues), `/login`, `/oauth` (never implemented). **Via the cloudflared tunnel, public curl results are inconsistent**, sometimes matching the pod, sometimes returning `521`/intermittent `404` — see Known Issues § "Cloudflared tunnel flakiness".

> **Install paths (all defined in this repo; production cluster ships via Nix manifests + Kustomize, not via any of these install paths directly).** The Nix-first build (`flake.nix`) is the source of truth and emits OCI images, K8s manifests, and Podman quadlets. The **canonical public registry is now `nexus:5000/quill-<svc>`** (was `ghcr.io/reverb256/quill/<svc>` pre-2026-07-10 systemic flip; GHCR push is dormant — see Known Issues § Image-tag). Compatible layers ship alongside for self-hosters:
> 1. `selfhost.sh` / `nix run .#selfhost up` — Podman Quadlets via Nix (rootless, no registry needed). Install path documented; `nix run .#selfhost up` not exercised in this audit window.
> 2. `docker compose up -d` or `podman compose up -d` (`docker-compose.yml` at repo root) — standard Docker/Compose path. **OPERATOR-ONLY post-flip**: targets `nexus:5000/quill-<svc>` which is the operator-host registry. External self-hosters without nexus access should use path 1 (nix self-host) or build images locally first (`nix build .#quill-<svc>-image && podman load < result`). The wrapper auto-builds a `nexus:5000/quill-<svc>:<TAG>` retag in `nix run .#push-images` if you have the registry on your own host.
> 3. `render.yaml` Blueprint — Render.com deploy. **DEPRECATED post-flip** (Render can't reach `nexus:5000`); kept as a CfT template only. Use path 1 or path 2.
> 4. `helm install quill charts/quill/` — Helm 3 chart (Chart.yaml + values-prod.yaml + 8 templates present) pointing at the operator-host registry; production cluster currently runs the Nix-generated manifests + Kustomize namePrefix, NOT this chart. Templates contain Helm `{{ }}` syntax; bare-Python YAML cannot validate them; install `helm` and run `helm template charts/quill` first before any `helm install`.
> 5. `wrangler pages deploy packages/portal/dist --project-name quill` — Cloudflare Pages for the static portal (requires adding `pages_build_output_dir` to a Pages-flavor `wrangler.toml` and `wrangler pages project create quill` first; tracked separately from the existing `quill-edge` Worker). Unaffected by the registry flip.
> 6. `nix run .#push-images` — publishes the Nix-built OCI images to `nexus:5000/quill-{api,mcp,portal}:<TAG>,<COMMIT>` (default `REGISTRY=nexus:5000`, `TAG=stable`); run on the operator host. The GHCR push path is RETIRED — see `docs/GHCR-CLEANUP.md` for archival context.
>
> Production cluster currently mirrors images from `nexus:5000/quill-<svc>:build-<ts>` (operator convention; `maplespike-portal` is the historical running tag being phased out per the rename wave); `nix run .#push-images` is the path to single-source so all six install paths converge on the same registry.

**Browser rendering (lightpanda CLI):** For JS-rendered data sources — sites that ship an empty SSR shell and only populate meaningful HTML after client hydration (PBO Nuxt at `pbo-dpb.ca`, several provincial regulator portals, SEDI public listings) — pipeline-core ships `packages/pipeline-core/src/utils/browser-fetch.ts`, a thin wrapper around the `lightpanda` CLI binary (https://lightpanda.io). It spawns `lightpanda fetch --dump <fmt> <url>` per call and returns the post-render DOM as a string with the same shape as `httpGet()`. **The binary is not packaged with the OCI images** — operators install it on the host (default `/home/j_kro/.local/bin/lightpanda`, override with `LIGHTPANDA_BIN`; self-hosters pull the precompiled release from `github.com/lightpanda-io/lightpanda/releases`). No ingestion module is wired to `browserFetch()` yet — the wrapper exists so individual fetchers can opt in behind a feature flag per file. A `__MAPLESPIKE_MOCK_BROWSER` flag (mirrors `__MAPLESPIKE_MOCK_FETCH` in `utils/http.ts`) short-circuits the subprocess to canned HTML in unit tests.

**Home lab cluster (`k3s`):** Both control-plane/etcd nodes (`nexus`, `sentry`) are `Unknown`; the two worker nodes (`forge`, `krash3`) are `Ready`. The portal pod (`maplespike-portal-79fc468865-wpksz`) is **currently scheduled directly on `nexus`** — so it's at higher-than-expected risk if `nexus` enrolls garbage collection. Verifying pod placement: `kubectl get pod -n maplespike <pod> -o wide`.

**Deployed portal image:** `nexus:5000/maplespike-portal:build-20260707-2036` (built 2026-07-07; pre-flip tag). The Deployment manifest `k8s/base/17-portal-service.yaml` declares `nexus:5000/quill-portal:dev` (post-flip), and a Kustomize **namePrefix** in the `maplespike` overlay still renames the resource `quill-portal` → `maplespike-portal`; the operator's actual path pushes fresh images to `nexus:5000/quill-<svc>:build-<ts>` on the operator host and patches the overlay image spec to point at the new tag — see "Image-tag construction" below.

---

## Repository Identity

| Attribute | Value |
|-----------|-------|
| Type | pnpm monorepo (pnpm@10.32.1) |
| Orchestrator | Turbo (workspace config in `turbo.json`) |
| Node | ≥18 (CI uses 22) |
| Packages | 14 in pnpm workspace (incl. `sdk-python` with `python -m build` and `i18n`) = 14 directories in `packages/`. See [docs/metrics.json](./docs/metrics.json) `packages.names` for the authoritative list. |
| TS | strict mode, ES2022 target, ESNext modules (bundler resolution) |
| No ESLint/Prettier | Match existing code style |
| npm scope | `@maplespike/` |
| License | AGPL-3.0 (pipeline-core) / MIT (others) |
| Changesets baseBranch | `prod` (not `main`) |
| Deploy | `scripts/deploy.sh` (reads `.env.deployment`); rollouts via `kubectl rollout restart` (see below) |

---

## Quick Start

```bash
# Enter dev environment (Nix-first)
nix develop

# Build all packages
pnpm build

# Run tests
pnpm test
```

> **Note:** Quick Start above builds/packages. For *running* the stack locally (three services on localhost), use `./scripts/dev-up.sh` — see the next section.

### Local dev recipes

| Task | Command | Notes |
| --- | --- | --- |
| Portal dev (Astro, hot-reload) | `cd packages/portal && pnpm dev` | http://localhost:4321 |
| Portal production-built preview | `cd packages/portal && pnpm build && python3 ./server.py` | `/app`-style path, port 8080 |
| API server | `cd packages/api-server && pnpm build && node dist/dev-server.js` | http://localhost:8082 |
| MCP server (SSE mode) | `cd packages/quill-mcp && PORT=3001 pnpm start:sse` | http://localhost:3001/sse |
| Full stack via Docker Compose | `./scripts/dev-up.sh` | api:8082 + mcp:3001 + portal:8080 |
| Tear down | `./scripts/dev-up.sh --down` | keeps `.env`, removes containers |

Storage modes (API server): `memory` (default), `sqlite` (`node:sqlite` built-in, no native compile), `postgres`.

Portal serves Astro static + a custom Python HTTP server (`server.py`) that adds:
- `Accept: text/markdown` content negotiation
- `/<path>.md` raw Markdown renderings for every page
- `/llms.txt` and `/llms-full.txt` AI-discovery files
- security headers + strict CSP (migrated from Cloudflare Pages `_headers`)

---

## Local Infrastructure & Deployment ★

> **Read first.** This section is the canonical reference for what runs where, how requests get to the right pod, and how to roll out a new build. If AGENTS.md is the first thing you read on entering this repo, this is the second.

### Two environments

| Environment | Where | What runs | How to start |
| --- | --- | --- | --- |
| **Dev** | This machine / a workstation | `docker compose` — api:8082, mcp:3001, portal:8080 | `./scripts/dev-up.sh` (wraps `docker compose` v1+v2) |
| **Prod** | k3s cluster on homelab (4 nodes: forge, krash3, nexus, sentry) | `nix build .#saas-manifests && kubectl apply -f result/manifests.yaml` — 5 pods in `maplespike` namespace + cloudflared tunnel | `nix run .#deploy-saas` (or `nix build .#saas-manifests -L && kubectl apply -f result/manifests.yaml`) |

### Cluster topology (current)

| Node | Current status | Role in this stack |
| --- | --- | --- |
| **forge** | `Ready` | Worker node; mining workload. Non-critical for MapleSpike. |
| **krash3** | `Ready` | Worker node; healthy. |
| **nexus** | `Unknown` ⚠️ | **Control-plane + etcd** node; 46 GB RAM, GPU; primary host of `etcd` for the cluster. Currently also runs the portal pod. The `Unknown` is symptomatic of `etcd` flapping (kubelet heartbeat lost). |
| **sentry** | `Unknown` ⚠️ | Second **control-plane + etcd** node; GPU; AI-inference-gateway host. Same flapping. |

Run state of prod: 5/7 pods in the `maplespike` namespace are `Running` (`cloudflared`, `maplespike-api`, `maplespike-ingress`, `maplespike-mcp`, `maplespike-portal`); the remaining two `maplespike-ingest-*` are `Completed` (one-shot cronjob runs).

To check yourself:
```bash
kubectl get nodes -o wide
kubectl get pods -n maplespike -o wide
```

### Routing matrix (split-hostname, prod)

The pattern is "**split hostname routing**" — see [docs/ROUTING.md](./docs/ROUTING.md) for the rationale (ADR [0004](./docs/decisions/0004-split-hostname-routing.md)) and the bootstrap-order cookbook.

| Host family | Entry point | Backends (cluster Service names) |
| --- | --- | --- |
| `*.maplespike.lan` | k3s Traefik Ingress on the LAN | `maplespike-portal` (TCP 8080), `maplespike-api` (TCP 8082), `maplespike-mcp` (TCP 3001) |
| `*.maplespike.ca` | Cloudflare Edge → Tunnel → `cloudflared` pod in k3s | same three Services |

> The Service names in the running cluster carry the `maplespike-` prefix even though the source manifests in `k8s/base/` declare the names `quill-portal`, `quill-api`, `quill-mcp`. A Kustomize **namePrefix** (overlay) renames them at apply time. See "Image-tag construction" below for the same kind of mismatch for image tags. Legacy aliases `mcp.maplespike.{ca,lan}` and `data.maplespike.ca` 301-redirect to `quill.maplespike.{ca,lan}` per [docs/ROUTING.md](./docs/ROUTING.md) § "Hostname aliases (Phase D)".

**One upstream, two entry points.** Both entry points terminate at the same three k3s Services.

#### Hostname → Service table (active `cloudflared-config` ConfigMap in `maplespike`)

```yaml
ingress:
  - hostname: quill.maplespike.ca
    service: http://maplespike-portal.maplespike.svc.cluster.local:8080
  - hostname: api.maplespike.ca
    service: http://maplespike-api.maplespike.svc.cluster.local:8082
  - hostname: mcp.maplespike.ca
    service: http://maplespike-mcp.maplespike.svc.cluster.local:3001
  - hostname: kanban.maplespike.ca
    service: http://maplespike-kanban-exec.maplespike.svc.cluster.local:8080
  - service: http_status:404   # catch-all
```

`.lan` ingress lives in `k8s/base/15-ingress-lan.yaml` and is roughly the same shape with `maplespike.lan`, `portal.maplespike.lan`, `api.maplespike.lan`, `mcp.maplespike.lan`, `quill.maplespike.lan` (and `dev.*` analogues).

### Container layout (Portal, from `Dockerfile` portal stage)

```dockerfile
FROM docker.io/python:3.13-slim AS portal
WORKDIR /app
COPY packages/portal/dist /app                      # dist contents flatten into /app
COPY packages/portal/server.py /app/server.py
EXPOSE 8080
ENV PORT=8080
CMD ["python3", "/app/server.py"]
```

**Prod portal runtime is Python — not nginx.** The Dockerfile's `portal` stage runs `python3 /app/server.py` (Python 3.13-slim). Traefik on `*.maplespike.lan` and cloudflared on `*.maplespike.ca` terminate TLS; the Python server serves static + content negotiation. An `nginx.conf` exists at [`./packages/portal/nginx.conf`](./packages/portal/nginx.conf) as a swap-in template but is **not** in the running image — it's reserved for a future migration.

`server.py` therefore has `DIRECTORY = /app/` and resolves URL → file as:

1. `/docs/<rel>` → serve from `DOCS_DIR` (`/app/docs/`)
2. Extensionless URL with no trailing slash → try `/app/<path>.html` (because Astro's `build.format = 'file'` produces `<page>.html`, not `<page>/index.html`)
3. `/<path>.md` → serve Markdown extract of `/app/<path>.html` with `x-markdown-tokens` header
4. `Accept: text/markdown` → same Markdown extraction on the fly
5. Else fall through to `SimpleHTTPRequestHandler` from `/app/`.

This is why every link in `BaseLayout.astro` is written without a `.html` suffix and sometimes with or without a trailing slash — they all hit branch (2) above.

See [./packages/portal/server.py](./packages/portal/server.py) for full logic. See [./packages/portal/astro.config.mjs](./packages/portal/astro.config.mjs) for the `format: 'file'` setting.### Image-tag construction (resolved post-flip)

After the 2026-07-10 systemic registry flip, the canonical registry is `nexus:5000/quill-<svc>` and the cluster pulls from it directly (no separate overlay-patching needed). Two source-of-truth differences remain:

| Location | Reference | Image spec |
| --- | --- | --- |
| `k8s/base/17-portal-service.yaml`, `10-api-deploy.yaml`, `11-mcp-deploy.yaml` | The Deployment specs | `nexus:5000/quill-portal:dev` (and `:api:dev`, `:mcp:dev`) |
| `charts/quill/values*.yaml` | `image.registry: nexus:5000` + `image.tag: stable` — renders to `nexus:5000/quill-<svc>:stable` | post-flip |
| Kustomize **namePrefix** (overlay, applied to `maplespike` overlay) | Renames `quill-*` Deployments/Services to `maplespike-*` | n/a — affects Service names, not image strings |
| **Actual running image** in the cluster | What you see via `kubectl describe pod` | `nexus:5000/maplespike-portal:build-20260707-2036` (pre-flip tag, rename wave pending) |

The cluster DOES pull from `nexus:5000/quill-...` post-flip. The `localhost/...` kustomize override remains in `k8s/base/kustomization.yaml` `images:` block as a defensive override (CI/build pipelines that rely on a local load); it's harmless for `nexus:5000`-pulling overlays because the overlay image spec is what wins at apply time.

When rolling out:

1. Build on a docker-enabled node — `nix build .#quill-<svc>-image -L` (preferred, Nix-first), or `docker build --target <stage> -t nexus:5000/quill-<svc>:build-$(date +%Y%m%d-%H%M) .` for non-Nix operators.
2. Push to the local registry: `nix run .#push-images` (defaults: `REGISTRY=nexus:5000`, `TAG=stable`, `COMMIT=$git_sha`), or `docker push nexus:5000/quill-<svc>:build-<ts>`.
3. Either (a) edit the Deployment manifest's `image:` line in the `maplespike` overlay, or (b) run `scripts/deploy.sh --overlay prod`.
4. `kubectl rollout restart deployment/maplespike-<service> -n maplespike` — **note the `maplespike-` prefix; the source manifests use `quill-` but the cluster has `maplespike-` until the rename rollout completes.**

**Resolved:** pre-flip three-way mismatch (`ghcr.io` vs `localhost` vs `nexus:5000`) is collapsed to a single canonical `nexus:5000/quill-<svc>` after the systemic flip. GHCR push is dormant; `docs/GHCR-CLEANUP.md` is now archival.

### Secrets (SOPS + age)

Production secrets are managed with **SOPS + age**; plaintext templates live in `secrets/*.yaml.example`, encrypted forms in `secrets/*.yaml` are committed, and decryption keys live at `/etc/nixos/.age/nexus-prod-key.txt` (or the workstation's `.age/`). Sync to k3s:

```bash
QUILL_REPO=/opt/quill /opt/quill/scripts/sops-sync-k8s.sh
```

…or via the sops-nix systemd timer on `nexus` (see `nix/sops-sync-k8s.timer` + `.service`).

See [./secrets/README.md](./secrets/README.md) for the full workflow (encrypt, decrypt, rotate, the per-file age recipients).

### Rebuild & roll out (operator recipe)

```bash
# 1. Build on a docker-enabled node (forge or krash3):
docker build --target portal  -t nexus:5000/maplespike-portal:build-$(date +%Y%m%d-%H%M)  .
docker build --target api-server -t nexus:5000/maplespike-api:build-$(date +%Y%m%d-%H%M) .
docker build --target quill-mcp -t nexus:5000/maplespike-mcp:build-$(date +%Y%m%d-%H%M) .

# 2. Push to local registry:
docker push nexus:5000/maplespike-portal:build-...
docker push nexus:5000/maplespike-api:build-...
docker push nexus:5000/maplespike-mcp:build-...

# 3. Apply the matching overlay (re-points Deployment image at the new tag):
#    - k8s/overlays/prod/  for production
#    - k8s/overlays/dev/   for the dev cluster
kubectl apply -k k8s/overlays/prod      # or: scripts/deploy.sh --overlay prod

# 4. Roll out (cluster names are `maplespike-*`, NOT `quill-*`):
kubectl rollout restart deployment/maplespike-portal -n maplespike
kubectl rollout restart deployment/maplespike-api    -n maplespike
kubectl rollout restart deployment/maplespike-mcp    -n maplespike
```

**Verify the rolling image actually changed** (use the actual cluster label, verified via `kubectl get pod <pod> --show-labels` → `app=maplespike-portal`):
```bash
kubectl get pod -n maplespike -l app=maplespike-portal -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].image}{"\n"}{end}'
```

> **Source manifest vs. cluster name mismatch:** `k8s/base/*.yaml` declares Deployments named `quill-portal`, `quill-api`, `quill-mcp`. The cluster has `maplespike-portal`, `maplespike-api`, `maplespike-mcp` because a **Kustomize namePrefix** is applied at deploy time. The recipe above uses the cluster-side names. If you `kubectl get deploy` to confirm, expect the `maplespike-` pattern; the `app=maplespike-<svc>` label selector is what matches the running pods.

The corresponding `scripts/deploy.sh --build --overlay prod` (or `--overlay dev`) automates most of this. See [./docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) and [./DEPLOY-CHECKLIST.md](./DEPLOY-CHECKLIST.md).

### Verification after deploy

Public:
```bash
curl -I                          https://quill.maplespike.ca/            # 200
curl -I                          https://quill.maplespike.ca/agents      # 200
curl -I                          https://quill.maplespike.ca/explorer    # 200
curl -sI -o /dev/null -w '%{http_code}\n' https://api.maplespike.ca/v1/health   # 200
curl -sI -o /dev/null -w '%{http_code}\n' https://mcp.maplespike.ca/health      # 200 (or SSE 200)
```

Bypass the cloudflared tunnel to verify the pod itself (avoids tunnel flakiness):
```bash
POD=$(kubectl get pod -n maplespike --no-headers -o custom-columns=NAME:.metadata.name | grep portal | head -1)
kubectl port-forward -n maplespike pod/"$POD" 18080:8080 &
curl -sI -o /dev/null -w 'HTTP=%{http_code}\n' http://127.0.0.1:18080/agents
```

Check cloudflared health (look out for `"failed to accept QUIC stream"` or `timeout` lines):
```bash
kubectl logs -n maplespike -l app=cloudflared --tail=60 | grep -i 'error\|timeout\|unregister' | tail
```

### Bootstrap (one-time)

For a brand-new node joining the cluster, run the four bootstrap scripts in [docs/ROUTING.md](./docs/ROUTING.md) § "One-time bootstrap order". They bring up cert-manager + step-issuer, init `step-ca`, wire LAN DNS via Unbound, then apply the k3s manifests. Strict ordering: only `kubectl apply` requires all prereqs; the other three can run in any order and are themselves idempotent.

---

## Architecture Overview

```
Internet → Cloudflare Tunnel (cloudflared pod in k3s)
  ├→ maplespike.ca / quill.maplespike.ca → Portal (:8080) — Astro static + server.py
  ├→ api.maplespike.ca                   → API    (:8082) — Node.js API server (SQLite/PostgreSQL)
  │   ├→ AI Gateway — glm-5.2 via AI Inference Gateway
  │   ├→ Qdrant — vector search for RAG
  │   ├→ Astral Key (proxy) — Web3 SIWE + FIDO2 passkey auth
  │   └→ BYOK middleware — users bring their own AI key
  └→ mcp.maplespike.ca                   → Quill  (:3001) — [Quill](./docs/products/quill.md) data-layer MCP server (175 tools, incl. `x402-deposit`)
```

For LAN access: substitute `*.maplespike.lan` everywhere `*.maplespike.ca` appears above.

---

## Package Quick Reference

| Package | Entry point | Build | Test (framework) | Published? |
|---------|-------------|-------|------------------|------------|
| `pipeline-core` | `dist/index.js` | `tsc -b` | `node --test` (tsx) | No |
| `quill-mcp` *(Quill, ADR 0005)* | `dist/cli.js` (bin: `quill-mcp`) | `tsc -b` | `node --test` (tsx) | No |
| `api-server` | `dist/dev-server.js` | `tsc -b` | `node --test` (tsx) | No |
| `engine` | `src/index.ts` | `tsc` | `vitest` (no config file) | No |
| `sdk` | `dist/index.js` (tsup, CJS+ESM) | `tsup` | `pnpm build && tsx --test` | Yes (npm) |
| `legal-core` | `dist/index.js` (tsup) | `tsup` | — | Yes (npm) |
| `legislation` | `dist/index.js` (tsup) | `tsup` | — | Yes (npm) |
| `sdk-python` | `quill/__init__.py` | `python -m build` | — | Yes (PyPI) |
| `portal` | `.` (Astro static + `server.py` runtime) | `astro build` | — | No |
| `database` | `dist/index.js` | `tsc -b` (better-sqlite3 via `node:sqlite` BUILTIN at runtime) | `node --test` (tsx) | No |
| `notification-service` | `dist/index.js` | `tsc -b` | `node --test` (tsx) | No |
| `create-module` | `dist/cli.js` (bin) | `tsc -b` | — | No |
| `docs` | `src/index.md` | VitePress | — | No |

---

## Auth Chain

Three auth methods, all returning JWT + MapleSpike API key:

1. **Passkey (WebAuthn/FIDO2)** — `@simplewebauthn/server` (Node) + Astral Key (Rust)
2. **Web3 (SIWE/EIP-4361)** — Ethereum signature verification via viem + Astral Key
3. **OAuth** — Casdoor SSO, GitHub, Google

Auth state is managed globally via `packages/portal/public/auth.js` — it injects account UI into the navbar on every page; components read from `window.MapleSpikeAuth`.

---

## AI Architecture

- **Default**: Routes to cluster AI Inference Gateway (GLM-5.2)
- **BYOK**: Users configure their own provider (OpenAI, Anthropic, ZAI, etc.) via `/v1/ai/settings` — stored per-tenant
- **RAG**: Qdrant vector search → context injection → LLM generation
- **Fallback**: Gov/keyword search if Qdrant has no data

---

## Key Files

| File | Purpose |
|------|---------|
| `packages/portal/src/layouts/BaseLayout.astro` | Global layout (nav, footer, auth) — every nav link routes through here |
| `packages/portal/astro.config.mjs` | `output: 'static'`, `format: 'file'` — explains why `<page>.html` is served extensionless |
| `packages/portal/server.py` | Production Python HTTP server, /app-served, with extensionless routing |
| `packages/portal/public/auth.js` | Global auth state manager |
| `packages/portal/public/config.js` | Runtime config (auto-derives API URL from `window.location.hostname`) |
| `packages/api-server/src/index.ts` | Main router (CORS, auth exemption, routes) |
| `packages/api-server/src/node-sqlite-storage.ts` | Persistent storage (node:sqlite) |
| `packages/api-server/src/routes/ai.ts` | AI ask/analyze (RAG + BYOK) |
| `packages/api-server/src/routes/astral-proxy.ts` | Astral Key auth proxy |
| `packages/api-server/src/routes/ai-settings.ts` | BYOK provider resolution |
| `packages/api-server/src/response.ts` | CORS origins, response envelope |
| `Dockerfile` | Multi-stage build (portal stage is `python:3.13-slim`; api/mcp stages are `node:22-bookworm-slim`) |
| `k8s/base/` | Kustomize base manifests |
| `k8s/base/kustomization.yaml` | Includes 6 resources + image overrides (`localhost/...`) |
| `k8s/base/15-ingress-lan.yaml` | LAN ingress (Traefik class) |
| `k8s/base/17-portal-service.yaml` | Portal Deployment + Service |
| `k8s/base/05-cloudflared.yaml` | Cloudflare Tunnel pod. The live tunnel UUID is in the `cloudflared-config` ConfigMap — get it via `kubectl get cm cloudflared-config -n maplespike -o yaml \| yq '.data \| to_entries \| .[].value' \| grep -E '^tunnel:'` (or any plaintext grep over the same `get`). The DEPLOY-CHECKLIST.md example UUID is illustrative, not authoritative. |
| `docs/ROUTING.md` | Split-hostname routing matrix + bootstrap order |
| `docs/DEPLOYMENT.md` | Local dev (docker-compose) and prod cutover recipes |
| `DEPLOY-CHECKLIST.md` | Step-by-step maplespike.ca production launch checklist |
| `secrets/README.md` | SOPS+age workflow |
| `scripts/dev-up.sh` | Docker compose wrapper for the dev stack |
| `scripts/deploy.sh` | End-to-end image build + kustomize apply + verify |
| `scripts/sops-sync-k8s.sh` | Decrypt secrets/*.yaml and apply to k3s |

---

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`):
- Triggers on push/PR to `main` and `prod`
- Uses Node 22, pnpm (auto-detected version)
- Runs `pnpm build` + `pnpm test`
- On `prod` branch: **builds** Docker images for the operator-host registry `nexus:5000/quill-<svc>` (no-push; the operator runs `nix run .#push-images` on the bare metal host with the binary already built). GHCR push is RETIRED post-flip — `if: false` on the GHCR login + `push: false` on `build-push-action`. To restore GHCR push when PAT scope is bumped, swap `push: true` and retarget tags back to `ghcr.io`.

---

## Design System

- **Theme**: Dark-first, shadcn/ui with Canadian-red primary (`hsl(0 72% 51%)`)
- **Fonts**: Inter (sans) + JetBrains Mono (mono) — loaded via Google Fonts
- **Brand utilities**: `.aurora`, `.bg-grid`, `.text-gradient`, `.card-hover`, `.btn-sheen`
- **Card elevation**: `--card: 0 0% 6.5%` (dark) — visible against `--background: 0 0% 3.5%`
- **Logo**: Geometric 11-spike maple leaf with data connection lines (SVG)

---

## Known Issues & Status

> **Updated 2026-07-10.** Read this before debugging "why is X not working."

| Issue | Impact | Fix path |
| --- | --- | --- |
| `nexus` k3s node `Unknown` | Primary control-plane runner down. Pipeline ingestion and most prod pods at risk of reschedule. Portal pod currently serving because scheduling happened before the flap, but is not safe long-term. | `nixos-rebuild switch` on `nexus` to fix `/etc/nix/machines` (source already patched); check `etcd` health with `journalctl -u k3s` |
| `sentry` k3s node `Unknown` | AI-inference-gateway host down. MapleSpike unaffected directly; degrades the RAG/Qdrant hot path if persisted. | Same `nixos-rebuild switch`; secondary fallback if needed |
| Cloudflared tunnel flakiness | `cloudflared` pod logs show `"failed to accept QUIC stream: timeout: no recent network activity"`. The reported `cloudflared` version is in the `2026.6.x` line (recommended: `≥ 2026.7.0`). Symptom: public curl results drift — a route verified `200` minutes ago may now return `521` or `404`. Direct pod access (`kubectl port-forward … 18080:8080`) consistently returns `200` for every route in `dist/`, confirming port-side is fine and the tunnel is the source. | Upgrade `cloudflared` image tag in `k8s/base/05-cloudflared.yaml` to `2026.7.0`+; redeploy |
| `/fr/` (trailing-slash) → 404 | `/fr` works (200), `/en` works (200), but `/fr/` 404s because server.py's extensionless rewrite `if not os.path.splitext(p)[1] and not p.endswith("/")` does **not** strip the trailing slash, then `SimpleHTTPRequestHandler` falls through to look for the directory `/app/fr/` which doesn't exist (Astro `format: 'file'` flattens to `fr.html`, not `fr/index.html`). Note: during the flakiness window this row was unstable — both `/fr` and `/fr/` returned 404 briefly. | Patch `packages/portal/server.py` to strip trailing `/` before the extensionless lookup. Low risk, isolated. |
| `/login`, `/oauth` → 404 | Not implemented in `packages/portal/src/pages/`. Nav never references them. | No action needed unless intentionally adding a login route. |
| Image-tag mismatch (`ghcr.io` vs `localhost` vs `nexus:5000`) | ✅ **RESOLVED 2026-07-10** (systemic registry flip: all sources now point at `nexus:5000/quill-<svc>`). The historical narrative above is preserved for context; the running install matrix converges on a single registry. | n/a |
| OWASP dashboard merged | `packages/portal` now hosts the dashboard; no dedicated dashboard directory remains |
| `packages/pretext-civic` removed | Was orphaned React library after the Next.js → Astro migration |
| Sentry node occasionally NotReady | k3s etcd flapping (same row as `nexus`), non-blocking |
| Forge node status was Unknown | Mining workload, non-critical for MapleSpike. Pretty consistent since 2026-06 |

---

## Related Repositories

- [reverb256/ai-inference-gateway](https://github.com/reverb256/ai-inference-gateway) — AI gateway, model routing, RAG
- [reverb256/astral-key](https://github.com/reverb256/astral-key) — Rust Web3/FIDO2/passkey auth microservice
- [reverb256/nixos-config](https://github.com/reverb256/nixos-config) — Cluster NixOS config

---

## Document hygiene

- **`AGENTS.md` is the source of truth.** Sibling `AGENTS.html` is an outdated static snapshot (Jul 3, 2026); do not edit.
- **Counts that align (as of 2026-07-10):** `docs/metrics.json.mcpTools.count` reads **175** from a fresh `scripts/generate-metrics.mjs run; the script now parses `getAllTools()` directly (166 single-tool entries) and adds 6 WDI + 3 Comtrade adapter expansions. `LandingBody.astro` and `AGENTS.md` repository-identity line both reflect **175**. If a future caller sees drift, the cause is no longer the script — it would be a real change in `tools/index.ts`.
- **Live route / pod state** changes between probes (cloudflared flap, etcd flap). Treat the Status section as a *recent snapshot*. To refresh: `curl -sI https://quill.maplespike.ca/<route>` + `kubectl get pods -n maplespike -o wide`.
