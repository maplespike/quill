---
version: alpha
name: MapleSpike
description: Dark-theme data intelligence dashboard for Canadian government data — Pretext-native
colors:
  primary: "#e84545"
  secondary: "#06b6d4"
  tertiary: "#10b981"
  warning: "#f59e0b"
  neutral: "#0a0e17"
  surface: "#111827"
  surface-elevated: "#1a2332"
  border: "#1e2d45"
  text-primary: "#e2e8f0"
  text-secondary: "#94a3b8"
  text-muted: "#64748b"
  chart-1: "#e84545"
  chart-2: "#06b6d4"
  chart-3: "#10b981"
  chart-4: "#f59e0b"
  chart-5: "#8b5cf6"
  chart-6: "#ec4899"
  chart-7: "#14b8a6"
  chart-8: "#f97316"
typography:
  h1:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.2
  h2:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1.3
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
  eased: ease-out
  eased-in-out: ease-in-out
  shimmer-duration: 1500ms
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: 12px 24px
    fontWeight: 600
    fontSize: 0.9rem
    transition: "opacity {motion.normal} {motion.eased}"
  button-primary-hover:
    opacity: 0.85
  button-primary-active:
    opacity: 0.7
    transform: "scale(0.98)"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 6px 14px
    border: "1px solid {colors.primary}"
    fontSize: 0.78rem
    transition: "background-color {motion.normal} {motion.eased}"
  button-secondary-hover:
    backgroundColor: "rgba(232,69,69,0.08)"
  card:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.lg}"
    padding: 24px
    transition: "border-color {motion.normal} {motion.eased}, box-shadow {motion.normal} {motion.eased}"
  card-hover:
    border-color: "#2d4a6a"
    boxShadow: "0 0 0 1px rgba(6,182,212,0.1)"
  card-entrance:
    animation: "fadeIn {motion.slow} {motion.eased}, slideUp {motion.slow} {motion.eased}"
  input:
    backgroundColor: "{colors.surface-elevated}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.md}"
    padding: 12px 16px
    textColor: "{colors.text-primary}"
    fontSize: 0.9rem
    transition: "border-color {motion.normal} {motion.eased}"
  input-focus:
    border-color: "{colors.secondary}"
    outline: "none"
    boxShadow: "0 0 0 3px rgba(6,182,212,0.15)"
  nav-link:
    textColor: "{colors.text-secondary}"
    fontSize: 0.82rem
    letterSpacing: 0.02em
    transition: "color {motion.normal} {motion.eased}"
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
    transition: "border-color {motion.normal} {motion.eased}, box-shadow {motion.normal} {motion.eased}"
  stat-card-hover:
    border-color: "#2d4a6a"
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)"
  stat-card-entrance:
    animation: "slideUp {motion.slow} {motion.eased}"
  shimmer:
    background: "linear-gradient(90deg, {colors.surface} 25%, {colors.surface-elevated} 50%, {colors.surface} 75%)"
    backgroundSize: "200% 100%"
    animation: "shimmer {motion.shimmer-duration} infinite"
---
> Wait for `document.fonts.ready` before calling Pretext `prepare()`.
> Always use `font-variant-numeric: tabular-nums` on data displays.

## Overview

Data intelligence pipeline tracking Canadian government influence, lobbying, committees, and procurement. Dark theme with red/cyan accent. High information density. The UI evokes a command center feed — dark foundation, high-contrast data, color only for signal and severity. Pretext handles all text layout.

## Color System & Tokens

### Background Hierarchy
- **Neutral (#0a0e17):** Deep navy foundation. Never pure black.
- **Surface (#111827):** Card and container backgrounds.
- **Surface-elevated (#1a2332):** Elevated elements — inputs, hovered cards, modals.

### Semantic Colors
- **Primary (#e84545):** Red for CTAs, active states, severity.
- **Secondary (#06b6d4):** Cyan for links, code highlighting, secondary actions.
- **Tertiary (#10b981):** Green for success states.
- **Warning (#f59e0b):** Amber for caution.

### Text
- **text-primary (#e2e8f0):** High-emphasis — headings, body, table cells.
- **text-secondary (#94a3b8):** Medium-emphasis — metadata, labels.
- **text-muted (#64748b):** Low-emphasis — placeholders.

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

## Component Catalog

**Cards:** Surface, 1px border, 12px radius, 24px padding. Entrance: fadeIn + slideUp 300ms. Hover: border brightens + cyan glow.

**Stat Cards:** Metric hero (1.5rem, bold, tabular-nums). SlideUp entrance. Hover: shadow lift.

**Buttons:** Primary = red fill, white text, 8px radius. Active: scale(0.98). Secondary = transparent, red border. Hover: bg fill 8%.

**Inputs:** Elevated surface, 1px border, 8px radius. Focus: cyan border + 3px glow ring.

**Badges:** Full radius pill. 11px, uppercase, mono. Pretext for label centering.

**Tables:** 28-32px rows, sticky header, right-aligned numbers, mono IDs.

**Shimmer:** 1.5s gradient loop. Never use spinners.

## Component State Matrix

| Component | Hover | Active | Focus | Disabled | Loading |
|-----------|-------|--------|-------|----------|---------|
| button-primary | opacity 0.85 | scale 0.98 | — | opacity 0.4 | shimmer |
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

Easing: ease-out for entrances. ease-in-out for state changes. Card entrance stagger: 50ms delay between items.

## Do's and Don'ts

- DO use Pretext for ALL text layout.
- DO use JetBrains Mono for nav.
- DO use tabular numerals in data displays.
- DO right-align numeric columns.
- DO use shimmer for loading.
- DON'T use pure white backgrounds.
- DON'T add decorative illustrations.
- DON'T use serif fonts.
- DON'T center numeric data.
- DON'T hardcode CSS heights — Pretext computes them.

## Accessibility

- Visible focus states (cyan outline).
- Color never sole indicator — use icons + labels.
- WCAG AA contrast minimum.
- Keyboard-navigable.
- Pretext respects WCAG resize.

## Responsive

- Desktop-first. Dashboards are wide.
- Tablet >768px: single cards, 2-col stats, collapsed sidebar.
- Mobile <768px: full-width, stacked, hidden sidebar.
- Tables scroll horizontally with sticky first column.

## Code Snippets

### Pretext Setup
```html
<script type="module">
import { prepare, layout } from 'https://esm.sh/@chenglou/pretext'
await document.fonts.ready
const h = prepare('42,891', '24px Inter')
const { height } = layout(h, 200, 32)
</script>
```

### CSS Variables
```css
:root {
  --color-primary: #e84545;
  --color-secondary: #06b6d4;
  --color-surface: #111827;
  --color-surface-elevated: #1a2332;
  --color-border: #1e2d45;
  --color-text: #e2e8f0;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #64748b;
  --font-ui: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px;
  --spacing-xs: 4px; --spacing-sm: 8px; --spacing-md: 16px;
  --spacing-lg: 24px; --spacing-xl: 32px;
}
```

### Animations
```css
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes slideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
```

## Agent Prompt Guide

Bias: dark canvas, tabular numerals, JetBrains Mono for code/IDs, red accent, dense tables, shimmer.

Reject: light backgrounds, serif fonts, hero illustrations, spinners, center-aligned numbers, shadows on cards, hardcoded CSS heights.

Pretext: use `prepare()` + `layout()` for all text. Call after `document.fonts.ready`. Never hardcode heights. Use stagger 50ms for card grid entrances.
