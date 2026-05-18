#!/usr/bin/env bash
# Sisyphus — multi-agent issue tracker daemon
# Version 3 — continuation turns, dispatch integration, proof-of-work
# All agents (Hermes, Claude, OMP, Pi) call this same script.
set -euo pipefail

REPO_ROOT="/data/projects/own/maplespike"
STATE_FILE="$REPO_ROOT/.sisyphus/state.json"
WORKTREE_PREFIX="$REPO_ROOT/worktrees"
DISPATCH_FILE="/data/agents/state/tasks.json"
REMOTE="origin"
MAX_CONCURRENT=3

mkdir -p "$(dirname "$STATE_FILE")"

load_state() {
  if [ -f "$STATE_FILE" ]; then cat "$STATE_FILE"; else echo '{"active":{},"completed":[]}'; fi
}

save_state() {
  local tmp=$(mktemp)
  echo "$1" > "$tmp"
  mv "$tmp" "$STATE_FILE"
}

slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g' | head -c 60
}

# ── Poll: find open issues, create worktrees ────────────────────────

cmd_poll() {
  local state=$(load_state)
  local active=$(echo "$state" | jq '.active')
  local running=$(echo "$active" | jq 'length')

  # Read issues into temp file to avoid pipefail issues
  local tmpfile=$(mktemp)
  gh issue list --state open --json number,title,labels \
    --jq '.[] | "\(.number)|\(.title)|\(.labels | map(.name) | join(","))"' \
    2>/dev/null > "$tmpfile" || true

  while IFS='|' read -r num title labels; do
    [ -z "$num" ] && continue
    [ "$running" -ge "$MAX_CONCURRENT" ] && break
    echo "$active" | jq -e "has(\"$num\")" >/dev/null 2>&1 && continue
    echo "$labels" | grep -qE "blocked|wontfix|duplicate" && continue

    dispatch_issue "$num" "$title" || true
    running=$((running + 1))
  done < "$tmpfile"
  rm -f "$tmpfile"
}

# ── Dispatch: create worktree (or reuse existing) ───────────────────

dispatch_issue() {
  local num="$1" title="$2"
  local slug=$(slugify "$title")
  local branch="issue-$num-$slug"
  local worktree_path="${WORKTREE_PREFIX}/${num}"

  # Create worktree if it doesn't exist
  if [ ! -d "$worktree_path" ]; then
    cd "$REPO_ROOT"
    git fetch "$REMOTE" main 2>/dev/null || true
    # Check if branch already exists (local or remote)
    if git rev-parse --verify "$branch" 2>/dev/null; then
      # Branch exists locally — check it out
      git worktree add "$worktree_path" "$branch" \
        || { echo "[dispatch] Failed worktree for existing branch #$num" >&2; return 1; }
    elif git fetch "$REMOTE" "$branch" 2>/dev/null; then
      # Branch exists on remote — use tracking ref
      git worktree add "$worktree_path" "$REMOTE/$branch" \
        || { echo "[dispatch] Failed worktree for existing remote branch #$num" >&2; return 1; }
    else
      # New branch from main
      git worktree add -b "$branch" "$worktree_path" "$REMOTE/main" \
        || { echo "[dispatch] Failed worktree for #$num" >&2; return 1; }
    fi
  fi

  # Update state
  local state=$(load_state)
  local label_status="created"
  # Check if this is a retry (re-dispatch of existing issue)
  echo "$state" | jq -e ".active[\"$num\"]" >/dev/null 2>&1 && label_status="re-dispatched"
  state=$(echo "$state" | jq --arg num "$num" --arg branch "$branch" --arg path "$worktree_path" --arg status "$label_status" \
    '.active[$num] = {"branch": $branch, "path": $path, "attempts": 0, "pr_url": null, "status": $status, "dispatched_by": "track.sh"}')
  save_state "$state"

  # Push to shared dispatch queue (if available)
  if [ -f "$DISPATCH_FILE" ]; then
    python3 /data/agents/dispatch.py add \
      "Implement issue #$num: $title" \
      --priority medium \
      --dispatch-to hermes \
      2>/dev/null || true
  fi

  echo "DISPATCHED:$num:$branch:$worktree_path"
}

# ── Status: show what's running ─────────────────────────────────────

