---
last-reviewed: 2026-05-19
status: active

# Contributing to MapleSpike

## Workflow
Every change follows: **Issue → Branch/Worktree → PR → Merge → Close Issue**

1. **Issues**: Every change needs a GitHub issue. No issue = no code.
2. **Worktrees**: Use `git worktree add` on the cluster node closest to your workload.
3. **Branch naming**: `issue-NNN-short-description`
4. **Commit messages**: `type: description (#NNN)` — conventional commits with issue ref.
5. **PR**: Push branch → create PR with `Closes #NNN`. All changes through PRs.
6. **Merge**: Squash merge preferred. Keep history clean.

## Development Environment

### Node Selection
| Workload | Node | Reason |
|----------|------|--------|
| AI/GPU work | Sentry or Nexus | GPU access |
| Data ingestion | Nexus | 46GB RAM |
| Infrastructure | Zephyr | Control plane |
| Light work | Any | |

### SSH Workaround
Remote nodes have fish/devenv startup noise. Use:
```bash
ssh nexus 'bash --norc --noprofile -c "your command here"'
```

## Code Standards

### TypeScript
- Strict mode, ES2022 target
- No `as any`, `@ts-ignore`, or `@ts-expect-error`
- SHA-256 citation hashing for data sources
- Trust scoring ≥60% threshold

### Conventional Commits
```
feat:     New feature or data module
fix:      Bug fix
chore:    Maintenance, tooling, config
refactor: Code change with no behavior change
docs:     Documentation only
test:     Test additions or changes
ci:       CI/CD changes
```

## Commit Signing
All commits should be signed (GPG or SSH). CI will warn on unsigned commits.
```bash
git config commit.gpgsign true
git config user.signingkey <key-id>
```

## PR Checklist
- [ ] Single issue per PR
- [ ] Work in a worktree on the right node
- [ ] `pnpm build` passes
- [ ] `pnpm test` passes
- [ ] Commit messages reference `(#NNN)`
- [ ] PR body contains `Closes #NNN`
- [ ] ROADMAP.md updated if scope changed
- [ ] CHANGELOG.md entry added (if user-facing)
- [ ] Worktree cleaned up after merge: `git worktree remove /data/projects/own/maplespike-NNN`
- [ ] Remote nodes synced: `git fetch origin && git reset --hard origin/main`

## Repository Settings (GitHub)
Branch protection rules are configured for `main`:
- Require pull request before merging
- Require status checks (CI must pass)
- Require up-to-date branches
- Require signed commits (recommended)
