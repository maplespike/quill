---
version: alpha
name: Quill
description: Sovereign MCP server + REST API for Canada's public record — 198 modules, 166 tools (incl. `x402-deposit`), dark-theme React + Tailwind dashboard
colors:
  background: "#090909"
  foreground: "#fafafa"
  card: "#111111"
  popover: "#111111"
  muted: "#1a1a1a"
  muted-foreground: "#a3a3a3"
  primary: "#e84545"
  secondary: "#06b6d4"
  tertiary: "#22c55e"
  accent: "#6b1d1d"
  destructive: "#8f2020"
  border: "#262626"
  input: "#292929"
  ring: "#06b6d4"
  chart-1: "#3b82f6"
  chart-2: "#3bcc9a"
  chart-3: "#e8923b"
  chart-4: "#b366d9"
  chart-5: "#e84d8c"
typography:
  h1:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  h2:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.01em
  body:
    fontFamily: Inter
    fontSize: 0.85rem
    lineHeight: 1.5
  body-small:
    fontFamily: Inter
    fontSize: 0.78rem
    lineHeight: 1.4
  code:
    fontFamily: JetBrains Mono
    fontSize: 0.85rem
    lineHeight: 1.4
  nav:
    fontFamily: JetBrains Mono
    fontSize: 0.82rem
    letterSpacing: 0.02em
    fontWeight: 500
  stat-value:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: 700
    fontVariant: tabular-nums
  stat-label:
    fontFamily: Inter
    fontSize: 0.78rem
    fontWeight: 500
rounded:
  none: 0px
  sm: 4px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
motion:
  instant: 0ms
  fast: 100ms
  normal: 200ms
  slow: 300ms
  shimmer-duration: 1500ms
  ease-out: "cubic-bezier(0.23, 1, 0.32, 1)"
  ease-in-out: "cubic-bezier(0.77, 0, 0.175, 1)"
  ease-drawer: "cubic-bezier(0.32, 0.72, 0, 1)"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: 12px 24px
    fontWeight: 600
    fontSize: 0.9rem
    transition: "opacity {motion.normal} {motion.ease-out}"
  button-primary-hover:
    opacity: 0.85
  button-primary-active:
    opacity: 0.7
    transform: "scale(0.97)"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 6px 14px
    border: "1px solid {colors.primary}"
    fontSize: 0.78rem
    transition: "background-color {motion.normal} {motion.ease-out}"
  button-secondary-hover:
    backgroundColor: "rgba(232,69,69,0.08)"
  card:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.lg}"
    padding: 24px
    transition: "border-color {motion.normal} {motion.ease-out}, box-shadow {motion.normal} {motion.ease-out}"
  card-hover:
    border-color: "#2d4a6a"
    boxShadow: "0 0 0 1px rgba(6,182,212,0.1)"
  card-entrance:
    animation: "fadeIn {motion.slow} {motion.ease-out}, slideUp {motion.slow} {motion.ease-out}"
  input:
    backgroundColor: "{colors.surface-elevated}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.md}"
    padding: 12px 16px
    textColor: "{colors.text-primary}"
    fontSize: 0.9rem
    transition: "border-color {motion.normal} {motion.ease-out}"
  input-focus:
    border-color: "{colors.secondary}"
    outline: "none"
    boxShadow: "0 0 0 3px rgba(6,182,212,0.15)"
  nav-link:
    textColor: "{colors.text-secondary}"
    fontSize: 0.82rem
    letterSpacing: 0.02em
    transition: "color {motion.normal} {motion.ease-out}"
  nav-link-hover:
    textColor: "{colors.text-primary}"
  badge:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.full}"
    padding: 2px 10px
    fontSize: 0.72rem
    fontWeight: 600
    fontFamily: JetBrains Mono
  stat-card:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.lg}"
    padding: 20px
    transition: "border-color {motion.normal} {motion.ease-out}, box-shadow {motion.normal} {motion.ease-out}"
  stat-card-hover:
    border-color: "#2d4a6a"
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)"
  stat-card-entrance:
    animation: "slideUp {motion.slow} {motion.ease-out}"
  shimmer:
    background: "linear-gradient(90deg, {colors.surface} 25%, {colors.surface-elevated} 50%, {colors.surface} 75%)"
    backgroundSize: "200% 100%"
    animation: "shimmer {motion.shimmer-duration} infinite"
---

## Overview

**Quill** is the first product shipped under the MapleSpike brand — an MCP server + REST API exposing 166 tools across 198 modules of Canada's public record. Parliamentary debates, federal open data, regulatory filings, corporate lobbying records, provincial datasets, and CanLII case law — all queryable through a single endpoint. The product page at `quill.maplespike.ca` and the in-app dashboard share this design system.

