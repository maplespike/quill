---
last-reviewed: 2026-05-17
status: active
---

# Contributing to MapleSpike

Thanks for your interest. MapleSpike is a sovereign Canadian government data pipeline. Every contribution makes Canadian public data more accessible.

## Quick Links

- **Docs:** [docs/](./docs/) — Architecture, gap analysis, endpoint catalogs
- **Metrics:** [docs/metrics.json](./docs/metrics.json) — Current module/tool/line counts
- **ROADMAP:** [ROADMAP.md](./ROADMAP.md) — Full phased build plan
- **Licensing:** [LICENSE.md](./LICENSE.md) — Three-tier license structure

---

## Licensing

MapleSpike uses a **three-tier licensing model**. By contributing, you agree that your contributions will be licensed under the same license as the package you're modifying.

| Tier | Packages | License | Why |
|------|----------|---------|-----|
| **Core (moat)** | pipeline-core, engine | AGPL-3.0-or-later | Protects the ingestion/verification engine — anyone hosting a modified version must share source |
| **Interface** | api-server, mcp-server, portal, docs | Apache-2.0 | Permissive for self-hosters, researchers, and tinkerers; includes patent grant |
| **Client** | sdk, sdk-python, legal-core, legislation | MIT | Zero-friction developer onboarding |

**Data vs. Code:** Source data from Canadian government sources (StatsCan, CKAN, etc.) is under the [Open Government Licence — Canada](https://open.canada.ca/en/open-government-licence-canada) and is always freely accessible regardless of code license. The code that fetches, processes, and verifies the data is what the above licenses cover.

### CLA (Contributor License Agreement)

Before your first pull request is merged, you must accept the MapleSpike CLA. This grants the project the right to re-license your contributions commercially (e.g., for the MapleSpike Enterprise License). This is standard practice for dual-licensed open-source projects (MongoDB, GitLab, Grafana).

- **For individuals:** Comment `I have read and agree to the MapleSpike CLA` on your first PR
- **For organizations:** A signed CLA must be on file — contact legal@maplespike.lan
- **Why:** Without a CLA, every external contribution is a legal encumbrance that prevents offering commercial licenses to enterprises

### Commercial License

Organizations that cannot accept AGPL-3.0 obligations (e.g., embedding pipeline-core in proprietary products) can purchase a MapleSpike Enterprise License. See [LICENSE.md](./LICENSE.md) for details.

---

## How to Contribute

### 1. Find Something to Work On

- Check [ROADMAP.md](./ROADMAP.md) — items marked 🔴 TODO or 🟡 PARTIAL
- Check [AGENTS.md](./AGENTS.md) — Tier 1 Critical Gaps section lists highest-priority missing data modules
- Check [docs/GAP-ANALYSIS.md](./docs/GAP-ANALYSIS.md) — comprehensive gap analysis

### 2. Set Up Your Environment

```bash
# Prerequisites: Node >= 18 (CI uses 22), pnpm >= 9
pnpm install # Install all dependencies
pnpm build # Build all packages (Turbo respects deps)
pnpm test # Run all tests
```

### 3. Understand the Repository

```
maplespike/
├── packages/
│   ├── pipeline-core/   # AGPL-3.0 — Ingestion, verification, audit
│   ├── engine/          # AGPL-3.0 — Entity resolution, graph, signals, briefs
│   ├── api-server/      # Apache-2.0 — REST API gateway
│   ├── mcp-server/      # Apache-2.0 — MCP protocol server (22 tools)
│   ├── portal/          # Apache-2.0 — Developer portal & landing page
│   ├── sdk/             # MIT — TypeScript client library
│   ├── sdk-python/      # MIT — Python client library
│   ├── legal-core/      # MIT — Legal data SDK
│   └── legislation/     # MIT — Legislation XML parser
├── docs/                # Apache-2.0 — Architecture docs
├── .hermes/             # Analysis plans and retrospectives
├── .sisyphus/           # Orchestration plans
├── flake.nix            # Nix build (delegates to nixos-config)
├── ROADMAP.md           # Full phased roadmap
└── tsconfig.json        # Shared TypeScript configuration
```

### 3b. GitHub Issues Workflow (MANDATORY)

Every change MUST be tracked through a GitHub issue. This is non-negotiable.

1. **Check** existing issues: `gh issue list -R reverb256/maplespike --limit 10`
2. **Create** if none exists: `gh issue create -R reverb256/maplespike --title "..." --label "p2,frontend" --body "..." --assignee "@me"`
3. **Branch**: `git checkout -b issue-NNN-short-description`
4. **Commit**: Every message includes `(#NNN)` — e.g., `feat: add IRCC immigration module (#42)`
5. **PR**: Body MUST contain `Closes #NNN` or `Related to #NNN`

Available labels: `bug`, `enhancement`, `p1`, `p2`, `k8s`, `frontend`, `module`, `security`, `documentation`, `cleanup`

### 4. Build a New Data Module

Every new data module follows this pattern:

1. Create `packages/pipeline-core/src/ingestion/<module>/` with:
   - `constants.ts` — URL configs, source definitions
   - `types.ts` — TypeScript interfaces
   - `fetcher.ts` — HTTP/API fetch functions
   - `parser.ts` — Data parsing and normalization
   - `db.ts` — Database persistence (optional)
   - `index.ts` — Public API (ingest*, search*)
2. Register the module in `packages/pipeline-core/src/ingestion/registry.ts`
3. Add SHA-256 citation hashing + trust scoring
4. Add 1+ MCP tool in `packages/mcp-server/src/tools/`
5. Add AIDA-compliant audit trail
6. Update [docs/metrics.json](./docs/metrics.json) with new counts
7. Update [ROADMAP.md](./ROADMAP.md) entry

### 5. Code Standards

- **TypeScript:** strict mode, ES2022 target, ESNext modules (bundler resolution)
- **Testing:** `node --test` (most packages) or `vitest` (engine)
- **No ESLint/Prettier** — the repo doesn't use them. Match existing code style.
- **No `as any`**, no `@ts-ignore`, no `@ts-expect-error` — type errors must be fixed properly
- **pnpm** only — never commit `package-lock.json` or `yarn.lock`
- **SPDX headers:** Key entry-point files include `// SPDX-License-Identifier: <license>` — match the package tier

### 6. Commit Conventions

We use [Changesets](https://github.com/changesets/changesets) for versioning. Commit messages should be clear and descriptive:

```
feat: add IRCC immigration data module
fix: correct StatCan WDS endpoint URL
docs: update gap analysis with new modules
refactor: extract common CKAN fetcher pattern
```

### 7. Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Run `pnpm build` and `pnpm test` — ensure all pass
4. Create a changeset: `pnpm changeset`
5. Open a PR against `main`
6. Ensure CI passes (runs mcp-server + engine tests)
7. **First-time contributors:** Comment `I have read and agree to the MapleSpike CLA` on the PR

### 8. Documentation Expectations

- If you add a new module, update the relevant docs
- If you change a metric (module count, tool count, etc.), update [docs/metrics.json](./docs/metrics.json)
- Docs live in `docs/` and root `.md` files — keep `last-reviewed` frontmatter current

---

## Architecture Decisions

### Why three-tier licensing?

- **AGPL-3.0 on core** prevents proprietary lock-in of the Canadian government data pipeline engine. The network clause closes the SaaS loophole.
- **Apache-2.0 on interface** lets self-hosters, researchers, and tinkerers deploy without AGPL anxiety. The patent grant protects against patent aggression.
- **MIT on client** is zero-friction — `npm install @maplespike/sdk` with no legal review needed.

### Why SQLite and not Postgres?

SQLite via `better-sqlite3` for MVP. PostgreSQL migration planned at 50+ modules for concurrent CronJob writes.

### Why K3s and not cloud?

Zero external cloud spend. Canadian K3s cluster on existing NixOS infrastructure. All data stays in Canada.

### Why MCP-first?

The Model Context Protocol is standardizing as the way AI agents consume tools. GPO and Census Bureau already ship public MCP servers. MapleSpike is MCP-native from day one.

---

## Known Issues

| Issue | Workaround | Status |
|-------|-----------|--------|
| MCP integration tests (`packages/mcp-server`) require API server running on port 8082 | Start `node packages/api-server/dist/dev-server.js` in background before `pnpm test` | Expected — CI handles this |
| Engine build fails without `@maplespike/database` | Ensure `pnpm install && pnpm build` runs from root (Turbo handles build order) | Resolved in PR #123 |
| Portal has no dev server with HMR | Use `python3 -m http.server 4321` or `npx serve . -p 4321` — manual refresh needed | By design (static site) |
| Garnix/flake.nix checks fail in CI (`Evaluate flake.nix`) | Not related to PR changes — pre-existing Nix build issue | Unresolved — NixOS maintainer needed |
| `pnpm build` vs `pnpm -r build` difference | `pnpm build` uses Turbo (topological order); `pnpm -r build` builds all independently. CI uses `-r` | By design — see AGENTS.md |
| `docs/metrics.json` is NOT auto-generated | Update manually when adding modules/tools | Known limitation |

---

## Need Help?

- Open a [GitHub Issue](https://github.com/reverb256/maplespike/issues)
- Check [README.md](./README.md) for environment setup
- Check [AGENTS.md](./AGENTS.md) for AI agent conventions
- Check [LICENSE.md](./LICENSE.md) for licensing questions
