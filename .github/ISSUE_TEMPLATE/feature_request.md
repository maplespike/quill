---
name: Feature / Module Request
about: Suggest a new feature or data module
title: ''
labels: enhancement
assignees: ''
---

## Context
What area does this affect?
[e.g., New data module, MCP tool, API endpoint, Portal feature]

## Problem / Opportunity
Why is this needed? What user or agent need does it address?
*Reference AGENTS.md mission: Building Library of Alexandria for Canadian public data*

## Proposed Solution
- **Data source(s):** [URLs, APIs, update frequency, license verification]
- **MCP tools needed:** [tool names following naming convention]
- **Packages affected:** [which packages need changes]
- **License:** [Verify OGL-C or compatible - required for federal data]
- **Ingestion approach:** [Fetcher, parser, DB strategy]

## Acceptance Criteria
- [ ] Ingestion pipeline fetches and parses the data
- [ ] SHA-256 citation hashing + trust scoring (≥60% threshold)
- [ ] 1+ MCP tool exposing the data (in packages/mcp-server/src/tools/)
- [ ] AIDA-compliant audit trail (algorithmic impact assessment + bias testing hooks)
- [ ] ROADMAP.md entry updated (🟡 PARTIAL or ✅ DONE)
- [ ] docs/metrics.json updated
- [ ] Unit tests with ≥80% coverage
- [ ] Follows Canadian-first principle (K3s/NixOS compatible)

## Priority
[P1 / P2 / P3]
*P1: Blocks core mission, Tier 1 gaps, security, or blocking bugs*
*P2: Important enhancements, documentation, cleanup*
*P3: Nice-to-have, low priority*

## Estimate
[Optional: e.g., 2h, 1d, 3d, 1w]

## Reference
- AGENTS.md Tier: [e.g., Tier 1: Immigration, Tier 2: Health deep]
- Related issue: #
- Following Sovereign Agent workflow: Discover → Validate → Log → Propose → GitHub Issue