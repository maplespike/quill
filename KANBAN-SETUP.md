---
last-reviewed: 2026-06-11
status: active
---

# MapleSpike Kanban Board Setup

**Board:** `maplespike`
**Current tasks:** 0 (board is empty — all completed)

## Importing issues

Issues labeled `agent-ready` are auto-imported by `.github/workflows/kanban-ingest.yml`.

Manual import:
```bash
./scripts/import-github-issues.sh all          # All open agent-ready issues
./scripts/import-github-issues.sh single 617   # Single issue
```

## Profile mapping

| Profile | Assigns To |
|---------|-----------|
| `backend-eng` | API, MCP, ingestion modules |
| `writer` | Documentation |
| `ops` | CI/CD, automation |
| `researcher` | International data research |

## Commands

```bash
hermes kanban list                              # View board
hermes kanban show t_XXXXXX                     # Task details
hermes kanban complete t_XXXXXX --summary "..."  # Mark done
hermes kanban reclaim t_XXXXXX                  # Unstick task
```

## Previous dependency graph (now resolved)

All blocking-chain tasks (#302 Entity Resolution, #316 Data Quality, #317 Export API, #268 AI Ask) have been merged and completed. The board is clean.
