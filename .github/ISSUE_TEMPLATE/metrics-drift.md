---
name: Docs Metrics Drift
about: Documentation references stale metrics that no longer match metrics.json
title: "fix: Update stale metric references in docs"
labels: documentation, metrics, auto-created, kelos
assignees: reverb256
---

## Task
Update documentation — stale metric references detected that no longer match `docs/metrics.json`.

## Drift Details
| Metric | Current Value | Stale References Found |
|--------|--------------|----------------------|
| MCP tools | <!-- auto-filled from metrics.json --> | <!-- auto-filled --> |
| Modules | <!-- auto-filled from metrics.json --> | <!-- auto-filled --> |
| TS lines | <!-- auto-filled from metrics.json --> | <!-- auto-filled --> |

## Files to Update
<!-- Auto-populated by Kelos docs-maintenance workflow -->

## Fix
1. Run `node scripts/generate-metrics.mjs` to update `docs/metrics.json`
2. Search for stale inline references:
   ```bash
   grep -rn '<old-value>' --include='*.md' .
   ```
3. Update each reference to match current metrics
4. Verify zero remaining stale refs:
   ```bash
   bash scripts/verify-metrics-sync.sh
   ```

## Acceptance Criteria
- [ ] `docs/metrics.json` is current and matches codebase
- [ ] No stale metric references in any `.md` file
- [ ] `scripts/verify-metrics-sync.sh` passes with zero drift
- [ ] AGENTS.md, README.md, README.fr.md all updated if affected

## Workflow
- [ ] Single PR per batch of fixes
- [ ] Branch: `issue-NNN-metrics-drift`
- [ ] Commit messages reference `(#NNN)`
- [ ] PR body contains `Closes #NNN`

## Reference
- Auto-created by Kelos docs-maintenance workflow
- Parent: #367, #361
- Metrics regeneration: `node scripts/generate-metrics.mjs`
