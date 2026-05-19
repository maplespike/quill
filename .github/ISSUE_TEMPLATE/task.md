---
name: Agent task
description: Well-scoped task for autonomous agent execution via Kelos
title: ''
labels: agent-ready
assignees: ''
---

## Task
One-line summary.

## Context
Why is this needed? What's the background?

## Scope
What files/directories are in scope? What is out of scope?

## Required changes
List the specific changes needed, concretely enough for autonomous execution.

## Clean long-term solution mandate

Agents **must** implement the cleanest long-term fix, not a workaround:

- **Fix root causes, not symptoms** — If a problem exists, fix it properly
- **Nix-native** — All deployment config in Nix. No raw k8s YAML, no wrapper scripts by hand
- **Gateway routing** — AI traffic goes through the AI Inference Gateway, not directly to providers
- **Test coverage** — Include tests that prove the fix works
- **Zero tech debt** — No `# TODO: fix later`, no workarounds, no half-measures

## Steps
- [ ] Step 1
- [ ] Step 2
- [ ] Verification

## Acceptance Criteria
- [ ] Changes applied and working
- [ ] `pnpm build` passes
- [ ] `pnpm test` passes
- [ ] PR links back to this issue with `Closes #NNN`
- [ ] AGENTS.md updated if new patterns introduced

## Workflow
- [ ] Single PR per task
- [ ] Work in worktree (`git worktree add -b issue-NNN-desc /data/projects/own/maplespike-NNN main`)
- [ ] Branch: `issue-NNN-short-description`
- [ ] Commit messages reference `(#NNN)`
- [ ] PR body contains `Closes #NNN`
- [ ] PR reviewed before merge (even solo)

## Reference
- Related issue: #
- ROADMAP.md section:
