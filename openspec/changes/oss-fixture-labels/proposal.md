# Proposal: Label API fixtures

## Why

The API mock path can call live pipeline modules. An open-source export must not ship unlabelled parliamentary or committee content as sample data. The records have to be obviously fake, and the routes have to stay off in production unless an operator turns them on.

## What Changes

- Replace the live mock path with synthetic fixture records. Each record carries `synthetic: true` and the `FIXTURE` marker.
- Serve those records from fixture routes. The routes say they serve fixtures.
- Keep the routes off unless `QUILL_FIXTURES=1`, including when `NODE_ENV=production`.
- Add a test that asserts the labels, the gate, and the absence of live-module calls.

## Capabilities

### New Capabilities

- `synthetic-fixtures`: labelled fake records and a production-off fixture route.

### Modified Capabilities

- None.

## Impact

- Packages: `@maplespike/api-server` only.
- API: new `GET /v1/fixtures` and `GET /v1/fixtures/:id`. Both answer 404 until `QUILL_FIXTURES=1`.
- No new dependencies. No MCP contract change.
