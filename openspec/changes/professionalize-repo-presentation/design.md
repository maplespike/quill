# Design: Professionalize Repository Presentation

## Context

The repo is a 14-package TypeScript/pnpm monorepo with a production k3s deploy,
28 CI workflows, and deliberate AGPL-3.0 (pipeline-core) / MIT (packages)
licensing. The professionalization gaps are presentational and community-hygiene
only — no product code changes.

Constraints discovered during recon:

- The repo enforces an **OpenSpec-first** workflow (AGENTS.md): every change
  follows propose → apply → archive.
- The repo is **private** on GitHub (`reverb256/quill`). This pass prepares for
  eventual public launch but does NOT flip visibility.
- The live logo already exists in `packages/portal/` (multiple copies:
  `public/logo.svg`, `src/assets/logo.svg`, `public/assets/maplespike_logo.svg`).
  Canonicalizing to `assets/logo/` should **reference, not recreate**.
- The README "Infrastructure Status" section exposes internal topology
  (tunnel IDs, `nexus:5000` registry, `.lan` DNS). This is a publish-gate item,
  not a change item — recorded in the change archive for later.
- The `docs-validation.yml` workflow covers metadata + link structure, but not
  dead links (lychee) or markdown lint (markdownlint).

## Goals / Non-Goals

**Goals:**

- Add the missing standard files (`CODE_OF_CONDUCT.md`, root `llms.txt` /
  `llms-full.txt`) with correct, verifiable content.
- Record attribution (`CREDITS.md`, `docs/VISION.md`) with a reproducible
  license-verification method.
- Canonicalize the logo into `assets/logo/` with a render-verified PNG.
- Add a README header (logo + name + tagline) and badge row (status, license,
  CI) pointing at real targets.
- Add a pinned README-lint CI job (lychee + markdownlint-cli2).
- Follow the OpenSpec cycle and stage everything for user review before push.

**Non-Goals:**

- No license change (AGPL core / MIT packages stays).
- No repo rename, no visibility flip.
- No code, dependency, or API changes.
- No README rewrite beyond the header/badge block.
- No removal of the internal-infra details from the README (publish-gate
  follow-up, recorded in the change archive).

## Decisions

### D1: Reference the existing portal logo, do not recreate

- **Choice:** Copy the existing `packages/portal/public/logo.svg` (the
  geometric 11-spike maple leaf with data connection lines) into
  `assets/logo/logo.svg`, then render `logo.png` with ImageMagick.
- **Why:** The logo is already the product identity (used by the portal, favicon,
  and docs). Recreating it invites brand drift. The skill's prerequisite
  (`imagemagick`) is available via `nix profile install` if missing.
- **Alternative considered:** Authoring a fresh SVG with the SVG Logo Designer
  skill — rejected, would fork the brand.

### D2: llms.txt — reuse the portal's proven content, widen to repo scope

- **Choice:** Root `llms.txt` mirrors the portal's `packages/portal/public/llms.txt`
  structure (project card per llmstxt.org), scoped to the repo: summary,
  key links (`README.md`, `docs/ARCHITECTURE.md`, `docs/metrics.json`,
  `packages/quill-mcp/README.md`), and API endpoint list.
- **Why:** The portal version is already battle-tested (live on
  `quill.maplespike.ca/llms.txt`); the root version extends it to repo-level
  docs. `llms-full.txt` carries the fuller description (package list, quick
  start, architecture).
- **Alternative considered:** Generating via a script — overkill for a static
  card; the portal files are hand-maintained and authoritative.

### D3: CODE_OF_CONDUCT — Contributor Covenant v2.1, link-first

- **Choice:** Adopt Contributor Covenant v2.1 with a link to the official text
  and a `maplespike` reporting contact (the skill's link-first rule: do not
  embed the full text).
- **Why:** The skill flags that agents get blocked reproducing the full
  Covenant text; link-first is both correct and reliable. The repo has no
  existing CoC to conflict with.

### D4: CREDITS.md — reproducible license verification

