#!/usr/bin/env bash
# kanban-post.sh — post a task to the MapleSpike kanban board (nexus dispatcher).
#
# WHY THIS EXISTS (2026-09-22): the kanban board + Hermes dispatcher live on
# nexus. Self-hosted runners serve several boards across hosts; a runner-local
# `hermes kanban create` strands the card in the wrong DB (e.g. an empty
# "default" board on sentry) where the dispatcher never sees it. This script
# always targets nexus's board: local CLI when we ARE nexus, ssh hop otherwise.
#
# Usage:
#   kanban-post.sh --title "T" --body-file /tmp/body.md \
#                  [--assignee backend-eng] [--priority 2] [--idem KEY]
#
# Env: KANBAN_BOARD (default: maplespike)
set -euo pipefail

BOARD="${KANBAN_BOARD:-maplespike}"
TITLE="" BODY_FILE="" ASSIGNEE="backend-eng" PRIORITY=2 IDEM="" WORKSPACE="" BRANCH=""
while [ $# -gt 0 ]; do
  case "$1" in
    --title) TITLE="$2"; shift 2;;
    --body-file) BODY_FILE="$2"; shift 2;;
    --assignee) ASSIGNEE="$2"; shift 2;;
    --priority) PRIORITY="$2"; shift 2;;
    --idem) IDEM="$2"; shift 2;;
    --workspace) WORKSPACE="$2"; shift 2;;
    --branch) BRANCH="$2"; shift 2;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done
[ -n "$TITLE" ] && [ -f "$BODY_FILE" ] || { echo "need --title and --body-file" >&2; exit 2; }

if [ "$(hostname -s)" = "nexus" ]; then
  BODY=$(cat "$BODY_FILE")
  hermes kanban --board "$BOARD" create "$TITLE" \
    --body "$BODY" --assignee "$ASSIGNEE" --priority "$PRIORITY" \
    ${IDEM:+--idempotency-key "$IDEM"} \
    ${WORKSPACE:+--workspace "$WORKSPACE"} \
    ${BRANCH:+--branch "$BRANCH"} \
    --created-by gh-ci-doctor --json | head -c 400
else
  BODY_B64=$(base64 -w0 "$BODY_FILE")
  ssh -o BatchMode=yes -o ConnectTimeout=10 nexus "bash -s" <<REMOTE
set -e
BODY=\$(echo '$BODY_B64' | base64 -d)
hermes kanban --board '$BOARD' create '$TITLE' \
  --body "\$BODY" --assignee '$ASSIGNEE' --priority '$PRIORITY' \
  ${IDEM:+--idempotency-key '$IDEM'} \
  ${WORKSPACE:+--workspace '$WORKSPACE'} \
  ${BRANCH:+--branch '$BRANCH'} \
  --created-by gh-ci-doctor --json | head -c 400
REMOTE
fi