> **Note (2026-07):** This repo was renamed `reverb256/maplespike` → `maplespike/quill`. Brand-level identifiers — domain `maplespike.ca`, npm scope `@maplespike/*` — are preserved. See [CHANGELOG.md](./CHANGELOG.md) for the rename entry.

The UI evokes a command center: dark foundation, high-contrast data, color only for signal and severity. Tailwind handles all styling. Every number is tabular, every ID is mono, every transition is intentional.

## Quill Page Layout

The product landing page at `quill.maplespike.ca` follows a single-scroll narrative:

### Section Sequence
1. **TopBar** — JetBrains Mono nav links, GitHub + Sign-in CTAs
2. **QuillHero** — Product name, one-line value prop, terminal-style install snippet, aurora + bg-grid effects
3. **Stats bar** — Key metrics (207 modules, 184 tools, 13 jurisdictions, ~220K lines TS) as stat cards with tabular counters
4. **McpServerBlock** — Claude Desktop config JSON snippet, MCP SSE endpoint, REST base URL, platform integration grid
5. **ToolGrid** — 6-column responsive grid of module categories (Parliamentary, Federal open data, Oversight, Corporate + influence, Provincial + municipal, Justice + CanLII)
6. **Sovereignty** — Tech stack badges: Nix, Cloudflare Pages, AGPL-3.0, SHA-256 provenance
7. **CTA** — Call-to-action with "Get started free" linking to signup
8. **QuillFooter** — Repo link, license, MapleSpike brand attribution

### Terminal Snippet Design
```
$ curl -H "Authorization: Bearer $QUILL_KEY" \
       https://quill.maplespike.ca/v1/search?q=lobbying+registrations
```
Mono font, surface-elevated background, 8px radius, copy-to-clipboard button on hover.

### Module Category Cards
Each ToolGrid card:
- Icon + title (Inter 600, 1rem)
- Bullet list of tool names (Inter, 0.78rem, text-secondary)
- Surface background, hover → border brightens
- Entrance: stagger 50–80ms per card

## Color System & Tokens

