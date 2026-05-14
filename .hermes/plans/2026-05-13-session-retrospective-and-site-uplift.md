# Session Retrospective & Site Uplift Blueprint

**Date:** 2026-05-13
**What happened:** ~19 hour session covering data pipeline expansion, repo consolidation, SaaS architecture analysis, and frontend deployment.

---

## 1. What We Built This Session

### Infrastructure
| Item | Detail |
|------|--------|
| Repo merged | `civic-intel` → `maplespike/` at `/data/projects/own/maplespike` |
| Git pushed | github.com/reverb256/maplespike (private, 38 commits across both repos) |
| Packages merged | pipeline-core + engine + web + pretext-civic + api-server + mcp-server + portal |
| Namespace renames | `@civic-intel/core` → `@maplespike/engine`, `@civic-intel/web` → `@maplespike/web` |
| K8s deploy | maplespike-web pod on nexus:30964, Next.js dashboard live |
| NixOS config | caddy-routes.nix (maplespike.lan), cluster-dns.nix (A record), cluster-ca.nix (SAN cert) |

### Ingestion Layer (3 new modules)
| Module | Files | Lines | What it tracks |
|--------|-------|-------|----------------|
| `committees/` | 6 | ~300 | 32 HoC committees, evidence XML, in-camera detection |
| `corporate/` | 6 | 1,171 | Lobbying registry, CanadaBuys procurement, 17 execs (banks/telecom/media) |
| `influence/` | 6 | 1,679 | 34 tracked actors: IOs, think tanks, consultancies, NGOs (now includes JCCF) |

### Frontend (Two Deployments)
| URL | Platform | Content | Status |
|-----|----------|---------|--------|
| https://maplespike.lan/ | Caddy → K8s | Next.js CivicIntel dashboard | ✅ User confirmed working |
| http://10.1.1.110:3000/ | Python http.server | Portal landing page (index.html, dashboard.html, docs.html, agents.html) | 🟡 User says "broken" |

### Purged
- External comparators removed from docs for clarity

---

## 2. What We Learned (Resources Analyzed)

### SaaS Architecture Articles

All seven resources converged on the same core themes:

**CloudZero article — Deep Architecture:**
- Multi-tenancy is foundational (data isolation, tenant-per-schema or shared-schema)
- Scalability patterns: vertical vs horizontal, stateless services, CDN for static
- Security: encryption at rest + transit, RBAC, regular audits, compliance (GDPR, SOC 2, AIDA)
- Observability: centralized logging, metrics (response time, error rate, resource utilization), alerting
- Integration: RESTful APIs + webhooks + event-driven architecture
- Microservices: each service independently deployable and scalable
- Data management: RDBMS for structured, NoSQL for high-volume, object storage for blobs

**Binadox article — Key Concepts:**
- Same multi-tenancy/scalability/security triad
- Added emphasis on **user interface** — responsive design, customizable UI per role
- Monitoring tools: New Relic, Datadog, Dynatrace, AppDynamics
- Zoom case study: scaled from 10M to 300M users during pandemic

**Kinex Media — 7 Must-Have Elements for SaaS Website:**
1. **Value Proposition** — one-sentence what + why best
2. **Social Proof** — testimonials, case studies, client logos, third-party reviews
3. **Call to Action** — clear sign-up/sign-in buttons
4. **Product Experience** — show the actual software
5. **Design for Conversion** — A/B testing, heatmaps, user journeys, minimize friction
6. **Video & Interactive Content** — 30-60 second demos
7. **Free Trials** — try before buying, no credit card

**What's missing from MapleSpike against these patterns:**
- No user accounts/auth at all → no multi-tenancy, no trial, no CTA flow
- No analytics → no conversion optimization, no A/B testing
- No social proof → no testimonials, no case studies (no real users yet)
- No interactive demo → static code block instead of live API playground
- No database provisioned → engine graph/signals/briefs run on seed data

---

## 3. UI Polish Improvements Already Done

The portal CSS has already been partially upgraded based on earlier work:
- Base16/Base24 token system with semantic aliases
- Dark/light theme toggle (via `data-theme` attribute, localStorage)
- Glass card effects (backdrop-filter blur)
- Shimmer animation on primary buttons
- Mobile hamburger nav structure (CSS exists for off-canvas menu)
- Scroll-reveal animation classes (fade-in, fade-in-up, stagger-* timing)
- API method badges (GET=cyan, POST=violet, PUT=blue, DELETE=red)
- Gradient hero background with radial glow
- Theme-consistent borders, shadows, spacing
- Smooth transitions on color/background swap

