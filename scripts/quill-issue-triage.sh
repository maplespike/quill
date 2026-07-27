#!/usr/bin/env bash
# Auto-triage new GitHub issues
# Labels by keyword matching, assigns priority
# Usage: maplespike-issue-triage.sh <issue-number> <repo>
set -euo pipefail

ISSUE_NUMBER="${1:?}"
REPO="${2:-reverb256/quill}"

# Get issue data
ISSUE_JSON=$(gh issue view "$ISSUE_NUMBER" --repo "$REPO" --json title,body)
TITLE=$(echo "$ISSUE_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['title'].lower())")
BODY=$(echo "$ISSUE_JSON" | python3 -c "import sys,json; print((json.load(sys.stdin).get('body') or '').lower())")
COMBINED="$TITLE $BODY"

# Determine type by keyword matching
LABELS=()
if echo "$COMBINED" | grep -qiE 'bug|broken|fail|error|crash|regression|incorrect|wrong'; then
  LABELS+=("bug")
elif echo "$COMBINED" | grep -qiE 'feature|request|want|would like|suggestion'; then
  LABELS+=("enhancement")
elif echo "$COMBINED" | grep -qiE 'doc|readme|docs|documentation|tutorial|guide'; then
  LABELS+=("documentation")
elif echo "$COMBINED" | grep -qiE 'infra|deploy|ci|cd|cluster|pipeline|k3s|k8s'; then
  LABELS+=("infrastructure")
elif echo "$COMBINED" | grep -qiE 'sec|vuln|depend|cve|patch'; then
  LABELS+=("security")
elif echo "$COMBINED" | grep -qiE 'question|how|what is|help|confused'; then
  LABELS+=("question")
else
  LABELS+=("triage")
fi

# Priority scoring
if echo "$COMBINED" | grep -qiE 'critical|blocker|crash|data.loss|security|p0'; then
  LABELS+=("p0")
elif echo "$COMBINED" | grep -qiE 'urgent|important|broken|high|p1'; then
  LABELS+=("p1")
elif echo "$COMBINED" | grep -qiE 'minor|nit|nice.to.have|low|p3'; then
  LABELS+=("p3")
else
  LABELS+=("p2")
fi

# Check if auto-generated
if echo "$COMBINED" | grep -qiE 'auto-generated|automatically generated|automatically created'; then
  LABELS+=("auto-generated")
fi

# Apply labels
for label in "${LABELS[@]}"; do
  gh label create "$label" --repo "$REPO" 2>/dev/null || true
  gh issue edit "$ISSUE_NUMBER" --repo "$REPO" --add-label "$label"
done

echo "auto-triage: applied ${LABELS[*]} to #$ISSUE_NUMBER"
