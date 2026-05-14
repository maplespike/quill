---
last-reviewed: 2026-05-14
status: active
---

# MapleSpike — Developer Portal

SaaS landing page, documentation, AI agent setup guide, and developer dashboard placeholder for the MapleSpike API.

**Status:** Local dev (stealth) — served from K3s cluster on LAN. Will deploy to GitHub Pages when public.

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

## Deployment

The portal is a pure static site (HTML + CSS + JS). No build step required.

| Environment | Platform | Status |
|-------------|----------|--------|
| **Dev** (current) | K3s cluster (LAN) — Python http.server on port 3000 | Active |
| **Production** (future) | GitHub Pages — workflow ready at `.github/workflows/deploy-portal.yml` | Ready to flip |

**To go live:** Make the repo public → enable Pages → merge to main. The workflow file is already in place and will deploy `packages/portal/` to GitHub Pages automatically.

## Stack

- Vanilla HTML/CSS/JS (zero framework dependencies)
- Inter + JetBrains Mono from Google Fonts
- Dark theme with Canadian red accent (#E84545)
- Fully responsive
- Dark/light theme toggle with localStorage persistence

## OGL-C Attribution

Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
