---
last-reviewed: 2026-09-21
status: active
---

# AGENTS.md — MapleSpike (a.k.a. Quill)

> **Mission**: Build the Library of Alexandria for Canadian public data — 150+ modules covering every federal, provincial, territorial, and municipal source.
> **Data-layer MCP product:** [Quill](./docs/products/quill.md) (see ADR [0005](./docs/decisions/0005-quill-product-name.md)).
> **Current metrics**: [docs/metrics.json](./docs/metrics.json) — 207 modules, **184 MCP tools** (runtime `getAllTools()` in `packages/quill-mcp/src/tools/index.ts` + 6 WDI + 3 Comtrade adapter expansions), **~221K lines TS** (221,431 exactly — see metrics.json), 14 packages. The auto-generator `scripts/generate-metrics.mjs` now parses `getAllTools()` directly post-fix; prior runs underreported.

Quick reference for agents working in this repo. Don't guess — check here first.

---

## Status (live as of 2026-08-11)

> **Stable.** All 4 cluster nodes `Ready`. Cloudflare tunnel healthy (2026.7.1). All auth methods operational. Stripe billing configured in **live** mode (STRIPE_ENV=live since 2026-09-22).

**Public site:** https://quill.maplespike.ca/ — all 22 main nav routes (`/`, `/explorer`, `/agents`, `/pricing`, `/docs`, `/signup`, `/api-explorer`, `/changelog`, `/signal`, `/watcher`, `/blog`, `/contact`, `/citation`, `/ask`, `/status`, `/privacy`, `/terms`, `/workspace`, `/dashboard`, `/llms.txt`, `/robots.txt`, `/sitemap.xml`) return `200 OK` directly from the pod. Three paths return `404` by design: `/fr/` (trailing-slash variant; see Known Issues), `/login`, `/oauth` (never implemented). **Via the cloudflared tunnel, all public endpoints verified 200/301/401-as-expected on 2026-08-10**: portal `/` and `/verify` (public claim-verify page) 200; API `/v1/health`, `/v1/status`, `/v1/claims/latest` 200 and `/v1/claims/verify/{hash}` live; MCP `/health` 200 and `/sse` 401 (auth-gated).