**What the HTML still lacks that the CSS supports:**
- Dark/light toggle button wired into HTML (nav has placeholder `theme-toggle` class but may not be connected)
- Mobile hamburger toggle wired (CSS has `.nav-mobile-toggle` but may not be in HTML)
- Scroll-reveal `data-animate` attributes not applied to sections (CSS has the `@keyframes` and visibility classes)
- Stat counter animation not wired (CSS has the keyframes, HTML likely has static numbers)
- Some images reference absolute URLs (`https://maplespike.ca/assets/...`) that don't resolve on LAN

---

## 4. Comprehensive Site Uplift Blueprint

### Phase 0 — Fix What's Broken (now)
| # | Task | Detail |
|---|------|--------|
| 0.1 | Fix logo references | Change `https://maplespike.ca/assets/...` → `assets/...` (relative paths) |
| 0.2 | Check dashboard data loading | Ensure `assets/pipeline-data.json` loads and populates cards/ticker |
| 0.3 | Wire dark mode toggle | Add theme toggle button to nav, verify localStorage persistence |
| 0.4 | Wire mobile hamburger | Add hamburger button, verify overlay + menu slide-in works |
| 0.5 | Add scroll-reveal attrs | Add `data-animate="fade-in-up"` to all sections that already have animation CSS |

### Phase 1 — User Experience (SaaS Foundation)
| # | Task | Detail | Pattern Reference |
|---|------|--------|-------------------|
| 1.1 | User accounts | Sign-up/login flow, passwordless email magic link, session management | Required by ALL articles |
| 1.2 | Multi-tenant data isolation | API keys per user, tenant-scoped database queries, usage tracking | CloudZero/Binadox core |
| 1.3 | Interactive API demo | Live code block with "Run" button showing mock gov-data response | Kinex #4 (product experience) |
| 1.4 | Pricing → real checkout | Stripe integration, annual/monthly toggle, tier enforcement | Kinex #3 (CTA) + #7 (trial) |
| 1.5 | Analytics | Plausible or Umami for privacy-first visitor analytics → conversion optimization | CloudZero observability + Kinex #5 |

### Phase 2 — Visual Polish (Premium SaaS Look)
| # | Task | Detail | Priority |
|---|------|--------|----------|
| 2.1 | Animated hero background | Subtle gradient sweep (not the current static radial) — already partially designed | High |
| 2.2 | Stat counter animation | Numbers count up from 0 when section scrolls into view — CSS keyframes exist, JS needed | High |
| 2.3 | Bento grid for features | Varied card sizes instead of uniform grid — HTML restructure needed | Medium |
| 2.4 | Pricing card hierarchy | Pro tier elevated with cyan glow, "Popular" badge, feature checkmarks | Medium |
| 2.5 | Integration showcase | Terminal-style panels with copy buttons for MCP config snippets | Medium |
| 2.6 | Typography refinement | Tighter letter-spacing, better body line-height, hierarchy polish | Low |
| 2.7 | Social proof section | "Trusted by" bar, testimonials (when available), data source logos | Low (depends on users) |

### Phase 3 — Content & Trust (Credibility)
| # | Task | Detail |
|---|------|--------|
| 3.1 | Video demo | 30-60 second screen recording showing API query → JSON response flow |
| 3.2 | Case studies | "How Frostbite Gazette uses MapleSpike to track in-camera meetings" |
| 3.3 | Open source showcase | GitHub stars badge, contribution guide link |
| 3.4 | Live data ticker animation | Ensure ticker at top of page smoothly scrolls through real pipeline alerts |
| 3.5 | AIDA/bill C-27 compliance badges | "AIDA-compliant audit trails" badge on pricing and footer |

### Phase 4 — Infrastructure (Scale)
| # | Task | Detail |
|---|------|--------|
| 4.1 | CI/CD for frontend | GitHub Actions → build → push image → rollout restart K8s pod |
| 4.2 | CDN for static assets | Serve portal static files from maplespike.lan (Caddy) instead of port 3000 Python server |
| 4.3 | Database provisioning | Run engine schema migrations on Postgres (currently seed-data only) |
| 4.4 | Sweep scheduler CronJob | Deploy engine sweep as K8s CronJob for regular ingestion |
| 4.5 | Rate limiting in Caddy | Per-IP rate limiting at reverse proxy level for API calls |
| 4.6 | Monitoring | Prometheus metrics from API server, Grafana dashboard for usage |

