## Why

`scripts/build-packages.sh` runs `tsc -b` and then builds the portal. `tsc -b` does not run package build scripts, so `syncInjectedDepsAfterScripts` does not refresh injected workspace copies. Portal generators then import `@maplespike/pipeline-core` through the store and fail with `ERR_MODULE_NOT_FOUND` for `@maplespike/database/dist`. `gen:all` also hides a mandatory generator failure behind `|| true`.

## What Changes

- Declare `syncInjectedDepsAfterScripts: [build]` in `pnpm-workspace.yaml`.
- Repair injected `@maplespike/*` copies after `tsc -b` and before the docs and portal builds.
- Parenthesize the optional pipeline-data timeout so a failed mandatory generator stops `gen:all`.
- Add a test that `gen:all` exits with the failing generator's status.

## Capabilities

### New Capabilities

- `workspace-build-sync`: Injected workspace copies are refreshed before portal generation, and mandatory generators fail the build.

## Impact

`pnpm-workspace.yaml` gains only the sync block. Overrides stay at their current values. No application runtime, auth, or dependency advisory change. Related to #1058. Builds from `main` by itself. The dependency-override PR edits a different region of the same file.
