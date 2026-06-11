---
last-reviewed: 2026-06-11
status: active
---

# MapleSpike Kanban Board Setup ✅

**Date:** 2026-06-04  
**Board:** `maplespike`  
**Pattern:** Follows TrovesAndCoves automation model with --yolo flag enabled

---

## Board Architecture

The Kanban board serves as the **orchestration layer** between GitHub Issues (source of truth) and autonomous agent execution. Workers are spawned automatically by the dispatcher with `--yolo` mode for full automation.

```
GitHub Issues (agent-ready labels)
        ↓
scripts/import-github-issues.sh
        ↓
Kanban Board (maplespike)
        ↓
Dispatcher (auto-spawns every 60s)
        ↓
Worker Agent (--yolo, auto-executes)
        ↓
Task Complete → PR Created (Fixes #N)
```

---

## Import Script

**Location:** `<repo-root>/scripts/import-github-issues.sh`

### Usage
```bash
# Import foundation-critical issues first
./scripts/import-github-issues.sh foundation

# Import remaining agent-ready issues
./scripts/import-github-issues.sh agent-ready

# Import all open issues (initial setup)
./scripts/import-github-issues.sh all
```

### Features
- **Idempotency keys**: `gh-maplespike-<number>` prevents duplicates on re-run
- **Profile assignment**: backend-eng, writer, ops, researcher based on labels
- **Workspace selection**: worktree for coding, scratch for research/docs
- **Branch naming**: `wt/gh<number>` for traceability
- **Priority mapping**: p1→1, p2→2, p3→3

---

## Current Board Status

### Foundation Layer (Critical Path)

| Task ID | GitHub # | Title | Status | Priority | Dependencies |
|---------|----------|-------|--------|----------|--------------|
| `t_6a4470d9` | #302 | Entity Resolution Engine | **ready** | 1 | ROOT |
| `t_43f2329a` | #268 | AI Ask (NL Q&A) | **todo** | 1 | Blocked by #302 |
| `t_2b77e6d5` | #316 | Data Quality Scoring | **todo** | 1 | Blocked by #302 |
| `t_ce1a8da3` | #317 | Export API Layer | **todo** | 1 | Blocked by #302 |
| `t_93f3f24f` | #318 | Sovereign LLM Fine-tuning | **todo** | 1 | Blocked by #268 |

**Execution model:** #302 must complete first → unlocks #268, #316, #317 → #318 waits for #268

### Module Development (Ready to Execute)

| Task ID | GitHub # | Title | Status | Priority |
|---------|----------|-------|--------|----------|
| `t_5e06325a` | #640 | Register who-gho/fao-faostat | **ready** | 2 |
| `t_25934362` | #641 | Reclassify 4 intl adapters | **ready** | 2 |
| `t_0547fc86` | #642 | Intl adapters shared infra | **ready** | 2 |
| `t_c6f781ed` | #620 | OECD Tax Database | **ready** | 3 |
| `t_d8e3f863` | #619 | UNESCO API | **ready** | 3 |
| `t_3a6b96c5` | #618 | ILO Labour Statistics | **ready** | 3 |

---

## Profile Mapping

| Profile | Assigns To | Workspace | Skills Loaded |
|---------|------------|-----------|---------------|
| `backend-eng` | API, MCP, engine, ingestion modules | `worktree` | maplespike, drizzle-schema-fix |
| `writer` | Documentation, specs | `scratch` | writing, documentation |
| `ops` | CI/CD, automation, Kelos | `worktree` | kelos-declarative-config |
| `researcher` | International data research | `scratch` | (none — web search) |

---

## Worker Execution Pattern

Workers execute directly via Hermes agent (no Kelos/Kagent):

```bash
# Manual execution
hermes -p backend-eng \
  --skills maplespike,drizzle-schema-fix \
  --yolo \
  -z "Execute task t_XXXXXX: <task body goal>"

# Then complete
hermes kanban complete t_XXXXXX --summary "Implemented X, Y, Z. PR #N opened."
```

### Automated Execution (Cronjob)
```bash
# Backend worker - runs every 30 minutes
hermes cronjob create \
  --name "maplespike-backend" \
  --schedule "30m" \
  --prompt "Check maplespike kanban for tasks with status=ready and assignee=backend-eng. For each, execute with delegate_task(goal=task.body, skills=['maplespike', 'drizzle-schema-fix']). Open PR referencing GitHub issue. Complete kanban task with PR number." \
  --enabled_toolsets '["terminal", "file"]' \
  --workdir <repo-root>
```

---

## Dependency Graph

```
#302 Entity Resolution (ROOT)
    ↓
#268 AI Ask ───────────────────┐
    ↓                          │
#318 LLM Fine-tuning           │
                               │
#316 Data Quality ←────────────┘
#317 Export API ←──────────────┘

#640, #641, #642 — Independent module fixes (parallel)
#618, #619, #620 — International data expansion (parallel)
```

---

## Monitoring Commands

```bash
# View all tasks
hermes kanban list

# View running tasks
hermes kanban list --status running

# View specific task
hermes kanban show t_XXXXXX

# View task logs (worker output)
hermes kanban log t_XXXXXX

# Reclaim stuck task
hermes kanban reclaim t_XXXXXX

# Reassign to different profile
hermes kanban reassign t_XXXXXX writer
```

---

## Automation Flow

1. **Dispatcher** ticks every 60 seconds
2. **Finds ready tasks** assigned to valid profiles
3. **Spawns worker** with `--yolo` flag (auto-approve tools)
4. **Worker executes** in isolated workspace
5. **Worker completes** with summary + metadata
6. **Task moves** to `done` status
7. **PR created** with `Fixes #N` in body

---

## Pitfalls & Recovery

### Worker Crashes (HTTP 429)
**Symptom:** Task blocked with "API call failed"  
**Fix:** 
```bash
hermes kanban reclaim t_XXXXXX
# Fix provider credits, then task auto-retries
```

### Tool Approval Blocking
**Symptom:** "terminal and execute_code tools require user approval"  
**Fix:** Verify dispatcher has `--yolo` in `kanban_db.py` line 6694

### Tasks Stuck in "ready"
- Dispatcher ticks every 60s — wait up to 2 minutes
- Check assignee profile exists: `hermes profiles list`
- Check profile has valid model: `hermes -p backend-eng model`

---

## Next Steps

1. ✅ Foundation tasks created with dependency wiring
2. ✅ Module tasks created (ready to execute)
3. ⏳ Monitor execution: `hermes kanban list --status running`
4. ⏳ As PRs merge, import remaining agent-ready issues
5. ⏳ Set up cronjob for automated worker execution

---

## References

- **Kanban Orchestrator Skill:** `~/.hermes/skills/devops/kanban-orchestrator/SKILL.md`
- **Kanban Worker Skill:** `~/.hermes/skills/devops/kanban-worker/SKILL.md`
- **GitHub Issues Import:** `~/.hermes/skills/devops/github-issues-to-kanban/SKILL.md`
- **TrovesAndCoves Pattern:** `<trovesandcoves>/KANBAN-DISPATCHER-FIXED.md`

---

**Summary:** MapleSpike Kanban board is now set up with foundation-first prioritization. Entity Resolution (#302) is the root blocker — once it completes, AI Ask, Data Quality, and Export API unlock automatically. Module development tasks (#640-642, #618-620) can execute in parallel without dependencies.