## Context

pnpm reads overrides from `pnpm-workspace.yaml`. The lockfile must match. `http-cache-semantics` has `last_affected: 4.2.0` and no fixed event (GHSA-ch52-4w7c-c8xp, modified 2026-10-02). npm 4.3.0 changes `Vary: *` matching. It does not change the max-stale path. Astro uses the package for remote-image build caching. The production portal is Python `server.py`.

## Decisions

1. Bump only packages that have a patched release in the existing override style.
2. Do not add an override, resolution, or audit suppression for `http-cache-semantics`.
3. Do not add the workspace sync block in this slice.

## Rollout

The next install uses the new lockfile. Rollback restores the previous lockfile and override lines. No credential or runtime config change.

## Verification

`pnpm install --frozen-lockfile` must succeed on this lockfile. Audit may still report the high `http-cache-semantics` advisory. CI fails audit only on critical.
