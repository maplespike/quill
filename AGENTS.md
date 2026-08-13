---
last-reviewed: 2026-08-11
status: active
---

# AGENTS.md — MapleSpike (a.k.a. Quill)

> **Mission**: Build the Library of Alexandria for Canadian public data — 150+ modules covering every federal, provincial, territorial, and municipal source.
> **Data-layer MCP product:** [Quill](./docs/products/quill.md) (see ADR [0005](./docs/decisions/0005-quill-product-name.md)).
> **Current metrics**: [docs/metrics.json](./docs/metrics.json) — 208 modules, **175 MCP tools** (runtime `getAllTools()` in `packages/quill-mcp/src/tools/index.ts`), **~200K lines TS** (200,412 exactly — see metrics.json), 14 packages. The auto-generator `scripts/generate-metrics.mjs` now parses `getAllTools()` directly post-fix; prior runs underreported.

Quick reference for agents working in this repo. Don't guess — check here first.

---

## Status (live as of 2026-08-11)

> **Stable.** All 4 cluster nodes `Ready`. Cloudflare tunnel healthy (2026.7.1). All auth methods operational. Stripe billing configured in test mode.

**Public site:** https://quill.maplespike.ca/ — all 22 main nav routes (`/`, `/explorer`, `/agents`, `/pricing`, `/docs`, `/signup`, `/api-explorer`, `/changelog`, `/signal`, `/watcher`, `/blog`, `/contact`, `/citation`, `/ask`, `/status`, `/privacy`, `/terms`, `/workspace`, `/dashboard`, `/llms.txt`, `/robots.txt`, `/sitemap.xml`) return `200 OK` directly from the pod. Three paths return `404` by design: `/fr/` (trailing-slash variant; see Known Issues), `/login`, `/oauth` (never implemented). **Via the cloudflared tunnel, all public endpoints verified 200/301/401-as-expected on 2026-08-10**: portal `/` and `/verify` (public claim-verify page) 200; API `/v1/health`, `/v1/status`, `/v1/claims/latest` 200 and `/v1/claims/verify/{hash}` live; MCP `/health` 200 and `/sse` 401 (auth-gated).

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

**Home lab cluster (`k3s`):** Single node `nexus` (control-plane + etcd, NixOS 26.11, k3s v1.36.1). Active deployments in `maplespike` namespace: `quill-api`, `quill-mcp`, `quill-portal` (pinned image tags from flake.nix, NOT `latest` — the `deny-latest-tag-deployments` admission policy rejects it). `cloudflared` runs in the separate `cloudflared` namespace (2 replicas, protocol http2, dials pinned ClusterIPs). Old `maplespike-*` deployments deleted; all traffic routes through quill-* services. Verifying pod placement: `kubectl get pod -n maplespike -o wide`.

**Deployed images (pinned in flake.nix, 2026-08-11):** `nexus:5000/quill-api:2026-08-10-9` (quill_ key rename + QUILL_DB_PATH binding fix), `nexus:5000/quill-mcp:2026-08-10-4` (eurostat removal + normalizeProvince fix), `nexus:5000/quill-portal:2026-08-10-3` (ThreadingHTTPServer + explorer fix). **These pins MUST track live rollouts** — a canonical `nix build .#saas-manifests` that pins an older tag regresses the cluster (2026-08-11: api `-4` pin would have rolled back the quill_ rename). All three deployments use `imagePullPolicy: IfNotPresent` (images are pinned tags in the local containerd store; the nexus:5000 registry is a bare podman container that does not survive reboots — see Known Issues).

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

## ⚠️ MANDATORY WORKFLOW — OpenSpec First

**Every feature, change, or addition in this repo uses OpenSpec.** Do not accept a request
to build/change/add without following the propose→apply→archive cycle. Trivial one-line fixes
(typo, single config value) are the only exceptions.

- `/opsx:explore <topic>` — think it through first (required unless requirements are 100% concrete)
- `/opsx:propose <name>` — creates change folder with proposal, specs, design, tasks
- `/opsx:apply` — implement against the spec
- `/opsx:archive` — specs merged, change filed

