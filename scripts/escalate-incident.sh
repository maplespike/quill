#!/usr/bin/env bash
# =============================================================================
# MapleSpike — Escalation Workflow Handler
# Creates incidents and notifies on-call when auto-remediation fails
# Usage: ./scripts/escalate-incident.sh [incident_type] [details_json]
# =============================================================================
set -euo pipefail

# Configuration
INCIDENT_LOG="/tmp/incidents-$(date +%Y%m%d).json"
GITHUB_REPO="${GITHUB_REPO:-reverb256/maplespike}"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"
PAGERDUTY_KEY="${PAGERDUTY_ROUTING_KEY:-}"

# Incident types
INCIDENT_TYPES=(
  "deployment_failure"
  "rollback_triggered"
  "health_check_failed"
  "test_flaky_repeated"
  "cluster_resource_exhaustion"
)

log() {
  echo "[$(date -Iseconds)] [ESCALATION] $*" | tee -a /tmp/escalation.log
}

# Create GitHub issue for incident
create_github_issue() {
  local title=$1
  local body=$2
  local labels=$3
  
  if [ -z "${GITHUB_TOKEN:-}" ]; then
    log "⚠️ GITHUB_TOKEN not set — skipping GitHub issue creation"
    return 1
  fi
  
  log "Creating GitHub issue: $title"
  
  local response
  response=$(curl -sf -X POST \
    "https://api.github.com/repos/${GITHUB_REPO}/issues" \
    -H "Authorization: token ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    -d "{
      \"title\": \"$title\",
      \"body\": \"$body\",
      \"labels\": [$labels]
    }" 2>&1) || {
    log "❌ Failed to create GitHub issue: $response"
    return 1
  }
  
  local issue_number
  issue_number=$(echo "$response" | python3 -c "import json,sys; print(json.load(sys.stdin).get('number', 'unknown'))")
  local issue_url
  issue_url=$(echo "$response" | python3 -c "import json,sys; print(json.load(sys.stdin).get('html_url', ''))")
  
  log "✅ Created issue #$issue_number: $issue_url"
  echo "$issue_url"
}

# Send Slack notification
send_slack_alert() {
  local severity=$1
  local title=$2
  local details=$3
  local incident_url=$4
  
  if [ -z "$SLACK_WEBHOOK" ]; then
    log "⚠️ SLACK_WEBHOOK_URL not set — skipping Slack notification"
    return 1
  fi
  
  local color
  case "$severity" in
    critical) color="danger" ;;
    high) color="#ff9800" ;;
    medium) color="#ffeb3b" ;;
    low) color="#4caf50" ;;
    *) color="#808080" ;;
  esac
  
  log "Sending Slack alert: $title"
  
  curl -sf -X POST "$SLACK_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d "{
      \"attachments\": [
        {
          \"color\": \"$color\",
          \"fallback\": \"$title\",
          \"blocks\": [
            {
              \"type\": \"header\",
              \"text\": {
                \"type\": \"plain_text\",
                \"text\": \"${severity^^}: $title\"
              }
            },
            {
              \"type\": \"section\",
              \"text\": {
                \"type\": \"mrkdwn\",
                \"text\": \"$details\"
              }
            }$(if [ -n "$incident_url" ]; then echo ",
            {
              \"type\": \"section\",
              \"text\": {
                \"type\": \"mrkdwn\",
                \"text\": \"📋 Incident: <$incident_url|View Details>\"
              }
            }"
          fi)
          ]
        }
      ]
    }" || {
    log "❌ Failed to send Slack alert"
    return 1
  }
  
  log "✅ Slack alert sent"
}

