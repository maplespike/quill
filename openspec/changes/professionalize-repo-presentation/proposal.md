# Proposal: Professionalize Repository Presentation

## Why

The repo is functionally complete — 14 packages, 208 modules, extensive CI,
deliberate AGPL/MIT licensing, and a documented data-source licensing audit.
But the public-facing presentation has gaps that undercut the launch:

- No root `llms.txt` / `llms-full.txt` (portal ships them; the repo root does not).
- No `CODE_OF_CONDUCT.md`.
- No `CREDITS.md` attribution table or `docs/VISION.md` (research-agent ideas,
  pattern-inspiration repos, and underlying-tech licenses are unrecorded).
- README lacks the badge block and centered logo header that signal a
  well-run project at a glance.
- No README dead-link / markdown-lint CI gate (docs-validation covers metadata,
  not link health or lint).
- No canonical `assets/logo/` (logos live only inside `packages/portal/`).

## What Changes

- Add root `llms.txt` + `llms-full.txt` (LLM-readable project card, per llmstxt.org).
- Add `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1, link-first).
- Add `CREDITS.md` — attribution table: underlying technologies (with licenses +
  dates), pattern-inspiration repos, research-agent credit, product-vision owner.
- Add `docs/VISION.md` — architecture, roadmap, principles, with attribution +
  license table.
- Add `assets/logo/` — canonical SVG logo (sourced from the existing
  `packages/portal/` logo, not recreated) + PNG renders to verify.
- Update `README.md` — centered logo + name + tagline header, shields.io badge
  row (Status, License, CI), keep existing content.
- Add `.github/workflows/readme-lint.yml` — lychee (dead links) +
  markdownlint-cli2 (lint), pinned versions, on PR/push touching `*.md`.
- No code changes. No license changes. No dependency changes.
- **Non-goals:** do NOT change the AGPL/MIT license split (business decision),
  do NOT rename the repo, do NOT flip visibility (stays private until the user
  says otherwise), do NOT touch the live infra details in the README beyond a
  publish-gate checklist note in the change archive.

## Capabilities

### New Capabilities

- `repo-standard-files`: Root-level LLM-readable project cards (`llms.txt`,
  `llms-full.txt`) and community standard `CODE_OF_CONDUCT.md`.
- `repo-credits`: Attribution ledger — `CREDITS.md` table of underlying
  technologies, pattern-inspiration repos, research-agent credit, and product
  vision owner, each with license + date.
- `repo-docs-vision`: `docs/VISION.md` — architecture, roadmap, principles,
  attribution + license table.
- `repo-assets-logo`: Canonical `assets/logo/` SVG + rendered PNGs.
- `repo-presentation`: README centered header (logo + name + tagline) and
  shields.io badge row (Status, License, CI).
- `repo-ci-readme-lint`: CI job running lychee + markdownlint-cli2 over `*.md`.

### Modified Capabilities

- None. Existing specs (`pipeline-core`) have no requirement changes.

## Impact

- **Affected packages:** none (docs + CI only).
- **New files:** `llms.txt`, `llms-full.txt`, `CODE_OF_CONDUCT.md`,
  `CREDITS.md`, `docs/VISION.md`, `assets/logo/logo.svg` (+ PNGs),
  `.github/workflows/readme-lint.yml`.
- **Modified files:** `README.md` (header + badges only).
- **APIs / MCP tools / endpoints:** none.
- **Dependencies:** none (CI actions are pinned, not repo deps).
- **Module count:** unchanged (208).
