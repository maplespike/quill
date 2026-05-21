# MapleSpike Agent Guidance

## Essential Commands
- Install: `pnpm install`
- Build: `pnpm run build`
- Test: `pnpm test` (some MCP tools require network)
- MCP server (stdio): `cd packages/mcp-server && pnpm start`
- MCP server (SSE): `cd packages/mcp-server && pnpm run start:sse`
- Dashboard: `cd packages/dashboard && pnpm run dev`

## Repository Structure
Monorepo with pnpm workspaces:
```
packages/
├── pipeline-core/    # Shared ingestion/verification library
├── engine/           # Entity resolution, graph building
├── mcp-server/       # 50 MCP tools for government data
├── api-server/       # REST gateway (auth, rate limits)
├── sdk/              # TypeScript client
├── sdk-python/       # Python client
├── dashboard/        # Next.js data portal
└── portal/           # Static marketing site
```

## Key Conventions
- **TypeScript**: Strict mode, ES2022 target
- **Never use**: `as any`, `@ts-ignore`, `@ts-expect-error`
- **Commits**: Conventional Commits (feat, fix, chore, refactor, docs, test, ci) + issue ref `(#NNN)`
- **Signing**: All commits should be signed (GPG/SSH)
- **PRs**: Must include `Closes #NNN` in body
- **Worktree**: Use `git worktree add -b issue-NNN-desc /data/projects/own/maplespike-NNN main`

## Verification
- `pnpm build` must pass
- `pnpm test` must pass (note: MCP tests may need network)
- Lint: `next lint` (dashboard), ESLint elsewhere
- Commit messages must reference issue number

## Infrastructure & Deployment
- **K3s cluster** with two environments:
  - Production: `maplespike` namespace → `maplespike.lan`
  - Development: `maplespike-dev` namespace → `dev.maplespike.lan`
- **Services**: Portal (static), Dashboard (Next.js), MCP/API (Node.js)
- **Ingress**: Caddy controller routes .lan domains
- **No external cloud spend** - all data on Canadian K3s
- **CI/CD**:
  - `main`: CI (tests) + Deploy Dev
  - `prod`: Deploy Prod
- Images: `:dev` for dev, `:latest` for prod

## Data Sources
Ingests 65 Canadian government data modules:
- Federal: StatCan, IRCC, Health Canada, CRA, Canada Gazette
- Parliamentary: Committees, Hansard, LEGISinfo
- Provincial: All 13 legislatures + CKAN portals
- Municipal: 19+ direct fetchers + provincial federation
- Corporate: Lobbying, procurement, insider trades
- Legal: CanLII, e-Laws, tribunal decisions
- Real-time: Weather alerts, border wait times

## Related
- Frostbite Gazette: AI journalism consumer
- mcp-canada: Precursor MCP tools