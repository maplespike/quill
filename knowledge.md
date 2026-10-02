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
- **The build hosts are NOT NixOS and have no `nix`** (verified 2026-10-01 on `nexus`, the runner). They run **Omarchy** (Arch) with `node` v26.10.0, `pnpm` 10.32.1, `python3` 3.14.7, `docker` 29.8.1, `kubectl`, `k3s`, `age`, `gh`, `jq`. The runner *label* is `self-hosted, nixos` and 10+ workflows select on it, so the label stays — but do not read it as an OS fact. The real image path is `scripts/pin-images.sh` (docker, per-service `Dockerfile.*`, digest-pinned), which is what the cluster consumes. Anything wired to `nix run .#*` or podman is a control that cannot fire. Full verified list: `docs/GITHUB-ACTIONS-NIX.md`. **`syft` was installed on `nexus` 2026-10-02** (Arch `extra` 1.51.0-1, reports 1.52.0) so the SBOM step in `pin-images.sh` can run; if a pacman install 404s, `sudo pacman -Syy` first — the mirrorlist was stale.
- **Prod deploy: `deploy-prod.yml` rewritten 2026-10-02, and the old failure is now fully diagnosed.** ArgoCD is the deploy path — it renders `charts/quill` + `values-prod.yaml` from `main`, Synced/Healthy, with selfHeal and prune. The workflow now runs `pin-images.sh` (build + SBOM + import), writes the digests with `scripts/apply-image-pins.mjs`, commits, and waits for the ArgoCD sync. It does **not** `kubectl apply` and does **not** `kubectl set image` — the latter is drift ArgoCD reverts. Two separate causes made the old workflow non-functional, and only the second was visible in the run list:
  1. It called `nix build .#saas-manifests` on a host with no nix.
  2. **The workflow file at those commits was not valid YAML.** A `run: |` block whose first body line was indented further than the rest. That is why all 8 runs showed *zero jobs started* with `created == updated` — GitHub rejected the workflow before scheduling, which looks like an infra failure, not a syntax error.
- **A workflow that is invalid YAML fails silently — check `scripts/gates/check-workflow-yaml.mjs`** (`pnpm test:workflow-yaml`, wired into `ci.yml`). The recurring cause is a heredoc inside a `run: |` block: YAML takes the block indentation from its first non-empty line, so a heredoc body at column 0 ends the scalar early and the rest is parsed as YAML. This broke `deploy-prod.yml` and then `portal-artifact-drift.yml` in the same week. When a workflow shows zero jobs and an instant failure, run this gate before looking at runners or secrets.
- **Canonical registry**: operator-host `quill-<svc>` (not GHCR anymore)
- **Portal runtime is Python** (`server.py`), not nginx — Astro `format: 'file'` means pages are `<page>.html`, served extensionless
- **`AGENTS.md` is the authoritative ops reference** — cluster topology, routing matrix, rebuild/rollout recipes, known issues
- **Secrets**: SOPS + age, synced via `scripts/sops-sync-k8s.sh`
- **`secrets` CI job — FIXED 2026-10-02.** It had been failing on every PR *and on `main`*: `gitleaks/gitleaks-action@v2` requires `GITLEAKS_LICENSE` for org repos and the step passed only `GITHUB_TOKEN`, so the action exited with `[maplespike] is an organization. License key is required.` even though the secret was set. One `env:` line. Recorded here because the symptom looked like a leaked secret in the diff and it was not.
- **Node ≥18** (CI uses 22)
- **Licensing**: unresolved package, file-header, and artifact conflicts; see `docs/open-source-audit.md` and `LICENSE.md`
- **Deploy**: `scripts/deploy.sh`; production K3s cluster with Kustomize namePrefix (`maplespike-*` at cluster, `quill-*` in source)
