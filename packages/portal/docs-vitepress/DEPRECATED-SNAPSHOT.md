# Stale, unregenerated snapshot — do not edit

This directory is a VitePress-era documentation build that is no longer part of
any build. `scripts/build-docs.mjs` does not read or write it, and the deploy
workflow (`.github/workflows/deploy-docs.yml`) uploads `packages/portal/dist`,
which is built from `packages/docs/**/*.md`.

The `.html` files here still carry claims that have since been corrected in the
canonical Markdown — blanket licence statements, "every record has a SHA-256
citation hash", and fixed module/tool counts.

- Edit `packages/docs/**/*.md`, then run `node scripts/build-docs.mjs` from the
  repo root.
- Do not hand-edit the HTML here; changes will be lost and never shipped.

These files are candidates for deletion. Until that decision is made they are
kept as-is so history stays intact.
