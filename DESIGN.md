---
version: public-record-1
name: Quill
updated: 2026-10-16
description: Canadian public-sector sources for research and AI tools.
colors:
  background: "#f4f2ec"
  foreground: "#161614"
  card: "#fbfaf6"
  paper-deep: "#e7e3d8"
  muted: "#ece8de"
  muted-foreground: "#534f46"
  primary: "#161614"
  primary-foreground: "#f4f2ec"
  border: "#ddd8cc"
  input: "#cfc8b8"
  editorial-red: "#a63029"
  on-ink: "#f6f4ef"
  on-ink-muted: "#b9b5aa"
  on-ink-line: "#3a3a34"
typography:
  display: Newsreader
  text: Source Sans 3
  data: IBM Plex Mono
layout:
  max-width: 1280px
  gutter: "clamp(20px, 4vw, 64px)"
  header-desktop: 88px
  header-mobile: 76px
  navigation-breakpoint: 1100px
  mobile-breakpoint: 768px
motion:
  duration: 150ms
  ease: "cubic-bezier(0.22, 1, 0.36, 1)"
---

# Quill design system — Public Record

## Direction

Quill is a research instrument, not a generic AI landing page. Its interface must feel clear, precise, and human. Use an editorial composition: warm paper, strong ink typography, fine rules, generous space, and a restrained red accent.

One identity serves the whole portal. Marketing, research, documentation, signup, pricing, and account pages use the same ink-and-paper foundation. Do not restore the former split between dark marketing pages and light product pages.

Quill is the product. MapleSpike is the parent brand. Display **Quill** in the primary wordmark, with **by MapleSpike** or **par MapleSpike** as secondary text. Preserve publisher attributions and legal notices.

### Principles

1. **The source comes first.** Make source discovery and inspection easy.
2. **Ink creates hierarchy.** Colour is not a substitute for structure.
3. **Organise by task.** Help people discover, research, verify, and connect tools.
4. **Evidence has limits.** Never imply that a hash proves authenticity or grants reuse rights.
5. **Content is visible by default.** JavaScript and animation must not gate static content.
6. **French is a first-class route.** Translate controls and preserve language through navigation and hydration.

## Implementation authority

| Concern | Source |
| --- | --- |
| Colour roles, local font faces, focus contrast | `packages/portal/src/styles/themes/ink-and-paper.css` |
| OKLCH twins, P3 path, derived colours, contrast/forced-colours layers | `packages/portal/src/styles/themes/ink-and-paper.oklch.css` |
| Canonical colour tokens (W3C DTCG) | `packages/portal/src/styles/tokens/quill.tokens.json` |
| Editorial composition, shared page rhythm, responsive rules | `packages/portal/src/styles/editorial.css` |
| Metadata, main landmark, footer, runtime hooks | `packages/portal/src/layouts/BaseLayout.astro` |
| Primary navigation, mobile menu, research rail | `packages/portal/src/components/SiteHeader.astro` |
| Bilingual landing | `packages/portal/src/components/LandingBody.astro` |
| Functional React primitives | `packages/portal/src/components/ui/` |
| Published coverage counts | `packages/portal/src/data/stats.json` |
| Canonical repository metrics | `docs/metrics.json` |
| Prices and plan limits | `packages/portal/src/data/plans.json` |

The tables in this document describe the system. CSS defines its rendered values. Do not hardcode tool counts, module counts, prices, or plan limits in page copy or this document. Read the generated data instead.

Use Astro for static structure and React islands for stateful features. Reuse existing dependencies. In Astro, pass React component styling through **`className`**, not `class`. Native HTML elements use `class`. The current Astro-to-React integration can drop component `class` props before the component receives them.

## Colour

Colour roles are specified in **OKLCH** (CSS Color 4) with the sRGB hex as the
exact fallback. The canonical token file is
`packages/portal/src/styles/tokens/quill.tokens.json` (W3C DTCG 2025.10,
`colorSpace: "oklch"` + `hex`). `ink-and-paper.css` keeps the HSL-triplet
roles that components consume as `hsl(var(--x))`; `ink-and-paper.oklch.css`
adds the `--q-*` OKLCH twins, the wide-gamut path, derived states, and the
contrast/forced-colours layers. Both are pinned by tests.

