#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="/data/projects/own/maplespike"
STATE_FILE="$REPO_ROOT/.sisyphus/state.json"
WORKTREE_ROOT="/tmp/maplespike-worktrees"
BARE_REMOTE="file:///srv/git/maplespike.git"
MAX_CONCURRENT=3

mkdir -p "$WORKTREE_ROOT"

load_state() {
  if [ -f "$STATE_FILE" ]; then cat "$STATE_FILE"; else echo '{"active":{},"completed":[]}'; fi
}

save_state() { echo "$1" > "$STATE_FILE"; }

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
  local slug=$(echo "$title" | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g' | head -c 60)
  local branch="issue-$num-$slug"
  local worktree_path="$WORKTREE_ROOT/$num"

  if [ ! -d "$worktree_path" ]; then
    cd "$REPO_ROOT"
    git fetch "$BARE_REMOTE" main 2>/dev/null || true
    git worktree add -b "$branch" "$worktree_path" bare/main 2>&1 \
      || git worktree add "$worktree_path" bare/$branch 2>&1 \
      || { echo "[dispatch] Failed worktree for #$num" >&2; return 1; }
  fi

  local state=$(load_state)
  state=$(echo "$state" | jq --arg num "$num" --arg branch "$branch" --arg path "$worktree_path" \
    '.active[$num] = {"branch": $branch, "path": $path, "attempts": 0, "pr_url": null, "status": "created"}')
  save_state "$state"
  echo "DISPATCHED:$num:$branch:$worktree_path"
}

cmd_status() {
  local state=$(load_state)
  echo "=== Active ==="
  echo "$state" | jq -r '.active | to_entries[] | "\(.key): \(.value.branch) — \(.value.status)"' 2>/dev/null || echo "  None"
  echo "Completed: $(echo "$state" | jq '.completed | length')"
  echo "Worktrees:"; du -sh "$WORKTREE_ROOT"/*/ 2>/dev/null | head -10 || echo "  (empty)"
}

cmd_cleanup() {
  local state=$(load_state)
  for num in $(echo "$state" | jq -r '.active | keys[]'); do
    local gh_state=$(gh issue view "$num" --json state --jq '.state' 2>/dev/null || echo "unknown")
    if [ "$gh_state" = "closed" ] || [ "$gh_state" = "merged" ]; then
      local path=$(echo "$state" | jq -r ".active[\"$num\"].path")
      cd "$REPO_ROOT" && git worktree remove "$path" 2>/dev/null || rm -rf "$path"
      local branch=$(echo "$state" | jq -r ".active[\"$num\"].branch")
      state=$(echo "$state" | jq --arg num "$num" --arg branch "$branch" \
        '.completed += [$branch] | del(.active[$num])')
    fi
  done
  save_state "$state"
}

cmd_retry() {
  local num="$1"
  [ -z "$num" ] && { echo "Usage: $0 retry ISSUE_NUMBER"; exit 1; }
  local state=$(load_state)
  local path=$(echo "$state" | jq -r ".active[\"$num\"].path // empty")

  [ -z "$path" ] || [ ! -d "$path" ] && { echo "[retry] Issue #$num not found"; exit 1; }

  local attempts=$(echo "$state" | jq -r ".active[\"$num\"].attempts // 0")
  attempts=$((attempts + 1))

  local delay=$((10 * (1 << (attempts - 1))))
  [ "$delay" -gt 300 ] && delay=300
  sleep "$delay"

  state=$(echo "$state" | jq --arg num "$num" --argjson attempts "$attempts" \
    '.active[$num].attempts = $attempts | .active[$num].status = "retrying"')
  save_state "$state"
  echo "RETRY:$num"
}

cmd="${1:-poll}"
case "$cmd" in
  poll)     cmd_poll ;;
  status)   cmd_status ;;
  cleanup)  cmd_cleanup ;;
  retry)    cmd_retry "${2:-}" ;;
  *)        echo "Usage: $0 [poll|status|cleanup|retry N]" ;;
esac
