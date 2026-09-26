# ink-and-paper-product-theme

## Why

GitHub #918 (decision j_kro 2026-09-23): the ink-and-paper design system (reference PR #917, `site/` — spec only, do not merge) becomes the product-surface default. Product surfaces currently ship the maple-red dark brand theme everywhere; the decision splits brand (marketing keeps maple-red) from product (docs, tools, account — ink on paper). The port is tokens only: no better-auth/kysely/PGlite, no server middleware, no Nitro preset, no route copy, no `__grok` scaffold.

## What Changes

- **New theme file** `packages/portal/src/styles/themes/ink-and-paper.css`: one scoped class `.theme-ink-and-paper` carrying the 12 colour roles (namespaced `--iap-*` to avoid colliding with the brand `--color-ink: #334155` token), radii (control 0.5rem / panel 2rem / console 1.75rem), shadow-panel, ease `cubic-bezier(0.22,1,0.36,1)` 150ms, fluid `--iap-text-hero`/`--iap-text-section` scales, reduced-motion base, and self-hosted `@font-face` for Newsreader / Source Sans 3 / IBM Plex Mono (10 woff2 subsets in `packages/portal/public/fonts/`, no Google Fonts request).
- **Semantic mapping**: the same class maps ink values onto `--background/--foreground/--card/--primary/--border/--ring` (and the secondary/accent/muted/sidebar family) as HSL triplets, so every `hsl(var(--x))` consumer restyles from one place. `--primary` = ink ("ink does the emphasis"); `--ring` = ink at /60 alpha for focus (4.56:1 on paper — fixes the measured ink/40 failure at 2.52:1).
- **Promotion** in `BaseLayout.astro`: a build-time `PRODUCT_SURFACES` prefix list (`/docs /explorer /agents /ask /api-explorer /citation /verify /status /watcher /signal /dashboard /workspace /signup /checkout`, `/fr` mirrors via `stripLangPrefix`) adds the class to `<html>`, suppresses the hard-coded `class="dark"` + Google Fonts links, and swaps the theme-color meta to paper. Brand family (`/ /pricing /blog /contact /privacy /terms /changelog`) is unchanged.
- **Scoped chrome fixes** inside the theme class: nav active pill (brand `bg-[var(--maple)]` → ink), `.btn-sheen` (maple gradient → flat ink), `.text-gradient` (red gradient → solid ink), `.aurora` (glow → none), input focus (maple ring → ink/60), `::selection` (ink/paper). Maple red is never body text on paper (4.28:1 would fail 4.5:1).
- **Sixth demo skin** in `design-demo.astro`: `ink-and-paper` section over the existing skeleton, like-for-like with the other five. The 5-items-in-2-columns empty-cell bug from the reference is not copied.
- **Regression test** `src/styles/themes/ink-and-paper.test.ts` (vitest): parses the theme file, asserts all six role vars resolve under `.theme-ink-and-paper`, and runs every token pair through a WCAG contrast function — ≥ 4.5:1 normal text, ≥ 3:1 focus. Fails if any token drops below the floor.

## Impact

- Affected specs: `ink-and-paper-product-theme` (new capability)
- Affected code: `packages/portal/src/styles/themes/` (new), `packages/portal/public/fonts/` (new assets), `packages/portal/src/layouts/BaseLayout.astro`, `packages/portal/public/script.js` (ink-surface guard), `packages/portal/src/pages/design-demo.astro`, `packages/portal/tests/` (none — new test lives in `src/styles/themes/`)
- No MCP tools, no API endpoints, no data flow changes
- Fonts: 10 self-hosted woff2 files (~554 KB) served from `/fonts/`; `@font-face` declarations are inert on brand pages (family unused → no fetch)
- Not in scope: dark-mode variant of ink-and-paper (the decision ships one light product theme), per-page markup rewrites, PR #917's runtime/scaffold/copy
