---
last-reviewed: 2026-06-11
status: active
---

# MapleSpike Kanban System

**Status:** Board exists at `hermes kanban` board `maplespike` but is currently **empty** — all previously created tasks have been completed. No cronjobs are running.

## Reality check (2026-06-11)

- `hermes kanban list` returns "(no matching tasks)"
- `hermes cron list` shows only `hermes-dreaming` — zero MapleSpike cronjobs
- The GitHub Action `.github/workflows/kanban-ingest.yml` exists and will auto-import new issues labeled `agent-ready`
- No automated task execution is currently running (gateway not active)

## To re-activate

1. Label an issue with `agent-ready` → GitHub Action imports to kanban
2. Start the gateway: `hermes gateway install && sudo hermes gateway install --system`
3. Create cronjobs to auto-execute tasks from the board

## Architecture (for reference)

When active, the pipeline works:
```
GitHub Issue (agent-ready) → kanban-ingest.yml → Kanban task
  → Cronjob worker → Hermes agent → Code → PR
```

See `KANBAN-SETUP.md` for initial board setup commands.
