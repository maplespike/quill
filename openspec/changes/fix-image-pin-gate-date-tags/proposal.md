# Proposal: Fix image-pin gate accepting date-only tags (issue #1032)

## Problem

CI run 37408574389 (main, SHA 31f810d7) failed `build-and-test [Image pin unit
tests]` on `images.ingest.tag: '2026-10-05'` — a date-only tag with no build
suffix. The bad pin arrived in commit bfe587bb, whose author ran the operator
gate (`scripts/gates/check-image-pins.mjs`) and saw `image pins: OK (4 refs
checked)` before pushing. The gate gave a false green; CI caught what the gate
did not. The gate and the unit test disagree on the same input.

## Root cause

`IMMUTABLE_TAG_RE` (scripts/gates/check-image-pins.mjs:50-51) has two
alternatives: a date-stamped build tag (`2026-09-21-sha.aa7a…`, suffix
mandatory) and a pinned upstream version (`17-alpine`, `2026.8.2`,
`v1.2.3-rc1`). The version alternative matches `2026-10-05` because `2026` +
`-10-05` parses exactly like `v1-2-3`. A date-only tag therefore slips through
the gate as a "pinned upstream version" while the CI test
(scripts/test-image-pins.mts:185-194) requires `YYYY-MM-DD-<suffix>` for quill
service tags.

## Proposed fix

In `scripts/gates/check-image-pins.mjs` only:

1. Add a negative lookahead to the version alternative of
   `IMMUTABLE_TAG_RE` that rejects any `YYYY-MM-DD` shape before the version
   pattern can match. A tag that looks like a bare date is not a version pin.
2. Keep the date-build-tag alternative unchanged (it already requires the
   build suffix).
3. Add regression tests in `scripts/test-image-pins.mts` citing this incident
   (CI run 37408574389, commit bfe587bb): `classifyRef` must reject
   `quill-ingest:2026-10-05` as `{ok:false, kind:'unpinned'}`, and the
   operator gate run as a subprocess against a values file carrying the
   bfe587bb tag must exit 1 (the exact false-green path of the incident).

## Affected packages

- None (scripts/ only). No API/MCP contract change. No new dependencies.
  CI contract: `pnpm run test:pins` (unchanged command) and the operator gate
  command are unchanged; only their agreement on date-only tags changes.

## Verification gate

- `NODE_ENV=test pnpm exec tsx --test scripts/test-image-pins.mts` green.
- `node scripts/gates/check-image-pins.mjs --values charts/quill/values-prod.yaml`
  exit 0 on current main values.
- With `images.ingest.tag` temporarily reverted to `'2026-10-05'` (the
  bfe587bb value), BOTH the gate and the unit test must go red.
- No regression on real third-party pins: `17-alpine`, `8.2.3-alpine`,
  `2026.8.2`, `v1.2.3-rc1`, and digest refs stay accepted.
