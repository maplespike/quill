## Summary

<!-- One or two sentences describing the change. -->

## Related Issues

<!-- REQUIRED: Link to GitHub issue(s) this PR addresses -->
Closes #   <!-- or: Related to # -->

**No issue = no PR.** If there's no issue, create one first.

## Worktree Info
- **Developed on:** [zephyr / nexus / forge / sentry]
- **Worktree path:** `/data/projects/own/quill-NNN`
- **Branch:** `issue-NNN-short-description`

## Type of Change

- [ ] New data module
- [ ] New MCP tool
- [ ] Bug fix
- [ ] Feature / enhancement
- [ ] API change
- [ ] Documentation
- [ ] Refactor / cleanup
- [ ] CI/CD

## Testing

- [ ] `pnpm build` passes
- [ ] `pnpm test` passes (all packages)
- [ ] New tests added for new functionality
- [ ] MCP tools tested (start server, verify tool output)

## Documentation

- [ ] ROADMAP.md updated
- [ ] docs/metrics.json updated
- [ ] AGENTS.md updated (if workflow/coverage changed)
- [ ] Changeset added: `pnpm changeset`

## Checklist

- [ ] SHA-256 citation hashing for all new data sources
- [ ] Trust scoring ≥60% threshold met
- [ ] AIDA-compliant audit trail
- [ ] No `as any` / `@ts-ignore` / `@ts-expect-error`
- [ ] Commit messages reference issue number: `(#NNN)`
- [ ] Branch name: `issue-NNN-short-description`
- [ ] Worktree cleaned up after merge: `git worktree remove /data/projects/own/quill-NNN`
- [ ] Remote nodes synced: `git fetch origin && git reset --hard origin/main` on all 4 nodes