### Background Hierarchy
- **Background (#090909):** Near-black foundation (shadcn dark default).
- **Card (#111111):** Card and container backgrounds.
- **Muted (#1a1a1a):** Elevated elements — inputs, hovered cards, modals.

### Semantic Colors
- **Primary (#e84545):** Red for CTAs, active states, severity.
- **Secondary (#06b6d4):** Cyan for links (ring focus, parliament accent), code highlighting, secondary actions.
- **Tertiary (#22c55e):** Green for success states, moss accent.
- **Accent (#6b1d1d):** Dark red for subtle accent surfaces.

### Text
- **Foreground (#fafafa):** High-emphasis — headings, body, table cells.
- **Muted-foreground (#a3a3a3):** Medium-emphasis — metadata, labels, placeholders.

### Contrast (WCAG AA)
| Pair | Ratio | Pass |
|------|-------|------|
| primary on white | 4.8:1 | AA |
| primary on surface | 6.2:1 | AA |
| text-primary on surface | 11.5:1 | AAA |

## Typography

- **Inter:** Primary — headings, body, labels, stats.
- **JetBrains Mono:** Nav, code, data identifiers.

Scale: `11 → 12 → 13 → 14 → 16 → 20 → 24 → 32px`

All numbers use `font-variant-numeric: tabular-nums`.

### Optical sizing & tracking
- Large display text uses **negative tracking** (`-0.02em`) because letters read too far apart as size grows.
- Body text stays near `0` tracking; small labels get slightly positive tracking for legibility.
- Leading is tight on headings (`1.2`) and looser on body copy (`1.5`).
- Respect the user's text-size setting by sizing spacing in `rem`/`em`.

## Component Catalog

**Cards:** Surface, 1px border, 12px radius, 24px padding. Entrance: fadeIn + slideUp 300ms. Hover: border brightens + cyan glow.

**Stat Cards:** Metric hero (1.5rem, bold, tabular-nums). SlideUp entrance. Hover: shadow lift.

**Buttons:** Primary = red fill, white text, 8px radius. Active: scale(0.97). Secondary = transparent, red border. Hover: bg fill 8%.

**Inputs:** Elevated surface, 1px border, 8px radius. Focus: cyan border + 3px glow ring.

**Badges:** Full radius pill. 11px, uppercase, mono. Tailwind utility classes for label centering.

**Tables:** 28-32px rows, sticky header, right-aligned numbers, mono IDs.

**Shimmer:** 1.5s gradient loop. Never use spinners.

## Component State Matrix

| Component | Hover | Active | Focus | Disabled | Loading |
|-----------|-------|--------|-------|----------|---------|
| button-primary | opacity 0.85 | scale 0.97 | — | opacity 0.4 | shimmer |
| button-secondary | bg 8% red | — | — | opacity 0.4 | — |
| input | — | — | cyan glow | opacity 0.5 | — |
| card | border ↑ | — | — | — | — |
| stat-card | shadow ↑ | — | — | — | shimmer |
| nav-link | primary | — | — | — | — |

## Layout

- 4px base grid. All spacing multiples of 4.
- Max content: 1280px. Dashboards: full viewport.
- Sidebar: 220-260px, collapsible to 48px rail.
- Card grid: auto-fill, minmax(180px, 1fr), 16px gap.

## Elevation

Flat. Depth via background layers. Shadows only for: dropdowns, modals (blur 4px), tooltips. No shadows on cards or panels in default state.

## Motion

| Token | Value | Usage |
|-------|-------|-------|
| instant | 0ms | Badge changes |
| fast | 100ms | Color transitions |
| normal | 200ms | Hover, focus |
| slow | 300ms | Card entrance, modal |
| shimmer | 1500ms | Loading loop |

Easing: ease-out for entrances. ease-in-out for state changes. Card entrance stagger: 50–80ms delay between items.

### Custom easing curves
```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

## Animation Decision Framework

Before adding any animation, answer: *should this animate at all?*

| Frequency | Decision |
| --- | --- |
| 100+ times/day (keyboard shortcuts, command palette toggle) | No animation. Ever. |
| Tens of times/day (hover effects, list navigation) | Remove or drastically reduce |
| Occasional (modals, drawers, toasts) | Standard animation |
| Rare / first-time (onboarding, feedback, celebrations) | Can add delight |

**Never animate keyboard-initiated actions.** They repeat hundreds of times daily; animation makes them feel slow and disconnected.

Valid purposes for motion: spatial consistency, state indication, explanation, feedback, preventing jarring change. "It looks cool" on a frequently-seen element is not valid.

### Easing & Timing
- **Enter/exit:** `ease-out` or custom `cubic-bezier(0.23, 1, 0.32, 1)`.
- **Move/morph on screen:** `ease-in-out` or `cubic-bezier(0.77, 0, 0.175, 1)`.
- **Hover/color:** `ease`.
- **UI animations stay under 300ms.** Button press: 100–160ms. Dropdowns/selects: 150–250ms. Modals/drawers: 200–500ms.
- **Never use `ease-in` on UI** — it delays the moment the user watches most.

### Physicality
- Never animate from `scale(0)`. Start from `scale(0.95)` + `opacity: 0`.
- Popovers/dropdowns scale from their trigger; modals stay centered.
- Buttons use `transform: scale(0.97)` on `:active` with 160ms `ease-out`.

### Interruptibility & Performance
- Prefer CSS transitions over keyframes for rapidly-triggered UI (toasts, toggles).
- Only animate `transform` and `opacity` for GPU compositing.
- Gate hover motion behind `@media (hover: hover) and (pointer: fine)`.
- Honor `prefers-reduced-motion: reduce` — keep opacity/color transitions, drop movement.

### Stagger
- Group entrances stagger 30–80ms between items.
- Never block interaction while stagger plays.

## Apple-Style Fluid Interactions

Where Quill uses drag, sheets, or gesture-driven UI, follow these principles:

1. **Response on pointer-down.** Show feedback the instant the user presses. Waiting for `click` feels dead.
2. **Direct manipulation — 1:1 tracking.** Content stays glued to the finger; respect the grab offset.
3. **Interruptibility.** Never lock out input during a transition. Animate from the current on-screen value, not the target value.
4. **Velocity handoff.** When a gesture ends, the animation continues at the finger's exact velocity.
5. **Momentum projection.** Snap to the target nearest the projected resting point, not the release point.
6. **Rubber-banding.** At boundaries, resist progressively instead of stopping hard.
7. **Spatial consistency.** Enter and exit along the same path; anchor popovers to their trigger.

## Accessibility

- Visible focus states (cyan outline).
- Color never sole indicator — use icons + labels.
- WCAG AA contrast minimum.
- Keyboard-navigable.
- Tailwind-based layouts respect WCAG resize.

### Reduced motion
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Hover gating
```css
@media (hover: hover) and (pointer: fine) {
  .card-hover:hover { transform: translateY(-3px); }
}
```

## Responsive

- Desktop-first. Dashboards are wide.
- Tablet >768px: single cards, 2-col stats, collapsed sidebar.
- Mobile <768px: full-width, stacked, hidden sidebar.
- Tables scroll horizontally with sticky first column.

## Code Snippets

### Theme tokens

```css
/* Actual globals.css uses shadcn-style HSL variable references */
@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

/* Dark theme values (applied via .dark class) */
:root.dark {
  --background: 0 0% 3.5%;    --foreground: 0 0% 98%;
  --card: 0 0% 6.5%;          --card-foreground: 0 0% 98%;
  --popover: 0 0% 6.5%;       --popover-foreground: 0 0% 98%;
  --primary: 0 72% 51%;       --primary-foreground: 0 0% 98%;
  --secondary: 0 0% 11%;      --secondary-foreground: 0 0% 98%;
  --muted: 0 0% 10%;          --muted-foreground: 0 0% 63.9%;
  --accent: 0 72% 14%;        --accent-foreground: 0 0% 98%;
  --destructive: 0 62.8% 30.6%; --destructive-foreground: 0 0% 98%;
  --border: 0 0% 15%;         --input: 0 0% 16%;
  --ring: 191 96% 42%;
}
```

### Animations
```css
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes staggerIn { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
```

## Implementation Status (2026-07-10)

The spec above is the canonical design intent for Quill. Three implementation layers exist; this section captures what is wired where so future work can land in the right place.

### Live portal (`packages/portal/src/` — Astro + React + Tailwind v4 + shadcn)

* **Wired to spec**: Inter + JetBrains Mono (BaseLayout), dark-canvas default + light toggle, card pattern (12px radius, 24px padding), `.font-mono-num` utility, `aria-current="page"` nav highlight, i18n en-CA + fr-CA (`@maplespike/i18n`), mobile drawer, `prefers-reduced-motion` reset.
* **Token reconciliation (in `globals.css`)**: `--ring` + `--sidebar-ring` use spec cyan `hsl(191 96% 42%)` (≈ `#06b6d4`, parliamentary).
* **Animation tokens (in `globals.css`)**: custom easing variables `--ease-out`, `--ease-in-out`, `--ease-drawer`; `reveal-on-scroll`, `stagger-*`, and `press-feedback` utilities added.
* **Quill Page Layout (in `LandingBody.astro`)**: section sequence now maps to `TopBar` (BaseLayout), `QuillHero`, `Stats bar`, `McpServerBlock`, `ToolGrid`, `Sovereignty`, `CTA`, and `QuillFooter` (BaseLayout). Added reveal-on-scroll, staggered card entrances, tabular-numeral stats, and terminal-style snippet copy.

### Canonical reference render (`packages/portal/public/readme.html`)

A faithful, self-contained ~1,000-line reference HTML that encodes every token + component pattern from this spec verbatim into the live portal's `public/` static assets. Used as:

* the canonical mood board for new components,
* the build target when wiring the narrative into Astro islands.

Includes exact hex tokens mirroring the YAML frontmatter, animated maple-leaf hero + aurora glow + bg-grid + reveal-on-scroll, metric cards with `IntersectionObserver`-animated counters and tabular-nums stats, timeline · repo-tree · service-grid · table · callout · code-block patterns with copy-to-clipboard, and `@media (prefers-reduced-motion: reduce)` reset. Header comment in the file reads: *"MapleSpike design system — extracted from packages/portal and DESIGN.md. Tokens are the source of truth; document CSS is a thin expressive layer over them."*

### Brand marketing layers (separate `maplespike-brand` repo)

Live at `maplespike.ca`. Maintains design cohesion with Quill via shared `colors.primary` (`#e84545`) + `colors.secondary` (`#06b6d4`) tokens.

## Design Skills & References

This design system is augmented by the following project skills under `.agents/skills/`:

- **`emil-design-eng`** — UI polish, animation decision framework, component craft, and the invisible details that make software feel right.
- **`apple-design`** — Fluid interfaces, springs, gesture-driven UI, translucent materials, typography, and reduced-motion/accessibility.
- **`animation-vocabulary`** — Reverse-lookup glossary for naming motion effects.
- **`review-animations`** + **`STANDARDS.md`** — Concrete animation standards (curves, durations, physicality, performance, a11y) used when reviewing motion code.

Use these skills whenever adding or reviewing motion, gestures, or visual polish in Quill.

## Agent Prompt Guide

**Context:** Quill — a sovereign MCP server + REST API for Canadian public record data. 166 tools (incl. `x402-deposit`), 198 modules. Product page at `quill.maplespike.ca`. Repo: `github.com/maplespike/quill`.

**Bias:** dark canvas, tabular numerals, JetBrains Mono for code/IDs, red accent, dense tables, shimmer. Terminal snippets on elevated surface with copy button. Tool counts as stat cards.

**Reject:** light backgrounds, serif fonts, hero illustrations, spinners, center-aligned numbers, shadows on cards, hardcoded CSS heights.

**Tailwind:** use utility classes for all styling. Prefer CSS animations/transitions for predetermined motion; use Framer Motion springs only for interruptible, gesture-driven React islands. Never use inline styles for layout.
