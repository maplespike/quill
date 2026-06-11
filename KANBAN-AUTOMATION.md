---
last-reviewed: 2026-06-11
status: active
---

# MapleSpike Fully Automated Kanban System ✅

**Date:** 2026-06-04  
**Status:** FULLY AUTOMATED  
**Board:** `maplespike`

---

## Automation Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ GitHub Issues                                                       │
│ (Source of Truth)                                                   │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ GitHub Action: kanban-ingest.yml                                    │
│ Triggers: issue opened, labeled agent-ready                         │
│ Action: Imports to Kanban with idempotency                          │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Kanban Board: maplespike                                            │
│ Statuses: ready → running → done                                    │
│ Dependencies: Parent/child gating                                   │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Cronjobs (Automated Execution)                                      │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ backend-exec (every 15m)   → Executes backend-eng tasks        ││
│ │ research-exec (every 15m)  → Executes researcher tasks         ││
│ │ stuck-recovery (every 30m) → Reclaims blocked/stuck tasks     ││
│ └─────────────────────────────────────────────────────────────────┘│
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Agent Execution (delegate_task)                                     │
│ Skills: maplespike, drizzle-schema-fix, etc.                        │
│ Workspace: worktree branches (wt/gh###)                             │
│ Output: PR with "Fixes #NNN"                                        │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ GitHub PR → Merge → Issue Auto-Closes                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Cronjobs (Automated Execution)

### 1. Backend Execution (`maplespike-backend-exec`)
- **Schedule:** Every 15 minutes
- **Job ID:** `3e05fbe33240`
- **Assignee:** `backend-eng`
- **Skills:** `maplespike`
- **Workdir:** `<repo-root>` (set dynamically via script)
- **Function:** 
  - Scans for `ready` tasks assigned to `backend-eng`
  - Executes each with `delegate_task(goal=body, skills=['maplespike'])`
  - Opens PR with `Fixes #NNN` in body
  - Completes kanban task with PR number in metadata
  - Leaves failed tasks as `ready` for retry

### 2. Research Execution (`maplespike-research-exec`)
- **Schedule:** Every 15 minutes
- **Job ID:** `e39545b67ffd`
- **Assignee:** `researcher`
- **Function:**
  - Scans for `ready` tasks assigned to `researcher`
  - Executes research with web search
  - Summarizes findings
  - Completes task with research summary

### 3. Stuck Recovery (`maplespike-stuck-recovery`)
- **Schedule:** Every 30 minutes
- **Job ID:** `d7ce2bc9c485`
- **Function:**
  - Scans for `running` tasks exceeding 30 minutes
  - Checks if worker process is alive
  - Reclaims stuck/dead tasks
  - Reports reclaimed tasks

---

## GitHub Action (Auto-Ingest)

**File:** `.github/workflows/kanban-ingest.yml`

### Triggers
- ✅ Issue opened (checks for `agent-ready` label)
- ✅ Issue labeled with `agent-ready`
- ✅ Manual dispatch with force re-import option

### Features
- **Idempotency:** Uses `gh-maplespike-<number>` keys
- **Label Detection:** Only imports issues with `agent-ready`
- **GitHub Token:** Auto-authenticated via `GITHUB_TOKEN`
- **Reporting:** Posts results to workflow summary

### Required Secret
```bash
# Add to GitHub repo secrets
HERMES_API_KEY=<your-hermes-api-key>
```

---

## Current Board Status

### Running Tasks (6)
```
✅ t_c6f781ed  running  backend-eng  OECD Tax Database (GH#620)
✅ t_d8e3f863  running  backend-eng  UNESCO API (GH#619)
✅ t_3a6b96c5  running  backend-eng  ILO Labour Stats (GH#618)
✅ t_5e06325a  running  backend-eng  Register who-gho/fao (GH#640)
✅ t_25934362  running  backend-eng  Reclassify adapters (GH#641)
✅ t_0547fc86  running  backend-eng  Fix shared imports (GH#642)
```

### Blocked Tasks (4) - Waiting on Foundation
```
⏳ t_6a4470d9  running  backend-eng  Entity Resolution (GH#302) ← ROOT
◻ t_43f2329a  todo     backend-eng  AI Ask (GH#268) ← blocked by #302
◻ t_2b77e6d5  todo     backend-eng  Data Quality (GH#316) ← blocked by #302
◻ t_ce1a8da3  todo     backend-eng  Export API (GH#317) ← blocked by #302
◻ t_93f3f24f  todo     backend-eng  LLM Fine-tuning (GH#318) ← blocked by #268
```

---

## Monitoring Commands

```bash
# Check running cronjobs
hermes cron list

# Check kanban board status
hermes kanban list

# Check running workers
hermes kanban list --status running

# Check a specific task
hermes kanban show t_XXXXXX

# View task logs (worker output)
hermes kanban log t_XXXXXX

# Manual reclaim (if needed)
hermes kanban reclaim t_XXXXXX
```

---

## Automation Flow (End-to-End)

### Step 1: Issue Created
```bash
# User creates GitHub issue
gh issue create \
  --title "Add new dataset" \
  --body "Need to add X dataset from Y API" \
  --label "enhancement,agent-ready"
```

### Step 2: Auto-Import (GitHub Action)
```
Issue #650 labeled agent-ready
  ↓
kanban-ingest.yml triggers
  ↓
Creates Kanban task with:
  - idempotency-key: gh-maplespike-650
  - branch: wt/gh650
  - assignee: backend-eng
  - status: ready
```

### Step 3: Automated Execution (Cronjob)
```
Cronjob ticks (every 15m)
  ↓
Finds t_XXXXXX in ready status
  ↓
Spawns agent with delegate_task:
  - goal: task body
  - skills: maplespike
  - worktree: $WORKDIR
  ↓
Agent writes code, commits, pushes branch
  ↓
Opens PR with "Fixes #650" in body
  ↓
Completes kanban task:
  - status: done
  - metadata: {pr_number: 123}
```

### Step 4: PR Merge
```
User reviews PR #123
  ↓
Merges PR
  ↓
GitHub auto-closes #650
  ↓
Kanban task already done
```

---

## Failure Recovery

### Worker Crash (HTTP 429)
**Cause:** Provider API credit exhaustion  
**Recovery:**
1. Cronjob detects stuck task (>30min)
2. Reclaims task automatically
3. Fixes provider credits manually if needed
4. Task retries next cycle

### Blocked Tasks
**Cause:** Dependency not complete  
**Recovery:**
- Tasks stay in `todo` until parents complete
- No manual intervention needed
- Auto-promotes to `ready` when unblocked

### Import Failures
**Cause:** Missing GitHub token or API limits  
**Recovery:**
- GitHub Action fails visibly in workflow
- Retry manually with: `./scripts/import-github-issues.sh single <number>`

---

## Pitfalls

**Cronjobs not running:**
- Verify Hermes gateway is running: `ps aux | grep gateway`
- Check cron list: `hermes cron list`
- Jobs run in `default` profile

**Tasks stuck in running:**
- Check worker logs: `hermes kanban log <task-id>`
- Wait for 30min → stuck-recovery cronjob reclaims
- Manual reclaim: `hermes kanban reclaim <task-id>`

**Duplicate tasks:**
- Idempotency prevents this: `gh-maplespike-<number>`
- If occurs, reclaim duplicates manually

---

## Files Created

```
maplespike/
├── .github/workflows/kanban-ingest.yml       # Auto-ingest on issue
├── scripts/
│   ├── import-github-issues.sh               # Manual import script
│   └── kanban-execute.sh                     # Manual execution helper
├── KANBAN-SETUP.md                           # Initial setup docs
└── KANBAN-AUTOMATION.md                      # This file
```

---

## Summary

**MapleSpike Kanban is now fully automated:**

✅ **Ingestion:** GitHub Action auto-imports issues labeled `agent-ready`  
✅ **Execution:** 3 cronjobs run every 15-30 minutes  
✅ **Dependencies:** Parent/child gating enforced  
✅ **Recovery:** Stuck tasks auto-reclaimed  
✅ **Traceability:** Worktree branches + PRs with issue references  
✅ **Idempotency:** No duplicates on re-run  

**Zero manual intervention required** — from issue creation to PR merge, the entire pipeline runs autonomously.