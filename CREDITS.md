# Credits & Attribution

This file records the technologies, repositories, and people behind Quill
(MapleSpike). License information was verified by **fetching each project's
LICENSE file directly** from its repository — not from the GitHub API metadata
field, which is unreliable (it returns `None`/`NOASSERTION` for many licensed
projects).

Verification date: 2026-08-21.

## Underlying technologies

Quill consumes these as libraries, runtimes, or separately-run services. No
code is vendored; all use is within the terms of their respective licenses.

| Project | License | Version/date | Purpose |
|---------|---------|--------------|---------|
| [TypeScript](https://github.com/microsoft/TypeScript) | Apache-2.0 | ^6.0.3 | Primary language |
| [Node.js](https://github.com/nodejs/node) | MIT | ≥18 (CI: 22) | Runtime |
| [pnpm](https://github.com/pnpm/pnpm) | MIT | 10.32.1 | Package manager |
| [Turbo](https://github.com/vercel/turbo) | MIT | ^2.10.5 | Build orchestrator |
| [Astro](https://github.com/withastro/astro) | MIT | ^7.0.9 | Portal framework |
| [React](https://github.com/facebook/react) | MIT | 19.2.7 | Portal UI |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | MIT | 4.x | Portal styling |
| [Hono](https://github.com/honojs/hono) | MIT | ^4.6.0 | API server framework |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | MIT | ^12.11.1 | SQLite storage |
| [Drizzle ORM](https://github.com/drizzle-team/drizzle-orm) | Apache-2.0 | ^0.45.2 | ORM |
| [Stripe Node](https://github.com/stripe/stripe-node) | MIT | current | Billing |
| [viem](https://github.com/wevm/viem) | MIT | ^2.48.11 | EVM wallet auth |
| [tweetnacl](https://github.com/dchest/tweetnacl-js) | Unlicense (public domain) | ^1.0.3 | Solana signature verify |
| [jose](https://github.com/panva/jose) | MIT | ^5.x | JWT |
| [pino](https://github.com/pinojs/pino) | MIT | ^10.x | Structured logging |
| [Qdrant](https://github.com/qdrant/qdrant) | Apache-2.0 | current | Vector search (RAG) |
| [K3s](https://github.com/k3s-io/k3s) | Apache-2.0 | v1.36.1 | Kubernetes distro |
| [NixOS / nixpkgs](https://github.com/NixOS/nixpkgs) | MIT (nixpkgs COPYING) | 26.11 | Deployment OS |
| [cloudflared](https://github.com/cloudflare/cloudflared) | Apache-2.0 | 2026.7.1 | Tunnel |
| [OpenSpec](https://github.com/Fission-AI/OpenSpec) | MIT | 1.5.0 | Spec-driven workflow |

> Drizzle-orm license note: verified by fetching
> `drizzle-team/drizzle-orm/LICENSE` (Apache-2.0).

## Pattern-inspiration repositories

These projects shaped the architecture or product direction. Ideas and
patterns only — no code copied.

| Repository | License | Relationship |
|------------|---------|--------------|
| [reverb256/mcp-canada](https://github.com/reverb256/mcp-canada) | MIT (verified) | Precursor to MapleSpike — Canadian government MCP tools |
| [reverb256/Frostbite-Gazette](https://github.com/reverb256/Frostbite-Gazette) | No LICENSE file (all rights reserved; private repo) | AI-curated Canadian political journalism — first-class consumer of Quill's data; referenced for integration, no code vendored |
| [reverb256/ai-inference-gateway](https://github.com/reverb256/ai-inference-gateway) | MIT (verified) | AI gateway, model routing, RAG |
| [reverb256/astral-key](https://github.com/reverb256/astral-key) | MIT (verified) | Rust Web3/FIDO2/passkey auth microservice |

## Research & design credit

- **Research agents** — portions of the architecture, gap analysis, and
  roadmap were produced with the assistance of autonomous research agents
  (Hermes Agent / Nous Research). See [docs/VISION.md](./docs/VISION.md) for
  the attribution and license table for those contributions.
- **AI-assisted development** — substantial implementation assistance from
  Hermes Agent and related AI coding tools.

## Product vision

- **Product vision owner:** reverb256 (MapleSpike)

## License

Quill (MapleSpike) itself is licensed under:

- **AGPL-3.0** — `packages/pipeline-core` (core library)
- **MIT** — all other packages (quill-mcp, engine, portal, api-server, sdk, …)

Government data retains its original license (primarily
[Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada)).
See [LICENSE](./LICENSE) and [docs/licensing-audit.md](./docs/licensing-audit.md).