# Send PagerDuty alert (for critical incidents)
send_pagerduty_alert() {
  local summary=$1
  local severity=$2
  local details=$3
  
  if [ -z "$PAGERDUTY_KEY" ]; then
    log "⚠️ PAGERDUTY_ROUTING_KEY not set — skipping PagerDuty alert"
    return 1
  fi
  
  log "Sending PagerDuty alert: $summary"
  
  curl -sf -X POST "https://events.pagerduty.com/v2/enqueue" \
    -H "Content-Type: application/json" \
    -d "{
      \"routing_key\": \"$PAGERDUTY_KEY\",
      \"event_action\": \"trigger\",
      \"payload\": {
        \"summary\": \"$summary\",
        \"severity\": \"$severity\",
        \"source\": \"maplespike-ci\",
        \"timestamp\": \"$(date -Iseconds)\",
        \"details\": $details
      }
    }" || {
    log "❌ Failed to send PagerDuty alert"
    return 1
  }
  
  log "✅ PagerDuty alert sent"
}

# Record incident in log
record_incident() {
  local incident_type=$1
  local severity=$2
  local title=$3
  local details=$4
  local github_url=$5
  
  python3 << PYEOF
import json
from datetime import datetime
import os

log_file = "$INCIDENT_LOG"

# Load existing incidents or create new
if os.path.exists(log_file):
    with open(log_file, "r") as f:
        incidents = json.load(f)
else:
    incidents = {"incidents": []}

# Add new incident
incident = {
    "id": "inc_$(date +%s)_$RANDOM",
    "timestamp": "$(date -Iseconds)",
    "type": "$incident_type",
    "severity": "$severity",
    "title": """$title""",
    "details": """$details""",
    "github_url": "$github_url",
    "status": "open"
}

incidents["incidents"].append(incident)

# Write back
with open(log_file, "w") as f:
    json.dump(incidents, f, indent=2)

print(json.dumps(incident, indent=2))
PYEOF
}

# Main escalation logic
escalate() {
  local incident_type=$1
  local details_json=$2
  
  log "Starting escalation for: $incident_type"
  
  # Validate incident type
  if [[ ! " ${INCIDENT_TYPES[*]} " =~ " ${incident_type} " ]]; then
    log "❌ Unknown incident type: $incident_type"
    exit 1
  fi
  
  # Determine severity based on incident type
  local severity="medium"
  local title=""
  case "$incident_type" in
    deployment_failure)
      severity="critical"
      title="🚨 Deployment Failure — Auto-remediation Failed"
      ;;
    rollback_triggered)
      severity="high"
      title="⚠️ Automatic Rollback Triggered"
      ;;
    health_check_failed)
      severity="high"
      title="⚠️ Health Checks Failed After Deployment"
      ;;
    test_flaky_repeated)
      severity="medium"
      title="⚠️ Repeated Flaky Test Failures Detected"
      ;;
    cluster_resource_exhaustion)
      severity="critical"
      title="🚨 Cluster Resource Exhaustion"
      ;;
  esac
  
  # Create GitHub issue
  local github_url
  github_url=$(create_github_issue \
    "$title" \
    "## Incident Details\n\n**Type**: $incident_type\n**Severity**: $severity\n**Time**: $(date -Iseconds)\n\n\`\`\`json\n$details_json\n\`\`\`\n\n## Auto-generated\nThis issue was created by the escalation workflow after auto-remediation failed." \
    "\"incident\", \"$incident_type\", \"$severity\"") || github_url=""
  
  # Record incident
  record_incident "$incident_type" "$severity" "$title" "$details_json" "$github_url"
  
  # Send Slack notification
  send_slack_alert "$severity" "$title" "$details_json" "$github_url"
  
  # Send PagerDuty for critical incidents
  if [ "$severity" = "critical" ]; then
    send_pagerduty_alert "$title" "$severity" "$details_json"
  fi
  
  log "✅ Escalation complete"
}

# Parse command line
if [ $# -lt 2 ]; then
  echo "Usage: $0 <incident_type> <details_json>"
  echo "Incident types: ${INCIDENT_TYPES[*]}"
  exit 1
fi

escalate "$1" "$2"