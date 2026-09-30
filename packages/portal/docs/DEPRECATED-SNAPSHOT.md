# Stale, unregenerated snapshot — do not edit

This directory is an old output of `scripts/build-docs.mjs`. That script now
writes to `packages/portal/dist/docs`, which is the copy GitHub Pages deploys
(`.github/workflows/deploy-docs.yml` uploads `packages/portal/dist`).

Nothing in this directory is served, and no current script regenerates it. The
`.html` files here still carry claims that have since been corrected in the
canonical Markdown under `packages/docs/**/*.md` — blanket licence statements,
"every record has a SHA-256 citation hash", and fixed module/tool counts.

- Edit `packages/docs/**/*.md`, then run `node scripts/build-docs.mjs` from the
  repo root.
- Do not hand-edit the HTML here; changes will be lost and never shipped.

These files are candidates for deletion. Until that decision is made they are
kept as-is so history stays intact.
