---
name: Docs TODO Rot
about: Security or other docs have excessive TODO/FIXME density
title: "docs: Resolve TODOs in <file>"
labels: documentation, security, auto-created, kelos
assignees: reverb256
---

## Task
Reduce TODO/FIXME density in documentation below acceptable thresholds.

## Problem
- [ ] Security docs have > 0 TODOs (target: 0)
- [ ] Other docs have > 5% TODO density
- [ ] HACK/XXX markers present

## Files Affected
<!-- Auto-populated by Kelos docs-maintenance workflow -->

## Current State
- TODO count: <!-- auto-filled -->
- Line count: <!-- auto-filled -->
- Density: <!-- auto-filled -->

## Required Action
1. Resolve each TODO: implement, convert to tracked issue, or remove
2. Remove all HACK/XXX markers
3. Security docs: target 0 TODOs
4. Other docs: target < 5% density

## Acceptance Criteria
- [ ] All TODOs in security docs resolved or converted to tracked issues
- [ ] Overall TODO density below 5% threshold
- [ ] No HACK/XXX markers remain
- [ ] Code compiles and tests pass after changes

## Workflow
- [ ] Single PR per batch of fixes
- [ ] Branch: `issue-NNN-todo-cleanup`
- [ ] Commit messages reference `(#NNN)`
- [ ] PR body contains `Closes #NNN`

## Reference
- Auto-created by Kelos docs-maintenance workflow
- Parent: #367, #360
