---
last-reviewed: 2026-05-17
status: active
---

### Context-First Rule (ALL agents — Kelos, kagent, Hermes)

Before ANY implementation or review step, verify reality — DO NOT assume the system state matches your training data.

**For Kelos (OpenCode) agents:**
1. Verify the AI Inference Gateway is reachable: `curl -s http://ai-inference-gateway.ai-inference.svc.cluster.local:8080/v1/models`
2. Verify the model in `/workspace/repo/opencode.json` is a valid model name (not `"auto"`) and matches a gateway-served model
3. Check if the issue body contains `## Previous Attempt Feedback` — if so, READ IT and fix the exact problems listed
4. Check if this issue depends on `#302` (entity resolution) or `#268` (AI Ask) — note dependencies in the PR body
5. Verify MCP servers listed in `KELOS_MCP_SERVERS` are reachable before calling them

**For kagent agents (pr-reviewer, gateway-mitigator):**
1. Verify the gateway is healthy before starting work
2. Verify MCP server dependencies are reachable
3. If the source issue body contains `## Previous Attempt Feedback`, read it before acting

**For all agents:** If any verification step fails, STOP and report the failure. Do not proceed with broken assumptions. A failed verification reported in the PR body is better than a broken PR that wastes the review cycle.

---


# AGENTS.md — MapleSpike
# Kelos test - 2026-05-18 - pipeline verified

> **Mission**: Build the Library of Alexandria for Canadian public data — 150+ modules covering every federal, provincial, territorial, and municipal source.
> **Current metrics**: [docs/metrics.json](./docs/metrics.json) — 65 modules, 24 MCP tools, ~115K lines TS, 10 packages.

Quick reference for agents working in this repo. Don't guess — check here first.