Specs live in `openspec/specs/`. The `spec-driven-with-review` custom schema adds a pre-implementation
review artifact. See `openspec/config.yaml` for repo context.

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
| **Dev (local)** | This machine / a workstation | `docker compose` — api:8082, mcp:3001, portal:8080 | `./scripts/dev-up.sh` (wraps `docker compose` v1+v2) |
| **Dev (cluster)** | k3s cluster on homelab (single node: nexus), namespace `quill-dev` | Same images, LAN-only bundle from `saasManifests { namespace = "quill-dev"; dev = true; }` — no tunnel, dynamic ClusterIPs, dev.* ingress hosts | `nix run .#push-images && nix run .#deploy-dev` (CI: `.github/workflows/deploy-dev.yml` on every push to main) |
| **Prod** | k3s cluster on homelab (single node: nexus) | `nix build .#saas-manifests && kubectl apply -f result/manifests.yaml` — pods in `maplespike` + `cloudflared` namespaces | `nix run .#deploy-saas` (or `nix build .#saas-manifests -L && kubectl apply -f result/manifests.yaml`) |

### Cluster topology (current)

| Node | Current status | Role in this stack |
| --- | --- | --- |
| **nexus** | `Ready` (2026-08-10; earlier `Unknown` from etcd flap) | **Single control-plane + etcd node**; 46 GB RAM, GPU; runs all `maplespike` + `cloudflared` pods. K3s v1.36.1, NixOS 26.11 (Zokor). |
| forge / krash3 / sentry | NOT part of the Quill deploy | Other homelab nodes; Quill deploys only to nexus. |

Run state of prod: pods in `maplespike` (`quill-api`, `quill-mcp`, `quill-portal`) + `cloudflared` namespaces. `maplespike-ingest-*` one-shot CronJobs are `Completed`.

To check yourself:
```bash
kubectl get nodes -o wide
kubectl get pods -n maplespike -o wide
kubectl get pods -n cloudflared -o wide
```

### Routing matrix (split-hostname, prod)

The pattern is "**split hostname routing**" — see [docs/ROUTING.md](./docs/ROUTING.md) for the rationale (ADR [0004](./docs/decisions/0004-split-hostname-routing.md)) and the bootstrap-order cookbook.

| Host family | Entry point | Backends (cluster Service names) |
| --- | --- | --- |
| `*.maplespike.lan` | k3s Traefik Ingress on the LAN | `maplespike-portal` (TCP 8080), `maplespike-api` (TCP 8082), `maplespike-mcp` (TCP 3001) |
| `*.maplespike.ca` | Cloudflare Edge → Tunnel → `cloudflared` pod in k3s | same three Services |

> The Service names in the running cluster carry the `maplespike-` prefix even though the source manifests in `k8s/base/` declare the names `quill-portal`, `quill-api`, `quill-mcp`. A Kustomize **namePrefix** (overlay) renames them at apply time. See "Image-tag construction" below for the same kind of mismatch for image tags. Legacy aliases `mcp.maplespike.{ca,lan}` and `data.maplespike.ca` 301-redirect to `quill.maplespike.{ca,lan}` per [docs/ROUTING.md](./docs/ROUTING.md) § "Hostname aliases (Phase D)".

**One upstream, two entry points.** Both entry points terminate at the same three k3s Services.

#### Hostname → Service table (active `cloudflared-config` ConfigMap in `cloudflared` ns)

> Upstreams are literal PINNED ClusterIPs (NOT DNS names): cloudflared's Go resolver on the minimal Alpine image dials 1.1.1.1 for `*.svc.cluster.local` and gets NXDOMAIN, which regresses the tunnel to edge 502s. The IPs are pinned in the Service specs (k8s/maplespike/*-service.yaml + nix/saas-manifests.nix) and MUST match.