cmd_status() {
  local state=$(load_state)
  local fmt="${1:-text}"

  if [ "$fmt" = "json" ]; then
    echo "$state"
    return
  fi

  echo "=== Active Issues ==="
  local count=0
  while IFS=: read -r num branch status; do
    printf "  #%-4s %-55s %s\n" "$num" "$(echo $branch | head -c 55)" "$status"
    count=$((count + 1))
  done < <(echo "$state" | jq -r '.active | to_entries[] | "\(.key):\(.value.branch):\(.value.status)"')
  [ "$count" -eq 0 ] && echo "  None"

  echo "=== Worktrees ==="
  git -C "$REPO_ROOT" worktree list 2>/dev/null | grep -v "^$REPO_ROOT " | \
    while IFS=' ' read -r wt branch rest; do
      echo "  $(basename "$wt") ($(du -sh "$wt" 2>/dev/null | awk '{print $1}'))"
    done
  local wt_count=$(git -C "$REPO_ROOT" worktree list 2>/dev/null | grep -v "^$REPO_ROOT " | wc -l)
  [ "$wt_count" -eq 0 ] && echo "  (none)"

  echo "=== Summary ==="
  echo "  Active: $(echo "$state" | jq '.active | length')"
  echo "  Completed: $(echo "$state" | jq '.completed | length')"
  echo "  Concurrency: $MAX_CONCURRENT"
}

# ── Cleanup: remove worktrees for closed issues ────────────────────

cmd_cleanup() {
  local state=$(load_state)
  local cleaned=0
  for num in $(echo "$state" | jq -r '.active | keys[]'); do
    local gh_state=$(gh issue view "$num" --json state --jq '.state' 2>/dev/null || echo "unknown")
    if [ "$gh_state" = "closed" ] || [ "$gh_state" = "merged" ]; then
      local path=$(echo "$state" | jq -r ".active[\"$num\"].path // \"${WORKTREE_PREFIX}-${num}\"")
      cd "$REPO_ROOT" && git worktree remove "$path" 2>/dev/null || rm -rf "$path"
      local branch=$(echo "$state" | jq -r ".active[\"$num\"].branch")
      state=$(echo "$state" | jq --arg num "$num" --arg branch "$branch" \
        '.completed += [$branch] | del(.active[$num])')
      echo "CLEANED:$num:$branch"
      cleaned=$((cleaned + 1))
    fi
  done
  save_state "$state"
  [ "$cleaned" -eq 0 ] && echo "Nothing to clean."
}

# ── Retry: exponential backoff, re-dispatch with continuation ──────

cmd_retry() {
  local num="$1"
  [ -z "$num" ] && { echo "Usage: $0 retry ISSUE_NUMBER"; exit 1; }
  local state=$(load_state)
  local path=$(echo "$state" | jq -r ".active[\"$num\"].path // empty")
  local branch=$(echo "$state" | jq -r ".active[\"$num\"].branch // empty")

  [ -z "$path" ] || [ ! -d "$path" ] && {
    echo "Issue #$num not active or worktree missing — re-dispatching..." >&2
    local title=$(gh issue view "$num" --json title --jq '.title' 2>/dev/null || echo "untitled")
    dispatch_issue "$num" "$title"
    path="${WORKTREE_PREFIX}-${num}"
    branch="issue-${num}-$(slugify "$title")"
  }

  local attempts=$(echo "$state" | jq -r ".active[\"$num\"].attempts // 0")
  attempts=$((attempts + 1))

  # Exponential backoff: 10s * 2^(attempt-1), max 5min
  local delay=$((10 * (1 << (attempts - 1))))
  [ "$delay" -gt 300 ] && delay=300

  # Fetch latest PR status for continuation context
  local pr_url=$(echo "$state" | jq -r ".active[\"$num\"].pr_url // empty")
  local ci_status="unknown"
  local pr_context=""
  if [ -n "$pr_url" ] && [ "$pr_url" != "null" ]; then
    local pr_num=$(echo "$pr_url" | grep -oP '/pull/\K[0-9]+')
    ci_status=$(gh pr view "$pr_num" --json state --jq '.state' 2>/dev/null || echo "unknown")
    pr_context="PR: $pr_url | CI: $ci_status"
  fi

  echo "[retry] Issue #$num attempt $attempts — backoff ${delay}s — $pr_context"
  sleep "$delay"

  # Update state
  state=$(echo "$state" | jq --arg num "$num" --argjson attempts "$attempts" \
    '.active[$num].attempts = $attempts | .active[$num].status = "retrying"')
  save_state "$state"

  echo "RETRY:$num:$attempts:$branch:$path"
}

