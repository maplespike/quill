## Context

`inject-workspace-packages=true` materializes workspace copies at install, before `dist/` exists. Package `build` scripts can refresh those copies when `syncInjectedDepsAfterScripts` lists `build`. QA calls `scripts/build-packages.sh`, which uses `pnpm exec tsc -b` and never runs those scripts. The repair loop on main runs after `portal build`, so the portal build sees stale copies. Drift CI sets `QUILL_BUILD_WORKSPACE_ONLY=1` and skips the portal, which is why drift can pass while QA fails.

## Decisions

1. Add `syncInjectedDepsAfterScripts: [build]` so a normal `pnpm build` refreshes copies after package build scripts.
2. Keep the explicit repair loop in `build-packages.sh`, and move it to immediately after `tsc -b`. `tsc -b` still does not fire the sync hook.
3. Change `gen:all` to `(timeout 60 node scripts/generate-pipeline-data.mjs || true)` so only that timeout is optional.
4. Do not change override versions in this slice.

## Rollout

No service image change by itself. The next image build that uses this script picks up fresh copies. Rollback restores the previous script order and the old `gen:all` line.

## Verification

The generation test spawns `gen:all` in a temp directory whose `gen-icons.mjs` exits 23 and expects status 23. QA after merge must pass the portal build step that failed on 2026-10-14.
