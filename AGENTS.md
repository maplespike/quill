---
last-reviewed: 2026-05-19
status: active
---

# MapleSpike — Canada's Sovereign Data Layer

**Mission**: Build the Library of Alexandria for Canadian public data — 150+ modules covering every federal, provincial, territorial, and municipal source.
**Current metrics**: [docs/metrics.json](./docs/metrics.json) — 65 modules, 50 MCP tools, ~123K lines TS, 12 packages.

> **Your job**: Implement the GitHub issue that spawned you. Read the issue body, make the changes, push the branch, and open a PR against `main`. **Do NOT stop until you have created a pull request.** If you hit an error, try a different approach. The task is not complete until a PR exists.

---

## Quick reference

### Before implementing

1. **Read the issue body thoroughly** — it contains the exact requirements, acceptance criteria, and file paths
2. **Check for `## Previous Attempt Feedback`** — if present, fix the exact problems listed before adding anything new
3. **If the issue depends on #302 (entity resolution) or #268 (AI Ask)**, note the dependency in the PR body

### Gateway verification

The AI Inference Gateway is at `http://ai-inference-gateway.ai-inference.svc.cluster.local:8080/v1`. If you need to check it:

- Use **webfetch** tool (not bash) to call `http://ai-inference-gateway.ai-inference.svc.cluster.local:8080/v1/models`
- The model configured in `/workspace/repo/opencode.json` is valid and served by the gateway
- The workspace setup already configured `opencode.json` with the correct model and provider

### Finding relevant skills

Before implementing, call **`find_skills`** via the `skills-mcp` MCP server with your issue title or keywords to find relevant Hermes Agent skills that may contain patterns, pitfalls, and best practices for your task. Example:
- `find_skills(query: "ingestion module")` — find ingestion-related skills
- `find_skills(query: "entity resolution")` — find entity resolution guidance
- `get_skill(name: "opencode-agent-early-stop")` — read full skill content

To use: call the MCP tool with your query. Skills are indexed from the Hermes Agent skill library.

### Critical: bash tool requires `description`

Every `bash` call **must** include a `description` parameter describing what the command does. Without it, bash calls fail with `SchemaError`.

Examples:
- ✅ `bash(command: "find . -name '*.ts'", description: "List TypeScript files")`
- ❌ `bash(command: "find . -name '*.ts'")` — will fail

If you forget `description` and get a SchemaError, retry the same command WITH a description. Do not move on without retrying.

### Important

- The workspace at `/workspace/repo` is writable — work directly there
- Branch: `kelos-task-{{.Number}}` (replaced automatically)
- Every commit message must reference the issue number
- PR body must include `Closes #<issue-number>`
- If verification fails, report it and STOP. Do not proceed with broken assumptions.

---

## Hallucinating Agent Detection

Known signatures of agent hallucination:
- "Ops Manager Reports" header or "Boss — sprint-to-live" completions
- Non-standard labels (`p0`, `kelos-ready`)
- Fabricated PR numbers that 404
- Stripped standard labels from legitimate issues

If you detect these, restore the original content and close the issue as `not_planned`.
