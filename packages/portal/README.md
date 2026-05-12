# CivInt Canada — Developer Portal

SaaS landing page, documentation, AI agent setup guide, and developer dashboard for the CivInt Canada API.

**Live on cluster.** Pure static site — no build step required.

---

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Landing page | `index.html` | Hero, features, pricing with monthly/annual toggle, API explorer |
| Documentation | `docs.html` | Quickstart, MCP setup, API reference, pricing table, FAQ |
| AI Agents | `agents.html` | MCP tool reference, agent setup (Claude, Cursor, Windsurf, Continue), example prompts |
| Dashboard | `dashboard.html` | API key management, usage stats, activity log |

## AI-friendly features

- **`/llms.txt`** — Compact API index for AI agent discovery (civint.ca/llms.txt)
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

- **K3s cluster** — Serve via Caddy from a simple pod
- **GitHub Pages** — `git push` and enable Pages
- **Any static host**

## Stack

- Vanilla HTML/CSS/JS (zero framework dependencies)
- Inter + JetBrains Mono from Google Fonts
- Dark theme with Canadian red accent (#E84545)
- Fully responsive
- Dark/light theme toggle with localStorage persistence

## OGL-C Attribution

Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