### Paper planes

| Role | OKLCH | hex |
| --- | --- | --- |
| Paper (the page) | `oklch(96.10% 0.0083 91.48)` | `#f4f2ec` |
| Surface (panels, forms) | `oklch(98.48% 0.0054 95.10)` | `#fbfaf6` |
| Paper deep (section separation) | `oklch(91.59% 0.0154 90.24)` | `#e7e3d8` |
| Chip (secondary controls) | `oklch(93.14% 0.0140 88.69)` | `#ece8de` |
| Line (dividers) | `oklch(88.29% 0.0171 88.01)` | `#ddd8cc` |
| Strong line (inputs, major rules) | `oklch(83.40% 0.0232 87.16)` | `#cfc8b8` |

### Ink and emphasis

| Role | OKLCH | hex | On paper (WCAG 2.2) | APCA Lc |
| --- | --- | --- | --- | --- |
| Ink | `oklch(19.94% 0.0039 106.75)` | `#161614` | 16.19:1 | 97 |
| Soft ink | `oklch(29.17% 0.0071 106.83)` | `#2c2c28` | 12.52:1 | — |
| Muted ink | `oklch(42.86% 0.0154 86.89)` | `#534f46` | 7.29:1 | 80 |
| Editorial red | `oklch(48.84% 0.1554 27.78)` | `#a63029` | 6.10:1 | 75 |

**Editorial red** marks small markers, active underlines, numbered labels, and
occasional display emphasis. It is not the default body or button colour. On
Display-P3 screens it becomes `oklch(48.84% 0.1832 27.78)` — same lightness and
hue, ~40% of the extra chroma P3 allows — via `@media (color-gamut: p3)`.
Paper and ink are near-neutral and are never gamut-boosted.

### Reversed planes

Use dark ink for the landing integration console, not as a competing site
theme. On-ink `#f6f4ef` / `oklch(96.73% 0.0070 88.64)`, muted on-ink `#b9b5aa`
(8.25:1, Lc −61 on the console), on-ink line `#3a3a34`, console interior
`#1d1d1a`. Use explicit focus colours on reversed planes. Preserve readable
status text, not just red/green dots. Do not use the former bright maple red
`#e84545` for text on paper: 3.49:1 fails the normal-text AA floor.

### Derived colours

Do not hand-pick hover or tint hexes. Derive them from the source role with
`color-mix(in oklch, …)`, upgraded to relative colour syntax under
`@supports (color: oklch(from red l c h))`. Shipped: `--q-red-hover`,
`--q-red-tint`, `--q-ink-hover`, `--q-focus-ring` (= ink/60).

### User preferences

- `color-scheme: light` on the theme root; light is the default. The header
  toggle switches to the ink-and-paper dark variant
  (`.theme-ink-and-paper.dark`, `color-scheme: dark`), which inverts the
  paper/ink planes and remembers the choice in `localStorage`
  (`maplespike-theme`). The `.dark` class is the switch — `data-theme` keeps
  naming the design theme (`ink-and-paper`).
- `@media (prefers-contrast: more)`: muted text → soft ink (12.5:1), hairlines →
  strong line, focus ring fully opaque (mono labels are already 11–12px).
- `@media (forced-colors: active)`: system `Highlight` focus, `CanvasText`
  panel borders; the editorial dot keeps its colour (`forced-color-adjust: none`).
- `prefers-reduced-motion` handling is unchanged (see Motion).

### Contrast requirements

Normal text must meet WCAG 2.2 AA 4.5:1; focus indicators 3:1 against their
surroundings. The tested paper theme uses an ink/60 focus ring (4.56:1); ink/40
fails (2.52:1). Alongside WCAG 2.2, the APCA (WCAG 3 draft) floors are tested:
body ≥ Lc 90, secondary body ≥ Lc 75, markers/display ≥ Lc 60. 10px text is
below APCA's minimum readable size for anything but non-essential labels.
Keep `ink-and-paper.test.ts` (WCAG) and `ink-and-paper.oklch.test.ts` (OKLCH
round-trip, P3 gamut, APCA). New colour pairs need measured coverage, not an
assumed pass.

