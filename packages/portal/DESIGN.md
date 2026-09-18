---
version: alpha
name: Quill Portal
description: >-
  Static product dashboard for the MapleSpike Canadian public data platform —
  Astro 7 + React 19 + Tailwind v4 + shadcn/ui, 38 built pages, dark-theme-first,
  en-CA/fr-CA i18n, served at quill.maplespike.ca
colors:
  background: "hsl(0 0% 3.5%)"
  foreground: "hsl(0 0% 98%)"
  card: "hsl(0 0% 6.5%)"
  popover: "hsl(0 0% 6.5%)"
  primary: "hsl(0 72% 51%)"
  primary-foreground: "hsl(0 0% 98%)"
  secondary: "hsl(0 0% 11%)"
  muted: "hsl(0 0% 10%)"
  muted-foreground: "hsl(0 0% 63.9%)"
  accent: "hsl(0 72% 14%)"
  destructive: "hsl(0 62.8% 30.6%)"
  border: "hsl(0 0% 15%)"
  input: "hsl(0 0% 16%)"
  ring: "hsl(191 96% 42%)"
  sidebar-background: "hsl(0 0% 3.5%)"
  sidebar-primary: "hsl(0 72% 51%)"
  sidebar-ring: "hsl(191 96% 42%)"
  chart-1: "hsl(220 70% 50%)"
  chart-2: "hsl(160 60% 45%)"
  chart-3: "hsl(30 80% 55%)"
  chart-4: "hsl(280 65% 60%)"
  chart-5: "hsl(340 75% 55%)"
  gradient-start: "hsl(0 72% 51%)"
  gradient-mid: "hsl(16 80% 60%)"
  gradient-end: "hsl(28 86% 64%)"
  aurora-primary: "hsl(0 72% 51% / 0.18)"
  aurora-ember: "hsl(16 80% 55% / 0.12)"
  aurora-violet: "hsl(280 65% 55% / 0.08)"
  # Named aliases
  maple: "#e84545"
  parliament: "#06b6d4"
  moss: "#10b981"
