## Context

PR #1046 (`fix/1042-stdio-transport`, commit `f4f4e763`) implements the stdio transport that issue #1042 describes. Current `main` (`fc807cc0`) still has `src/cli.ts` re-export `src/index.ts`, so the bin starts the SSE server. The #1046 branch merges onto that `main` with no textual conflicts.

PR #1059 (`issue-1058-mcp-sse-readiness`, head `e6381640`) is open and not merged. `git merge-tree` of this branch with that head succeeds. Git auto-merges `packages/quill-mcp/src/server.ts`. The hunks do not overlap:

- This change exports `JsonRpcResponse` and adds `McpMessageWriter`.
- #1059 replaces the hardcoded `serverVersion = '0.1.0'` with a read of `packages/quill-mcp/package.json`.

#1059 also changes SSE session ownership, the endpoint event, and SIGTERM handling in `src/index.ts`. The stdio process does not import `src/index.ts`. After both land, `initialize` on stdio will report package version `0.4.0` because both transports share `McpServer.handleMessage`. No second dispatcher is required. Do not take #1059's SSE edits into this branch.

`npm view @maplespike/quill-mcp` on 2026-10-14 returns 404. The same check for `@maplespike/sdk`, `@maplespike/legal-core`, and `@maplespike/legislation` also returns 404. Nothing under the `@maplespike` scope is installable from the public registry.

## Goals / Non-Goals

**Goals:**

- Keep the #1046 transport: shared `McpServer` dispatcher, newline-delimited JSON, in-order dispatch, stdout flush before exit, exit 0 on stdin close, no quota tracker on stdio.
- Prove those properties on `dist/cli.js`, not only on `tsx src/cli.ts`.
- Make package and container instructions name `dist/cli.js` for stdio and `dist/index.js` for SSE.
- Remove `npx @maplespike/quill-mcp` from current install instructions.

**Non-Goals:**

- Do not publish to npm.
- Do not merge, deploy, or change production image pins.
- Do not rewrite the transport, and do not replace the hand-rolled dispatcher with `@modelcontextprotocol/sdk`.
- Do not implement #1059. Do not change `serverInfo.version` here. That fix is already in #1059.
- Do not edit ADR 0007. It records the rename decision, including the `npx` config that was the intended name. Planning notes in `docs/GAP-MAP.md`, `docs/EXECUTION-BOARD.md`, and `docs/TRANSFORMATION-MASTER-PLAN.md` still describe a future npm command. They are not current install steps.

## Decisions

1. **Follow-up branch, not a force-push of #1046.** The original commit stays intact as a merge parent. Reconciliation (docs, the built-artifact test, the integration-test path) is a later commit. #1046 remains open until a human closes it. This PR supersedes it for merge onto current `main`.

2. **Stdout guard stays in front of the dynamic import.** `cli.ts` calls `claimStdoutForProtocol()` and then `await import('./stdio-server.js')`. A static import would run pipeline-core before the guard. The municipal registry log stays on `console.error` as a second line of defence.

3. **Logger destination depends on `QUILL_MCP_TRANSPORT=stdio`.** Production uses `pino.destination(2)`. Any other `NODE_ENV` uses `pino-pretty` with `destination: 2`. Both paths are part of the built-artifact test, because `pnpm start` does not set `NODE_ENV=production` and `Dockerfile.glama` does.

4. **`Dockerfile.glama` stays a copy of `Dockerfile.mcp` with a different final stage.** The `CMD` is `dist/cli.js`. There is no `EXPOSE`. Docker has no include, so a later edit to `Dockerfile.mcp` can drift. The built-artifact test locks both `CMD` lines.

5. **Integration test package root.** `src/__integration__/stdio-transport.test.ts` computed `new URL('../../..')` from a file two directories under the package. That URL is `packages/`, not `packages/quill-mcp`. The fix is `../..`. The test still launches `tsx src/cli.ts`. The new unit test launches `node dist/cli.js`.

6. **Sync injected workspace copies after `build`.** `.npmrc` sets `inject-workspace-packages=true`. pnpm hard-links each workspace package into the store at install time. `database` has no `prepare` script, so that copy has no `dist/` until `tsc` runs. New files are not hard-linked back into the store. `node dist/cli.js` then fails with `ERR_MODULE_NOT_FOUND` for `@maplespike/database/dist/index.js` before it writes a frame. `pnpm-workspace.yaml` sets `syncInjectedDepsAfterScripts: [build]`, which is the same key PR #1059 adds. This branch does not take #1059's override bumps. The lines match, so a merge of the two branches keeps a single copy of the key. The sync runs for the package whose `build` script ran. `pnpm --filter @maplespike/quill-mcp build` does not run `database`'s build, so the QA job and the coverage job must use the `...` filter (`@maplespike/quill-mcp...` and `@maplespike/api-server...`). The CI `build-and-test` job already runs `pnpm build`, which builds the whole graph, and that job passed.

## Risks / Trade-offs

- [pino-pretty worker writes to fd 1 despite `destination: 2`] → The development built-artifact test fails if a non-protocol line appears on stdout. Fix the destination before calling the transport done.
- [Import-time `process.stdout.write` bypasses the console guard] → The same test spawns the real build, so a stray write fails the purity check. The guard only wraps `console.*`.
- [#1059 lands first and conflicts] → Re-merge `server.ts`. Expect a clean auto-merge unless #1059 edits the `JsonRpcResponse` block.
- [`Dockerfile.glama` drifts from `Dockerfile.mcp`] → CMD assertions do not compare every `RUN` line. Review both files together when the hosted image build changes.
- [Docs still mention `npx` in an ADR or a future plan] → Those files are not install steps. A reader who follows the README, setup guide, product quick start, Hermes notes, or `DEPLOYMENT.md` gets `dist/cli.js`.

## Migration Plan

No production rollout. Hosted SSE keeps `dist/index.js`. Rollback is reverting this branch. Local hosts that were pointed at `dist/index.js` or at `npx` must switch to `dist/cli.js` after a build. There is no published package to yank.

## Open Questions

- None for this change. Publishing `@maplespike/quill-mcp` is a separate decision. Do not do it here.
