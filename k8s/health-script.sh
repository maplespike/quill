#!/usr/bin/env bash
set -euo pipefail

NAMESPACE=maplespike
DOMAIN=maplespike.lan
TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID:-1384182343}
AI_GATEWAY=ai-inference-gateway.ai-inference.svc.cluster.local:8080
QDRANT=qdrant.ai-inference.svc.cluster.local:6333
ERRORS=()
WARNINGS=()

error() {
  ERRORS+=("FAIL $1")
}

warning() {
  WARNINGS+=("WARN $1")
}

check_endpoint() {
  local name=$1 url=$2 expected=${3:-200}
  echo -n "  Checking $name... "
  STATUS=$(curl -sk -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  if [ "$STATUS" = "$expected" ]; then
    echo "OK ($STATUS)"
  else
    echo "FAIL ($STATUS)"
    error "$name: HTTP $STATUS"
  fi
}

check_pods() {
  echo "  Checking pods..."
  FAILED=$(kubectl get pods -n "$NAMESPACE" -o json | jq -r '.items[] | select(.status.phase!="Running") | .metadata.name' 2>/dev/null || true)
  [ -n "$FAILED" ] && error "Pods not running: $FAILED"
  RESTARTS=$(kubectl get pods -n "$NAMESPACE" -o json | jq -r '.items[] | "\(.metadata.name) \(.status.containerStatuses[0].restartCount // 0)"' 2>/dev/null | awk '$2>0 {print $1 ": " $2 " restarts"}' || true)
  [ -n "$RESTARTS" ] && warning "$RESTARTS"
}

check_logs() {
  echo "  Checking logs (24h)..."
  API_ERRORS=$(kubectl logs -n "$NAMESPACE" -l app=quill-api --since=24h 2>/dev/null | grep -iE "error|fail" | tail -2 || true)
  [ -n "$API_ERRORS" ] && warning "API errors: $API_ERRORS"
}

check_ai() {
  echo "  Checking AI..."
  check_endpoint "AI Gateway" "http://$AI_GATEWAY/v1/models" "200"
  curl -sk "http://$QDRANT/health" > /dev/null 2>&1 || error "Qdrant failed"
}

check_storage() {
  echo "  Checking storage..."
  UNBOUND=$(kubectl get pvc -n "$NAMESPACE" -o json | jq -r '.items[] | select(.status.phase!="Bound") | .metadata.name' 2>/dev/null || true)
  [ -n "$UNBOUND" ] && error "PVC unbound: $UNBOUND"
}

send_alert() {
  local status=$1 message=$2
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ]; then
    ts=$(date --iso-8601=seconds)
    msg=$(echo "$message" | tr '\n' ' ')
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" -d "text=MapleSpike [$status] $ts: $msg" > /dev/null
  else
    echo "[$status] $message"
  fi
}

echo "=== MapleSpike Health Check ==="
echo "Time: $(date --iso-8601=seconds)"
check_endpoint "Portal" "https://$DOMAIN/" "200"
check_endpoint "API" "https://api.$DOMAIN/v1/health" "200"
echo ""
check_pods
check_storage
check_ai
check_logs
echo "=== Summary ==="
if [ ${#ERRORS[@]} -eq 0 ] && [ ${#WARNINGS[@]} -eq 0 ]; then
  echo "OK: All systems operational"
  send_alert "OK" "All systems operational"
else
  [ ${#ERRORS[@]} -gt 0 ] && echo "ERRORS:" && printf "%s\n" "${ERRORS[@]}"
  [ ${#WARNINGS[@]} -gt 0 ] && echo "WARNINGS:" && printf "%s\n" "${WARNINGS[@]}"
  msg=$(printf "%s\n" "${ERRORS[@]}" "${WARNINGS[@]}" | tr '\n' ' ')
  if [ ${#ERRORS[@]} -gt 0 ]; then
    send_alert "FAILED" "$msg"
    exit 1
  else
    send_alert "WARNING" "$msg"
    exit 0
  fi
fi