> **Install paths (all defined in this repo; production cluster ships via Nix manifests + Kustomize, not via any of these install paths directly).** The Nix-first build (`flake.nix`) is the source of truth and emits OCI images, K8s manifests, and Podman quadlets. The **canonical registry is the operator-host registry `quill-<svc>`** (was `ghcr.io/reverb256/quill/<svc>` pre-2026-07-10 systemic flip; GHCR push is dormant). Compatible layers ship alongside for self-hosters:
> 1. `selfhost.sh` / `nix run .#selfhost up` — Podman Quadlets via Nix (rootless, no registry needed). Install path documented.
> 2. `docker compose up -d` or `podman compose up -d` (`docker-compose.yml` at repo root) — standard Docker/Compose path. **OPERATOR-ONLY post-flip**: targets the operator-host registry. External self-hosters without registry access should use path 1 (nix self-host) or build images locally first (`nix build .#quill-<svc>-image && podman load < result`).
> 3. `render.yaml` Blueprint — Render.com deploy. **DEPRECATED post-flip** (Render can't reach the operator registry); kept as a CfT template only. Use path 1 or path 2.
> 4. `helm install quill charts/quill/` — Helm 3 chart (Chart.yaml + values-prod.yaml + 8 templates present) pointing at the operator-host registry; production cluster currently runs the Nix-generated manifests + Kustomize namePrefix, NOT this chart. Templates contain Helm `{{ }}` syntax; bare-Python YAML cannot validate them; install `helm` and run `helm template charts/quill` first before any `helm install`.
> 5. `wrangler pages deploy packages/portal/dist --project-name quill` — Cloudflare Pages for the static portal (requires adding `pages_build_output_dir` to a Pages-flavor `wrangler.toml` and `wrangler pages project create quill` first; tracked separately from the existing `quill-edge` Worker). Unaffected by the registry flip.
> 6. `nix run .#push-images` — publishes the Nix-built OCI images to the operator registry `quill-{api,mcp,portal}:<TAG>,<COMMIT>` (default `TAG=stable`); run on the operator host. The GHCR push path is RETIRED.

> Production cluster mirrors images from the operator registry (`quill-<svc>:build-<ts>` convention); `nix run .#push-images` is the path to single-source so all six install paths converge on the same registry.

**Browser rendering (lightpanda CLI):** For JS-rendered data sources — sites that ship an empty SSR shell and only populate meaningful HTML after client hydration (PBO Nuxt at `pbo-dpb.ca`, several provincial regulator portals, SEDI public listings) — pipeline-core ships `packages/pipeline-core/src/utils/browser-fetch.ts`, a thin wrapper around the `lightpanda` CLI binary (https://lightpanda.io). It spawns `lightpanda fetch --dump <fmt> <url>` per call and returns the post-render DOM as a string with the same shape as `httpGet()`. **The binary is not packaged with the OCI images** — operators install it on the host (default `LIGHTPANDA_BIN`; self-hosters pull the precompiled release from `github.com/lightpanda-io/lightpanda/releases`). No ingestion module is wired to `browserFetch()` yet — the wrapper exists so individual fetchers can opt in behind a feature flag per file. A `__MAPLESPIKE_MOCK_BROWSER` flag (mirrors `__MAPLESPIKE_MOCK_FETCH` in `utils/http.ts`) short-circuits the subprocess to canned HTML in unit tests.

**Home lab cluster (`k3s`):** Single-node control plane (NixOS, k3s v1.36.1). Active deployments in `maplespike` namespace: `quill-api`, `quill-mcp`, `quill-portal` (pinned image tags from flake.nix, NOT `latest` — the `deny-latest-tag-deployments` admission policy rejects it). `cloudflared` runs in the separate `cloudflared` namespace (2 replicas, protocol http2, dials pinned ClusterIPs). Old `maplespike-*` deployments deleted; all traffic routes through quill-* services. Verifying pod placement: `kubectl get pod -n maplespike -o wide`.

**Deployed images (pinned in flake.nix, 2026-08-11):** `quill-api:2026-08-10-9` (quill_ key rename + QUILL_DB_PATH binding fix), `quill-mcp:2026-08-10-4` (eurostat removal + normalizeProvince fix), `quill-portal:2026-08-10-3` (ThreadingHTTPServer + explorer fix). **These pins MUST track live rollouts** — a canonical `nix build .#saas-manifests` that pins an older tag regresses the cluster. All three deployments use `imagePullPolicy: IfNotPresent` (images are pinned tags in the local containerd store).

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
| Licensing | Unresolved metadata/SPDX conflicts; see [docs/open-source-audit.md](./docs/open-source-audit.md) — do not summarize packages as one license until the rights holder resolves them |
| Changesets baseBranch | `main` |
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

## Cursor Cloud specific instructions

Cloud Agents run Quill on a single-node k3s cluster (v1.37.0+k3s1). systemd is not PID 1. Start k3s with `k3s server`. Do not use `systemctl`.

This VM cannot create a VXLAN device. Pass `--flannel-backend=host-gw`. The iptables multiport module is also missing, so Quill pods use `hostNetwork`. Do not use `hostPort`.

Put Node 22.23.3 (or newer) first on `PATH`. Node 22.14 crashes in `undici` 8 because `zlib.createZstdDecompress` is absent. Use the static pnpm 10.32.1 binary at `/usr/local/bin/pnpm`. Corepack rejects the `packageManager` checksum in `package.json`.

After boot these URLs respond:

- API: `http://127.0.0.1:8082/v1/health`
- MCP: `http://127.0.0.1:3001/health`
- Portal: `http://127.0.0.1:4321/`

Use `sudo k3s kubectl`. The kubeconfig is `/etc/rancher/k3s/k3s.yaml`. First boot writes dev JWT and PII hash secrets under `/var/lib/quill-dev/`. Do not commit those files.

After a code change, rebuild the package and roll its pod. The pods mount `/workspace` and run the files on disk.

```bash
pnpm --filter @maplespike/api-server build
sudo k3s kubectl -n maplespike rollout restart deploy/quill-api
```

A leaf-only `pnpm --filter <pkg> build` does not build workspace dependencies and does not refresh pnpm's injected copies, so a runtime `ERR_MODULE_NOT_FOUND` for `@maplespike/database/dist` or `pipeline-core/dist` is expected after one. If the pod logs that, run `bash scripts/build-packages.sh` (whole graph plus the injected-copy repair) and roll the pod again — see the `#859` note in that script.

Use the same pattern for `@maplespike/quill-mcp` (`deploy/quill-mcp`) and `@maplespike/i18n` (`deploy/quill-portal`).

Do not use `./scripts/dev-up.sh` in Cloud Agents. That path needs Docker and the operator registry. Use the local k3s stack.

---

## Local Infrastructure & Deployment

> **Production note:** Quill runs on a private home-lab K3s cluster behind a
> Cloudflare Tunnel, deployed from Nix. Operator-specific details (node
> topology, registry addresses, secret paths, incident history) live in the
> private NixOS config repo (`reverb256/nixos-config`) and are not part of
> this public repo.

### Two environments

| Environment | Where | What runs | How to start |
| --- | --- | --- | --- |
| **Dev (local)** | This machine / a workstation | `docker compose` — api:8082, mcp:3001, portal:8080 | `./scripts/dev-up.sh` (wraps `docker compose` v1+v2) |
| **Prod** | k3s cluster (private homelab) | Nix-built manifests (`nix build .#saas-manifests`) | `nix run .#deploy-saas` |

### Routing (public)

| Host family | Entry point | Backends |
| --- | --- | --- |
| `*.maplespike.ca` | Cloudflare Edge → Tunnel → k3s | `quill-portal` (:8080), `quill-api` (:8082), `quill-mcp` (:3001) |

The routing pattern is "split hostname routing" — see [docs/ROUTING.md](./docs/ROUTING.md) for the rationale (ADR [0004](./docs/decisions/0004-split-hostname-routing.md)).

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

**Prod portal runtime is Python — not nginx.** The Dockerfile's `portal` stage runs `python3 /app/server.py` (Python 3.13-slim). TLS terminates at the edge (Cloudflare / Traefik); the Python server serves static + content negotiation. An `nginx.conf` exists at [`./packages/portal/nginx.conf`](./packages/portal/nginx.conf) as a swap-in template but is not in the running image — reserved for a future migration.

`server.py` has `DIRECTORY = /app/` and resolves URL → file as:

1. `/docs/<rel>` → serve from `DOCS_DIR` (`/app/docs/`)
2. Extensionless URL with no trailing slash → try `/app/<path>.html` (because Astro's `build.format = 'file'` produces `<page>.html`, not `<page>/index.html`)
3. `/<path>.md` → serve Markdown extract of `/app/<path>.html` with `x-markdown-tokens` header
4. `Accept: text/markdown` → same Markdown extraction on the fly
5. Else fall through to `SimpleHTTPRequestHandler` from `/app/`.

See [./packages/portal/server.py](./packages/portal/server.py) for full logic. See [./packages/portal/astro.config.mjs](./packages/portal/astro.config.mjs) for the `format: 'file'` setting.

### Image building (Nix-first)

The canonical image build path is Nix (`flake.nix` → `dockerTools.buildLayeredImage`). Build and push all three service images with:

```bash
nix run .#push-images
# Override defaults: REGISTRY=<registry> TAG=stable
```

### Secrets (SOPS + age)

Production secrets are managed with **SOPS + age**. Plaintext templates live in `secrets/*.yaml.example`; encrypted forms in `secrets/*.yaml` are committed (SOPS-encrypted files are safe to commit). Decryption keys live on the operator's hosts, not in this repo.

**`QUILL_PII_HASH_SECRET` (Decision 0002):** registration/Auth requires a stable **64-char hex** secret in production — the api-server refuses `POST /v1/register` without it. Wire it through your secrets pipeline (e.g. `scripts/sops-sync-k8s.sh` syncs it to k8s as `maplespike-secrets/pii-hash-secret` with a 64-hex validation guard).

See [./secrets/README.md](./secrets/README.md) for the full workflow (encrypt, decrypt, rotate, the per-file age recipients).

### Rebuild & roll out (ArgoCD — current)

Production is GitOps-managed: the ArgoCD Application `quill` (defined in
`reverb256/media-k8s` → `helm/apps/quill.yaml`) renders this repo's chart
(`charts/quill` + `values-prod.yaml`) into the `maplespike` namespace.
**Chart or values change = commit to `main`; ArgoCD syncs automatically.**
Verify: `kubectl get app -n argocd quill` → Synced / Healthy.
ArgoCD reads this repo with a read-only deploy key (ArgoCD secret `quill-repo`).

Legacy (Nix-era — no longer the deploy path, kept for reference):

```bash
# Build and apply all manifests from Nix (single command):
nix build .#saas-manifests -L
kubectl apply -f result/manifests.yaml

# Or use the convenience app (wraps the two commands above):
nix run .#deploy-saas
```

### Verify after deploy

```bash
# Public endpoints through the tunnel:
curl -sI -o /dev/null -w '%{http_code}\n' https://api.maplespike.ca/v1/health    # 200
curl -sI -o /dev/null -w '%{http_code}\n' https://mcp.maplespike.ca/health       # 200
curl -sI -o /dev/null -w '%{http_code}\n' https://quill.maplespike.ca/           # 200
```

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
  └→ mcp.maplespike.ca                   → Quill  (:3001) — [Quill](./docs/products/quill.md) data-layer MCP server (184 tools, incl. `x402-deposit`)
```

For LAN access: **`quill.lan`** (portal), **`api.quill.lan`** (API), **`mcp.quill.lan`** (MCP) — the product's own LAN identity, served by the nexus `nginx-rp` edge (wildcard `CN=*.lan` cert; source `media-k8s/configmap-nginx.yaml`; DNS in nexus unbound `local-dns.conf`). Public addresses stay under the MapleSpike brand (`quill.maplespike.ca`, `api.maplespike.ca`, `mcp.maplespike.ca`). See [docs/ROUTING.md](./docs/ROUTING.md).

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

Auth state is managed globally via `packages/portal/public/auth.js` — it injects account UI into the navbar on every page; components read from `window.QuillAuth`. The `SignupForm` component at `/signup` dynamically shows passkey, Web3, and OAuth buttons based on browser capabilities (`browserSupportsWebAuthn`, `window.ethereum`, `window.solana`).

---

## Billing

Three payment methods implemented. **Live** mode is active since 2026-09-22 (`STRIPE_ENV=live`); test keys remain available for local work.

**Stripe routes:**
- `GET /v1/billing/plans` — Returns Free/Pro/Enterprise tier data (public)
- `GET /v1/billing/stripe/status` — Stripe account status (auth-required)
- `POST /v1/billing/stripe/webhook` — Stripe event handler (signature-verified)
- `GET /v1/billing/stripe/checkout` — Create checkout session
- `GET /v1/billing/orders` — Create/query payment orders
- `POST /v1/billing/reconcile` — Manual reconciliation

**Env vars (delivered to `maplespike-secrets` — keys `stripe-secret-key` / `stripe-webhook-secret` — and injected into the api via secretKeyRef):**

| Variable | Source |
|----------|--------|
| `STRIPE_SECRET_KEY` | `sk_live_51TXKNt...` (live) |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_51TXKNt...` (live) |
| `STRIPE_TEST_SECRET_KEY` | `sk_test_51TXKNt...` (test) |
| `STRIPE_TEST_PUBLISHABLE_KEY` | `pk_test_51TXKNt...` (test) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (signing secret of the live endpoint `we_1UINQwIZlbpvSCVXysk56SCA`) |
| `STRIPE_ACCOUNT_ID` | `acct_1TXKNtIZlbpvSCVX` |
| `STRIPE_ENV` | `live` (since 2026-09-22; set in `charts/quill/values-prod.yaml`) |
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
| `Dockerfile` | Multi-stage build (portal stage is `python:3.13-slim`; api/mcp stages are `node:24-bookworm-slim`) |
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
- On `prod` branch: **builds** Docker images for the operator-host registry (no-push; the operator runs `nix run .#push-images` on the host with the binary already built). GHCR push is RETIRED — `if: false` on the GHCR login + `push: false` on `build-push-action`. To restore GHCR push when PAT scope is bumped, swap `push: true` and retarget tags back to `ghcr.io`.

---

## Design System

- **Theme**: Dark-first, shadcn/ui with Canadian-red primary (`hsl(0 72% 51%)`)
- **Fonts**: Inter (sans) + JetBrains Mono (mono) — loaded via Google Fonts
- **Brand utilities**: `.aurora`, `.bg-grid`, `.text-gradient`, `.card-hover`, `.btn-sheen`
- **Card elevation**: `--card: 0 0% 6.5%` (dark) — visible against `--background: 0 0% 3.5%`
- **Logo**: Geometric 11-spike maple leaf with data connection lines (SVG)

---

## Known Issues & Status

> **Updated 2026-08-21.** Product-facing issues only. Operator/infrastructure
> incident history is tracked in the private NixOS config repo.

| Issue | Status |
| --- | --- |
| `/fr/` (trailing-slash) → 404 | ✅ **RESOLVED** — `server.py` now strips trailing `/` before the extensionless lookup. Verified live: `/fr`, `/fr/`, `/en` all 200. |
| `/login`, `/oauth` → 404 | Not implemented in `packages/portal/src/pages/`. Nav never references them. No action needed unless intentionally adding a login route. |
| **Solana auth not deployed** | Code committed (`/v1/astral/web3/solana/{nonce,verify}`) but needs container image rebuild to deploy. |
| **better-sqlite3 "binding missing" false alarm** | The api image ships the native binding under `.pnpm/better-sqlite3@*/node_modules/better-sqlite3/build/Release/better_sqlite3.node`. `require("/app/node_modules/better-sqlite3")` FAILS because pnpm never symlinks a top-level module — that is a WRONG test, not a missing binding. The correct runtime check is `cd /app/packages/api-server && node -e "require('better-sqlite3')"`. |

---

## Related Repositories

- reverb256/ai-inference-gateway — AI gateway, model routing, RAG
- reverb256/astral-key — Rust Web3/FIDO2/passkey auth microservice
- [reverb256/nixos-config](https://github.com/reverb256/nixos-config) — Cluster NixOS config

---

## Issue closure — put `Closes #N` in the COMMIT message

PRs close issues with `Closes #NNN`. **Put that keyword in the commit
message, not only the PR body.**

The `ready-to-merge` gate squash-merges, and the squash carries the **head
commit message**. Measured 2026-10-04: a PR with `Closes #983` in the PR body
produced squash `8c08ae65` whose message did not contain it, so the issue stayed
open. (Before that fix the gate passed an explicit `--subject`, which discarded
even the commit body; see #983.)

- **Commit message** — what survives the squash and drives auto-closure.
- **PR body** — what humans and reviewers read. Keep it there too.

An issue still open after a green gate merge is this convention being missed,
not a flaky check.

The owner account `reverb256`, the merge-gate App, and the merge workflow
may remove the `ready-to-merge` label. To pause an approved pull request,
add `hold`. Only Atlas sets `hold`. The merge gate skips a pull request
that carries `hold`. `.github/workflows/label-guard.yml` restores the label
and files a `label-guard` issue when another Bot removes it.

## Document hygiene

- **`AGENTS.md` is the source of truth.** Sibling `AGENTS.html` is an outdated static snapshot (Jul 3, 2026); do not edit.
- **Counts that align (as of 2026-09-17):** module count **207** — `scripts/generate-metrics.mjs` now prefers the runtime `getAllModules()` count; previously it counted the unquoted `modulePath: string;` interface field in `registry.ts`, overstating the total by one (correction detailed in CHANGELOG [Unreleased] and `docs/metrics.json`). MCP tool count **184** from `getAllTools()`. `README.md`, `AGENTS.md`, `ROADMAP.md`, `docs/metrics.json`, and the generated discovery artifacts (`agent-card.json`, `server-cards.json`, `agents.json`) all reflect these numbers. Enforcement: `node scripts/check-count-consistency.mjs` fails if any published count disagrees with `docs/metrics.json` or the runtime registry; `node packages/portal/scripts/check-agent-discovery.mjs` validates the discovery artifacts. If a caller sees drift, run both first.
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

---

## Git hygiene rules for every agent on this fleet

Status: shared rule block. Paste into a repo's `AGENTS.md`, `CLAUDE.md`, or a
profile's `SOUL.md`. Owner: Reverb. Added 2026-10-23 by fleet-leakguard.

This block starts at H2 on purpose: pasting an H1 into a document that already
has a title trips markdownlint MD025 (`single-h1`). Every fenced block here is
fenced rather than indented so MD046 (`code-block-style`) stays clean in the
host repo.

These rules are mandatory for all Hermes profiles, bots, and delegated agents.
They exist because an agent ran `git add -A` in `reverb256.github.io` and
committed `.freebuff/` session databases that held live Cloudflare OAuth tokens
plus the operator's real name and city into a public repo (commit `051a6be`).

### Stage explicit paths. Never stage a tree.

- Use `git add <path> [<path> ...]` with the paths you actually changed.
- Never run `git add -A`, `git add .`, `git add --all`, or `git commit -a`.
- Never use `git stash --include-untracked` as a shortcut before staging.

### Never commit tool or session state

Forbidden in any commit, at any depth:

```text
.freebuff/  .sisyphus/  .serena/  .playwright-mcp/  .codebuff/
.cursor/    .claude/    .aider*   .hermes/          .opencode/
.continue/  playwright-report/    .wrangler/        .dev.vars
*.db  *.db-wal  *.db-shm  *.sqlite*  .env*  *.pem  *.key
```

A global exclude file blocks most of these, but the exclude list is a net, not
permission. If a path is not part of the change, do not stage it.

### Do not bypass the gates

- Never pass `--no-verify` to `git commit` or `git push`.
- Never set `core.hooksPath` to an empty directory inside a repo.
- Never delete or edit `~/.config/git/ignore` or anything in `~/.config/git/hooks/`.
- Never unset `core.excludesFile`.
- A blocked commit is a finding: report it to the operator. Do not retry with a
  different flag, do not rewrite the finding, do not edit the pattern list.

If a hook blocks work that is genuinely correct, stop and report it. The
operator decides.

### Identity

- Commit as `Reverb <129622142+reverb256@users.noreply.github.com>`.
- Never commit with a real-name or ISP-provided address.
- Never put the operator's real name, city, ISP mailbox, or the private LAN plan
  into a tracked file. It belongs in the operator's local notes, not here.

### Before you push

```bash
git status --short          # read every line
git diff --cached --stat    # confirm the staged set
git log --oneline -3        # confirm the author identity
```

Install check on a host: `bash ~/.config/git/leakguard/doctor.sh` (17 checks).