---

## 5. Design System State — What CSS Already Has vs HTML Lacks

### ✅ CSS already supports

| Feature | Status | Implementation |
|---------|--------|----------------|
| Base16/Base24 tokens | Complete | 16 base + 8 extended, semantic aliases |
| Dark/light theme | Complete | `:root` (dark) + `[data-theme="light"]` with WCAG AA colors |
| Glass effects | Complete | `.glass`, `.glass-card` with backdrop-filter blur |
| Shimmer button | Complete | `.btn-primary::before` gradient sweep on hover |
| Scroll animations | Complete | `@keyframes fadeInUp`, `fadeIn`, `countUp`, `.stagger-1` through `.stagger-8` |
| Typography | Complete | Inter + JetBrains Mono, h1-h4 sizes, letter-spacing, line-height |
| Badges | Complete | `.badge-red`, `.badge-cyan`, `.badge-green`, `.badge-violet`, `.badge-api` |
| Responsive nav | Complete | Media query at 768px, `.nav-links` column layout |
| Theme toggle button | Complete | `.theme-toggle` styled, ready to wire |
| Mobile nav overlay | Complete | `.nav-mobile-overlay` with open/close states |
| Hover lift | Complete | `transform: translateY(-2px)` on cards and buttons |
| Hero gradient | Complete | `--gradient-hero` radial glow |
| Pricing toggle | Complete | Annual/monthly toggle CSS exists |
| Cards | Complete | `.glass-card` with hover effects, `bento-card` classes, `featured`, `highlight` |

### ❌ HTML doesn't yet leverage

| Gap | Impact | Fix |
|-----|--------|-----|
| `data-theme` not set on `<html>` | Dark/light toggle won't persist on reload | Add `data-theme="dark"` to all HTML files' `<html>` tags |
| No theme toggle button in nav | Users can't switch to light mode | Add `<button class="theme-toggle">...</button>` to each nav |
| No mobile hamburger toggle in nav | Mobile users can't access nav | Add hamburger button + overlay div |
| No `data-animate` attributes | Scroll animations don't fire | Add `data-animate="fade-in-up"` to hero, features, pricing, etc. |
| Stats are static HTML numbers | Counter animation can't trigger | Add `data-count="54"` etc. to stat elements |
| No `id="features"` etc. on sections | Anchor links scroll to wrong offset | Add semantic `id` attributes matching CSS selectors |
| Logo references `https://maplespike.ca/` | Broken image on LAN | Change to relative path `assets/maplespike_logo_v2_00002_.png` |
| Pricing has no annual/monthly toggle wiring | Toggle CSS exists but no JS | Add simple show/hide toggle for pricing values |

---

## 6. Decision Landscape — Open Questions

| Question | Options | Recommendation |
|----------|---------|----------------|
| Which frontend is the "real" one? | maplespike.lan (Next.js dashboard) vs portal (static HTML landing) | **Both** — portal is marketing, maplespike.lan is the product. Keep them distinct. |
| Should portal assets be served through Caddy? | Port 3000 Python vs Caddy reverse proxy | **Yes** — serve `maplespike.lan` → Next.js (existing), add `maplespike.lan/marketing` → portal static files |
| Accounts before visual polish? | Missing both | **Visual polish first** (can be done solo, no infra changes) then accounts (requires database/backend) |
| What's "broken" on landing page? | Logo URL, missing theme/hamburger wiring, no scroll animations | Ask user what specifically looks wrong — could be one thing |

---

## 7. Recommended Next Action (Right Now)

From the pattern across all articles and the existing CSS state: the landing page is 80% designed, 30% wired. The fastest path to a visible improvement is **Phase 0** — wire what's already built:

1. Fix logo URLs (relative paths)
2. Wire dark mode toggle button into all 4 HTML pages
3. Wire mobile hamburger menu into nav
4. Add `data-animate` attributes to sections
5. Add `data-count` to stat numbers for counter animation
6. Set `data-theme` on all `<html>` tags
7. Add `id` attributes to sections for nav anchor linking

This is pure HTML edits — no backend, no database, no accounts — and makes the site immediately look complete and polished. CSS already handles everything else.
