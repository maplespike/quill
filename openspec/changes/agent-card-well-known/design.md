## Context

The portal is a static Astro build served by `packages/portal/server.py`. It has no rewrite layer, so one file is served at one path. The generator writes the agent card once and the check asserts what it wrote.

## Decision

Write the same JSON object to two paths instead of adding a redirect.

- `public/agent-card.json` — the published path, linked from `_meta.agentCard` and from `llms.txt`.
- `public/.well-known/agent-card.json` — the RFC 8615 path A2A clients look for.

Both come from one object in the generator, so they cannot differ. A redirect would need a server rule in `server.py`, which the static Pages deployment does not share.

## Alternatives

- **Redirect from `server.py`.** Rejected: the Cloudflare Pages path serves the same `dist/` without Python, so the redirect would not exist there.
- **Move the card to the well-known path and drop the root copy.** Rejected: the root path is published and linked. Breaking it to fix a second path trades one 404 for another.

## Risks

A second copy can drift if someone edits one file by hand. The check reads both and compares them, which turns drift into a failure.
