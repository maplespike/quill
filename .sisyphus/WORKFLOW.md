---
# Sisyphus Workflow — Repository Contract
# This file defines how agents operate in this repository.
# Version: 1
tracker:
  kind: github
  active_labels: []
  exclude_labels: [blocked, wontfix, duplicate]
  priority_sort: [p1, p2, p3]
agent:
  max_concurrent: 3
  max_turns: 10
  turn_timeout_ms: 300000
  retry_backoff_ms: 60000
workspace:
  root: /tmp/maplespike-worktrees
hooks:
  after_create: |
    git fetch bare main 2>/dev/null || true
  before_run: |
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install
proof:
  require_build: true
  require_tests: true
  require_pr: true
---

# Sisyphus Workflow Template

You are implementing issue **{{issue.title}}**.

## Context
{{issue.description}}

**Repository:** `/data/projects/own/maplespike`
**Bare remote:** `file:///srv/git/maplespike.git`
**Worktree:** `{{workspace.path}}`
**Branch:** `{{workspace.branch}}`

## Rules

### Worktree Management
- Worktree is at `{{workspace.path}}` — already created
- Work from inside it: `cd {{workspace.path}}`
- Branch `{{workspace.branch}}` is already checked out
- Keep the main repo (`/data/projects/own/maplespike`) clean — don't stage/commit there

### Implementation
1. Read relevant files to understand current state
2. Make focused, minimal changes — one concern per commit
3. Match existing code patterns in the codebase (see AGENTS.md)
4. Do NOT use `as any`, `@ts-ignore`, or `@ts-expect-error`
5. Do NOT delete existing stubs or placeholder directories — build them out
6. Do NOT add new dependencies unless absolutely necessary

### Commit Convention
```
type(scope): description (#NNN)

- type: feat|fix|chore|docs|test|refactor
- scope: package name or module
- #NNN: issue number
```

### Proof of Work
Before declaring success, you MUST run these verification steps:

1. **Build**: `cd {{workspace.path}} && pnpm build`
   - All packages must compile cleanly
   - If a single package has errors, fix them before proceeding
2. **Test**: `cd {{workspace.path}} && pnpm test`
   - All tests must pass (or only pre-existing failures — check by running `git stash && pnpm test` first, then restoring changes)
3. **Commit and push**:
   ```
   cd {{workspace.path}}
   SKIP=trim-trailing-whitespace git add -A
   SKIP=trim-trailing-whitespace git commit -m "type(scope): description (#{{issue.number}})"
   git push bare HEAD
   ```
4. **Create PR**:
   ```
   gh pr create \
     --base main \
     --head {{workspace.branch}} \
     --title "type(scope): description (#{{issue.number}})" \
     --body "Closes #{{issue.number}}"
   ```

### Continuation (if this is turn > 1)
This is not the first attempt. Previous turn {{turn.attempt}} ended with:
- PR: {{turn.pr_url}}
- CI status: {{turn.ci_status}}
- Remaining issues: {{turn.remaining_issues}}

Focus on addressing the remaining issues. Do NOT redo work that's already done.

## Completion Report
When done, report:
- Commit SHA: `{{workspace.commit_sha}}`
- Build: ✅/❌
- Tests: ✅/❌ (N/M passing, F failing)
- PR URL: `{{workspace.pr_url}}`
