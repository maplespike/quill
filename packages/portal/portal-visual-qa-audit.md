# Quill Portal — Visual QA Audit

**Date:** 2026-07-15  
**Scope:** packages/portal — Astro app, Python dev server  
**Auditor:** Hermes Agent  

---

## 1. BaseLayout.astro Usage

**Verdict: ✅ ALL 27 page route files import BaseLayout**

Every `.astro` page file under `src/pages/` imports and wraps content in `<BaseLayout>`:

| File | Route |
|------|-------|
| `index.astro` | `/` |
| `[locale].astro` | `/[locale]` (en, fr) |
| `agents.astro` | `/agents` |
| `api-explorer.astro` | `/api-explorer` |
| `ask.astro` | `/ask` |
| `blog.astro` | `/blog` |
| `changelog.astro` | `/changelog` |
| `citation.astro` | `/citation` |
| `contact.astro` | `/contact` |
| `dashboard.astro` | `/dashboard` |
| `design-demo.astro` | `/design-demo` |
| `docs.astro` | `/docs` |
| `explorer.astro` | `/explorer` |
| `pricing.astro` | `/pricing` |
| `privacy.astro` | `/privacy` |
| `signal.astro` | `/signal` |
| `signup.astro` | `/signup` |
| `status.astro` | `/status` |
| `terms.astro` | `/terms` |
| `watcher.astro` | `/watcher` |
| `workspace.astro` | `/workspace` |
| `404.astro` | (error page) |
| `auth/callback.astro` | `/auth/callback` |
| `dashboard/billing.astro` | `/dashboard/billing` |
| `dashboard/checkout-success.astro` | `/dashboard/checkout-success` |
| `dashboard/extraction.astro` | `/dashboard/extraction` |
| `dashboard/owasp.astro` | `/dashboard/owasp` |
| `explorer/result/[id].astro` | `/explorer/result/{id}` |

**Note:** The originally specified 19 routes are included. There are actually **8 additional route files** beyond the 19 (design-demo, signal, api-explorer, 404, auth/callback, 3 dashboard sub-pages, explorer result pages). All use BaseLayout.

---

## 2. Nav, Footer, auth.js, Language Switcher Presence

**Verdict: ✅ All present on every page via BaseLayout**

`BaseLayout.astro` (src/layouts/BaseLayout.astro) is the single layout wrapper for all pages. It includes:

### Navigation (lines 119–264)
- Sticky header with logo + "MapleSpike" brand
- Desktop nav pills: Home, Explorer, Agents, Dashboard, Pricing, Docs
- Active page indicator (`aria-current="page"`)
- Scroll-shrink behavior (JS + CSS)
- Mobile drawer with same nav links + language switcher + signup CTA
- Theme toggle button (dark/light)

### Language Switcher (lines 155, 253)
- Imported from `@/components/LanguageSwitcher.astro`
- Rendered **twice** in every page:
  - Once in desktop header (line 155)
  - Once in mobile drawer (line 253)
- Toggles between EN/FR with i18n-aware locale URL routing
- Uses SVG globe icon + current language label

### Auth Container (line 192)
- `<div id="nav-auth-container" class="flex items-center"></div>`
- Populated client-side by `auth.js` (loaded is:inline at line 410)
- Shows signed-in user widget or "Sign in" button depending on auth state

### Footer (lines 272–356)
- Full footer with:
  - Brand logo + tagline
  - 5-column grid (Documentation, Explorer, Company, Legal, branding bar)
  - Links to all key pages
  - 4-bar brand rule (maple/parliament/moss/flame colors)
  - Open Government Licence attribution
  - Copyright line

### Scripts (lines 407–419)
- `/config.js` — runtime config (is:inline)
- `/auth.js` — auth state manager (is:inline)
- `/nav-scroll.js` — scroll shrink utility (is:inline)
- `__LANG` global for React components
- `/script.js` — general page script (is:inline)

---

## 3. Server.py Routing Analysis

**File:** `packages/portal/server.py` (494 lines)

### Architecture
- Custom `SimpleHTTPRequestHandler` subclass (`QuillHandler`)
- Serves static `dist/` directory
- API proxy at `/api/` → upstream API
- Content negotiation for AI-friendly markdown

### Extensionless URL Rewrite (lines 348–374)

**How it works:**
1. Trailing slashes stripped (except root `/`)
2. If no file extension and not ending in `/` → appends `.html`
3. If `.html` file exists → serves it with `text/html`

**Issues Found:**

#### ⚠️ Issue 1: AI Content Negotiation Bypassed by Extensionless Rewrite
The extensionless rewrite (line 363) runs **before** the `Accept: text/markdown` content negotiation (line 406). When an AI agent requests `/dashboard` with `Accept: text/markdown`, the rewrite matches `dashboard.html` and returns HTML immediately — the content negotiation code is never reached.

**Impact:** AI agents requesting extensionless URLs get raw HTML instead of Markdown. Only pages that explicitly add `.md` suffix (e.g., `/dashboard.md`) trigger the MD conversion.