```yaml
ingress:
  - hostname: quill.maplespike.ca
    service: http://10.43.100.12:8080
  - hostname: api.maplespike.ca
    service: http://10.43.100.10:8082
  - hostname: mcp.maplespike.ca
    service: http://10.43.100.11:3001
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
| **Actual running image** in the cluster | What you see via `kubectl describe pod` | `nexus:5000/quill-portal:2026-08-10-3` (post-flip tag; old `maplespike-portal:build-20260707-2036` phased out per rename wave) |

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

> **⚠ Key-path reality (2026-08-10):** the documented `/etc/nixos/.age/nexus-prod-key.txt` does **NOT** exist on nexus — the age key that exists is `/etc/nixos/.age/key.txt`, and it does **NOT** decrypt `secrets/runtime.yaml` (recipient mismatch). Until the correct nexus-prod key is restored, `sops-sync-k8s.sh` cannot decrypt `runtime.yaml` on nexus; secrets must be patched directly (`kubectl create secret generic maplespike-secrets --from-file=...`). The `nix/sops-sync-k8s.timer/.service` unit is documented but **not installed** on nexus (`systemctl status sops-sync-k8s` → not found); the sync has been run manually. Fix path: restore the nexus-prod age key, `sops set secrets/runtime.yaml '["QUILL_PII_HASH_SECRET"]' <64-hex>`, then run the sync.

**`QUILL_PII_HASH_SECRET` (Decision 0002):** registration/Auth **requires** a stable **64-char hex** secret in production — the api-server refuses `POST /v1/register` without it (fixed 2026-08-10; was unset because the nix manifests never injected it). It is now wired in `nix/saas-manifests.nix` (`optional: false`, so a fresh cluster **MUST run `scripts/sops-sync-k8s.sh` before `kubectl apply`** or the api pod wedges in ContainerCreating) and `scripts/sops-sync-k8s.sh` syncs it as `maplespike-secrets/pii-hash-secret` with a 64-hex validation guard. **Scope caveat:** the sync's PII fallback only engages when SOPS decrypts but lacks the key; when no decrypting age key exists at all (current nexus reality), the whole `maplespike-secrets` block is skipped as a safe no-op — patch the secret directly in that case.

See [./secrets/README.md](./secrets/README.md) for the full workflow (encrypt, decrypt, rotate, the per-file age recipients).

### Rebuild & roll out (canonical Nix deploy path)

The canonical production deploy path is **Nix-first**: the `flake.nix` drives OCI image builds (via `dockerTools.buildLayeredImage`), the `nix/saas-manifests.nix` generator produces a single `manifests.yaml` bundling all K8s resources, and `kubectl apply` syncs the cluster to the nix source of truth. No Dockerfiles or Kustomize overlays are needed.

```bash
# Build and apply all manifests from Nix (single command):
nix build .#saas-manifests -L
kubectl apply -f result/manifests.yaml

# Or use the convenience app (wraps the two commands above):
nix run .#deploy-saas
```

**What the manifest bundle contains** (14 resources):
| Order | Resource | Notes |
|-------|----------|-------|
| 00 | `Namespace/maplespike` | Application namespace |
| 00 | `Namespace/ai-inference` | AI gateway namespace |
| 03 | `GlobalNetworkPolicy/default-deny-enforced` | Calico GNP from `k8s/gnp-default-deny.yaml` (single source of truth via `builtins.readFile`). Allows TCP+UDP 7844 for cloudflared edge. |
| 05 | `Namespace/cloudflared` | Must carry label `app.kubernetes.io/name: cloudflared` for API NetworkPolicy |
| 05 | `ConfigMap/cloudflared-config` | Tunnel config with pinned ClusterIP upstreams (NOT DNS names) |
| 05 | `Deployment/cloudflared` | 2 replicas, `cloudflare/cloudflared:2025.4.0`, protocol http2 |
| 10 | `Deployment/quill-api` | Pinned image tag: `nexus:5000/quill-api:<apiTag>` |
| 10 | `Service/quill-api` | ClusterIP `10.43.100.10` (pinned) |
| 11 | `Deployment/quill-mcp` | Pinned image tag: `nexus:5000/quill-mcp:<mcpTag>` |
| 11 | `Service/quill-mcp` | ClusterIP `10.43.100.11` (pinned) |
| 17 | `Deployment/quill-portal` | Pinned image tag: `nexus:5000/quill-portal:<portalTag>` |
| 17 | `Service/quill-portal` | ClusterIP `10.43.100.12` (pinned) |
| 15 | `Ingress/maplespike.ca` | LAN traefik ingress (cluster uses caddy for external routing; this is a future-path resource) |

**Per-service image tags and securityContext:**

The `nix/saas-manifests.nix` generator accepts per-service tag overrides (`apiTag`, `mcpTag`, `portalTag`) defaulting to the shared `tag`. The flake pins these to match the registry:
```nix
saas-manifests = saasManifests {
  inherit pkgs;
  registry = "nexus:5000";
  tag = "2026-08-10-9";          # shared default
  apiTag = "2026-08-10-9";       # quill_ key rename + QUILL_DB_PATH binding fix
  mcpTag = "2026-08-10-4";       # eurostat removal + normalizeProvince fix
  portalTag = "2026-08-10-3";    # ThreadingHTTPServer + explorer fix
  domain = "maplespike.ca";
};
```

All three deploy containers carry `securityContext` (required by the cluster's `require-resources-and-security-deployments` admission policy):
```yaml
securityContext:
  allowPrivilegeEscalation: false
  runAsGroup: 1001
  runAsNonRoot: true
  runAsUser: 1001