# ── Continue: fetch PR context, re-dispatch with continuation context ──

cmd_continue() {
  local num="$1"
  [ -z "$num" ] && { echo "Usage: $0 continue ISSUE_NUMBER"; exit 1; }
  local state=$(load_state)
  local path=$(echo "$state" | jq -r ".active[\"$num\"].path // empty")
  local branch=$(echo "$state" | jq -r ".active[\"$num\"].branch // empty")

  [ -z "$path" ] || [ ! -d "$path" ] && {
    echo "Issue #$num not active — re-dispatched" >&2
    cmd_retry "$num"
    return
  }

  # Pull the latest from branch
  cd "$REPO_ROOT"
  git fetch "$REMOTE" "$branch" 2>/dev/null || true
  cd "$path" && git pull --ff-only 2>/dev/null || true

  # Read PR context
  local pr_url=$(echo "$state" | jq -r ".active[\"$num\"].pr_url // empty")
  local pr_num=""
  local ci_status="unknown"
  local review_summary=""
  local remaining_issues=""

  if [ -n "$pr_url" ] && [ "$pr_url" != "null" ]; then
    pr_num=$(echo "$pr_url" | grep -oP '/pull/\K[0-9]+')

    # Check CI status
    ci_status=$(gh pr view "$pr_num" --json statusCheckRollup \
      --jq '[.statusCheckRollup[] | select(.conclusion == "FAILURE" or .conclusion == "TIMED_OUT") | .name] | join(", ")' \
      2>/dev/null || echo "unknown")

    # Check for review comments requiring changes
    local changes_requested=$(gh pr view "$pr_num" --json reviews \
      --jq '[.reviews[] | select(.state == "CHANGES_REQUESTED")] | length' \
      2>/dev/null || echo "0")

    if [ "$changes_requested" -gt 0 ]; then
      review_summary="$changes_requested reviews requesting changes"
    fi

    # Check if PR is still open
    local pr_state=$(gh pr view "$pr_num" --json state --jq '.state' 2>/dev/null || echo "CLOSED")
    if [ "$pr_state" = "MERGED" ] || [ "$pr_state" = "CLOSED" ]; then
      echo "[continue] PR #$pr_num is $pr_state — nothing to continue"
      return
    fi
  fi

  # Build continuation context
  local attempts=$(echo "$state" | jq -r ".active[\"$num\"].attempts // 0")
  attempts=$((attempts + 1))

  local delay=$((10 * (1 << (attempts - 1))))
  [ "$delay" -gt 300 ] && delay=300
  sleep "$delay"

  # Update state
  state=$(echo "$state" | jq --arg num "$num" --argjson attempts "$attempts" \
    '.active[$num].attempts = $attempts | .active[$num].status = "continuation"')
  save_state "$state"

  echo "CONTINUE:$num:$attempts:$branch:$path"
  echo "CONTEXT:PR=$pr_url|CI=$ci_status|REVIEWS=$review_summary"
}

# ── Mark complete: manually mark an issue as done ──────────────────

cmd_done() {
  local num="$1"
  local pr_url="${2:-}"
  [ -z "$num" ] && { echo "Usage: $0 done ISSUE_NUMBER [PR_URL]"; exit 1; }
  local state=$(load_state)
  state=$(echo "$state" | jq --arg num "$num" --arg pr_url "$pr_url" \
    '.active[$num].status = "completed" | if $pr_url != "" then .active[$num].pr_url = $pr_url else . end')
  save_state "$state"
  echo "MARKED_COMPLETE:$num"
}

# ── Proof: verify proof-of-work for an issue ──────────────────────

