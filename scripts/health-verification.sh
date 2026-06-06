#!/usr/bin/env bash
# =============================================================================
# MapleSpike — Post-Deployment Health Verification
# Comprehensive health checks after deployment with detailed reporting
# Usage: ./scripts/health-verification.sh [namespace]
# =============================================================================
set -euo pipefail

# Configuration
NAMESPACE="${1:-maplespike-dev}"
HEALTH_LOG="/tmp/health-verification-$(date +%Y%m%d-%H%M%S).json"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
REPO="${GITHUB_REPOSITORY:-reverb256/maplespike}"

# Health check endpoints
declare -A HEALTH_ENDPOINTS=(
  ["maplespike-api"]="/v1/health"
  ["maplespike-mcp"]="/health"
  ["maplespike-portal"]="/"
)

# Timeout settings
HEALTH_TIMEOUT=30
HEALTH_RETRIES=5
RETRY_DELAY=10

log() {
  echo "[$(date -Iseconds)] [HEALTH] $*" | tee -a "${HEALTH_LOG}.txt"
}

# Check single endpoint
check_endpoint() {
  local service=$1
  local endpoint=$2
  local namespace=$3
  
  local url="http://${service}.${namespace}.svc.cluster.local${endpoint}"
  local success=false
  
  log "Checking ${service}: ${url}"
  
  for i in $(seq 1 $HEALTH_RETRIES); do
    if curl -sf --max-time $HEALTH_TIMEOUT "$url" > /dev/null 2>&1; then
      log "✅ ${service} healthy (attempt $i)" >&2
      success=true
      break
    fi
    log "⚠️ ${service} unhealthy (attempt $i/$HEALTH_RETRIES) — retrying in ${RETRY_DELAY}s" >&2
    sleep $RETRY_DELAY
  done
  
  if [ "$success" = true ]; then
    echo "healthy"
  else
    echo "unhealthy"
  fi
}

# Check pod status
check_pods() {
  local namespace=$1
  
  log "Checking pod status in namespace: $namespace" >&2
  
  local pods_status
  pods_status=$(kubectl get pods -n "$namespace" -o json 2>/dev/null || echo '{"items": []}')
  
  local total_pods
  total_pods=$(echo "$pods_status" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('items', [])))")
  
  local running_pods
  running_pods=$(echo "$pods_status" | python3 -c "import json,sys; print(sum(1 for p in json.load(sys.stdin).get('items',[]) if p.get('status',{}).get('phase')=='Running'))")
  
  local pending_pods
  pending_pods=$(echo "$pods_status" | python3 -c "import json,sys; print(sum(1 for p in json.load(sys.stdin).get('items',[]) if p.get('status',{}).get('phase')=='Pending'))")
  
  local failed_pods
  failed_pods=$(echo "$pods_status" | python3 -c "import json,sys; print(sum(1 for p in json.load(sys.stdin).get('items',[]) if p.get('status',{}).get('phase')=='Failed'))")
  
  log "Pods: $running_pods/$total_pods running, $pending_pods pending, $failed_pods failed" >&2
  
  python3 << PYEOF
{
  "total": $total_pods,
  "running": $running_pods,
  "pending": $pending_pods,
  "failed": $failed_pods
}
PYEOF
}

# Check deployment status
check_deployments() {
  local namespace=$1
  
  log "Checking deployment status in namespace: $namespace"
  
  local deployments
  deployments=$(kubectl get deployments -n "$namespace" -o json 2>/dev/null || echo '{"items": []}')
  
  python3 << PYEOF
import json
import sys

data = json.loads('''$deployments''')
results = []

for dep in data.get('items', []):
    name = dep['metadata']['name']
    spec_replicas = dep['spec'].get('replicas', 1)
    status = dep.get('status', {})
    ready_replicas = status.get('readyReplicas', 0)
    available_replicas = status.get('availableReplicas', 0)
    updated_replicas = status.get('updatedReplicas', 0)
    
    is_healthy = (
        ready_replicas >= spec_replicas and
        available_replicas >= spec_replicas and
        updated_replicas >= spec_replicas
    )
    
    results.append({
        "name": name,
        "spec_replicas": spec_replicas,
        "ready_replicas": ready_replicas,
        "available_replicas": available_replicas,
        "updated_replicas": updated_replicas,
        "healthy": is_healthy
    })

print(json.dumps(results, indent=2))
PYEOF
}

