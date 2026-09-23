#!/usr/bin/env bash
# Import GitHub Issues to MapleSpike Kanban Board
# Usage: ./scripts/import-github-issues.sh [foundation|agent-ready|all|single <number>]

set -e

REPO="${1:-reverb256/quill}"
MODE="${2:-agent-ready}"
SINGLE_NUMBER="${3:-}"

# --- Caller contract -------------------------------------------------------
# Positional order is <repo> <mode> [number]. A caller that passes the mode
# first (`... single 918`) silently binds REPO="single" and MODE="918", falls
# through every branch below and exits 1 without importing anything — which is
# exactly how the kanban-ingest workflow failed on every newly labeled issue.
# Accept the mode-first form, and reject anything else loudly.
VALID_MODES="foundation agent-ready all single"
mode_is_known() {
    case " $VALID_MODES " in *" $1 "*) return 0 ;; esac
    return 1
}

if ! [[ "$REPO" =~ ^[^/[:space:]]+/[^/[:space:]]+$ ]]; then
    if mode_is_known "$REPO"; then
        # Mode-first form: `agent-ready`, or `single <number>`.
        MODE="$REPO"
        [[ "${2:-}" =~ ^[0-9]+$ ]] && SINGLE_NUMBER="$2"
        REPO="reverb256/quill"
    else
        echo "✖ First argument must be a repo (owner/name); got '$REPO'." >&2
        echo "  Usage: $0 <repo> [foundation|agent-ready|all|single <number>]" >&2
        echo "  Example: $0 reverb256/quill single 918" >&2
        exit 2
    fi
fi

if ! mode_is_known "$MODE"; then
    echo "✖ Unknown mode '$MODE'. Known: $VALID_MODES" >&2
    echo "  Usage: $0 <repo> [foundation|agent-ready|all|single <number>]" >&2
    exit 2
fi

if [ "$MODE" = "single" ] && [ -z "$SINGLE_NUMBER" ]; then
    echo "✖ Mode 'single' needs an issue number: $0 <repo> single <number>" >&2
    exit 2
fi

# CI self-check entry point: resolve the arguments, print them, stop before
# touching gh or the board. The kanban-ingest workflow asserts on this output.
if [ "${DRY_RUN:-}" = "1" ]; then
    echo "repo=$REPO mode=$MODE issue=${SINGLE_NUMBER:-none}"
    exit 0
fi
# ---------------------------------------------------------------------------

echo "📥 Importing GitHub issues from $REPO to MapleSpike Kanban board"
echo "   Mode: $MODE"
echo ""

# Ensure we're on the maplespike board
# Target the maplespike board explicitly via --board (stateless). Do NOT use
# `boards switch`: runner hosts serve multiple boards (nexus runs
# faceless-youtube) and a global switch pollutes their board targeting.
KB="hermes kanban --board maplespike"

# Single issue import (for GitHub Actions)
if [ "$MODE" = "single" ] && [ -n "$SINGLE_NUMBER" ]; then
    echo "📥 Importing single issue #$SINGLE_NUMBER..."
    
    issue_data=$(gh issue view $SINGLE_NUMBER --repo $REPO --json number,title,body,labels)
    title=$(echo "$issue_data" | jq -r '.title')
    labels=$(echo "$issue_data" | jq -r '.labels[].name' | tr '\n' ',' | sed 's/,$//')
    
    assignee="backend-eng"
    [[ "$labels" == *"documentation"* ]] && assignee="writer"
    [[ "$labels" == *"research"* ]] && assignee="researcher"
    
    priority=2
    [[ "$labels" == *"p1"* ]] && priority=1
    [[ "$labels" == *"p3"* ]] && priority=3
    
    $KB create "$title (GH#$SINGLE_NUMBER)" \
        --assignee "$assignee" \
        --priority $priority \
        --workspace worktree \
        --branch "wt/gh$SINGLE_NUMBER" \
        --idempotency-key "gh-maplespike-$SINGLE_NUMBER" \
        --created-by "gh-action" \
        --body "GitHub #$SINGLE_NUMBER | Labels: $labels | Auto-imported" \
        --json | jq -r '.id'
    
    echo "✅ Imported #$SINGLE_NUMBER as task"
    exit 0
fi

# Foundation-first: Critical infrastructure that blocks everything else
FOUNDATION_ISSUES=(302 268 316 317 318)