cmd_proof() {
  local num="${1:-}"
  if [ -z "$num" ]; then
    # If no number given, check all active issues
    local state=$(load_state)
    for num in $(echo "$state" | jq -r '.active | to_entries[] | select(.value.status != "completed") | .key'); do
      cmd_proof "$num"
    done
    return
  fi

  local state=$(load_state)
  local status=$(echo "$state" | jq -r ".active[\"$num\"].status // empty")
  [ -z "$status" ] && { echo "Issue #$num not tracked"; return; }

  local path=$(echo "$state" | jq -r ".active[\"$num\"].path // \"${WORKTREE_PREFIX}-${num}\"")
  local branch=$(echo "$state" | jq -r ".active[\"$num\"].branch // empty")
  local pr_url=$(echo "$state" | jq -r ".active[\"$num\"].pr_url // empty")

  local passed=0
  local total=3

  echo "=== Proof of Work: #$num ($branch) ==="

  # Check 1: Worktree exists and branch matches
  if [ -f "$path/.git" ] || [ -d "$path/.git" ]; then
    local current_branch=$(cd "$path" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "detached")
    if [ "$current_branch" = "$branch" ] || [ "$current_branch" = "detached" ]; then
      echo "  [✅] Worktree: $path ($current_branch)"
      passed=$((passed + 1))
    else
      echo "  [❌] Wrong branch: $current_branch (expected $branch)"
    fi
  else
    echo "  [❌] Worktree missing: $path"
  fi

  # Check 2: PR exists and is open
  if [ -n "$pr_url" ] && [ "$pr_url" != "null" ]; then
    local pr_num=$(echo "$pr_url" | grep -oP '/pull/\K[0-9]+')
    local pr_state=$(gh pr view "$pr_num" --json state --jq '.state' 2>/dev/null || echo "unknown")
    if [ "$pr_state" = "OPEN" ]; then
      echo "  [✅] PR open: $pr_url"
      passed=$((passed + 1))
    else
      echo "  [❌] PR state: $pr_state ($pr_url)"
    fi
  else
    # Check if branch has been pushed
    if [ -n "$branch" ]; then
      local remote_exists=$(cd "$path" && git ls-remote --heads "$REMOTE" "$branch" 2>/dev/null | wc -l)
      if [ "$remote_exists" -gt 0 ]; then
        echo "  [⏳] Branch pushed, no PR yet: $branch"
      else
        echo "  [⏳] Branch not yet pushed"
      fi
    fi
  fi

  # Check 3: CI passing (if PR exists)
  if [ -n "$pr_url" ] && [ "$pr_url" != "null" ]; then
    local pr_num=$(echo "$pr_url" | grep -oP '/pull/\K[0-9]+')
    local ci_status=$(gh pr view "$pr_num" --json statusCheckRollup \
      --jq '[.statusCheckRollup[] | select(.name | test("CI|test|build")) | "\(.name)=\(.conclusion)"] | join("; ")' \
      2>/dev/null || echo "no CI checks")
    if echo "$ci_status" | grep -qi "SUCCESS"; then
      echo "  [✅] CI: $ci_status"
      passed=$((passed + 1))
    else
      echo "  [❌] CI: $ci_status"
    fi
  fi

  echo ""
  echo "Result: $passed/$total checks passed"
  if [ "$passed" -eq "$total" ]; then
    echo "Status: ✅ All proof-of-work gates satisfied"
  elif [ "$passed" -gt 0 ]; then
    echo "Status: ⏳ In progress ($passed/$total)"
  else
    echo "Status: ❌ Not started"
  fi
}

# ── Main ──────────────────────────────────────────────────────────

cmd="${1:-help}"
case "$cmd" in
  poll)       cmd_poll ;;
  status)     cmd_status "${2:-text}" ;;
  cleanup)    cmd_cleanup ;;
  retry)      cmd_retry "${2:-}" ;;
  continue)   cmd_continue "${2:-}" ;;
  done)       cmd_done "${2:-}" "${3:-}" ;;
  proof)      cmd_proof "${2:-}" ;;
  dispatch)   dispatch_issue "${2:-}" "${3:-}" ;;
  help|*)
    echo "Sisyphus — multi-agent issue tracker (v3)"
    echo ""
    echo "Commands:"
    echo "  poll                  Poll open issues, create worktrees"
    echo "  status  [text|json]   Show active worktrees and state"
    echo "  cleanup               Remove worktrees for closed issues"
    echo "  retry   N             Retry an issue (exponential backoff)"
    echo "  continue N            Continue work on a PR (fetch latest, re-dispatch)"
    echo "  done    N [PR_URL]    Mark issue complete"
    echo "  proof   [N]           Check proof-of-work (all or by number)"
    echo "  dispatch N title      Manually create a worktree"
    echo ""
    echo "All tools (Hermes, Claude, OMP, Pi) should use this script."
    echo "Worktrees go to ${WORKTREE_PREFIX}/{num}"
    ;;
esac
