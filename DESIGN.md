---
name: MapleSpike
description: Dark-theme developer dashboard for Canadian government intelligence data
colors:
  primary: "#e84545"
  secondary: "#06b6d4"
  tertiary: "#10b981"
  neutral: "#0a0e17"
  surface: "#111827"
  surface-elevated: "#1a2332"
  border: "#1e2d45"
  text-primary: "#e2e8f0"
  text-secondary: "#94a3b8"
  text-muted: "#64748b"
  warning: "#f59e0b"
typography:
  h1:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: 700
  h2:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 600
  body:
    fontFamily: Inter
    fontSize: 0.85rem
  code:
    fontFamily: JetBrains Mono
    fontSize: 0.85rem
  nav:
    fontFamily: JetBrains Mono
    fontSize: 0.82rem
    letterSpacing: 0.02em
  stat-value:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: 700
  stat-label:
    fontFamily: Inter
    fontSize: 0.78rem
rounded:
  sm: 4px
  md: 8px
  lg: 12px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: 12px 24px
    fontWeight: 600
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 6px 14px
    border: "1px solid {colors.primary}"
    fontSize: 0.78rem
  card:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.lg}"
    padding: 24px
  card-hover:
    borderColor: "#2d4a6a"
  input:
    backgroundColor: "{colors.surface-elevated}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.md}"
    padding: 12px 16px
    textColor: "{colors.text-primary}"
    fontSize: 0.9rem
  nav-link:
    textColor: "{colors.text-secondary}"
    fontSize: 0.82rem
    letterSpacing: 0.02em
  nav-link-hover:
    textColor: "{colors.text-primary}"
---

## Overview

Data intelligence dashboard for Canadian government influence tracking. Dark theme with high-contrast neutrals and red/cyan accent system. The UI prioritizes readability of dense data tables and code output over decorative elements.

## Colors

The palette is dark-first with a warm undertone, designed for长时间 use by analysts.

- **Primary (#e84545):** Red accent for CTAs, active states, and key data indicators.
- **Secondary (#06b6d4):** Cyan for secondary actions, links, and code highlighting.
- **Tertiary (#10b981):** Green for success states and positive indicators.
- **Neutral (#0a0e17):** Deep navy background — the foundation layer.
- **Surface (#111827):** Card and container backgrounds, one step above foundation.
- **Surface-elevated (#1a2332):** Elevated elements — inputs, hovered cards, modals.
- **Border (#1e2d45):** Subtle blue-tinted border for card separation.
- **Text-primary (#e2e8f0):** High-emphasis text for headings and body content.
- **Text-secondary (#94a3b8):** Medium-emphasis for metadata and labels.
- **Text-muted (#64748b):** Low-emphasis for hints and placeholders.

## Typography

- **Inter**: Primary typeface for all UI text — headings, body, labels, stats.
- **JetBrains Mono**: Monospace for code, navigation, and data identifiers.
- Navigation uses all-caps with letter-spacing for distinct hierarchy.

## Layout & Spacing

- Max content width: 1280px, centered with auto margins.
- Page padding: 32px top/bottom, 24px sides.
- Card grid uses auto-fill with min 180px columns.
- Stats row: auto-fit grid, 16px gap.

## Elevation & Depth

- Three-layer background hierarchy: bg-primary (foundation) → bg-card (surface) → bg-elevated (raised).
- Shimmer loading: gradient animation on bg-card → bg-elevated → bg-card.
- Card hover: border transitions from border color to #2d4a6a.
- Button hover: 85% opacity reduction for all interactive elements.

## Components

The UI is built from primitive components — cards, stats rows, buttons, inputs — composed into purpose-built pages. No component library is used; every element is styled with CSS variables.

## Do's and Don'ts

- DO use JetBrains Mono for the top navigation bar for visual distinction.
- DO use the shimmer pattern for loading states instead of spinners.
- DON'T use bright white (#ffffff) as a background color — always use the neutral/surface hierarchy.
- DON'T add decorative flourishes or illustrations — the UI should be utilitarian.
- DO let data density drive layout — narrow columns for metrics, full width for tables.