### Browser baseline

`oklch()`, `color-mix()`, `color-gamut`, `prefers-contrast`, `forced-colors`
are Baseline (2023 or earlier). Relative colour syntax is Baseline 2024 and is
behind `@supports`. Engines without `oklch()` keep the hex declarations.

## Typography

All portal fonts are self-hosted under `packages/portal/public/fonts/`. Do not request Google Fonts.

| Role | Family | Use |
| --- | --- | --- |
| Display | Newsreader | Page titles, section titles, editorial emphasis |
| Text | Source Sans 3 | Body text, labels, navigation, form controls |
| Data | IBM Plex Mono | Code, identifiers, counts, small editorial labels |

- Landing hero: `clamp(46px, 4.5vw, 67px)` on desktop; `clamp(45px, 8.8vw, 65px)` below 768px.
- Product title: `clamp(35px, 3.5vw, 48px)`.
- Landing section title: `clamp(34px, 3.4vw, 48px)`.
- Display weight: usually 500. Keep line height tight and tracking slightly negative.
- Body: 16–18px in editorial sections, with 1.6–1.65 line height.
- Data tables and navigation: 13–14px where appropriate.
- Eyebrows: 12px mono, increased tracking. Use for short supplementary labels only. Supplementary mono labels (rail labels, link notes, kickers, bylines) are 11px; nothing is set below 11px.
- Use italic Newsreader for a deliberate second phrase, not whole paragraphs.
- Use tabular figures for comparable numeric values. Keep long identifiers in mono.

Do not reduce important content to small uppercase metadata. Use real heading elements for document hierarchy. Shared card titles are visual labels; they do not replace the page heading structure.

## Layout and navigation

### Shared frame

The content width is at most 1280px. Gutters scale from 20px to 64px. The header stays visible after scroll. Do not hide primary navigation or shrink it into an unusable state.

Primary navigation: Explore, For AI agents, Documentation, Pricing. Keep the language switch, API-key action, and auth-aware account container. Preserve `nav-auth-container` for `auth.js`.

Below 1100px, show a mobile menu. It must:

- Use a button with `aria-controls` and accurate `aria-expanded`.
- Open and close with a click.
- Close on Escape and return focus to the menu button.
- Close on navigation and on resize to desktop.
- Rebind once per new DOM node after `astro:page-load`.
- Remove document-level listeners before the node leaves the page.
- Offer visible static navigation when JavaScript is disabled.

### Research rail

Product routes get a labelled research-tool rail: Data explorer, Ask Quill, Workspace, Signals, Watchers, Verify a record, API, Dashboard. Mark the current route with `aria-current="page"`. Allow horizontal scroll inside the rail on small screens; never widen the document.

### Product rhythm

Use compact introductions rather than full-screen heroes. Product sections start with about 32–44px of vertical space. Shared cards use a 7px radius and fine borders. Do not apply hover lift to passive information panels.

Keep grid children shrinkable. Let code blocks, tables, and documentation panel content scroll inside their own boundaries. Do not fix overflow with `overflow-x: hidden` on the document.

### Documentation

Use a 240px contents rail and a readable main column above 1024px. Below that, use one column. The rail can scroll within the viewport. Keep one main landmark; do not nest a second `<main>` inside BaseLayout.

## Landing narrative

1. **Search-first hero:** editorial title, short explanation, labelled search field, useful query links, and an AI integration link. Submit to the locale-aware explorer with the existing `query` parameter.
2. **Decorative artwork:** a paper archive still life, framed as field notes. It carries no data claim.
3. **Coverage band:** generated module, tool, and jurisdiction counts. No invented live counters.
4. **Research pathways:** three numbered paths for discovery, research, and integration. Use clear whole-row/card links.
5. **Source directory:** federal, provincial/territorial, municipal, and corporate/influence entry points. Use working query URLs; do not imply unsupported category filters work.
6. **Provenance principle:** explain source inspection, available evidence, and the limits of integrity checks.
7. **Connection desk:** a reversed-ink MCP/REST console with real hostnames, selectable code, copy controls, and translated success/failure feedback.
8. **Final invitation:** return to the explorer. Keep source terms and licence-review notices visible.