```

**Cluster admission policies to be aware of:**
| Policy | What it blocks | Status |
|--------|---------------|--------|
| `deny-latest-tag-deployments` | Deployments using `:latest` image tag | ✅ Fixed — per-service pinned tags |
| `require-resources-and-security` (pods) + VAP `matchConditions` exclusion for local-path helper pods | Pods missing resources/securityContext — the exclusion lets `helper-pod-create-pvc-*` / `helper-pod-delete-*` through (they run as root with hostPath, impossible under the policy) | ✅ Exclusion is LIVE + tightened to `namespace == "kube-system"` (2026-08-11, spoof-proof); committed + shipped in the nix bundle; `git add` NEW files referenced by `readFile` or the flake source fetch silently drops them (that failure mode took 3 build cycles to find) |
| `require-resources-and-security-deployments` | Deployments missing `securityContext.runAsNonRoot` or resource limits | ✅ Fixed — all containers have securityContext + resources |

**Push new images to the registry:**
```bash
# Build and push all three images from Nix:
nix run .#push-images
# Override defaults: REGISTRY=nexus:5000 TAG=stable
```

**Verify after deploy:**
```bash
# Public endpoints through the tunnel:
curl -sI -o /dev/null -w '%{http_code}\n' https://api.maplespike.ca/v1/health    # 200
curl -sI -o /dev/null -w '%{http_code}\n' https://mcp.maplespike.ca/health       # 200
curl -sI -o /dev/null -w '%{http_code}\n' https://quill.maplespike.ca/           # 200

# Cluster state:
kubectl get pods -n maplespike -o wide
kubectl get pods -n cloudflared -o wide
kubectl rollout status deployment/quill-api -n maplespike --timeout=60s

# Check image tags are correct:
kubectl get deploy -n maplespike -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.template.spec.containers[0].image}{"\n"}{end}'
```

> **Replica count note:** The nix manifests set `replicas: 1` for api, mcp, and portal. The broken `maplespike-*` HPAs were **deleted 2026-08-10**, so no HPA can override the manifest replica count. If autoscaling is wanted later, fix the metrics server first (see k3s encryption issue below), then recreate the HPAs.

### Verification after deploy

Public:
```bash
curl -I                          https://quill.maplespike.ca/            # 200
curl -I                          https://quill.maplespike.ca/agents      # 200
curl -I                          https://quill.maplespike.ca/explorer    # 200
curl -sI -o /dev/null -w '%{http_code}\n' https://api.maplespike.ca/v1/health      # 200
curl -sI -o /dev/null -w '%{http_code}\n' https://api.maplespike.ca/v1/claims/latest  # 200
curl -sI -o /dev/null -w '%{http_code}\n' https://mcp.maplespike.ca/health         # 200
curl -sI -o /dev/null -w '%{http_code}\n' https://mcp.maplespike.ca/sse            # 401 = auth-gated (endpoint live)
curl -sI -o /dev/null -w '%{http_code}\n' https://quill.maplespike.ca/verify       # 200 (public claim-verify page)
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

Four auth methods, all returning JWT + MapleSpike API key. The auth mode is **native** (Node.js) with Astral Key proxy for Web3 and FIDO2.

| Method | Endpoint | Backend | Frontend | Status |
|--------|----------|---------|----------|--------|
| **GitHub OAuth** | `/v1/auth/oauth/github` | Node.js OAuth handler → GitHub API | "Sign in with GitHub" button | **Live** (Client ID + secret configured) |
| **Passkey (WebAuthn)** | `/v1/auth/passkey/{register,login}/{begin,complete}` | `@simplewebauthn/server` + Node.js | "Create passkey" button (`browserSupportsWebAuthn`) | **Live** (auto-creates tenant + API key on register) |
| **Web3 (EVM)** | `/v1/astral/web3/{nonce,verify}` | Astral Key proxy → Rust microservice (SIWE/EIP-4361) | "Connect Web3 wallet" button (`window.ethereum`) | **Live** (Ethereum, Polygon, Arbitrum, Optimism) |
| **Solana** | `/v1/astral/web3/solana/{nonce,verify}` | Direct Node.js Ed25519 verification (tweetnacl + bs58) | "Connect Solana wallet" button (`window.solana`) | **Coded & committed** (needs image rebuild for pod) |
| **API Key** | `X-Api-Key` header | `generateApiKey()` → key hash stored in DB | Signup form or after any auth | **Live** |
| **Registration** | `POST /v1/register` | Creates tenant + API key via `registerTenant()` | Email + name form | **Live** |

