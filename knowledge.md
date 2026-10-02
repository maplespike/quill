# MapleSpike (Quill) — Project Knowledge

> **Mission**: Build the Library of Alexandria for Canadian public data — 207 modules, 184 MCP tools, ~220K lines TS, 14 packages.

## What it is

An AI-native government data pipeline that ingests, verifies, and surfaces data from Canadian federal, provincial, territorial, municipal, and other public-sector sources across every sector. Source terms vary by publisher and dataset; public availability does not itself grant reuse rights. Ships as:

- **pipeline-core** — ingestion/verification/audit library
- **quill-mcp** — MCP server (184 tools, incl. `x402-deposit`)
- **api-server** — REST API gateway (auth, rate limits, billing, AI)
- **portal** — Astro + React + Tailwind v4 static site served by Python
- **engine** — entity resolution, graph building, signals
- **sdk** — typed TypeScript client (published to npm)
- **sdk-python** — Python client (published to PyPI)
- **database** — `node:sqlite` wrapper (better-sqlite3 builtin)
- **legal-core / legislation** — legal data SDKs (published npm)

Live at https://quill.maplespike.ca/

## Commands

| Task | Command |
|------|---------|
| Install | `pnpm install` |
| Build all | `pnpm build` (turbo build) |
| Test all | `pnpm test` (turbo test + doc link tests + external host tests) |
| Test packages only | `pnpm test:packages` |
| Dev stack (Docker Compose) | `./scripts/dev-up.sh` |
| Smoke test | `./scripts/e2e-smoke.sh --mode=compose --up --down` |
| Clean | `pnpm clean` |
| Portal dev (hot-reload) | `cd packages/portal && pnpm dev` (port 4321) |
| API server | `cd packages/api-server && pnpm build && node dist/dev-server.js` (port 8082) |
| MCP server (SSE) | `cd packages/quill-mcp && PORT=3001 pnpm start:sse` (port 3001) |

## Package test framework

Most packages use `node --test` (via tsx). The `engine` package uses `vitest`.

## Key conventions & gotchas

- **pnpm@10.32.1** — enable via `corepack enable && corepack prepare pnpm@10.32.1 --activate`
- **TypeScript strict mode**, ES2022 target, ESNext modules, bundler module resolution
- **No ESLint/Prettier** — match existing code style manually
- **OpenSpec mandatory** — every feature/change uses `propose → apply → archive` cycle via `/opsx:*` commands (exceptions: trivial one-line fixes)
- **Changesets baseBranch**: `prod`, not `main`
- **Nix-first build** — `flake.nix` is source of truth for OCI images; secondary paths: Docker Compose, `selfhost.sh`, Helm chart, Cloudflare Pages, `nix run .#push-images`
- **Canonical registry**: operator-host `quill-<svc>` (not GHCR anymore)
- **Portal runtime is Python** (`server.py`), not nginx — Astro `format: 'file'` means pages are `<page>.html`, served extensionless
- **`AGENTS.md` is the authoritative ops reference** — cluster topology, routing matrix, rebuild/rollout recipes, known issues
- **Secrets**: SOPS + age, synced via `scripts/sops-sync-k8s.sh`
- **`secrets` CI job fails on every PR (pre-existing, as of 2026-10-01)** — `gitleaks/gitleaks-action@v2` requires `GITLEAKS_LICENSE` for org repos and the job in `.github/workflows/ci.yml` passes only `GITHUB_TOKEN` to it, so the action exits with `[maplespike] is an organization. License key is required.` even though the `GITLEAKS_LICENSE` repository secret *is* set. It is not a finding about the diff; the baseline check in the preceding step still runs. Fix by adding `GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}` to that step's `env:`, or by pinning the CLI directly instead of using the action. Unrelated to any content change — do not chase it when a PR goes red.
- **Node ≥18** (CI uses 22)
- **Licensing**: unresolved package, file-header, and artifact conflicts; see `docs/open-source-audit.md` and `LICENSE.md`
- **Deploy**: `scripts/deploy.sh`; production K3s cluster with Kustomize namePrefix (`maplespike-*` at cluster, `quill-*` in source)
