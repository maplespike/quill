# MapleSpike Canada Portal — Full Visual Redesign

**Date:** 2026-05-12
**Author:** Hermes Agent
**Status:** Plan (no execution yet)

---

## 1. Goal

Transform the current functional-but-flat MapleSpike Canada portal into a premium SaaS-grade frontend that projects trust, sovereignty, and polish — commensurate with the product's positioning as Canada's sovereign AI-native government data layer.

The existing AI-friendly backend (`llms.txt`, `llms-full.txt`, content negotiation, Markdown endpoints) is already in place and must remain fully functional after the redesign.

---

## 2. Current Context

### What exists (in `/data/projects/own/frostbite-data-pipeline/packages/portal/`)

| File | Role | Notes |
|------|------|-------|
| `index.html` | Landing page | Hero + features grid + pricing + API ref + footer |
| `docs.html` | Documentation | Quickstart, MCP setup, API ref, FAQ |
| `agents.html` | AI agent guide | Per-agent MCP setup, best practices, example prompts |
| `dashboard.html` | Developer dashboard | Sidebar layout, API key, usage stats, chart, activity |
| `server.py` | Dev server | Static serving + `Accept: text/markdown` + `.md` suffix + `x-markdown-tokens` |
| `styles.css` | All CSS | ~727 lines, single file, dark-only, red-accent theme |
| `llms.txt` | AI discovery index | Standard `llms.txt` protocol format |
| `llms-full.txt` | Full doc dump | 7.2KB flat Markdown for large-context models |

### Design strengths already present
- Dark theme (navy base) — developer-oriented, correct choice
- Inter + JetBrains Mono font stack — modern and readable
- Glass nav bar with backdrop blur — already premium-ish
- Hero section with code block demo — functional
- Good content and messaging — the *what* is right

