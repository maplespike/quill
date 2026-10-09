# Design: Fix image-pin gate accepting date-only tags (issue #1032)

## Approach

Close the gate/test divergence at its source: one regex, one semantics — a
quill service tag must be `YYYY-MM-DD-<suffix>` (date-build-tag alternative),
and the version alternative must not be able to reassemble a date.

### The regex change (scripts/gates/check-image-pins.mjs)

Before:

```
/^(?:\d{4}-\d{2}-\d{2}-[0-9a-z][0-9a-z.-]*|v?\d+(?:\.\d+)*(?:-[0-9a-z][0-9a-z.-]*)?)$/
```

After:

```
/^(?:\d{4}-\d{2}-\d{2}-[0-9a-z][0-9a-z.-]*|v?(?!\d{4}-\d{1,2}(?:-\d{1,2})?(?:-|$))\d+(?:\.\d+)*(?:-[0-9a-z][0-9a-z.-]*)?)$/
```

The lookahead `(?!\d{4}-\d{1,2}(?:-\d{1,2})?(?:-|$))` sits after `v?`, inside
the version alternative. It blocks that alternative whenever the tag starts
with a 4-digit year followed by dash-digits — the date shape — including
`2026-10-05`, `2026-10-5`, `2026-10`, `2026-1`, `v2026-10-05`, and
`2026-10-5-extra` (date prefix + odd suffix). A date-shaped tag must then
qualify through the first alternative, which accepts exactly the CI-enforced
`YYYY-MM-DD-<suffix>` shape. The gate and the CI test now agree on every
date-shaped tag: both accept `2026-10-06-f34547a9-dirty`, both reject
`2026-10-05`.

The lookahead cannot fire on a true version pin:

- `17-alpine` — needs 4 leading digits; `17-a…` fails `\d{4}` → not blocked;
  accepted as a version.
- `2026.8.2` — after `2026` the lookahead demands a `-`; the tag has `.` →
  not blocked; accepted.
- `v1.2.3-rc1` — `1.2.3-rc1` fails `\d{4}` at the start → not blocked;
  accepted.
- `8.2.3-alpine` — `8.2.…` fails `\d{4}` → accepted.

Only a tag opening with a 4-digit-year-dash-digits shape is barred from the
version path — and such a tag is a date (or a date plus something), never a
version this repo pins. The card sanctions this strict form: "forbid the
version alternative entirely from matching `\d{4}-\d{2}-\d{2}` prefixes".

### Tests (scripts/test-image-pins.mts)

Two layers, per the repo's existing `test-secret-lockstep.mts` convention of
driving the REAL gate script through `spawnSync`:

1. Unit layer: extend the `classifyRef` block so
   `classifyRef('quill-ingest:2026-10-05')` is `{ok:false, kind:'unpinned'}`,
   and a table of date-only shapes (`2026-10-05`, `2026-10-5`, `26-10-05`,
   `v2026-10-05`) all rejected, while `17-alpine`, `8.2.3-alpine`,
   `2026.8.2`, `v1.2.3-rc1`, `2026-10-06-f34547a9-dirty`,
   `2026-10-06-serve-fix`, digest refs stay ok. Cite incident run 37408574389
   / commit bfe587bb in the test comment.
2. Gate layer (new test): spawn the REAL gate script against a temp copy of
   values-prod with the ingest tag flipped to the bfe587bb value and assert
   exit 1. This locks the incident's exact false-green path shut: the operator
   gate must catch what CI catches.

### Why test the gate end-to-end

`checkProdValues` validates the quill service tag through `classifyRef`, and
the divergence was between the gate process and the CI test process. Spawning
the real gate (not importing internals) proves the operator command an author
runs before pushing actually exits non-zero on the bad values — the exact
command recorded in bfe587bb's commit message.

## Security / rollout / rollback

- Security: stricter acceptance of image tags only; no new inputs, no network,
  no deps. False greens are a supply-chain hygiene risk; this narrows them.
- Rollout: single commit, squash-merged to main; CI runs it on the PR.
- Rollback: revert the single commit; the regex returns to its prior shape and
  the two new tests fail open (they assert rejection, so a revert turns the
  new tests red — intentional, since reverting restores the incident's root
  cause).
