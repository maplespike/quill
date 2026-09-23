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

# The board + dispatcher live on nexus. Target `--board maplespike` explicitly
# (stateless) and NEVER `boards switch`: runner hosts serve several boards
# (nexus runs faceless-youtube) and a global switch pollutes their targeting.
#
# A runner-local create on a non-nexus host prints "board 'maplespike' does not
# exist", and the old `create | jq -r '.id'` pipeline discarded that: the step
# exited 0 and reported "✅ Imported" while writing nothing. So: hop to nexus the
# way kanban-post.sh does, and fail loudly when no task id comes back.
BOARD="maplespike"
ON_NEXUS=0
[ "$(hostname -s)" = "nexus" ] && ON_NEXUS=1

# kb_create <title> <body> [extra create args...] -> prints the CLI's output
kb_create() {
    local title="$1" body="$2"; shift 2
    if [ "$ON_NEXUS" = "1" ]; then
        hermes kanban --board "$BOARD" create "$title" --body "$body" "$@"
    else
        local b64 extra a qtitle
        b64=$(printf '%s' "$body" | base64 -w0)
        qtitle=$(printf '%q' "$title")
        extra=""
        for a in "$@"; do extra+=" $(printf '%q' "$a")"; done
        ssh -o BatchMode=yes -o ConnectTimeout=10 nexus "bash -s" <<REMOTE
set -e
body=\$(printf '%s' '$b64' | base64 -d)
hermes kanban --board '$BOARD' create $qtitle --body "\$body"$extra
REMOTE
    fi
}

# kb_create_checked <title> <body> [extra args...] -> prints the new task id.
# Fails (non-zero) when the create errors or returns no id, so a swallowed board
# error can never be reported as a successful import again.
kb_create_checked() {
    local title="$1" body="$2"; shift 2
    local out card_id
    if ! out=$(kb_create "$title" "$body" "$@"); then
        echo "✖ kanban create failed for: $title" >&2
        return 1
    fi
    card_id=$(printf '%s\n' "$out" | sed -n 's/^Created \([^ ]*\).*/\1/p' | head -n 1)
    if [ -z "$card_id" ]; then
        echo "✖ kanban create returned no task id for: $title" >&2
        echo "  output: $out" >&2
        return 1
    fi
    printf '%s\n' "$card_id"
}

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
    
    card_id=$(kb_create_checked "$title (GH#$SINGLE_NUMBER)" \
        "GitHub #$SINGLE_NUMBER | Labels: $labels | Auto-imported" \
        --assignee "$assignee" \
        --priority "$priority" \
        --workspace worktree \
        --branch "wt/gh$SINGLE_NUMBER" \
        --idempotency-key "gh-maplespike-$SINGLE_NUMBER" \
        --created-by "gh-action") || exit 1

    echo "✅ Imported #$SINGLE_NUMBER as task $card_id"
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
        task_id=$(kb_create_checked "$title" \
            "GitHub #$num | Labels: $labels | Foundation Issue" \
            --assignee "$assignee" \
            --priority "$priority" \
            --idempotency-key "gh-maplespike-$num" \
            --created-by "gh-import" \
            --worktree \
            --branch "wt/gh$num") || exit 1
        
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
        
        # NOTE: the idempotency key must use $number. It used to read $num, which
        # is undefined in this loop, so every issue in a bulk run shared the key
        # "gh-maplespike-" and all but the first were silently deduped away.
        task_id=$(kb_create_checked "$title" \
            "GitHub #$number | Labels: $labels | Priority: p$priority" \
            $workspace_arg \
            --assignee "$assignee" \
            --priority "$priority" \
            --idempotency-key "gh-maplespike-$number" \
            --created-by "gh-import" \
            --branch "wt/gh$number") || exit 1
        
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