### Design weaknesses to fix
- **Red (#E84545)** as primary accent — reads "danger/alert/stop," not "trust/sovereignty/data"
- **No dark/light mode toggle** — expected for a developer SaaS
- **Feature grid is flat** — uniform cards, no hierarchy, no visual rhythm
- **Pricing cards are basic** — no visual emphasis on the recommended tier, no trust badges
- **No animations** — no scroll-reveal, no micro-interactions, no polish
- **Section spacing inconsistent** — some sections at 40px padding, others 100px
- **No mobile hamburger menu** — nav breaks on small screens
- **Dashboard sidebar is static** — no icons, no grouping, no visual hierarchy
- **No live demo / interactive element** on the hero — the curl code block is static
- **Typography lacks hierarchy** — h1 is 3.5rem, but h2/h3 are undersized; line-heights tight
- **No social proof / testimonials** — empty grey area on a page that sells trust

---

## 3. Proposed Approach

### 3.1 Color Palette — Base16/Base24 Token System (Refinement, Not Replacement)

Keep the current colors mostly as-is. Restructure into a systematic Base16/Base24 token hierarchy so the palette is extensible, consistent, and follows a known convention. This also makes it trivial to generate a light theme (just flip base00↔base07 and tweak accent shades).

#### Base16 mapping (16 base colors)

| Token | Role | Current value | Notes |
|-------|------|---------------|-------|
| `base00` | Darkest bg | `#0B1120` | Primary background |
| `base01` | Surface bg | `#111827` | Secondary panels, code blocks |
| `base02` | Card bg | `#1A2332` | Feature cards, pricing cards |
| `base03` | Card hover/border | `#1F2A3D` | Card hover state |
| `base04` | Border | `#2D3748` | Borders, dividers |
| `base05` | Muted text | `#6B7280` | Secondary labels |
| `base06` | Secondary text | `#9CA3AF` | Body text |
| `base07` | Primary text | `#F8F9FA` | Headings, primary text |
| `base08` | **Red (accent)** | `#E84545` | Primary CTA, brand mark — **stays red** |
| `base09` | Orange | `#F97316` | Warn-level indicators |
| `base0A` | Yellow | `#FBBF24` | Rate-limit warnings, pause states |
| `base0B` | Green | `#10B981` | Success, verified badges |
| `base0C` | **Cyan (secondary accent)** | `#06B6D4` | Secondary actions, links, info badges |
| `base0D` | Blue | `#3B82F6` | API method badges (GET), info |
| `base0E` | Violet | `#8B5CF6` | Gradients, premium-tier accents |
| `base0F` | Magenta | `#D946EF` | Rarely used, special states |

#### Base24 extensions (8 additional tokens)

| Token | Role | Value | Notes |
|-------|------|-------|-------|
| `base10` | Deeper bg | `#070C19` | Hero gradient deepest point |
| `base11` | Elevated card | `#1E2A3D` | Hovered card surface |
| `base12-base17` | Reserved | TBD | Light theme intermediate bg tones |
| `base18` | Red-dim | `rgba(232,69,69,0.15)` | Alert backgrounds |
| `base19` | Green-dim | `rgba(16,185,129,0.15)` | Success backgrounds |
| `base20` | Cyan-dim | `rgba(6,182,212,0.15)` | Info badge backgrounds |
| `base21-base23` | Reserved | TBD | Future use |

**Key rule:** Red (`base08`) is the primary identity color. Cyan (`base0C`) is the secondary/utility accent for non-critical interactive elements (secondary buttons, info badges, link underlines). This gives a two-tone system: 🇨🇦 **Red for identity + Cyan for data/clarity**.

For a **light theme**, swap base00↔base07, lighten base01-base04, and slightly darken base08-base0F for WCAG AA contrast.

### 3.2 Hero Section (index.html)

**Before:** Static badge row + h1 + paragraph + two buttons + curl code block.

**After:**
- Larger, more dramatic hero (180px+ padding top)
- **Animated gradient background** — subtle cyan-to-violet sweep instead of current red radial gradient
- **Trust badges** row replaced with a *featured-in* / *used-by* bar (even if fictional/aspirational — design patterns like "Trusted by civic tech teams across Canada")
- **Interactive API demo box** — a live code block with a "Run" button that shows a mock JSON response (client-side JS, no actual API call needed), demonstrating `query_gov_data` with a sample response envelope
- **Stat counter animation** — the 6/10+/100%/$0 stats should count up on scroll rather than being static numbers
- **Two CTAs** remain but with cyan + secondary violet gradient on primary CTA

### 3.3 Features Bento Grid (index.html)

**Before:** Uniform 3-column grid of feature cards, all same size/shape.

**After:** Convert to a **bento/masonry grid** with varied card sizes:

```
┌─────────────────┬──────────────┐
│  MCP-Native      │ Every Dataset │
│  (tall card)     │              │
├─────────────────┼──────────────┤
│  5GW Defense     │ Audit Trails  │
│  (wide card)     │              │
├─────────────────┴──────────────┤
│  AI Trust Scores                 │
│  (full-width highlight card)    │
├─────────────────┬──────────────┤
│  Canadian        │ ...          │
│  Sovereign       │              │
└─────────────────┴──────────────┘
```

Each card gets:
- A **gradient icon background** (colored per card theme) — already exists but can be more vibrant
- Subtle **border glow on hover** — `box-shadow: 0 0 0 1px rgba(6, 182, 212, 0.3)`
- **50-100ms staggered entrance animation** on scroll

### 3.4 Pricing Cards (index.html)

**Before:** 4-column uniform cards with "Popular" text badge.

**After:**
- 3 visible tiers (Free, Pro, Business) with Enterprise as a separate CTA below — reduces visual noise
- **Pro tier highlighted** with:
  - Cyan border glow
  - Slightly elevated (`translateY(-8px)`)
  - Gradient card background
  - "Popular" badge with cyan/teal color (not red)
- **Feature items** with checkmark icons in cyan
- **Annual/monthly toggle** at the top (annual = 2 months free)
- **Trust badges** at the bottom of the pricing section ("No surprise billing," "Cancel anytime," "AIDA-compliant")

### 3.5 MCP Integration Section (index.html)

**Before:** Second feature grid that looks identical to the first one — causes visual fatigue.

**After:**
- Convert to a **3-panel integration showcase** with a monospace "terminal" aesthetic
- Each panel shows the actual config snippet for Claude Desktop / Cursor / REST API with a **copy button**
- Background: slightly different from features (e.g., a darker tinted section with a grid pattern)
- Heading: "Works with your AI tools — add in under 30 seconds"

### 3.6 Dashboard (dashboard.html)

**Before:** Functional sidebar layout, basic chart bars, flat cards.

**After:**
- **Glass sidebar** with nav grouping (Workspace / Account / Support)
- **Avatar + user info** at top with tier badge styled as a pill
- **Stat cards** with glass background (`backdrop-filter: blur`)
- **Usage chart** animated on load (bar chart grows from bottom)
- **Activity feed** with color-coded HTTP method badges (GET=cyan, POST=violet, green=200, yellow=429)
- **Inline code block** for API key with a one-click copy that shows a toast

### 3.7 Navigation (all pages)

**Before:** Fixed top nav with inline links.

**After:**
- **Mobile hamburger menu** — off-canvas slide-in for <768px
- **Dark/light mode toggle** in the nav bar (sun/moon icon button, CSS custom properties swap)
- **Active page indicator** — thicker bottom border or underline animation
- **Sticky nav** with shrink-on-scroll effect (reduce height from 64px to 48px on scroll)

### 3.8 Dark/Light Mode Toggle

**Implementation:**
- Add `data-theme="dark"` (default) or `data-theme="light"` on `<html>`
- CSS custom properties in `:root` for dark and `[data-theme="light"]` for light
- Light theme: white backgrounds, dark text, cyan accent retained but with darker shades
- JS toggle button saves preference to `localStorage`
- Transition: `color 0.3s, background-color 0.3s` for smooth switch

### 3.9 Animations & Micro-interactions

- **Scroll reveal** — use IntersectionObserver (no library) to fade+slide in sections
- **Hover lift** — `transform: translateY(-4px)` with `box-shadow` on cards (already partially exists)
- **Button shimmer** — gradient sweep on primary CTA hover
- **Typing effect** on the hero code block subtitle
- **Smooth anchor scroll** — `scroll-behavior: smooth` + offset for fixed nav
- **Stat counter animation** — count up from 0 on viewport entry

### 3.10 Typography Polish

- Increase `h2` from 2.2rem to 2.5rem
- Increase section spacing from 40-100px to **80-120px consistent**
- Better line-height on body text (1.7 → 1.8)
- Add `letter-spacing: -0.02em` to headings for tighter, more premium look
- Use `font-weight: 400` for body, `500` for strong, `600+` for headings

---

## 4. Files That Change

| File | Change | Scope |
|------|--------|-------|
| `styles.css` | Complete rewrite of color system, new animation classes, bento grid, light theme, mobile nav, glass effects | **Heavy** — ~1,000+ lines |
| `index.html` | New hero markup, bento grid structure, pricing with toggle, integration showcase, scroll-reveal data attrs | **Heavy** |
| `docs.html` | Nav update for dark mode toggle, light theme support | Light |
| `agents.html` | Nav update for dark mode toggle, light theme support | Light |
| `dashboard.html` | Glass sidebar, animated chart, nav update | Medium |
| `server.py` | No changes — AI features must remain untouched | None |

---

## 5. Tests / Validation

1. **All static files serve** — `llms.txt`, `llms-full.txt`, `agents.html`, `docs.html`, `index.html`, `dashboard.html`
2. **Content negotiation still works** — `curl -H "Accept: text/markdown"` returns Markdown with `x-markdown-tokens` header
3. **`.md` suffix still works** — `curl http://localhost:4321/docs.md` returns Markdown
4. **Responsive** — test at 375px, 768px, 1024px, 1440px viewport widths
5. **Dark/light toggle** — switch modes, reload page, verify preference persists in `localStorage`
6. **No broken links** — all nav links, footer links, CTA buttons resolve
7. **Animations don't break scroll** — scroll-reveal works, stats animate once, no layout shift

---

## 6. Risks, Tradeoffs, Open Questions

### Risks
- **Over-engineering the CSS** — the portal is static HTML, not React. Complex animations without a framework can get fragile. Mitigation: use IntersectionObserver + CSS transitions, not a JS animation library.
- **Light theme readability** — cyan-on-white can be low-contrast. Mitigation: darken cyan to `#0e7490` in light mode, ensure 4.5:1 WCAG AA minimum.
- **Server.py accidentally broken** — must not touch server.py during this redesign. All changes go into `styles.css` + `*.html` only.
- **Red demotion loses brand identity** — the red "C" logo icon needs to stay red (it's the logo mark). Only demote red from UI accents, not the brand mark.

### Tradeoffs
- **More CSS = more weight** — premium designs need more CSS. Acceptable for a dev portal (< 100KB gzipped).
- **JS animations means JS dependency** — currently the portal has minimal JS (dashboard only). Adding scroll-reveal JS adds ~50 lines. Acceptable tradeoff.
- **Mobile nav complexity** — off-canvas menu requires JS for open/close and overlay. Worth it for mobile users.

### Open Questions (for user)
1. For the "interactive API demo" box — should it show a real-looking StatCan response or a simpler mock?
2. Testimonials section — real quotes from early users, or skip until there are actual users?

---

## 7. Execution Order (recommended)

1. **CSS foundation** — rewrite `styles.css` with new color palette, light theme vars, animation classes, glass effects, mobile nav styles
2. **Landing page** — `index.html`: hero, bento grid, pricing with toggle, integration showcase, scroll-reveal
3. **Dashboard** — `dashboard.html`: glass sidebar, animated chart, stat cards polish
4. **Docs + Agents** — `docs.html` + `agents.html`: light theme support, nav update
5. **Nav unification** — dark mode toggle wired into all pages, mobile hamburger
6. **Test** — full pass of all 6 validation tests above

Each step produces a visible, testable result. The CSS foundation (step 1) is the critical path — everything depends on it.
