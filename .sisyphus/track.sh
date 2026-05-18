#!/usr/bin/env bash
# Sisyphus — multi-agent issue tracker daemon
# Works with Hermes, Claude Code, OMP, and Pi-agent
set -euo pipefail

REPO_ROOT="/data/projects/own/maplespike"
STATE_FILE="$REPO_ROOT/.sisyphus/state.json"
WORKTREE_PREFIX="/data/projects/own/maplespike"
REMOTE="origin"
MAX_CONCURRENT=3

mkdir -p "$(dirname "$STATE_FILE")"

load_state() {
  if [ -f "$STATE_FILE" ]; then cat "$STATE_FILE"; else echo '{"active":{},"completed":[]}'; fi
}

save_state() { echo "$1" > "$STATE_FILE"; }

slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g' | head -c 60
}

cmd_poll() {
  local state=$(load_state)
  local active=$(echo "$state" | jq '.active')
  local running=$(echo "$active" | jq 'length')

  gh issue list --state open --json number,title,labels \
    --jq '.[] | "\(.number)|\(.title)|\(.labels | map(.name) | join(","))"' \
    2>/dev/null | head -20 | while IFS='|' read -r num title labels; do

    [ "$running" -ge "$MAX_CONCURRENT" ] && break
    echo "$active" | jq -e "has(\"$num\")" >/dev/null 2>&1 && continue
    echo "$labels" | grep -qE "blocked|wontfix|duplicate" && continue

    dispatch_issue "$num" "$title"
    running=$((running + 1))
  done
}

dispatch_issue() {
  local num="$1" title="$2"
  local slug=$(slugify "$title")
  local branch="issue-$num-$slug"
  local worktree_path="${WORKTREE_PREFIX}-${num}"

  if [ ! -d "$worktree_path" ]; then
    cd "$REPO_ROOT"
    git fetch "$REMOTE" main 2>/dev/null || true
    git worktree add -b "$branch" "$worktree_path" "$REMOTE/main" 2>&1 \
      || git worktree add "$worktree_path" "$REMOTE/$branch" 2>&1 \
      || { echo "[dispatch] Failed worktree for #$num" >&2; return 1; }
  fi

  local state=$(load_state)
  state=$(echo "$state" | jq --arg num "$num" --arg branch "$branch" --arg path "$worktree_path" \
    '.active[$num] = {"branch": $branch, "path": $path, "attempts": 0, "pr_url": null, "status": "created", "dispatched_by": "track.sh"}')
  save_state "$state"
  # Machine-readable: tool name pipes this to its agent
  echo "DISPATCHED:$num:$branch:$worktree_path"
}

cmd_status() {
  local state=$(load_state)
  local fmt="${1:-text}"

  if [ "$fmt" = "json" ]; then
    echo "$state"
    return
  fi

  echo "=== Active ==="
  echo "$state" | jq -r '.active | to_entries[] | "  #\(.key): \(.value.branch) — \(.value.status)"' 2>/dev/null || echo "  None"
  echo "=== Completed ==="
  echo "$state" | jq -r '.completed[]' 2>/dev/null | head -10 || echo "  None"
  echo "=== Worktrees ==="
  for wt in $(git -C "$REPO_ROOT" worktree list 2>/dev/null | grep "$WORKTREE_PREFIX-" | awk '{print $1}'); do
    du -sh "$wt" 2>/dev/null | awk '{print "  " $2 " (" $1 ")"}'
  done
  echo "=== Summary ==="
  echo "  Active: $(echo "$state" | jq '.active | length')"
  echo "  Completed: $(echo "$state" | jq '.completed | length')"
}

cmd_cleanup() {
  local state=$(load_state)
  local json_out="${1:-}"
  for num in $(echo "$state" | jq -r '.active | keys[]'); do
    local gh_state=$(gh issue view "$num" --json state --jq '.state' 2>/dev/null || echo "unknown")
    if [ "$gh_state" = "closed" ] || [ "$gh_state" = "merged" ]; then
      local path=$(echo "$state" | jq -r ".active[\"$num\"].path")
      cd "$REPO_ROOT" && git worktree remove "$path" 2>/dev/null || rm -rf "$path"
      local branch=$(echo "$state" | jq -r ".active[\"$num\"].branch")
      state=$(echo "$state" | jq --arg num "$num" --arg branch "$branch" \
        '.completed += [$branch] | del(.active[$num])')
      echo "CLEANED:$num:$branch"
    fi
  done
  save_state "$state"
}

cmd_retry() {
  local num="$1"
  [ -z "$num" ] && { echo "Usage: $0 retry ISSUE_NUMBER"; exit 1; }
  local state=$(load_state)
  local path=$(echo "$state" | jq -r ".active[\"$num\"].path // empty")

  [ -z "$path" ] || [ ! -d "$path" ] && { echo "Issue #$num not active or worktree missing" >&2; exit 1; }

  local attempts=$(echo "$state" | jq -r ".active[\"$num\"].attempts // 0")
  attempts=$((attempts + 1))

  local delay=$((10 * (1 << (attempts - 1))))
  [ "$delay" -gt 300 ] && delay=300
  sleep "$delay"

  state=$(echo "$state" | jq --arg num "$num" --argjson attempts "$attempts" \
    '.active[$num].attempts = $attempts | .active[$num].status = "retrying"')
  save_state "$state"
  echo "RETRY:$num:$attempts"
}

# ── Main ──────────────────────────────────────────────────────────
cmd="${1:-help}"
case "$cmd" in
  poll)     cmd_poll ;;
  status)   cmd_status "${2:-text}" ;;
  cleanup)  cmd_cleanup "${2:-}" ;;
  retry)    cmd_retry "${2:-}" ;;
  dispatch) dispatch_issue "${2:-}" "${3:-}" ;;
  help|*)
    echo "Sisyphus — multi-agent issue tracker"
    echo ""
    echo "Usage:"
    echo "  $0 poll                  Poll issues, dispatch new worktrees"
    echo "  $0 status [text|json]    Show active worktrees and state"
    echo "  $0 cleanup               Remove worktrees for closed/merged issues"
    echo "  $0 retry N               Retry a failed issue with backoff"
    echo "  $0 dispatch N title      Manually dispatch an issue"
    echo ""
    echo "All tools (Hermes, Claude, OMP, Pi) call this same script."
    echo "Worktrees go to ${WORKTREE_PREFIX}-{num}"
    ;;
esac
