# The `.html` files in this package are stale snapshots

`packages/docs/**/*.md` are the canonical documentation sources.
`scripts/build-docs.mjs` (run from the repo root) reads them and writes the
served HTML to `packages/portal/dist/docs`.

The `.html` files sitting next to those Markdown files — and everything under
`packages/docs/public/` — are leftovers from an earlier static export. No
current script reads or writes them, and they are not deployed: the deploy
workflow uploads `packages/portal/dist`.

They still contain claims that have since been corrected in the Markdown, such
as blanket `"license": "Open Government Licence – Canada"` sample payloads,
`"retrieved_at"` values that are not acquisition timestamps, "Every record has a
SHA-256 citation hash", and hard-coded module counts (65+, 142, 206).

- Edit the `.md` files, not these.
- These files are candidates for deletion. Until that decision is made they are
  kept as-is so history stays intact.
