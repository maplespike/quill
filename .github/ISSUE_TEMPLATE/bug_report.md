---
name: Bug report
about: Something isn't working
title: ''
labels: bug
assignees: ''
---

## Describe the Bug
Clear and concise description.

## To Reproduce
Steps to reproduce.

## Expected vs Actual
What should happen vs what actually happens.

## Root-cause analysis (for agents)

Before implementing a fix, identify whether this is:
- **Nix-native issue** → revert any raw k8s YAML changes and express through Nix (flake.nix, nix/ modules)
- **Gateway routing issue** → fix the gateway's transformation layer, not the routing (don't bypass the AI Inference Gateway)
- **Data pipeline issue** → fix ingestion, verification, or storage in the pipeline
- **MCP tool issue** → fix the tool implementation in the affected package

## Clean long-term solution mandate

Agents implementing fixes **must**:
- Fix root causes, not apply workarounds
- Express all deployment config through Nix (no raw k8s YAML)
- Route AI traffic through the AI Inference Gateway (not directly to NIM/providers)
- Include tests that prevent regression
- Leave zero TODOs or half-measures

## Environment
- **Package:** [pipeline-core / mcp-server / api-server / portal / engine / sdk / other]
- **Working node:** [zephyr / nexus / forge / sentry]
- **Worktree path:** `/data/projects/own/maplespike-<NNN>`
- **Branch:** `issue-NNN-short-description`
- **Commit:** `git log -1 --oneline`
- **Node version:** `node --version`

## Logs / Screenshots
```
Paste relevant output
```

## Workflow Check
- [ ] Issue created before any code was written
- [ ] Work in a worktree (`git worktree add`)
- [ ] Branch name follows `issue-NNN-short-description`
- [ ] PR will be created before merge

## Additional Context
- Is this a regression?
- Link to related issue: #
