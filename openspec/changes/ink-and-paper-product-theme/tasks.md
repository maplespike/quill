# tasks — ink-and-paper-product-theme

## 1. Theme file

- [ ] 1.1 `packages/portal/src/styles/themes/ink-and-paper.css`: scoped class `.theme-ink-and-paper` with 12 `--iap-*` colour roles at the exact spec hexes
- [ ] 1.2 Radii (control 0.5rem / panel 2rem / console 1.75rem), shadow-panel, ease `cubic-bezier(0.22,1,0.36,1)` 150ms motion tokens
- [ ] 1.3 Fluid `--iap-text-hero` / `--iap-text-section` type scales (clamp)
- [ ] 1.4 Self-hosted @font-face × 10 (Newsreader 400-700 + italic, Source Sans 3 400-700, IBM Plex Mono 400/500; latin + latin-ext unicode-ranges) from `public/fonts/` — no Google Fonts request
- [ ] 1.5 Semantic var mapping under the class: `--background/--foreground/--card/--primary/--border/--ring` + secondary/accent/muted/sidebar family as HSL triplets
- [ ] 1.6 Focus ring ink/60 (4.56:1 — not ink/40 at 2.52:1); no maple-red body text; reduced-motion base layer

## 2. Promotion to product surfaces

- [ ] 2.1 `PRODUCT_SURFACES` prefix list in BaseLayout; gate `.theme-ink-and-paper` on `<html>` via `stripLangPrefix(cleanPath)`
- [ ] 2.2 On product surfaces: suppress `class="dark"` hard-code, suppress Google Fonts `<link>`s, theme-color meta = paper `#f4f2ec`
- [ ] 2.3 Theme-toggle hides on ink surfaces (script.js guard) — the light/dark toggle is a brand-surface feature
- [ ] 2.4 Scoped chrome fixes inside the class: nav pill, btn-sheen, text-gradient, aurora, ::selection, input focus ring (ink/60)

## 3. Demo skin

- [ ] 3.1 Sixth `ink-and-paper` entry in design-demo.astro themes array, like-for-like skeleton
- [ ] 3.2 Skin CSS: paper canvas, Newsreader headline, ink primary button, hairline lines, panel shadow, 44px controls, empty-cell bug not copied

## 4. Regression test

- [ ] 4.1 `src/styles/themes/ink-and-paper.test.ts`: parses the CSS, asserts the 6 semantic role vars resolve under `.theme-ink-and-paper` (background, foreground, card, primary, border, ring)
- [ ] 4.2 WCAG contrast floor: every declared text pair ≥ 4.5:1, focus pairs ≥ 3:1 — test fails if any token drops below the floor
- [ ] 4.3 Cross-check the parsed role triplets against the spec hexes (paper #f4f2ec … on-ink-line #3a3a34)

## 5. Verification

- [ ] 5.1 `pnpm --filter @maplespike/portal build` green; every route emits
- [ ] 5.2 Preview each of the 14 product routes → `curl -o /dev/null -w '%{http_code}'` = 200
- [ ] 5.3 Contrast script over the token pairs ≥ 4.5 / ≥ 3
- [ ] 5.4 Hit-target sweep `a, button, [role="tab"]` at 390px + 1440px, scrollWidth ≤ innerWidth
- [ ] 5.5 Screenshots of each product route at 1440px + 390px, attached
- [ ] 5.6 OpenSpec change validated and archived