**Astral Key microservice**: Running in `astral-key` namespace (pod `astral-key-59bd486bf9-bsm5l`, PostgreSQL + Redis). Auth proxy routes at `/v1/astral/*`.

**Secrets**:
- `JWT_SECRET`: 512-bit, stored in k8s `quill-runtime-secrets` (key `jwt-secret`)
- `QUILL_PII_HASH_SECRET`: 256-bit, stored in k8s `quill-runtime-secrets` (key `pii-hash-secret`)
- `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET`: GitHub OAuth app `Maplespike Quill` (owner: `reverb256`)

Auth state is managed globally via `packages/portal/public/auth.js` — it injects account UI into the navbar on every page; components read from `window.MapleSpikeAuth`. The `SignupForm` component at `/signup` dynamically shows passkey, Web3, and OAuth buttons based on browser capabilities (`browserSupportsWebAuthn`, `window.ethereum`, `window.solana`).

---

## Billing

Three payment methods implemented, all in **test mode** via Stripe.

**Stripe routes:**
- `GET /v1/billing/plans` — Returns Free/Pro/Enterprise tier data (public)
- `GET /v1/billing/stripe/status` — Stripe account status (auth-required)
- `POST /v1/billing/stripe/webhook` — Stripe event handler (signature-verified)
- `GET /v1/billing/stripe/checkout` — Create checkout session
- `GET /v1/billing/orders` — Create/query payment orders
- `POST /v1/billing/reconcile` — Manual reconciliation

**Env vars (from k8s `quill-billing-secrets` via secretKeyRef):**

| Variable | Source |
|----------|--------|
| `STRIPE_SECRET_KEY` | `sk_live_51TXKNt...` (live) |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_51TXKNt...` (live) |
| `STRIPE_TEST_SECRET_KEY` | `sk_test_51TXKNt...` (test) |
| `STRIPE_TEST_PUBLISHABLE_KEY` | `pk_test_51TXKNt...` (test) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_oBBRFm3d...` |
| `STRIPE_ACCOUNT_ID` | `acct_1TXKNtIZlbpvSCVX` |
| `STRIPE_ENV` | `test` (switch to `live` for production) |
| `QUILL_BILLING_SECRET` | 256-bit HMAC for order signing |
| `MAPLESPIKE_BILLING_EMAIL` | `billing@maplespike.ca` |

**Crypto treasury wallets** (8 EVM chains) — private keys encrypted with `age-plugin-yubikey` (both Nano + NFC Yubikeys required as recipients). Public addresses set on deployment:

| Chain | Address |
|-------|---------|
| Ethereum | `0xcc2aca38644f8ea6352f1cb43c5f014d778974c8` |
| Base | `0xeef30237e374508e5c09517533cdc3d5fde15297` |
| Polygon | `0xab9502b9f035b5c77b122c61ef27c9050ca0c42e` |
| Arbitrum | `0xeaf336c41419573381bc28ea3ad9c5507556c6f6` |
| Optimism | `0x3aa2847e5a6343cacab58a7952e0fb4ca69b4f50` |
| Avalanche | `0x271ac5aad37aa36f99856af71be87a81580c60f8` |
| BNB Chain | `0x70c34199aa80642fe9fe878f95f4fd7d6511a71e` |
| Tron | `0x8fb2f7a6c90adf2250dff387e7e8da228dc91383` |

**Treasury key recovery**:
```bash
# Requires Yubikey connected + touch
age --decrypt /home/j_kro/.config/maplespike-treasury/treasury.keys.age
```

