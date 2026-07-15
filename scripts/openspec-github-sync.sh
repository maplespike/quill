#!/usr/bin/env bash
# OpenSpec ↔ GitHub Issue Sync
# Bridges OpenSpec change lifecycle to GitHub issues.
# Called by openspec-* skills after propose/archive actions.
#
# Usage:
#   openspec-github-sync.sh propose <change-name> <repo-path>
#     → Creates GitHub issue, stores issue number in .openspec.yaml
#   openspec-github-sync.sh archive <change-name> <repo-path>
#     → Closes the linked GitHub issue
#   openspec-github-sync.sh status <change-name> <repo-path>
#     → Shows the linked GitHub issue status
set -euo pipefail

ACTION="${1:?Usage: openspec-github-sync.sh <propose|archive|status> <change-name> <repo-path>}"
CHANGE_NAME="${2:?}"
REPO_PATH="${3:?}"
GH_REPO="reverb256/maplespike"

CHANGE_DIR="$REPO_PATH/openspec/changes/$CHANGE_NAME"
META_FILE="$CHANGE_DIR/.openspec.yaml"
ARCHIVE_DIR="$REPO_PATH/openspec/changes/archive"

case "$ACTION" in
  propose)
    # Check if already linked
    if [ -f "$META_FILE" ] && grep -q "github_issue" "$META_FILE" 2>/dev/null; then
      echo "→ Already linked to issue: $(grep github_issue "$META_FILE")"
      exit 0
    fi

    # Read proposal summary for the issue body
    PROPOSAL_FILE="$CHANGE_DIR/proposal.md"
    PROPOSAL_BODY=""
    if [ -f "$PROPOSAL_FILE" ]; then
      PROPOSAL_BODY=$(head -30 "$PROPOSAL_FILE")
    fi

    # Create GitHub issue
    ISSUE_URL=$(gh issue create \
      --repo "$GH_REPO" \
      --title "change: $CHANGE_NAME" \
      --label "openspec" \
      --body "## OpenSpec Change: \`$CHANGE_NAME\`

**Status:** Proposed
**Location:** \`openspec/changes/$CHANGE_NAME/\`

### Summary
$PROPOSAL_BODY

---
_Automatically created by openspec-github-sync_")

    echo "→ Created: $ISSUE_URL"

    # Extract issue number and store in .openspec.yaml
    ISSUE_NUMBER=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
    if [ -f "$META_FILE" ]; then
      echo "github_issue: $ISSUE_NUMBER" >> "$META_FILE"
    else
      echo "---" > "$META_FILE"
      echo "github_issue: $ISSUE_NUMBER" >> "$META_FILE"
    fi
    echo "→ Linked issue #$ISSUE_NUMBER to change metadata"
    ;;

  archive)
    if [ ! -f "$META_FILE" ]; then
      echo "→ No .openspec.yaml found — checking archive..."
      # Try finding in archive
      for f in "$ARCHIVE_DIR"/*-"$CHANGE_NAME"/.openspec.yaml; do
        [ -f "$f" ] && META_FILE="$f" && break
      done
      if [ ! -f "$META_FILE" ]; then
        echo "→ No linked issue found, skipping"
        exit 0
      fi
    fi

    ISSUE_NUMBER=$(grep "github_issue:" "$META_FILE" | sed 's/.*: //')
    if [ -z "$ISSUE_NUMBER" ]; then
      echo "→ No linked issue found, skipping"
      exit 0
    fi

    # Read the change summary for the close comment
    CHANGE_SUMMARY="Change archived: \`$CHANGE_NAME\`"
    SUMMARY_FILE="$REPO_PATH/openspec/changes/archive/"*"-$CHANGE_NAME/proposal.md"
    for f in $SUMMARY_FILE; do
      if [ -f "$f" ]; then
        CHANGE_SUMMARY=$(head -10 "$f")
        break
      fi
    done

    gh issue close "$ISSUE_NUMBER" \
      --repo "$GH_REPO" \
      --comment "## ✅ Change Archived: \`$CHANGE_NAME\`

$CHANGE_SUMMARY

---
_Automatically closed by openspec-github-sync_"

    echo "→ Closed issue #$ISSUE_NUMBER"
    ;;

  status)
    if [ -f "$META_FILE" ]; then
      ISSUE_NUMBER=$(grep "github_issue:" "$META_FILE" | sed 's/.*: //')
      if [ -n "$ISSUE_NUMBER" ]; then
        gh issue view "$ISSUE_NUMBER" --repo "$GH_REPO"
      else
        echo "→ No linked issue"
      fi
    else
      echo "→ No .openspec.yaml at $META_FILE"
    fi
    ;;

  *)
    echo "Usage: $0 <propose|archive|status> <change-name> <repo-path>"
    exit 1
    ;;
esac
