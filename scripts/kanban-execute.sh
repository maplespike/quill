#!/usr/bin/env bash
# MapleSpike Automated Kanban Execution Script
# Run by cronjob every 15 minutes to check and execute ready tasks
set -e

BOARD="maplespike"
WORKDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGFILE="$WORKDIR/kanban-execution.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"
}

log "🚀 Starting Kanban execution cycle for board: $BOARD"

# Ensure we're on the right board
hermes kanban boards switch "$BOARD" 2>/dev/null || true

# Get all ready tasks assigned to backend-eng
log "📋 Checking for ready tasks..."

READY_TASKS=$(hermes kanban list --status ready --json 2>/dev/null | jq -r '.[] | select(.assignee == "backend-eng") | "\(.id)|\(.title)"' || echo "")

if [ -z "$READY_TASKS" ]; then
    log "✅ No ready tasks for backend-eng. Board is caught up."
    exit 0
fi

# Process each ready task
echo "$READY_TASKS" | while IFS='|' read -r task_id task_title; do
    if [ -z "$task_id" ]; then continue; fi
    
    log "▶️  Executing task: $task_id - $task_title"
    
    # Get task body for context
    task_body=$(hermes kanban show "$task_id" --json 2>/dev/null | jq -r '.body' || echo "")
    
    # Determine which skills to load based on task title/body
    SKILLS="maplespike"
    [[ "$task_title" == *"Drizzle"* ]] || [[ "$task_body" == *"database"* ]] && SKILLS="$SKILLS,drizzle-schema-fix"
    [[ "$task_title" == *"MCP"* ]] && SKILLS="$SKILLS,mcp-builder"
    
    log "   Skills: $SKILLS"
    
    # Execute the task
    cd "$WORKDIR"
    hermes -p backend-eng \
        --skills "$SKILLS" \
        --yolo \
        -z "Execute kanban task $task_id: $task_body" \
        >> "$LOGFILE" 2>&1
    
    if [ $? -eq 0 ]; then
        log "✅ Task $task_id completed successfully"
    else
        log "❌ Task $task_id failed (will retry next cycle)"
    fi
done

log "🏁 Execution cycle complete"