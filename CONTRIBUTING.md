# Contributing to MapleSpike

## Workflow
Every change follows: **Issue → Branch/Worktree → PR → Merge → Close Issue**

1. **Issues**: Every change needs a GitHub issue. No issue = no code.
2. **Worktrees**: Use `git worktree add` on the cluster node closest to your workload.
3. **Branch naming**: `issue-NNN-short-description`
4. **Commit messages**: `type: description (#NNN)` — conventional commits with issue ref.
5. **PR**: Push branch → create PR with `Closes #NNN`. All changes through PRs.
6. **Merge**: Squash merge to `main` for most changes. `prod` is reserved for production releases via changeset publish workflow.
7. **Cleanup**: Remove worktree after merge: `git worktree remove /data/projects/own/maplespike-NNN`

> **Branch Protection**: `main` is protected requiring PRs + CI. `prod` is production-only (changesets publish to `prod` then merge to `main`). Pre-commit hooks warn on commits to `prod`.

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

## Beta Testing (current phase)

Quill is in **active development / beta**. We welcome testers.

### Getting a dev key
The free tier (35 calls/day, 1,000/month) is available to everyone via
[quill.maplespike.ca/signup](https://quill.maplespike.ca/signup). For higher
limits during testing, contact the maintainers for a dev key (internal tier).

### Running locally
```bash
# Clone
git clone git@github.com:maplespike/quill.git
cd quill
pnpm install

# Build
pnpm --filter @maplespike/api-server build
pnpm --filter @maplespike/quill-mcp build
pnpm --filter @maplespike/portal build

# Run tests
pnpm --filter @maplespike/api-server test:unit   # 606 tests
pnpm --filter @maplespike/quill-mcp test:unit    # 894 tests
pnpm --filter @maplespike/portal test            # 112 tests
```

### What to test
- **API endpoints**: hit `/v1/health`, `/v1/gov/releases`, `/v1/usage` with your key.
- **MCP tools**: connect via `https://mcp.maplespike.ca/mcp` (streamable-http) or run locally with `node packages/quill-mcp/dist/cli.js`.
- **Portal**: check the dark/light mode toggle, data explorer, citation verification.
- **Report issues**: [GitHub Issues](https://github.com/maplespike/quill/issues) or beta@maplespike.ca.

### Canada & open source
Quill is built in Canada, for Canada. We welcome contributions from Canadian
developers, researchers, journalists, and civic technologists. Source terms vary
by publisher; see `docs/licensing-audit.md` and `data-source-licenses.json`.

## Local Setup

### Activate Git Hooks

This repo ships with git hooks in `.githooks/`:

- `prepare-commit-msg` — warns if a commit message lacks an issue reference (`#NNN`)
- `pre-commit` — blocks direct commits to the `prod` branch

Activate them once per clone (the setting is per-clone local config, not
committed to the repo):

```bash
git config --local core.hooksPath .githooks
```

> **Note for new contributors:** `.git/config` is per-clone, not tracked in git.
> Each fresh clone requires re-activation. Worktrees share `.git/` with the
> parent checkout, so they automatically inherit the parent clone's
> `core.hooksPath` setting (no re-activation needed per-worktree).
> The hooks are not auto-installed by `pnpm install` or any other tool.

To verify:

```bash
git config --get core.hooksPath
# → .githooks
```

To skip hooks for a single commit (e.g., backports, reverts, bulk
cherry-picks):

```bash
git commit --no-verify
```

The hooks are intentionally non-blocking on missing `#NNN` (warn-and-allow)
because the prepare-commit-msg fires before the user has finished editing
the message in many editors. Use `git commit --amend` or the
`commit-msg` hook chain if your team wants hard enforcement.

---

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
Branch protection rules are configured:

- **main**: Requires pull request before merging, requires status checks (CI must pass), requires up-to-date branches, recommends signed commits
- **prod**: Production branch - changesets publish workflow targets this branch, pre-commit hook warns against direct commits
