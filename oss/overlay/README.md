# Quill API

Quill is the API and the MCP server for Canadian public data. This repository is the public source for those servers. It is a fresh export. The private repository stays the source of truth.

## Licences

The servers are AGPL-3.0-only. That covers `packages/api-server`, `packages/quill-mcp`, `packages/pipeline-core`, `packages/database`, and `packages/engine`.

Packages under `packages/sdk-*` are Apache-2.0. Their `LICENSE` file is the Apache text.

Read `LICENSE`, `LICENSE.md`, and `NOTICE` before you reuse data or code. Data you ingest keeps the licence of its publisher.

## Self-host

You need Docker, or Node.js 22 and pnpm 10.32.1.

1. Copy `.env.example` to `.env`.
2. Set `JWT_SECRET` to a long random value.
3. Leave the Stripe variables unset. Unset Stripe variables turn billing off.
4. Leave the AI variables unset. Unset AI variables turn AI off.
5. Leave the x402 variables unset. Unset x402 variables turn crypto payments off.
6. Run:

```bash
docker compose -f docker-compose.oss.yml up --build
```

The API listens on port 8082. The MCP server listens on port 3001. Redis is included.

Postgres is optional:

```bash
docker compose -f docker-compose.oss.yml --profile postgres up --build
```

Set `QUILL_STORAGE=postgres` and `DATABASE_URL` when you use that profile.

Published images:

- `ghcr.io/maplespike/quill-api`
- `ghcr.io/maplespike/quill-mcp`

Each service also has a `build` block. `docker compose up --build` builds from this tree.

## Fixtures

`GET /v1/fixtures` serves invented records. Every record is marked `FIXTURE`. The route is off until you set `QUILL_FIXTURES=1`. Production stays off until you set that variable.

## Ingest

An empty database answers health checks and, when you enable them, fixture routes. Build the workspace, then run the pipeline-core CLI against an open-government source you choose.

## Contributions

Read `CONTRIBUTING.md`. Issues are welcome. Pull requests are not accepted yet.