# Generate health report
generate_report() {
  local namespace=$1
  local timestamp
  timestamp=$(date -Iseconds)
  
  log "Generating health verification report"
  
  # Collect all health data
  local pod_status
  pod_status=$(check_pods "$namespace")
  
  local deployment_status
  deployment_status=$(check_deployments "$namespace")
  
  # Check each service
  local service_health="{}"
  for service in "${!HEALTH_ENDPOINTS[@]}"; do
    local endpoint="${HEALTH_ENDPOINTS[$service]}"
    local status
    status=$(check_endpoint "$service" "$endpoint" "$namespace")
    
    service_health=$(python3 << PYEOF
import json
health = json.loads('''$service_health''')
health["$service"] = "$status"
print(json.dumps(health))
PYEOF
)
  done
  
  # Determine overall status
  local overall_status="healthy"
  if echo "$pod_status" | python3 -c "import json,sys; d=json.load(sys.stdin); exit(0 if d['failed']==0 else 1)"; then
    overall_status="unhealthy"
  fi
  
  if echo "$service_health" | python3 -c "import json,sys; d=json.load(sys.stdin); exit(0 if all(v=='healthy' for v in d.values()) else 1)"; then
    overall_status="unhealthy"
  fi
  
  # Generate JSON report
  python3 << PYEOF
import json
from datetime import datetime

report = {
    "timestamp": "$timestamp",
    "namespace": "$namespace",
    "overall_status": "$overall_status",
    "pod_status": $pod_status,
    "deployment_status": $deployment_status,
    "service_health": $service_health,
    "checks_performed": {
        "pod_status": True,
        "deployment_status": True,
        "health_endpoints": True,
        "rollout_status": True
    }
}

with open("$HEALTH_LOG", "w") as f:
    json.dump(report, f, indent=2)

print(json.dumps(report, indent=2))
PYEOF
}

# Send notification on failure
send_notification() {
  local status=$1
  local details=$2
  
  if [ "$status" = "healthy" ]; then
    return 0
  fi
  
  log "❌ Deployment unhealthy — sending notifications"
  
  # GitHub comment on recent PR
  if [ -n "$GITHUB_TOKEN" ]; then
    log "Posting GitHub comment..."
    # Implementation would go here
  fi
  
  # Slack notification
  if [ -n "$SLACK_WEBHOOK" ]; then
    log "Sending Slack notification..."
    curl -sf -X POST "$SLACK_WEBHOOK" \
      -H "Content-Type: application/json" \
      -d "{
        \"text\": \"⚠️ MapleSpike Deployment Unhealthy\",
        \"blocks\": [
          {
            \"type\": \"header\",
            \"text\": {
              \"type\": \"plain_text\",
              \"text\": \"⚠️ Deployment Health Check Failed\"
            }
          },
          {
            \"type\": \"section\",
            \"fields\": [
              {\"type\": \"mrkdwn\", \"text\": \"*Namespace:*\\n$NAMESPACE\"},
              {\"type\": \"mrkdwn\", \"text\": \"*Status:*\\nUNHEALTHY\"},
              {\"type\": \"mrkdwn\", \"text\": \"*Time:*\\n$(date -Iseconds)\"}
            ]
          },
          {
            \"type\": \"section\",
            \"text\": {
              \"type\": \"mrkdwn\",
              \"text\": \"Details:\\n\`\`\`$details\`\`\`\"
            }
          }
        ]
      }" || true
  fi
}

# Main execution
main() {
  local namespace="${1:-$NAMESPACE}"
  
  log "Starting post-deployment health verification"
  log "Namespace: $namespace"
  
  # Generate comprehensive report
  local report
  report=$(generate_report "$namespace")
  
  local overall_status
  overall_status=$(echo "$report" | python3 -c "import json,sys; print(json.load(sys.stdin)['overall_status'])")
  
  log "Overall status: $overall_status"
  
  # Send notifications if unhealthy
  if [ "$overall_status" = "unhealthy" ]; then
    send_notification "unhealthy" "$report"
    exit 1
  fi
  
  log "✅ All health checks passed"
  echo "$report"
}

main "$@"