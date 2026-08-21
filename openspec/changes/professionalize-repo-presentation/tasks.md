## 1. Standard files

- [ ] 1.1 Create root `llms.txt` (project card per llmstxt.org: H1 name, one-line description, key doc links, API endpoints) mirroring `packages/portal/public/llms.txt` scope to repo level
- [ ] 1.2 Create root `llms-full.txt` (fuller project card: summary, architecture, package list, quick start)
- [ ] 1.3 Create `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1, link-first, reporting contact)

## 2. Credits and vision

- [ ] 2.1 Create `CREDITS.md` — attribution table (project, license, version/date, method) for underlying technologies, pattern-inspiration repos, research-agent credit, product-vision owner; document the LICENSE-file verification method
- [ ] 2.2 Create `docs/VISION.md` — architecture overview, roadmap summary, principles, attribution + license table

## 3. Logo canonicalization

- [ ] 3.1 Create `assets/logo/` and copy `packages/portal/public/logo.svg` → `assets/logo/logo.svg`
- [ ] 3.2 Render `assets/logo/logo.png` with ImageMagick and verify it renders (check `magick` availability first)

## 4. README header and badges

- [ ] 4.1 Replace README H1 block with centered header: logo + name + tagline
- [ ] 4.2 Add shields.io badge row (status, license AGPL-3.0|MIT, CI) linking to real targets
- [ ] 4.3 Preserve the existing status line, rename-note callout, and all downstream content unchanged

## 5. README lint CI

- [ ] 5.1 Create `.github/workflows/readme-lint.yml` — trigger on PR/push touching `*.md`, pinned `lycheeverse/lychee-action@v1` + `DavidAnson/markdownlint-cli2-action@v16`, `runs-on: ubuntu-latest`
- [ ] 5.2 Add `.markdownlint-cli2.jsonc` (permissive: disable MD013 line-length, keep structural rules)
- [ ] 5.3 Configure lychee excludes for non-HTTP schemes (`gitlawb://`, etc.)
- [ ] 5.4 Verify workflow YAML parses and the actions are pinned (no `latest`/`stable`)

## 6. Verification and staging

- [ ] 6.1 Run `git status` and confirm only the expected files changed
- [ ] 6.2 Render-check the logo PNG; visually confirm the README header renders
- [ ] 6.3 Run `openspec validate` on the change and confirm it passes
- [ ] 6.4 Stage the full diff for user review — do NOT push or commit without user approval