**Stripe webhook** (configured in Stripe Dashboard → Webhooks):
- URL: `https://api.maplespike.ca/v1/billing/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

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

> **Updated 2026-08-10.** Issues resolved this session: cluster nodes all Ready, tunnel upgraded to 2026.7.1, old deployments cleaned, calico upgraded to v3.32.1, `/fr/` trailing-slash 404 fixed.

| Issue | Impact | Fix path |
| --- | --- | --- |
| **All nodes `Ready`** | ✅ **RESOLVED 2026-07-15** — forge, krash3, nexus, sentry all report `Ready`. Old `Unknown` states resolved. | Cluster stability recovered. |
| **Cloudflared tunnel flakiness** | ✅ **RESOLVED** — upgraded to `cloudflare/cloudflared:2026.7.1` with 0 restarts. Previous restarts (exit 255) resolved. | Image tag updated, deployment restarted. |
| `/fr/` (trailing-slash) → 404 | ✅ **RESOLVED** — `server.py` now strips trailing `/` before the extensionless lookup (`if len(p) > 1 and p.endswith("/"): p = p[:-1]`). Verified live 2026-08-10: `/fr`, `/fr/`, `/en` all 200 through the tunnel. | Done (in deployed portal image). |
| `/login`, `/oauth` → 404 | Not implemented in `packages/portal/src/pages/`. Nav never references them. | No action needed unless intentionally adding a login route. |
| **Old deployments cleaned** | ✅ `maplespike-api`, `maplespike-mcp`, `maplespike-portal` deleted. All traffic routes through `quill-*` services. | Done. |
| **Solana auth not deployed** | Code committed (`/v1/astral/web3/solana/{nonce,verify}`) but needs container image rebuild to deploy to pod. Registry digest pinning requires a clean build pipeline. | Rebuild with `podman build --format docker` or Nix. |
| **Calico host→pod ARP (2026-08-10 incident)** | ✅ **RESOLVED** — calico upgraded `v3.31.4 → v3.32.1` (tigera-operator `v1.40.7 → v1.42.4`). Two root causes: (1) calico-node `v3.31.4`/`v3.32.0` bundle `nft` `v1.0.x`, which segfaults on the NixOS 26.11 kernel (nftables-only, no legacy iptables); `v3.32.1` bundles `nft v1.1.1`, which works. (2) Pods run `arp_ignore=2`, so host→pod traffic depends on CNI-seeded host neighbor entries that lapse on pod churn or reboot. | If pods become unreachable after churn/reboot: `sudo bash scripts/ops/seed-pod-neighbors.sh` (re-seeds permanent neighbor entries). Re-run after any pod recreation or node reboot. Do NOT downgrade calico below v3.32.1. A systemd timer `quill-seed-neighbors.timer` (every 2 min) on nexus automates this; `systemctl list-timers | grep quill` to check. **VALIDATED 2026-08-11 reboot**: the timer fired 60s after boot (exit 0, 15 PERMANENT entries) — the durable ARP fix works unattended. |
| **Claims store wiped on rollout (2026-08-11)** | ✅ **RESOLVED** — `/data` (claims + api_keys + tenants, `QUILL_DB_PATH=/data/maplespike.db`) was an `emptyDir` in the nix source of truth, so every canonical deploy wiped it. Fixed: `nix/saas-manifests.nix` now mounts the `quill-api-data` PVC (10Gi local-path, matches `k8s/maplespike/quill-api-data-pvc.yaml`), added `fsGroup: 1001`. Verified live: claims survive `kubectl rollout restart` (7/7 after restart, 2026-08-11). | Re-seed claims after a DB wipe: `sudo bash scripts/ops/seed-claims.sh` (uses the real citationStore + awaited buildClaimBundle; idempotent). Keep `replicas: 1` on quill-api — two writers on one WAL SQLite file contends. |
| **Local-path PVCs Pending cluster-wide (2026-08-11 root cause)** | ✅ **RESOLVED** — the `local-path-provisioner` creates its helper pod (hostPath + root + privilege escalation — impossible under `restricted`/`baseline`) **in kube-system for ALL claims**, and kube-system carried `pod-security.kubernetes.io/enforce=restricted`. Every local-path PVC (quill-api-data, nix-store-nix-cache-0, qdrant-storage) was Pending with `violates PodSecurity "restricted:latest"`. Also, the `require-resources-and-security` VAP blocked helper pods cluster-wide. | Fix (live + persisted in nix/saas-manifests.nix namespace fragments): label BOTH `kube-system` and `maplespike` `pod-security.kubernetes.io/enforce=privileged` (k3s default for kube-system; the restricted label was a hardening overstep), and add the VAP `matchConditions` exclusion for `helper-pod-create-pvc-*`/`helper-pod-delete-*`. A rebuild MUST reproduce both or storage breaks again. Posture tradeoff: kube-system is now `privileged` cluster-wide — acceptable because it only affects the provisioner helper pod, but the clean long-term fix is running local-path-provisioner in its own privileged namespace (or a different CSI). | The kube-system Namespace labels are **apply-only**: if a future bundle omits them, `kubectl apply` will NOT remove them — drift is silent, not failing. The VAP exclusion was **tightened 2026-08-11** to require `namespace == "kube-system"` (generateName alone was a spoofable bypass: any pod named `helper-pod-create-pvc-evil` skipped the whole policy). |
| **Nexus reboot 2026-08-11: registry down → ImagePullBackOff → site 502/530** | ✅ **RESOLVED** — nexus rebooted; the `nexus:5000` OCI registry is a bare podman container (`registry`) that did NOT survive the reboot, and deployments used `imagePullPolicy: Always`, so every restart round-tripped the dead registry → ImagePullBackOff → 502/530 on both domains. `port 50000` is nix-serve (Nix binary cache), NOT the registry — the registry is `10.1.1.120:5000`. | Two-part fix (both live): (1) `imagePullPolicy: Always → IfNotPresent` on all three deployments (pinned tags already in the local containerd store — sovereign/local-first; do NOT revert), persisted in nix + k8s manifests; (2) `quill-registry.service` systemd unit on nexus (`podman start registry` on boot, `Restart=always`) so the registry survives reboots — `nix/quill-registry.container` is the quadlet reference (NixOS podman generator not wired on this host, plain unit used). |
| **better-sqlite3 “binding missing” false alarm (2026-08-11)** | The api image ships the native binding under `.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build/Release/better_sqlite3.node`. `require("/app/node_modules/better-sqlite3")` FAILS because pnpm never symlinks a top-level module — that is a WRONG test, not a missing binding. The correct runtime check is `cd /app/packages/api-server && node -e "require('better-sqlite3')"` (resolves via the package-local symlink). | Use the runtime-path require when verifying the binding. The `onlyBuiltDependencies` entry in `pnpm-workspace.yaml` is what makes the binding build in the image. |
| **Registration broken in prod (2026-08-10 journey finding)** | ✅ **RESOLVED** — `POST /v1/register` failed with `QUILL_PII_HASH_SECRET must be set to a stable 32-byte hex string in production` because the nix manifests never injected the env var (running pod had it UNSET). Fixed by wiring it in `nix/saas-manifests.nix` + `scripts/sops-sync-k8s.sh` and applying a valid 64-hex value to `maplespike-secrets/pii-hash-secret` (direct kubectl patch; DB was empty so rotation safe). Verified live: register → `success:true` + real API key through the tunnel. | Root fix is the nix wiring (survives rebuilds). See Secrets section for the missing age-key caveat + recovery sequence. |
| **`nix build .#saas-manifests` fails on nexus (2026-08-10)** | Running nix build as root on nexus fails with `Path "/nix" is world-writable or a symlink. That's not allowed for security.` — so the canonical deploy path cannot run as root on nexus. The 2026-08-10 PII env fix was applied via direct `kubectl patch` (now also in the nix source, so no permanent drift). | Try as non-root (`su j_kro -c 'nix build ...'`) or fix `/nix` store perms; otherwise apply changes via `kubectl patch` mirroring the nix source and verify with the checks in "Verification after deploy". |

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


## Writing style — ASD-STE100 + Zinsser

Write all user-facing prose in this repo in ASD-STE100 (Simplified Technical English) plus
Zinsser's four principles. This governs grammar and tone only. It does NOT override the
repo's hard rules (declarative-only, no-stubs, OpenSpec-first, root-cause-first).

- Use the imperative for instructions. "Run the build." Not "You should run the build."
- One idea per sentence. Short. Active voice.
- Plain words: use, do, run, make, check, show. Not utilize, execute, perform, demonstrate.
- No gerunds as nouns. No vague modals. Use "must / will / do not" for clear obligation.
- Zinsser's four principles: Simplicity. Brevity. Clarity. Humanity.
- Conclusion first. Then evidence. Then action.
- When you do not know, say so. Never fabricate.
