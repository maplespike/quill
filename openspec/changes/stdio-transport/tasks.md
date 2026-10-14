## 1. Integrate the existing transport

- [x] 1.1 Merge `fix/1042-stdio-transport` onto current `main` without rewriting `stdio-server.ts`
- [x] 1.2 Confirm `git merge-tree` against `issue-1058-mcp-sse-readiness` auto-merges `server.ts`

## 2. Entry points and docs

- [x] 2.1 Keep `package.json` bin and `pnpm start` on `dist/cli.js`, and `start:sse` / `Dockerfile.mcp` on `dist/index.js`
- [x] 2.5 Set `syncInjectedDepsAfterScripts: [build]` so the built entry can resolve `@maplespike/database` (same key as PR #1059; no override changes taken from that PR)
- [x] 2.2 Point `Dockerfile.glama` CMD at `dist/cli.js`
- [x] 2.3 Replace current `npx @maplespike/quill-mcp` install steps with the checkout command
- [x] 2.4 Fix `stdio-transport` integration test so its working directory is the package root

## 3. Built artifact

- [x] 3.1 Add a test that spawns `dist/cli.js`, requires protocol-only stdout, and requires exit 0 when stdin closes
- [x] 3.2 Build `@maplespike/quill-mcp` and run that test for `NODE_ENV=production` and `NODE_ENV=development`