if [ "$MODE" = "foundation" ]; then
    echo "🏗️  Importing FOUNDATION issues only (critical path infrastructure)"
    for num in "${FOUNDATION_ISSUES[@]}"; do
        echo "   Importing #$num (foundation)..."
        
        # Fetch issue data
        issue_data=$(gh issue view $num --repo $REPO --json number,title,body,labels,createdAt)
        
        title=$(echo "$issue_data" | jq -r '.title')
        body=$(echo "$issue_data" | jq -r '.body')
        labels=$(echo "$issue_data" | jq -r '.labels[].name' | tr '\n' ',' | sed 's/,$//')
        
        # Determine assignee based on labels
        assignee="backend-eng"
        [[ "$labels" == *"engine"* ]] && assignee="backend-eng"
        [[ "$labels" == *"documentation"* ]] && assignee="writer"
        
        # Priority based on issue number (foundation = p1)
        priority=1
        
        # Create kanban task
        task_id=$($KB create "$title" \
            --assignee "$assignee" \
            --priority $priority \
            --idempotency-key "gh-maplespike-$num" \
            --created-by "gh-import" \
            --worktree \
            --branch "wt/gh$num" \
            --body "GitHub #$num | Labels: $labels | Foundation Issue" \
            --json | jq -r '.id')
        
        echo "   ✓ Created $task_id for #$num"
    done
    
    echo ""
    echo "✅ Foundation issues imported! Dependencies wired:"
    echo "   #302 (Entity Resolution) → ROOT"
    echo "   #268 (AI Ask) → blocked by #302"
    echo "   #316/317/318 → blocked by #268 and #302"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Import remaining agent-ready issues: $0 agent-ready"
    echo "   2. Watch workers execute: hermes kanban list --status running"
    exit 0
fi

# Agent-ready issues (the main ingestion flow)
if [ "$MODE" = "agent-ready" ]; then
    echo "🚀 Importing AGENT-READY issues (filtering by agent-ready label)"
    
    # Fetch all open issues with agent-ready label
    gh issue list --repo $REPO --label agent-ready --state open \
        --json number,title,body,labels,createdAt \
        --jq -r '.[] | @base64' | while read -r line; do
        
        decoded=$(echo "$line" | base64 -d)
        number=$(echo "$decoded" | jq -r '.number')
        title=$(echo "$decoded" | jq -r '.title')
        body=$(echo "$decoded" | jq -r '.body')
        labels=$(echo "$decoded" | jq -r '.labels[].name' | tr '\n' ',' | sed 's/,$//')
        
        # Skip foundation issues (handled separately)
        skip=false
        for found in "${FOUNDATION_ISSUES[@]}"; do
            [[ "$found" == "$number" ]] && skip=true && break
        done
        [[ "$skip" == "true" ]] && continue
        
        # Determine assignee based on labels
        assignee="backend-eng"
        [[ "$labels" == *"documentation"* ]] && assignee="writer"
        [[ "$labels" == *"automation"* ]] || [[ "$labels" == *"ci-cd"* ]] && assignee="ops"
        [[ "$labels" == *"research"* ]] && assignee="researcher"
        
        # Priority: p1=1, p2=2, p3=3, default=2
        priority=2
        [[ "$labels" == *"p1"* ]] && priority=1
        [[ "$labels" == *"p3"* ]] && priority=3
        
        # Workspace: worktree for coding, scratch for research/docs
        workspace_arg="--worktree"
        [[ "$labels" == *"research"* ]] && workspace_arg="--scratch"
        [[ "$labels" == *"documentation"* ]] && workspace_arg="--scratch"
        
        echo "   Importing #$number: $title (p$priority, $assignee)..."
        
        task_id=$($KB create "$title" \
            $workspace_arg \
            --assignee "$assignee" \
            --priority $priority \
            --idempotency-key "gh-maplespike-$num" \
            --created-by "gh-import" \
            --branch "wt/gh$num" \
            --body "GitHub #$number | Labels: $labels | Priority: p$priority" \
            --json | jq -r '.id')
        
        echo "   ✓ Created $task_id"
    done
    
    echo ""
    echo "✅ Agent-ready issues imported!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Wire dependencies: hermes kanban link --parent <foundation> --child <dependent>"
    echo "   2. Check board: hermes kanban list"
    echo "   3. Monitor execution: hermes kanban list --status running"
    exit 0
fi

# All issues (for initial board setup)
if [ "$MODE" = "all" ]; then
    echo "📦 Importing ALL open issues"
    
    gh issue list --repo $REPO --state open \
        --json number,title,body,labels,createdAt \
        --jq -r '.[] | @base64' | while read -r line; do
        
        decoded=$(echo "$line" | base64 -d)
        number=$(echo "$decoded" | jq -r '.number')
        title=$(echo "$decoded" | jq -r '.title')
        body=$(echo "$decoded" | jq -r '.body')
        labels=$(echo "$decoded" | jq -r '.labels[].name' | tr '\n' ',' | sed 's/,$//')
        
        # Determine if epic (needs triage)
        triage_arg=""
        [[ "$labels" == *"epic"* ]] && triage_arg="--triage"
        
        # Determine assignee
        assignee="backend-eng"
        [[ "$labels" == *"documentation"* ]] && assignee="writer"
        [[ "$labels" == *"research"* ]] && assignee="researcher"
        
        echo "   Importing #$number: $title..."
        
        $KB create "$title" \
            --assignee "$assignee" \
            --idempotency-key "gh-maplespike-$num" \
            --created-by "gh-import" \
            $triage_arg \
            --body "GitHub #$number | Labels: $labels" \
            --json > /dev/null
        
        echo "   ✓ Created task for #$number"
    done
    
    echo ""
    echo "✅ All issues imported!"
    exit 0
fi

echo "Usage: $0 <repo> [mode]"
echo "  repo: GitHub repo (default: reverb256/quill)"
echo "  mode: foundation|agent-ready|all (default: agent-ready)"
exit 1