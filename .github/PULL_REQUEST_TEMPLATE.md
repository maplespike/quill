## Summary

<!-- One or two sentences describing the change. -->

## Related Issues

<!-- REQUIRED: Link to GitHub issue(s) this PR addresses -->
Closes #   <!-- or: Related to # -->

**No issue = no PR.** If there's no issue, create one first.

## Autonomous Pipeline

### AI Review
This PR will be reviewed by the AI PR Reviewer. If rejected, structured feedback
will be appended to the source issue as `## Previous Attempt Feedback` and the
`agent-ready` label will be re-added for Kelos retry.

### Dependabot Fast-Track
If this PR is from `dependabot/*` and only changes lockfiles or package.json
version bumps, it will be auto-approved without full review.

### Entity Resolution Integration
If this PR adds a new data module, include a note on how it feeds
entity resolution (#302):
```
## Cross-Reference Integration
- **Person fields:** [which fields contain person names/identifiers]
- **Organization fields:** [which fields contain org names/identifiers]
- **Module readiness for #302:** [ready / needs schema changes / N/A]
```

## Type of Change

- [ ] New data module
- [ ] New MCP tool
- [ ] Bug fix
- [ ] Feature / enhancement
- [ ] API change
- [ ] Documentation
- [ ] Refactor / cleanup
- [ ] CI/CD / templates

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
- [ ] Worktree cleaned up after merge: `git worktree remove /data/projects/own/maplespike-NNN`
- [ ] Remote nodes synced: `git fetch origin && git reset --hard origin/main` on all 4 nodes

## Clean Long-Term Solution

- [ ] **Nix-native**: All deployment config in Nix, not raw k8s YAML
- [ ] **Gateway routing**: AI traffic through AI Inference Gateway, not direct to providers
- [ ] **Root cause, not workaround**: If this works around a limitation, fix the limitation instead
- [ ] **No tech debt**: No TODO/FIXME left behind
- [ ] **Backwards compatible**: Existing clients and configs continue working