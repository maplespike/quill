# Quill public site

Ink-and-paper portal for [quill.maplespike.ca](https://quill.maplespike.ca).

This directory is not part of the pnpm workspace. Install and run it on its own:

```bash
cd site
npm install
npm run dev
```

The dev server listens on port 8080.

`packages/portal` is still the portal that ships today. This tree is the replacement candidate: landing, coverage, MCP, explorer, agents, ask, API explorer, pricing, docs, dashboard, blog, and the rest of the public routes.

Signup, contact, watches, notes, and preview keys stay in the browser. They are not sent to the cluster. Live answers, crawls, and Stripe checkout stay on the gateway.