- **Choice:** Table of credited technologies/repos with columns: project,
  license, version/date, method (fetched LICENSE file). Document the method:
  "license verified by fetching the repo's LICENSE file, not the GitHub API
  metadata (which returns None/NOASSERTION for licensed projects)".
- **Why:** The skill's section 5 — the GitHub API license field is unreliable.
- **Source list (researched):** TypeScript, Node.js, pnpm, Astro, React,
  Tailwind, better-sqlite3, Fastify/Express (per package manifests), Stripe,
  Cloudflare (tunnel/Pages), K3s, NixOS, OpenSpec, and pattern-inspiration
  repos (`reverb256/mcp-canada`, `reverb256/Frostbite-Gazette`,
  `reverb256/ai-inference-gateway`, `reverb256/astral-key`).
- **Direct code reuse:** none — all external software is consumed as packages
  or separate services (license-compatible with AGPL/MIT as library deps /
  process calls).

### D5: README header — logo + badges, minimal diff

- **Choice:** Replace the current H1 `# MapleSpike` block with a centered
  header: logo image, name, tagline, then a badge row. Preserve the existing
  status line and rename-note callout below.
- **Badges (shields.io, all real targets):**
  - Status: `active` (link to repo).
  - License: `AGPL-3.0|MIT` (link to `LICENSE`).
  - CI: `ci.yml` workflow badge (link to `actions/workflows/ci.yml`).
- **Why:** Minimal diff, maximum signal. The skill's "no badges = unfinished"
  rule is satisfied without a content rewrite.

### D6: README-lint CI — pinned actions, path-scoped

- **Choice:** New `.github/workflows/readme-lint.yml`:
  - Trigger: `pull_request` + `push` on `main`/`prod`, paths `*.md` +
    `packages/*/README.md` + `docs/**/*.md`.
  - Jobs: `lycheeverse/lychee-action@v1` (dead links) and
    `DavidAnson/markdownlint-cli2-action@v16`, both pinned.
  - `runs-on: ubuntu-latest` (these are standard GitHub-hosted actions; the
    self-hosted nixos runners are for build/test, not lint).
- **Why:** The skill prescribes exactly these two actions. Pinning matches the
  repo's "pinned toolchain versions, never floating" convention.
- **Alternative considered:** adding to `docs-validation.yml` — rejected; keeps
  concerns separate and the new job is independently disable-able.

### D7: OpenSpec change name + capabilities

- **Choice:** Change name `professionalize-repo-presentation`; six new
  capabilities: `repo-standard-files`, `repo-credits`, `repo-docs-vision`,
  `repo-assets-logo`, `repo-presentation`, `repo-ci-readme-lint`.
- **Why:** Matches the spec-driven schema; each capability maps to a
  independently-reviewable file group.

## Risks / Trade-offs

- **Badge targets go stale (e.g. workflow renamed)** → badges link to stable
  paths (`actions/workflows/ci.yml`), and the README-lint CI will not catch a
  broken badge URL — mitigated by pinning to stable paths and verifying at
  apply time.
- **lychee flags false positives (e.g. `gitlawb://` remote URLs in docs)** →
  configure lychee with `--exclude` for non-HTTP schemes; verify on a sample
  before enabling as a hard gate.
- **markdownlint flags existing docs style (MD013 line length etc.)** →
  start with a permissive `.markdownlint-cli2.jsonc` (disable line-length,
  MD013) and only enforce structural rules; the gate should not block the
  existing 300+ docs.
- **Logo PNG render depends on ImageMagick** → it's a dev-time verification
  step, not a build dep; check `magick` availability first.
- **CREDITS license data could be wrong** → every row records the verification
  method and date; corrections are a docs PR away.
- **Scope creep (README rewrite)** → the change is strictly additive;
  non-goals are explicit in the proposal.

## Migration Plan

This is additive documentation — no rollback path needed. Files land in one
commit group; each is independently removable.

## Open Questions

- None blocking. (Reporting contact for the CoC defaults to the repo owner
  handle `reverb256`; the user can change it before push.)