**Severity:** Medium — doesn't affect human users but breaks AI-friendly content negotiation.

**Suggested fix:** Move the content-negotiation check before the extensionless rewrite, or integrate it so that `Accept: text/markdown` requests skip the HTML shortcut and go through the MD pipeline.

#### ✅ Issue 2: Trailing-Slash Handling (No Issue)
The `len(p) > 1` guard properly protects root `/` from slashing. `/fr/` → `/fr` → tries `fr.html`.

#### ✅ Issue 3: Security Headers
- CSP: well-configured with appropriate `script-src`, `style-src`, `connect-src`
- HSTS: only sent when X-Forwarded-Proto indicates HTTPS
- X-Content-Type-Options: `nosniff`
- X-Frame-Options: `DENY`
- Permissions-Policy: restricts camera, mic, geolocation

#### ✅ Issue 4: API Proxy (lines 148–268)
- Correctly strips `/api` prefix before forwarding
- Handles CORS preflight locally
- Limits body size (1 MB default)
- Streams response bodies (SSE-compatible)
- Filters hop-by-hop headers
- Appends to X-Forwarded-For chain

#### ℹ️ Issue 5: `do_GET` fallthrough for unknown routes
When no `.html` file matches and the AI MD path doesn't produce content, it falls through to `SimpleHTTPRequestHandler.do_GET()` which serves static files or returns 404. This is standard behavior for most routes but means there's no custom 404 handler (the Astro 404 page would need to be caught separately).

---

## 4. Pages Missing Language Switcher or Auth Container

**Verdict: ✅ None missing — 0 pages deficient**

Since all pages use `BaseLayout`, and `BaseLayout` contains:
- `<LanguageSwitcher />` (2 instances — desktop header + mobile drawer)
- `<div id="nav-auth-container">` (auth container for auth.js)

**Every page has both components.** No exceptions found.

The specific checks:

| Component | Present in BaseLayout? | On all pages? |
|-----------|----------------------|---------------|
| Nav (desktop) | Line 132 | ✅ |
| Nav (mobile) | Line 234 | ✅ |
| Footer | Line 272 | ✅ |
| Language Switcher | Lines 155, 253 | ✅ (2x per page) |
| Auth Container (`#nav-auth-container`) | Line 192 | ✅ |
| `/auth.js` script | Line 410 | ✅ |

---

## 5. Additional Observations

### Astro Config (astro.config.mjs)
- `output: 'static'` — fully static site generation
- `build: { format: 'file' }` — generates `<page>.html` files (not `/page/index.html`)
- This is why server.py needs the extensionless rewrite (line 363)
- Tailwind CSS v4 via Vite plugin

### Build Output (dist/)
24 static `.html` files + subdirectory pages:
- Top-level: `index.html`, `en.html`, `fr.html`, and 21 page HTMLs
- `dashboard/billing.html`, `dashboard/checkout-success.html`, `dashboard/extraction.html`, `dashboard/owasp.html`
- `auth/callback.html`
- `explorer/result/{1-10}.html`
- `robots.txt`, `llms.txt`, `sitemap.xml`, `og-image.svg`, etc. served from `public/`

### i18n Structure
- `/[locale]` dynamic route for landing page in en/fr
- Other pages use `Astro.props.lang` (defaults to "en")
- `/@maplespike/i18n` package for translations
- `public/assets/i18n/en-CA.json` and `fr-CA.json` for client-side i18n
- `maplespike_lang` stored in localStorage for client-side redirect

### Language Redirect Flow
- Inline script on BaseLayout (line 102-111): on bare `/`, redirects based on `maplespike_lang` localStorage or browser language
- Landing page: `/[locale].astro` renders with locale param
- Other pages: serve with `lang` prop, defaults to English

### auth.js Global Manager
- Exposes `window.QuillAuth` API
- Handles: token storage, user info, login/logout, nav widget injection
- Re-initializes on Astro view transitions (`astro:page-load` event)
- Supports: OAuth, Web3 (wallet), passkey auth methods

---

## Summary

| Check | Status |
|-------|--------|
| 1. BaseLayout imported by all page routes | ✅ All 27+ page files |
| 2. Nav present on all pages | ✅ Via BaseLayout |
| 3. Footer present on all pages | ✅ Via BaseLayout |
| 4. auth.js present on all pages | ✅ Via BaseLayout |
| 5. Language switcher present on all pages | ✅ Via BaseLayout (2x per page) |
| 6. Server.py extensionless rewrite | ⚠️ AI content negotiation bypass issue |
| 7. Pages missing language switcher | ✅ None |
| 8. Pages missing auth container | ✅ None |

**Key finding requiring attention:** The extensionless URL rewrite in `server.py` short-circuits AI content negotiation — requesting any extensionless URL with `Accept: text/markdown` returns HTML instead of Markdown because the `.html` file match happens first. This only affects AI/tool consumers using the MD content negotiation feature.
