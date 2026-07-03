---
last-reviewed: 2026-06-19
status: active
---

# AGENTS.md — MapleSpike

> **Mission**: Build the Library of Alexandria for Canadian public data — 150+ modules covering every federal, provincial, territorial, and municipal source.
> **Data-layer MCP product:** [Quill](./docs/products/quill.md) (see ADR [0005](./docs/decisions/0005-quill-product-name.md)).
> **Current metrics**: [docs/metrics.json](./docs/metrics.json) — 208 modules, 164 MCP tools, ~191K lines TS, 13 packages.

Quick reference for agents working in this repo. Don't guess — check here first.

---

## Repository Identity

| Attribute | Value |
|-----------|-------|
| Type | pnpm monorepo (pnpm@10.32.1) |
| Orchestrator | Turbo (workspace config in `turbo.json`) |
| Node | ≥18 (CI uses 22) |
| Packages | 13 in pnpm workspace (incl. `sdk-python` with `python -m build`) + dashboard (workspace-excluded, OWASP integrated into portal) = 14 directories in `packages/`. See [docs/metrics.json](./docs/metrics.json) `packages.names` for the authoritative list. |
| TS | strict mode, ES2022 target, ESNext modules (bundler resolution) |
| No ESLint/Prettier | Match existing code style |
| npm scope | `@maplespike/` |
| License | AGPL-3.0 (pipeline-core) / MIT (others) |
| Changesets baseBranch | `prod` (not `main`) |
| Deploy | `scripts/deploy.sh` (reads `.env.deployment`) |

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
| `dashboard` | — | Excluded from workspace (OWASP integrated into portal) | — | No |

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

### Portal Development

```bash
cd packages/portal
pnpm dev          # Astro dev server (hot reload)
pnpm build        # Build to dist/
pnpm preview      # Preview built site
```

The portal uses Astro + Tailwind v4 + shadcn/ui (React). Served in production
by `server.py` (custom Python HTTP server with AI-friendly content negotiation
and extensionless URL rewriting).

### API Server Development

```bash
cd packages/api-server
pnpm build        # TypeScript compile
node dist/dev-server.js   # Start on :8082
```

Storage modes: `memory` (default), `sqlite` (node:sqlite built-in), `postgres`.

### Deployment

```bash
# Copy and customize deployment config
cp .env.deployment.example .env.deployment

# Build images and deploy
./scripts/deploy.sh --build

# Or use a specific overlay
./scripts/deploy.sh --overlay prod
```

---

## Architecture Overview

```
Browser → maplespike.lan (Caddy TLS)
  ├→ Portal (:31559) — Astro static site + server.py
  ├→ API    (:32481) — Node.js API server (SQLite/PostgreSQL)
  │   ├→ AI Gateway — glm-5.2 via AI Inference Gateway
  │   ├→ Qdrant — vector search for RAG
  │   ├→ Astral Key (proxy) — Web3 SIWE + FIDO2 passkey auth
  │   └→ BYOK middleware — users bring their own AI key
  └→ Quill  (:31746) — [Quill](./docs/products/quill.md) data-layer MCP server (164 tools)
```

### Auth Chain

Three auth methods, all returning JWT + MapleSpike API key:

1. **Passkey (WebAuthn/FIDO2)** — `@simplewebauthn/server` (Node) + Astral Key (Rust)
2. **Web3 (SIWE/EIP-4361)** — Ethereum signature verification via viem + Astral Key
3. **OAuth** — Casdoor SSO, GitHub, Google

Auth state is managed globally via `public/auth.js` — injects account UI into
the navbar on every page. Components read from `window.MapleSpikeAuth`.

### AI Architecture

- **Default**: Routes to cluster AI Inference Gateway (GLM-5.2)
- **BYOK**: Users configure their own provider (OpenAI, Anthropic, ZAI, etc.)
  via `/v1/ai/settings` — stored per-tenant
- **RAG**: Qdrant vector search → context injection → LLM generation
- **Fallback**: Gov/keyword search if Qdrant has no data

---

## Key Files

| File | Purpose |
|------|---------|
| `packages/portal/src/layouts/BaseLayout.astro` | Global layout (nav, footer, auth) |
| `packages/portal/src/styles/globals.css` | Design system (tokens, brand utilities) |
| `packages/portal/public/auth.js` | Global auth state manager |
| `packages/portal/public/config.js` | Runtime config (auto-derives API URL) |
| `packages/api-server/src/index.ts` | Main router (CORS, auth exemption, routes) |
| `packages/api-server/src/node-sqlite-storage.ts` | Persistent storage (node:sqlite) |
| `packages/api-server/src/routes/ai.ts` | AI ask/analyze (RAG + BYOK) |
| `packages/api-server/src/routes/astral-proxy.ts` | Astral Key auth proxy |
| `packages/api-server/src/routes/ai-settings.ts` | BYOK provider resolution |
| `packages/api-server/src/response.ts` | CORS origins, response envelope |
| `.env.deployment.example` | Deployment config template |
| `scripts/deploy.sh` | End-to-end deployment script |
| `k8s/base/` | Kustomize base manifests |
| `k8s/overlays/dev/` | Homelab overlay |
| `k8s/overlays/prod/` | Production overlay |
| `Dockerfile` | Multi-stage build (bookworm-slim base for `node:sqlite` ABI compat via Python 3 stdlib) |

---

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`):
- Triggers on push/PR to `main` and `prod`
- Uses Node 22, pnpm (auto-detected version)
- Runs `pnpm build` + `pnpm test`
- On `prod` branch: pushes Docker images to GHCR

---

## Design System

- **Theme**: Dark-first, shadcn/ui with Canadian-red primary (`hsl(0 72% 51%)`)
- **Fonts**: Inter (sans) + JetBrains Mono (mono) — loaded via Google Fonts
- **Brand utilities**: `.aurora`, `.bg-grid`, `.text-gradient`, `.card-hover`, `.btn-sheen`
- **Card elevation**: `--card: 0 0% 6.5%` (dark) — visible against `--background: 0 0% 3.5%`
- **Logo**: Geometric 11-spike maple leaf with data connection lines (SVG)

---

## Known Issues

- `packages/dashboard` build fails (excluded from workspace — OWASP dashboard is in portal)
- `packages/pretext-civic` directory has been removed (was orphaned React component library after the Next.js → Astro portal migration)
- Sentry node occasionally goes NotReady (k3s etcd flapping)
- Forge node status Unknown (mining workload — non-critical for MapleSpike)
- Nix builder `/etc/nix/machines` needs `nixos-rebuild switch` (source fixed, pending deploy)

---

## Related Repositories

- [reverb256/ai-inference-gateway](https://github.com/reverb256/ai-inference-gateway) — AI gateway, model routing, RAG
- [reverb256/astral-key](https://github.com/reverb256/astral-key) — Rust Web3/FIDO2/passkey auth microservice
- [reverb256/nixos-config](https://github.com/reverb256/nixos-config) — Cluster NixOS config
