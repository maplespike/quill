---
last-reviewed: 2026-10-14
status: active
---

# Hermes / Local Agent Runtime Integration

> Part of the Quill ecosystem enablement workstream (WS-5 of
> [`docs/ECOSYSTEM-EXECUTION-PLAN.md`](../ECOSYSTEM-EXECUTION-PLAN.md)). This
> document shows how to connect Quill to local agent runtimes (Hermes,
> OpenClaw, Claude Desktop, Cursor) and publish/import the Quill skills.

## 1. Connect the MCP server

### Local (stdio — checkout build, no API key)

```json
{
  "mcpServers": {
    "quill": {
      "command": "node",
      "args": ["/absolute/path/to/quill/packages/quill-mcp/dist/cli.js"]
    }
  }
}
```

`@maplespike/quill-mcp` is not published on npm. `npx` cannot install it.
Build the repo first (`pnpm --filter @maplespike/quill-mcp... build`).
Use `dist/cli.js`. `dist/index.js` starts the HTTP/SSE server.

Stdio calls are tagged `self-hosted` and are **not** counted against the
1,000-call free quota — you run the server, so the data is yours.

### Hosted (SSE — requires an API key from https://quill.maplespike.ca)

```json
{
  "mcpServers": {
    "quill": {
      "type": "sse",
      "url": "https://mcp.maplespike.ca/sse",
      "headers": { "Authorization": "Bearer <your-api-key>" }
    }
  }
}
```

## 2. Hermes profile

Hermes profiles are distributable agent bundles (SOUL.md + config.yaml + MCP
connections). A ready-to-import profile lives at
[`examples/hermes-quill-profile/`](../../packages/quill-mcp/examples/hermes-quill-profile/).
To use it:

```bash
# Copy the profile into your Hermes profiles directory
cp -r packages/quill-mcp/examples/hermes-quill-profile ~/.hermes/profiles/quill-civic
# Enable it
hermes profile enable quill-civic
```

The profile wires the Quill MCP server (stdio, `node dist/cli.js`), declares the two skills
(`quill-influence-mapping`, `quill-provenance-briefing`), and sets a SOUL.md
that instructs the agent to always surface claim hashes.

## 3. Install the skills

The repo ships two agent skills (SKILL.md standard):

| Skill | Path | Purpose |
|-------|------|---------|
| Influence mapping | `.agents/skills/quill-influence-mapping/` | Map a lobbyist/politician influence trail with verified hashes |
| Provenance briefing | `.agents/skills/quill-provenance-briefing/` | Regulation/bill briefings with per-claim verification |

To install into a Hermes runtime:

```bash
cp -r .agents/skills/quill-influence-mapping ~/.hermes/skills/
cp -r .agents/skills/quill-provenance-briefing ~/.hermes/skills/
```

Or point Hermes at the repo via `external_dirs` in `config.yaml`:

```yaml
skills:
  external_dirs:
    - /path/to/quill/.agents/skills
```

## 4. OpenClaw / other runtimes

OpenClaw and most MCP-native runtimes accept the same stdio/SSE declarations
above. For the skills, copy the directories into your runtime's skill path
(`~/.agents/skills/` works for tools honoring that convention) or use your
runtime's equivalent of `external_dirs`.

## 5. Agent-native surfaces you get for free

The Quill server (since the WS-3 milestone) advertises **resources** and
**prompts** in addition to 167 tools:

- **Resources**: `quill://tool-index`, `quill://entities/{name}`,
  `quill://citations/{hash}`, `quill://crossref/{name}` — agents can read
  entity subgraphs and claim bundles without hard-coding tool names.
- **Prompts**: `influence-map`, `provenance-brief`, `narrative-shift` —
  multi-step workflows your agent can invoke directly.

## 6. Tips

- Always prefer `resolve_entity` over guessing names — aliases matter.
- Every cross-reference response carries a `claims` array; surface `sha256`
  hashes to the user so the trail is verifiable.
- `verify_claim` and `system_health` are free even after the quota.
