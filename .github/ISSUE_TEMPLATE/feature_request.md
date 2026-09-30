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

## Proposed Solution
- **Data source(s):** [URLs, APIs, update frequency, dataset-specific source terms and provenance]
- **MCP tools needed:** [tool names following naming convention]
- **Packages affected:** [which packages need changes]
- **Source terms:** [Identify the publisher's dataset-specific terms; do not infer a license from public access or jurisdiction]
- **Ingestion approach:** [Fetcher, parser, DB strategy]

## Acceptance Criteria
- [ ] Ingestion pipeline fetches and parses the data
- [ ] SHA-256 citation hashing + trust scoring (≥60% threshold)
- [ ] 1+ MCP tool exposing the data
- [ ] ROADMAP.md entry updated
- [ ] docs/metrics.json updated
- [ ] Unit tests with ≥80% coverage

## Workflow
- [ ] Single PR per feature
- [ ] Work in worktree on appropriate cluster node
- [ ] Branch: `issue-NNN-short-description`
- [ ] Commit messages reference `(#NNN)`
- [ ] PR body contains `Closes #NNN`

## Node Assignment
**Develop on:** [zephyr / nexus / forge / sentry]
- AI/GPU: Sentry or Nexus
- Data ingestion: Nexus (46GB)
- Infrastructure: Zephyr
- Light work: any node

## Priority
[P1 / P2 / P3]

## Estimate
[Optional: e.g., 2h, 1d, 3d]

## Reference
- Related issue: #
- AGENTS.md section:
