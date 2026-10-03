---
last-reviewed: 2026-07-07
status: active
---

# MapleSpike — Developer Portal

SaaS landing page, documentation, AI agent setup guide, and live developer dashboard.
**Migrated from Next.js → Astro + React + shadcn/ui + Tailwind v4.**

**Status:** Served from K3s cluster on LAN. GitHub Pages deployment is planned for public launch.

## AI-friendly features

- **`/llms.txt`** — Compact API index for AI agent discovery (maplespike.ca/llms.txt)
- **`/llms-full.txt`** — Full documentation archive for large-context models
- **`/v1/openapi.json`** — OpenAPI 3.1 specification for code generation
- **`Accept: text/markdown`** — Returns raw Markdown for any page
- **`x-markdown-tokens`** header — Estimated token count on every response

## Local development

```bash
# Static file server (any of these work)
python3 -m http.server 4321
npx serve .
npm run dev     # if configured
```

## Environment Variables

Astro loads `import.meta.env.PUBLIC_*` at build time. The portal reads:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PUBLIC_BRAND_URL` | `https://brand.maplespike.lan` (dev) / `https://brand.maplespike.ca` (prod) | Cross-deployable link to the marketing/brand site. Pointer only — the portal does not proxy or render brand content. |
| `PUBLIC_*` | — | Any other `PUBLIC_*` var exposed to the Astro frontmatter. |

For a full env reference (API server, MCP, OAuth, etc.) see
[`../../.env.example`](../../.env.example) at the repo root.

## Deployment

The portal is a pure static site (HTML + CSS + JS). No build step required.

| Environment | Platform | Status |
|-------------|----------|--------|
| **Dev** (current) | K3s cluster (LAN) — Python http.server on port 3000 | Active |
| **Production** (current) | K3s cluster (nginx) — auto-deployed via CI/CD | Active |
| **Future** | GitHub Pages — workflow ready at `.github/workflows/deploy-portal.yml` | Planned |

**Future live deploy:** Make the repo public → enable Pages → merge to main to deploy to GitHub Pages.

## Stack

- Vanilla HTML/CSS/JS (zero framework dependencies)
- Inter + JetBrains Mono from Google Fonts
- Dark theme with Canadian red accent (#E84545)
- Fully responsive
- Dark/light theme toggle with localStorage persistence

## Source-data terms

Source-data licenses and terms vary by publisher, API, dataset, and jurisdiction. The portal displays publisher metadata when supplied, but that display is not a legal clearance or a license grant by Quill. Consult original source terms before reuse.