The landing is useful without hydration. Do not replace it with an empty React shell, a fabricated result feed, or a video that obscures the task.

## Components

### Buttons and links

Primary buttons are ink on paper, with a 4px radius. On ink planes, reverse the pair. Make action labels specific. Keep target height at least 44px; primary editorial actions are 46px. Do not rely on hover to reveal an essential control.

Text links can remain inline. Give navigational links an underline, border, or other clear affordance. External links that open a new tab use safe rel attributes.

### Panels

Shared primitives expose `data-slot` markers for card, header, title, description, content, and button. Style these hooks instead of brittle utility-class substring selectors. Preserve consumers' functional props and event handlers.

A panel separates related information. It is not a decorative sticker. Use hairline borders and restrained shadows. Keep documentation code and tables scrollable within the panel content.

### Inputs and feedback

Use visible or screen-reader labels. Inputs are at least 46px high in the shared theme. Provide readable empty, error, loading, and success states. Never show a fake successful result when a request fails.

Copy actions must report both success and failure through a live status region. Rebind them after ClientRouter navigation. Do not expose real credentials in examples, logs, screenshots, or artwork.

## Artwork and brand assets

The landing illustration is generated locally through the existing ComfyUI service. `public/assets/public-record-art.json` records the model, prompt, seed, and workflow. `scripts/generate-editorial-art.py` reproduces the job; the delivered WebP is optimised separately.

- Decorative image: empty alt text, dimensions set, honest AI-illustration caption.
- No fabricated maps, charts, documents, source seals, or evidence.
- Budget: under 100KB for the delivered landing illustration. Current asset is about 42KB.
- Keep text and all product meaning in HTML.
- Favicon and touch icon use the Quill ink-and-red monogram.
- `scripts/gen-og-image.mjs` generates bilingual 1200×630 PNG share cards in the same paper/ink style.

## Motion and accessibility

Prefer 150ms colour and opacity transitions. Use no large entrance animation, continuous decorative loop, or hover lift for passive content. Static content remains visible even if observers never run.

Respect `prefers-reduced-motion`. Keep the skip-to-content link, visible keyboard focus, labelled navigation, and one main landmark. On small screens, reflow sections instead of squeezing desktop columns. Test at 390px, 768px, and 1440px. Check larger text and translated strings when a layout changes.

## Language and truthfulness

English routes use bare paths; French routes use `/fr`. The route owns the language. A saved browser preference must not overwrite the rendered document language. Pass language explicitly into hydrated islands so their first client render matches server HTML.

Use short, active sentences. Describe what the product actually does. Avoid unsupported claims about coverage, freshness, source authenticity, legal rights, or production readiness. Retain publisher attribution, non-endorsement notices, and licence limitations on every applicable surface.

## Verification and release

Run checks from the repository root unless noted:

```bash
pnpm --filter @maplespike/portal exec astro check
pnpm --filter @maplespike/portal test
pnpm --filter @maplespike/portal... build
pnpm --filter @maplespike/portal smoke:dist
```

Serve the built site through its actual Python runtime:

```bash
cd packages/portal
PORT=4390 python3 server.py
```

In another terminal, run the browser suite:

```bash
node packages/portal/scripts/check-design-browser.mjs
```

`QUILL_PREVIEW_URL`, `QUILL_DESIGN_OUTPUT`, and `CHROME_BIN` can override the preview host, evidence directory, and Chromium path. The suite checks route status, overflow, landmarks, fonts, language, keyboard use, SPA navigation, clipboard failure, search handoff, auth display, no-JavaScript use, and reduced motion. Test fixtures do not prove live billing or authenticated API behavior.

Keep screenshots and machine-readable results with release evidence. A build alone is not acceptance. Rerun affected checks after a repair. Preserve failed checks as limitations; never weaken assertions to make a release pass.

Deploy through the repository's reviewed PR and GitOps process. Build and scan the portal image, import it into each eligible node's containerd store, pin its digest in Helm values, and let ArgoCD reconcile. Do not patch the live deployment's image outside git. Record operations in the ops log. Verify the public hostname and both portal replicas after rollout. Rollback uses the prior chart digest; no data migration is part of this design change.
