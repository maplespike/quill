# Plan: Issue #199 — Portal Astro Pages Visual QA (16 Pages)

**Status**: Draft
**Created**: 2026-05-18
**Owner**: Sisyphus
**Issue**: https://github.com/reverb256/maplespike/issues/199
**Labels**: `bug`, `p2`, `frontend`

---

## Overview

Portal rebuilt from 16 static HTML pages to Astro + shadcn/ui. Build passes but no visual QA has been done. Every page needs a manual/automated check for dark theme, mobile responsive, shadcn styling, navigation links, and console errors.

### Pages to QA

```
packages/portal/src/pages/
├── index.astro          (Landing hero, min-h-[80vh], CTA)
├── explorer.astro       (Search + filter + result cards)
├── dashboard.astro      (Metrics + data table)
├── workspace.astro      (API key mgmt, usage bars, OAuth section, slide-over panels)
├── pricing.astro        (3-tier card grid)
├── docs.astro           (Search + category cards + accordion sections)
├── blog.astro           (Post cards with badges)
├── signal.astro         (Signal monitoring cards)
├── agents.astro         (AI agent listing cards)
├── api-explorer.astro   (Interactive REST client UI)
├── ask.astro            (Query textarea + result cards)
├── signup.astro         (React SignupForm + feature cards)
├── contact.astro        (Contact form + card)
├── citation.astro       (Citation examples grid)
├── changelog.astro      (React ChangelogAccordion)
└── 404.astro            (Centered minimal layout)
```

### QA Categories (per page)

| Category | What to check |
|----------|---------------|
| Layout structure | Sections render in correct order inside `<main>`, no overflow or clipping |
| Responsive | 320px, 768px, 1024px, 1440px — mobile nav toggle, grid collapse, code block horizontal scroll |
| Dark theme | Card backgrounds, text contrast, border visibility, primary red (hsl(0 72% 51%)) on both themes |
| Light theme | Toggle works, localStorage persists, no flash of wrong theme |
| Interactive | Form validation, accordion open/close, API explorer input, workspace API key reveal/hide |
| AnimatedShaderBackground | Renders on all pages? Overlaps header z-index? Performance on low-end? |
| Navigation | Header links work, mobile nav toggles, footer links work, Get Started CTA |
| Console errors | No JS errors, no 404s on assets, i18n loads correctly |
| OG/metadata | Each page has unique title/description, Open Graph preview |

---

## Execution Plan

### Approach: `visual-engineering` subagents for checklist generation, then manual or Playwright verification.

### Step 1: Create per-page checklist (parallel subagents)

Spawn 2-3 subagents to generate detailed QA checklists grouped by page type:
- Group A (high-interactivity): workspace, api-explorer, signup, contact, changelog
- Group B (content-heavy): index, blog, docs, pricing, citation, agents
- Group C (data-driven): dashboard, explorer, signal, ask, 404

Each checklist specifies: element selectors to check, expected visual state, responsive behavior at each breakpoint, and theme-specific CSS values.

### Step 2: Automated verification (Playwright)

Run Playwright tests against the built portal (`pnpm build` in `packages/portal/`, then serve `dist/`).

Tests should cover:
- All 16 pages load with 200 status
- Navigation links between pages resolve correctly
- Theme toggle works and persists (check `localStorage`)
- Mobile menu toggle visible at 375px, hidden at 1024px
- No console errors on any page
- i18n/fr-CA toggles content language

### Step 3: Manual visual inspection

For each page, load at 4 viewports (320, 768, 1024, 1440) in both dark and light theme. Document any visual issues with screenshots.

Focus areas:
- **index.astro**: hero section at 320px (80vh may be too tall)
- **workspace.astro**: slide-over API keys panel, OAuth section, usage bar animations
- **signup.astro**: React form validation states, error messages
- **api-explorer.astro**: input → card results flow
- **changelog.astro**: React accordion open/close animation
- **404.astro**: centered layout at all viewports

### Step 4: Fix identified issues

Each bug gets a sub-issue or inline fix. Common areas:
- Responsive breakpoint glitches (grid collapse)
- Theme-specific color contrast (red on light bg)
- Form validation UX (missing error states, focus rings)
- Mobile nav behavior (touch targets, animation)

---

## Known Risks

| Risk | Mitigation |
|------|------------|
| AnimatedShaderBackground (Three.js) may lag on low-end mobile | Add `prefers-reduced-motion` check, fallback to static gradient |
| `data-theme="dark"` hardcoded in HTML; light-theme users see dark flash | Inline script before `<html>` rendering corrects it, but flash is inherent |
| React 19 interactive islands may break under fast toggling | Client-only islands hydrate independently — test rapid nav |
| Mobile nav JS toggles may conflict with Astro's view transitions | No view transitions configured (static output), but verify SPA-like nav |

---

## Success Criteria

- [ ] All 16 pages visually verified at 4 viewports (320, 768, 1024, 1440)
- [ ] Dark and light themes visually clean on all pages
- [ ] Navigation links work bidirectionally on all pages
- [ ] No console errors on any page (JS, assets, i18n)
- [ ] Interactive components (forms, accordion, API explorer) function correctly
- [ ] Mobile nav toggle works on all pages
- [ ] AnimatedShaderBackground renders without breaking layout or z-index
- [ ] All identified visual bugs fixed or documented as pre-existing
- [ ] QA checklist saved for regression testing
