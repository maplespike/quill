---
# Sisyphus Workflow — Repository Contract
# Version-controlled agent policy for MapleSpike.
tracker:
  kind: github
  active_labels: []
  exclude_labels: [blocked, wontfix, duplicate]
agent:
  max_concurrent: 3
  max_turns: 10
  turn_timeout_ms: 300000
  retry_backoff_ms: 60000
hooks:
  after_create: git fetch bare main 2>/dev/null || true
proof:
  require_build: true
  require_tests: true
  require_pr: true
---
You are implementing issue **{{issue.title}}**.

## Context
{{issue.description}}
**Repository:** `/data/projects/own/maplespike`
**Bare remote:** bare
**Worktree:** `{{workspace.path}}`
**Branch:** `{{workspace.branch}}`

## Rules

### Worktree
- Work from `{{workspace.path}}` — already created
- Branch `{{workspace.branch}}` is checked out
- Keep main repo clean — no changes there

### Implementation
1. Read existing code first — match patterns
2. Focused minimal changes — one concern per commit
3. No `as any`, `@ts-ignore`, `@ts-expect-error`
4. Keep `.js` extensions in relative imports
5. Do NOT delete placeholder dirs — build them out

### Commit Format
```
type(scope): description (#{{issue.number}})
```
Types: feat|fix|chore|docs|test|refactor

### Proof of Work
Before declaring success:
1. `cd {{workspace.path}} && pnpm build` — must pass
2. `cd {{workspace.path}} && pnpm test` — must pass (or pre-existing failures only)
3. `git add -A && git commit -m "type: description (#NNN)"`
4. `git push bare HEAD`
5. `gh pr create --base main --head {{workspace.branch}} --title "type: desc (#NNN)" --body "Closes #NNN"`
