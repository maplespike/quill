---
name: Agent task
description: Well-scoped task for autonomous agent execution via Kelos
title: ''
labels: agent-ready
assignees: ''
---

## Task
One-line summary.

## Context for Agent
**Issue author:** Fill this section with the context the agent needs to verify before starting work.

- **Gateway check:** Does the agent need to verify the AI Inference Gateway has the right models loaded?
- **Previous attempts:** Is there a `## Previous Attempt Feedback` section below? (The AI reviewer adds this on retry)
- **Services that must be up:** [e.g., "Gateway must be running", "Postgres must have schema migrated"]
- **What to look at first:** [files, logs, or endpoints to inspect before writing code]
- **What NOT to touch:** [files or directories that are out of scope]
- **Model to use:** `nemotron-3-nano-30b-a3b` (default for coding) / `nemotron-3-super-120b-a12b` (hard tasks)

## Background
Why is this needed? What's the business or technical reason?

## Scope
What files/directories are in scope? What is out of scope?

## Dependencies

- **Blocks on #302 (Entity Resolution)?** [yes / no] — if yes, mark body with `**Depends on:** #302`
- **Blocks on #268 (AI Ask)?** [yes / no]
- **Related issues:** #

## Cross-Reference Integration

If this is a data module, document how it feeds entity resolution (#302):
- **Person fields:** [which fields contain person names/identifiers]
- **Organization fields:** [which fields contain org names/identifiers]
- **Date fields for temporal linking:** [which fields link to time]
- **Module readiness for #302:** [ready / needs schema changes / N/A]

## Required changes
List the specific changes needed, concretely enough for autonomous execution.

## Previous Attempt Feedback

<!-- If this is a retry after AI PR review rejection, the reviewer will
     prepend structured feedback here. Kelos reads this to fix the exact
     problem. Format:

## Previous Attempt Feedback
Rule violated: [rule name]
File: [file path]
Line: [line number]
Details: [specific explanation of what's wrong]
Fix: [what the fix should look like]

-->

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
