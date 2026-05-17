---
last-reviewed: 2026-05-16
status: active
---

# Contributing to MapleSpike

Thanks for your interest. MapleSpike is a sovereign Canadian government data pipeline. Every contribution makes Canadian public data more accessible.

## Quick Links

- **Docs:** [docs/](./docs/) — Architecture, gap analysis, endpoint catalogs
- **Metrics:** [docs/metrics.json](./docs/metrics.json) — Current module/tool/line counts
- **ROADMAP:** [ROADMAP.md](./ROADMAP.md) — Full phased build plan

---

## How to Contribute

### 1. Find Something to Work On

- Check [ROADMAP.md](./ROADMAP.md) — items marked 🔴 TODO or 🟡 PARTIAL
- Check [AGENTS.md](./AGENTS.md) — Tier 1 Critical Gaps section lists highest-priority missing data modules
- Check [docs/GAP-ANALYSIS.md](./docs/GAP-ANALYSIS.md) — comprehensive gap analysis

### 2. Set Up Your Environment

```bash
# Prerequisites: Node >= 18 (CI uses 22), pnpm >= 9
pnpm install        # Install all dependencies
pnpm build          # Build all packages (Turbo respects deps)
pnpm test           # Run all tests
```

### 3. Understand the Repository

```
maplespike/
├── packages/
│   ├── pipeline-core/    # Ingestion, verification, audit (shared library)
│   ├── engine/           # Entity resolution, graph building, signals, briefs
│   ├── pretext-civic/    # React component library (charts, geo) — orphaned
│   ├── portal/           # Developer portal & landing page (static HTML)
│   ├── api-server/       # REST API gateway (auth, rate limits, usage)
│   ├── mcp-server/       # MCP protocol server (22 tools)
│   ├── sdk/              # TypeScript client library
│   ├── sdk-python/       # Python client library
│   ├── legal-core/       # Legal data SDK
│   └── legislation/      # Legislation XML parser
├── docs/                 # Architecture docs, roadmap, gap analysis
├── .hermes/              # Analysis plans and retrospectives
├── .sisyphus/            # Orchestration plans
├── flake.nix             # Nix build (delegates to nixos-config)
├── ROADMAP.md            # Full phased roadmap
└── tsconfig.json         # Shared TypeScript configuration
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

### 8. Documentation Expectations

- If you add a new module, update the relevant docs
- If you change a metric (module count, tool count, etc.), update [docs/metrics.json](./docs/metrics.json)
- Docs live in `docs/` and root `.md` files — keep `last-reviewed` frontmatter current

---

## Architecture Decisions

### Why SQLite and not Postgres?
SQLite via `better-sqlite3` for MVP. PostgreSQL migration planned at 50+ modules for concurrent CronJob writes.

### Why K3s and not cloud?
Zero external cloud spend. Canadian K3s cluster on existing NixOS infrastructure. All data stays in Canada.

### Why MCP-first?
The Model Context Protocol is standardizing as the way AI agents consume tools. GPO and Census Bureau already ship public MCP servers. MapleSpike is MCP-native from day one.

### Why AGPL-3.0 on pipeline-core?
The core library is AGPL to prevent proprietary lock-in of Canadian government data pipelines. MCP server, API server, and SDK are MIT.

---

## Need Help?

- Open a [GitHub Issue](https://github.com/reverb256/maplespike/issues)
- Check [README.md](./README.md) for environment setup
- Check [AGENTS.md](./AGENTS.md) for AI agent conventions