typography:
  font-sans: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
  font-mono: "'JetBrains Mono', ui-monospace, 'SFMono-Regular', 'Menlo', 'Consolas', monospace"
  weights: { light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 }
  h1: { fontFamily: Inter, fontSize: 2.25rem, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.03em" }
  h2: { fontFamily: Inter, fontSize: 1.5rem, fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.02em" }
  h3: { fontFamily: Inter, fontSize: 1.125rem, fontWeight: 600, lineHeight: 1.3 }
  body: { fontFamily: Inter, fontSize: 0.938rem, lineHeight: 1.6 }
  body-muted: { fontFamily: Inter, fontSize: 0.875rem, lineHeight: 1.5 }
  mono: { fontFamily: JetBrains Mono, fontSize: 0.85rem, lineHeight: 1.4 }
  label: { fontFamily: JetBrains Mono, fontSize: 0.75rem, fontWeight: 600, letterSpacing: "0.02em" }
  nav: { fontFamily: JetBrains Mono, fontSize: 0.82rem, fontWeight: 500, letterSpacing: "0.02em" }
rounded: { none: 0px, sm: 4px, md: 8px, lg: 12px, xl: 16px, "2xl": 24px, full: 9999px }
spacing: { xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px, "2xl": 48px, "3xl": 64px }
motion:
  instant: 0ms; fast: 100ms; normal: 200ms; slow: 300ms; press: 160ms
  stagger-delay: 60ms; shimmer-duration: 1500ms
  ease-out: "cubic-bezier(0.23, 1, 0.32, 1)"
  ease-in-out: "cubic-bezier(0.77, 0, 0.175, 1)"
  ease-drawer: "cubic-bezier(0.32, 0.72, 0, 1)"
breakpoints: { sm: 640px, md: 768px, lg: 1024px, xl: 1280px, "2xl": 1536px }
layout: { max-width: 1280px, container-padding: "px-4 sm:px-6 lg:px-8" }
build:
  output: static
  site: https://quill.maplespike.ca
  compressHTML: true
  format: file
  manualChunks:
    vendor-react: "react, react-dom, scheduler"
    vendor-framer: "framer-motion"
    vendor-icons: "lucide-react"
  gen-all: "generate-agents-json.mjs + generate-openapi.mjs + generate-pipeline-data.mjs (timeout 60) + generate-llms.mjs + gen-security-audit.mjs"
---

# Quill Portal Design System

> **Product dashboard for the MapleSpike Canadian public data platform.**
> 38 static pages, dark-theme-first, served at `quill.maplespike.ca`.

---

## 1. Overview

The **Quill Portal** (`packages/portal/`) is a statically-generated product dashboard that serves as the primary user interface for the MapleSpike platform. Built with Astro 7 (static output), React 19 client islands, Tailwind CSS v4, and shadcn/ui, it provides a single-page-app-like experience via Astro View Transitions.

The portal sits within the **quill monorepo** alongside the MCP server (`packages/quill-mcp/`), REST API (`packages/quill-api/`), and shared packages (`sdk`, `i18n`, `pipeline-core`). It is deployed to **Cloudflare Pages** (dev) and the **K3s cluster** (production), both serving the same pre-built static assets.

**Key surfaces:**
- Landing page hero with aurora glow + bg-grid effects, MCP config JSON snippets, and 207-module/182-tool stats
- Data explorer (`/explorer`) with full-text search across Canada's public record
- MCP agent directory (`/agents`) documenting every tool with per-client setup snippets
- Developer dashboard (`/dashboard`) with API key management, usage stats, billing, AI settings, browser extraction, and OWASP LLM compliance
- Static content pages — docs, pricing, signup, status, changelog, blog, terms, privacy, contact, citation, signal, watcher, workspace

---

## 2. Architecture

### Astro Component Tree

```
packages/portal/src/
├── layouts/
│   └── BaseLayout.astro            ← Root shell: nav, footer, i18n meta, auth.js,
│                                      View Transitions, SEO, dark class
├── pages/                          ← 28 Astro route files → 38 built pages
│   ├── index.astro                 ← "/" — client-side redirect to /en or /fr
│   ├── [locale].astro              ← "/en", "/fr" — landing page
│   ├── 404.astro                   ← Custom error page
│   ├── agents.astro                ← MCP agent directory (182 tools)
│   ├── api-explorer.astro          ← Interactive API playground
│   ├── ask.astro                   ← AI Q&A (client:load AgentChat)
│   ├── blog.astro                  ← Blog listing
│   ├── changelog.astro             ← Version changelog
│   ├── citation.astro              ← Citation verification
│   ├── contact.astro               ← Contact form
│   ├── dashboard.astro             ← Developer dashboard hub
│   ├── docs.astro                  ← API documentation
│   ├── explorer.astro              ← Data explorer
│   ├── pricing.astro               ← Pricing tiers
│   ├── privacy.astro / terms.astro ← Legal pages
│   ├── signal.astro                ← Cross-reference signal detection
│   ├── signup.astro                ← Registration
│   ├── status.astro                ← System status
│   ├── watcher.astro               ← Data change monitor
│   ├── workspace.astro             ← User workspace
│   ├── design-demo.astro           ← Theme demo (dev only)
│   ├── auth/callback.astro         ← OAuth callback
│   ├── dashboard/billing.astro     ← Subscription management
│   ├── dashboard/extraction.astro  ← Browser extraction config
│   ├── dashboard/owasp.astro       ← OWASP compliance matrix
│   └── explorer/result/[id].astro  ← Single search result
├── components/
│   ├── LandingBody.astro           ← Shared landing body (used by index + [locale])
│   ├── LanguageSwitcher.astro      ← EN/FR locale toggle
│   ├── ChangelogAccordion.tsx      ← Collapsible changelog (client island)
│   ├── SignupForm.tsx              ← Passkey/OAuth/Web3 signup
│   ├── ui/                         ← 20 shadcn/ui primitives (dark-theme)
│   │   ├── accordion, avatar, badge, button, card, dialog,
│   │   │   dropdown-menu, form, glsl-hills (Three.js), input,
│   │   │   label, navigation-menu, select, separator, sheet,
│   │   │   skeleton, table, tabs, textarea, toggle
│   ├── dashboard/                  ← 10 interactive workspace components
│   │   ├── AgentChat, AISettings, AnnotationModal, ApiKeysManager,
│   │   │   BillingPlans, BrowserExtraction, JournalismToggle,
│   │   │   Overview, OwaspDashboard, WatcherDashboard
│   └── billing/                    ← Stripe integration
│       ├── CheckoutSuccessPoller, ManageSubscriptionButton,
│       └── StripeCheckoutButton
├── lib/
│   ├── api.ts                      ← API client (health, usage, webhooks)
│   ├── landing-meta.ts             ← Landing SEO metadata
│   └── utils.ts                    ← cn() helper (clsx + tailwind-merge)
├── styles/
│   └── globals.css                 ← Tailwind v4 @import + @theme + CSS vars
└── utils/
    └── localeUrl.ts                ← i18n-aware URL helpers
```

### Route Map

| Path | Page | Hydration | Auth-aware |
|------|------|-----------|------------|
| `/` | Landing (index → redirect) | Static | No |
| `/en`, `/fr` | Landing (locale) | Static | No |
| `/404` | Custom 404 | Static | No |
| `/agents` | MCP Agent Directory | Static | No |
| `/api-explorer` | API Playground | Static | No |
| `/ask` | AI Q&A | `client:load` (AgentChat) | Yes |
| `/blog` | Blog listing | Static | No |
| `/changelog` | Changelog | Static | No |
| `/citation` | Citation verification | Static | No |
| `/contact` | Contact | Static | No |
| `/dashboard` | Developer Dashboard | `client:load` | Yes |
| `/dashboard/billing` | Subscriptions | `client:load` | Yes |
| `/dashboard/extraction` | Browser Extraction | `client:load` | Yes |
| `/dashboard/owasp` | OWASP Compliance | `client:load` | Yes |
| `/docs` | API Documentation | Static | No |
| `/explorer` | Data Explorer | Static | No |
| `/explorer/result/[id]` | Search Result | Static | No |
| `/pricing` | Pricing Tiers | Static | No |
| `/privacy` | Privacy Policy | Static | No |
| `/signal` | Cross-reference signals | Static | No |
| `/signup` | Registration | `client:load` (SignupForm) | No |
| `/status` | System Status | Static | No |
| `/terms` | Terms of Service | Static | No |
| `/watcher` | Data Change Monitor | `client:load` | Yes |
| `/workspace` | User Workspace | Static | Yes (auth.js) |
| `/dashboard/checkout-success` | Stripe checkout success | Static | No |
| `/auth/callback` | OAuth callback | Static | No |
| `/design-demo` | Theme demo (dev) | Static | No |

**Total: 28 Astro route files → 38 built pages** (includes `/en`, `/fr` locale variants, and `checkout-success`).

---

## 3. Design System

### Background Hierarchy

- **`--background` (hsl 240 10% 4%):** Near-black page foundation. Never pure black.
- **`--card` (hsl 0 0% 6.5%):** Card/container backgrounds.
- **`--popover` (hsl 222 18% 8%):** Elevated overlay surfaces (dialogs, sheets).
- **`--muted` (hsl 0 0% 10%):** Subtle secondary backgrounds.

### Semantic Colors

- **Primary (hsl 0 72% 51%):** Maple red — CTAs, active nav, severity indicators, brand accent.
- **Ring (hsl 191 96% 42%):** Parliament cyan — focus rings, interactive highlights, secondary links.
- **Destructive (hsl 0 62.8% 30.6%):** Deep red — dangerous actions, error states.
- **Accent (hsl 0 72% 14%):** Subtle primary-tinted hover backgrounds.

### Brand Gradient

The `.text-gradient` utility produces a maple-red-to-warm-ember gradient on emphasized titles: `hsl(0 72% 51%) → hsl(16 80% 60%) → hsl(28 86% 64%)`.

### Aurora + Grid Backgrounds

- **`.aurora::before`**: Layered radial gradients (primary/ember/violet) for a northern-lights glow over hero sections.
- **`.bg-grid`**: 56px repeating dot grid that fades via `mask-image: radial-gradient(ellipse 60% 80% at 50% 0%)`.
- **`.quill-landing-bg`**: Scoped to landing page only — multi-color radial gradients that don't leak into other pages.

### Typography

| Token | Font | Size | Weight | Usage |
|-------|------|------|--------|-------|
| h1 | Inter | 2.25rem | 700 | Page titles (-0.03em tracking) |
| h2 | Inter | 1.5rem | 600 | Section headings (-0.02em) |
| h3 | Inter | 1.125rem | 600 | Card titles |
| body | Inter | 0.938rem | 400 | Body copy (line-height 1.6) |
| body-muted | Inter | 0.875rem | 400 | Secondary text |
| mono | JetBrains Mono | 0.85rem | 400 | Code, data IDs, terminal |
| label | JetBrains Mono | 0.75rem | 600 | Badges, section labels |
| nav | JetBrains Mono | 0.82rem | 500 | Navigation (+0.02em tracking) |

Tabular numbers (`font-variant-numeric: tabular-nums`) on all stat/metric displays.

### Spacing Scale

Tailwind v4 4px-base: `xs(4px) → sm(8px) → md(16px) → lg(24px) → xl(32px) → 2xl(48px) → 3xl(64px)`. Intra-component: `md`. Inter-component: `lg`. Sections: `xl`–`2xl`. Max content width: 1280px.

---

## 4. Component Catalog

### shadcn/ui Primitives (20 components)

All adapted for dark theme via CSS variables in `globals.css`. The `cn()` utility (`clsx` + `tailwind-merge`) resolves variant conflicts.

| Component | Radix Primitive | Key Variants |
|-----------|----------------|--------------|
| Button | `@radix-ui/react-slot` | default (primary), outline, ghost, link, sizes sm/md/lg/icon |
| Card | — | default with `CardHeader`/`CardTitle`/`CardDescription`/`CardContent` |
| Badge | — | default, outline, secondary |
| Dialog | `@radix-ui/react-dialog` | default overlay, sheet (slide-in panel) |
| NavigationMenu | `@radix-ui/react-navigation-menu` | horizontal nav with viewport |
| Select | `@radix-ui/react-select` | native-style with custom trigger |
| Tabs | `@radix-ui/react-tabs` | underline and pill variants |
| Accordion | `@radix-ui/react-accordion` | collapsible sections |
| Table | — | sticky header, mono IDs, right-aligned numbers |
| Skeleton | — | shimmer loading placeholder |
| Sheet | `@radix-ui/react-dialog` | slide-in panel (mobile nav drawer) |
| DropdownMenu | `@radix-ui/react-dropdown-menu` | contextual menus |
| Form | `react-hook-form` + `zod` | field validation wrapper |
| Input | — | elevated surface, cyan focus ring |
| Textarea | — | multi-line input |
| Label | `@radix-ui/react-label` | form field label |
| Separator | `@radix-ui/react-separator` | horizontal/vertical rule |
| Avatar | `@radix-ui/react-avatar` | user/org avatar with fallback |
| Toggle | `@radix-ui/react-toggle` | on/off state button |
| GLSLHills | (Three.js) | WebGL animated shader background |

### Dashboard Components (10)

| Component | Role | Auth |
|-----------|------|------|
| Overview | Usage summary, health, stats | Yes |
| ApiKeysManager | API key CRUD (listing, rotate, revoke) | Yes |
| BillingPlans | Plan selection + Stripe checkout | Yes |
| AISettings | AI behaviour preferences | Yes |
| AgentChat | AI assistant chat interface | Yes |
| BrowserExtraction | Government portal extraction config | Yes |
| OwaspDashboard | OWASP LLM Top 10 compliance matrix | Yes |
| WatcherDashboard | Watcher status + event feed | Yes |
| AnnotationModal | Data annotation overlay | Yes |
| JournalismToggle | Investigative mode toggle | Yes |

### Component State Definitions

| Component | Hover | Active | Focus | Disabled | Loading |
|-----------|-------|--------|-------|----------|---------|
| button (primary) | opacity 0.9 | scale(0.97), 160ms | outline ring | opacity 0.5 | shimmer |
| button (outline) | bg accent | — | outline ring | opacity 0.5 | — |
| input | — | — | 2px solid ring | opacity 0.5 | — |
| card | translateY(-3px), border primary | — | — | — | — |
| nav-pill | bg foreground/4% | — | — | — | — |
| skeleton | — | — | — | — | shimmer 1.5s |

---

## 5. Component State Matrix

| Component | Hover | Active | Focus | Disabled | Loading |
|-----------|-------|--------|-------|----------|---------|
| Button (primary) | opacity 0.9 | scale 0.97 / 160ms | cyan ring | opacity 0.4 | shimmer |
| Button (outline) | bg accent | — | cyan ring | opacity 0.4 | — |
| Input | — | — | 2px solid ring | opacity 0.5 | — |
| Card | translateY(-3px) + border primary | — | — | — | — |
| Stat card | shadow lift | — | — | — | shimmer |
| Nav pill | bg foreground/0.04 | — | — | — | — |
| Skeleton | — | — | — | — | shimmer 1.5s |

---

## 6. Layout

- **4px base grid.** All spacing multiples of 4.
- **Max content width:** 1280px with `px-4 sm:px-6 lg:px-8` container padding.
- **Navbar:** Sticky top bar, 6 nav links (Home, Explorer, Agents, Dashboard, Pricing, Docs), scroll-shrink to 56px via `header.scrolled`.
- **Card grids:** `auto-fill, minmax(300px, 1fr)` with 16px gap.
- **Dashboard:** Full viewport width, sidebar with sub-navigation for billing/extraction/owasp.
- **Landing:** Single-scroll narrative — Hero → Stats → MCP Config → ToolGrid → Sovereignty → Footer.
- **Elevation:** Flat design. Depth via background layers. Shadows only for card hover and dropdowns/modals.

---

## 7. Motion

### Timing Scale

| Token | Value | Usage |
|-------|-------|-------|
| instant | 0ms | Badge changes, keyboard shortcuts |
| fast | 100ms | Focus-visible outline, color transitions |
| press | 160ms | Button active state (scale 0.97) |
| normal | 200ms | Hover effects, nav-item transitions |
| slow | 300ms | Card entrance, modal overlay, reveal |
| shimmer | 1500ms | Loading placeholder loop |

### Easing Curves

```css
--ease-out:    cubic-bezier(0.23, 1, 0.32, 1);   /* Entrances */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);  /* State transitions */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);   /* Sheet/drawer slide */
```

### CSS Animation Utilities

- **`.reveal-on-scroll`**: Opacity 0→1 + translateY(16px→0), 300ms ease-out. Activated by `IntersectionObserver` (`.is-visible` class).
- **`.stagger-children`**: Applies `staggerIn` animation to each child with `--stagger-index × 60ms` delay (supports 8 children).
- **`.press-feedback`**: `scale(0.97)` on `:active` with 160ms ease-out.
- **`.card-hover`**: 3px lift (`translateY(-3px)`) with primary-tinted border/shadow, gated behind `@media (hover: hover) and (pointer: fine)`.
- **`.clip-reveal`**: HW-accelerated clip-path wipe from bottom → top, 400ms ease-out.
- **`.shimmer`**: 1.5s gradient sweep for skeleton loading.
- **`.gpu-transition`**: Compositor-only transform + opacity transitions.

### View Transitions

Astro View Transitions use 100ms cross-fade for SPA-like page navigation. No movement-based transitions — only opacity to avoid jarring spatial shifts.

### framer-motion

Available as a dependency (`v12.42.2`) for future gesture-driven React islands. When used:
- Prefer springs for interruptible gestures, CSS transitions for predetermined UI motion
- Entrance animations: `initial={{ opacity: 0, y: 16 }}` with `easeOut` spring
- Never animate keyboard-initiated actions

### Animation Decision Framework

| Frequency | Decision |
|-----------|----------|
| 100+ times/day (keyboard shortcuts, palette) | No animation. Ever. |
| Tens of times/day (hover, list nav) | Remove or drastically reduce |
| Occasional (modals, drawers, toasts) | Standard animation (300ms max) |
| Rare / first-time (onboarding, celebrations) | Can add delight |

Never animate from `scale(0)`. Start from `scale(0.95)` + `opacity: 0`. Only animate `transform` and `opacity` for GPU compositing.

---

## 8. Accessibility

- **Focus states:** Visible cyan ring (`outline: 2px solid hsl(var(--ring) / 0.7)`; `outline-offset: 2px`) on all interactive elements via `:focus-visible`.
- **Color independence:** Color is never the sole indicator — always paired with icons, labels, or text.
- **WCAG AA contrast:** All text pairs meet AA minimum; text-primary on surface achieves AAA (11.5:1).
- **Keyboard navigation:** All interactive elements are reachable via Tab; nav has `aria-current="page"` markers.
- **Reduced motion:** Full `prefers-reduced-motion: reduce` reset — animations reset to 0.01ms, scroll-behavior set to auto, reveal-on-scroll set to fully visible. Opacity cross-fades are preserved for comprehension.
- **Hover gating:** Motion is gated behind `@media (hover: hover) and (pointer: fine)` — touch devices never see hover transforms.
- **Text sizing:** All spacing in `rem`/`em`; `-webkit-text-size-adjust: 100%` set; `html { scroll-behavior: smooth }` gated by reduced-motion.
- **Dark scrollbar:** Thin, border-colored scrollbar; no custom scroll on body.
- **Semantic HTML:** Proper heading hierarchy, `aria-hidden` on decorative elements, `role` attributes on interactive regions.

---

## 9. Responsive

- **Desktop-first.** Landing and dashboards are wide.
- **Breakpoints:** sm(640px), md(768px), lg(1024px), xl(1280px), 2xl(1536px).
- **Tablet (≥768px):** Single cards, 2-column stat grids, collapsed sidebar.
- **Mobile (<768px):** Full-width, stacked, hidden sidebar, hamburger sheet nav.
- **Container padding:** `px-4 sm:px-6 lg:px-8` — tighter gutters on small screens.
- **Tables:** Horizontally scrollable on small viewports.
- **Card grids:** 6-col on xl → 3-col on lg → 2-col on md → 1-col on sm.
- **Hero:** Stacked on mobile (heading → subtext → CTA), full-width on all breakpoints.

---

## 10. Build Configuration

### Astro 7 Static Build

- **Output:** `static` — pre-renders all pages at build time. No SSR runtime.
- **Site URL:** `https://quill.maplespike.ca`
- **compressHTML:** `true` — strips whitespace from HTML output.
- **Build format:** `file` — each page generates `/path/index.html` (no trailing `/index` in URLs).
- **Rust compiler:** Astro 7 uses the Rust-based compiler; stricter about unclosed tags than previous versions.
- **Vite 8:** Bundled with Astro 7, config accessed via `vite.build.rollupOptions`.

### manualChunks

```js
rollupOptions: {
  output: {
    manualChunks(id) {
      if (id.includes('/node_modules/react/'))        return 'vendor-react';
      if (id.includes('/node_modules/react-dom/'))    return 'vendor-react';
      if (id.includes('/node_modules/framer-motion/'))return 'vendor-framer';
      if (id.includes('/node_modules/lucide-react/')) return 'vendor-icons';
    },
  },
}
```

Three stable vendor chunks: `vendor-react` (React 19.2.7, React DOM, scheduler), `vendor-framer` (framer-motion 12), `vendor-icons` (lucide-react).

### `gen:all` Pipeline

The build script runs `pnpm gen:all && astro build`. The `gen:all` script sequentially generates:
1. `generate-agents-json.mjs` — builds `/agents` page data (182 MCP tools)
2. `generate-openapi.mjs` — fetches OpenAPI 3.1 spec for `/api-explorer`
3. `generate-pipeline-data.mjs` — fetches pipeline metrics (wrapped in `timeout 60`)
4. `generate-llms.mjs` — generates `/llms.txt` and `/llms-full.txt`
5. `gen-security-audit.mjs` — generates OWASP compliance data

Step 3 has a **60-second timeout guard** (`timeout 60`) to prevent CI hangs if the upstream pipeline API is unavailable. The `|| true` ensures the overall build continues on timeout.

### Deployment

| Environment | Platform | URL |
|-------------|----------|-----|
| Production | K3s cluster (Nix-built OCI image) | `quill.maplespike.ca` |
| Dev | Cloudflare Pages | `maplespike-quill.pages.dev` |
| Local | `pnpm dev` (Astro dev server) | `localhost:4321` |

---

## 11. Agent Prompt Guide

**Context:** Quill Portal — the product dashboard for the MapleSpike Canadian public data platform. Astro 7 + React 19 + Tailwind v4 + shadcn/ui. 38 static pages at `quill.maplespike.ca`. Monorepo location: `packages/portal/`.

**Bias:** Dark canvas (`hsl 240 10% 4%`), maple red primary (`hsl 0 72% 51%`), parliament cyan ring (`hsl 191 96% 42%`), JetBrains Mono for nav/code/labels, Inter for body/headings, tabular numerals on all stats. Text gradient (`red → ember`) on hero titles. Aurora glow + bg-grid on landing. Card hover lift with primary-tinted shadow.

**Page structure:**
- **Landing** (`/en`, `/fr`): Hero with `.aurora` + `.bg-grid` → stat bar (207 modules · 182 tools · 13 jurisdictions) → MCP config JSON -> ToolGrid (6 categories) → platform badges
- **Dashboard** (`/dashboard`): Full-width, tabbed interface (Overview, API Keys, Billing, AI Settings, OWASP, Extraction)
- **Agents** (`/agents`): 182 tools listed with per-client setup code blocks
- **Docs** (`/docs`): Monospaced API reference with curl examples

**CSS utility patterns:**
- `reveal-on-scroll` for entrance animations
- `card-hover` for interactive cards (`translateY(-3px)` + primary border)
- `press-feedback` for button active state (`scale(0.97)`)
- `stagger-children` for sequential entrance of grid items
- `text-gradient` for emphasized titles
- `.dark` class on `<html>` — light theme exists but is production-inactive

**Component imports:** shadcn/ui from `@/components/ui/[name]`; dashboard components from `@/components/dashboard/[Name]`.

**Build:** `pnpm gen:all && astro build`. Vendor chunks: `vendor-react`, `vendor-framer`, `vendor-icons`. `compressHTML: true`. `timeout 60` guard on pipeline data generation.

**Reject:** Light backgrounds, serif fonts, spinners (use shimmer), shadows on default-state cards, ease-in on UI animations, center-aligned numbers, inline styles for layout.
