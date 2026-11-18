## Why

A2A clients discover an agent at `/.well-known/agent-card.json`. The portal serves the agent card at the site root only, so a client that follows the well-known convention gets a 404. Measured 2026-11-10: `https://quill.maplespike.ca/.well-known/agent-card.json` returns 404 and `/agent-card.json` returns 200.

## What Changes

- Write a byte-identical copy of the agent card to `public/.well-known/agent-card.json`.
- Require that path in `check-agent-discovery.mjs`, so a build that drops it fails the check.

## Capabilities

### Modified Capabilities

- `agent-discovery`: the agent card is discoverable at the RFC 8615 well-known path as well as at the site root.

## Impact

One write in the generator, one entry in the check, one delta spec. No transport, version, count, or content change. The root `agent-card.json` stays where it is, because it is already published and linked from `_meta.agentCard` in the server card.
