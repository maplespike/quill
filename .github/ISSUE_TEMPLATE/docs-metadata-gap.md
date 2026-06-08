---
name: Docs Metadata Gap
about: Documentation file missing or has stale last-reviewed metadata
title: "docs: Add metadata to <file>"
labels: documentation, auto-created, kelos
assignees: reverb256
---

## Task
Add or update `last-reviewed` metadata in documentation file(s).

## Files Affected
<!-- Auto-populated by Kelos docs-maintenance workflow -->

## Problem
- [ ] File missing `last-reviewed` frontmatter entirely
- [ ] `last-reviewed` date is stale (> 30 days)
- [ ] YAML frontmatter syntax is invalid

## Required Fix
Add or update the file frontmatter:
```markdown
---
last-reviewed: YYYY-MM-DD
---
```

## Acceptance Criteria
- [ ] `last-reviewed: <date>` present in frontmatter
- [ ] Date is current (within last 7 days)
- [ ] YAML syntax valid
- [ ] Frontmatter at top of file

## Workflow
- [ ] Single PR per batch of fixes
- [ ] Branch: `issue-NNN-docs-metadata`
- [ ] Commit messages reference `(#NNN)`
- [ ] PR body contains `Closes #NNN`

## Reference
- Auto-created by Kelos docs-maintenance workflow
- Parent: #367
