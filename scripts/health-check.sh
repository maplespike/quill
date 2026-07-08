#!/usr/bin/env bash
set -euo pipefail

# MapleSpike Health Check Script
# Run as CronJob in k8s, alerts via Telegram on failure

NAMESPACE="maplespike"
DOMAIN="maplespike.lan"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-1384182343}"
AI_GATEWAY="ai-inference-gateway.ai-inference.svc.cluster.local:8080"
QDRANT="qdrant.ai-inference.svc.cluster.local:6333"

ERRORS=()
WARNINGS=()

# Helper: Add error
error() {
  ERRORS+=("❌ $1")
}

# Helper: Add warning
warning() {
  WARNINGS+=("⚠️  $1")
}

# Helper: Check HTTP endpoint
check_endpoint() {
  local name="$1"
  local url="$2"
  local expected="${3:-200}"

  echo -n "  Checking $name ($url)... "
  if STATUS=$(curl -sk -o /dev/null -w "%{http_code}" "$url" 2>/dev/null); then
    if [ "$STATUS" = "$expected" ]; then
      echo "✓ ($STATUS)"
    else
      echo "✗ ($STATUS, expected $expected)"
      error "$name: HTTP $STATUS (expected $expected)"
    fi
  else
    echo "✗ (connection failed)"
    error "$name: Connection failed"
  fi
}

# Helper: Check pod status
check_pods() {
  echo "  Checking pods..."
  kubectl get pods -n "$NAMESPACE" -o json | \
    jq -r '.items[] | select(.status.phase != "Running" or .status.conditions[] | select(.type=="Ready" and .status=="False")) |
      "\(.metadata.name): \(.status.phase) - Ready: \([.status.conditions[] | select(.type=="Ready") | .status] // [])"' 2>/dev/null | \
    while read -r line; do
      [ -n "$line" ] && error "Pod: $line"
    done || true

  # Check restart counts
  kubectl get pods -n "$NAMESPACE" -o json | \
    jq -r '.items[] | "\(.metadata.name) \(.status.containerStatuses[0].restartCount // 0)"' 2>/dev/null | \
    while read -r pod restarts; do
      if [ "$restarts" -gt 0 ]; then
        warning "$pod: $restarts restarts (last 24h)"
      fi
    done || true
}

# Helper: Check recent logs for errors
check_logs() {
  echo "  Checking recent logs (24h)..."
  SINCE="24h"

  kubectl logs -n "$NAMESPACE" -l app=quill-api --since="$SINCE" 2>/dev/null | \
    grep -iE "error|fail|exception|panic" | tail -5 | while read -r line; do
      warning "API log: $line"
    done || true

  kubectl logs -n "$NAMESPACE" -l app=quill-portal --since="$SINCE" 2>/dev/null | \
    grep -iE "error|fail|exception" | tail -5 | while read -r line; do
      warning "Portal log: $line"
    done || true
}

# Helper: Check AI services
check_ai() {
  echo "  Checking AI services..."

  # AI Gateway
  check_endpoint "AI Gateway" "http://$AI_GATEWAY/v1/models" "200"

  # Qdrant
  echo -n "  Checking Qdrant ($QDRANT)... "
  if curl -sk "http://$QDRANT/health" > /dev/null 2>&1; then
    echo "✓"
  else
    echo "✗"
    error "Qdrant: Health check failed"
  fi
}

# Helper: Check storage
check_storage() {
  echo "  Checking storage..."
  kubectl get pvc -n "$NAMESPACE" -o json | \
    jq -r '.items[] | select(.status.phase!="Bound") | "\(.metadata.name): \(.status.phase)"' 2>/dev/null | \
    while read -r line; do
      [ -n "$line" ] && error "PVC: $line"
    done || true
}

# Helper: Send Telegram alert
send_alert() {
  local status="$1"
  local message="$2"

  if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "[$status] $message"
    return
  fi

  local ts
  ts=$(date --iso-8601=seconds)
  local escaped
  escaped=$(echo "$message" | sed 's/_/\\_/g; s/\*/\\*/g')

  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" \
    -d "text=*MapleSpike Health* [$status] ($ts)

$escaped" \
    -d "parse_mode=Markdown" > /dev/null
}

# Run checks
echo "═══════════════════════════════════════════════"
echo "MapleSpike Health Check"
echo "Domain: $DOMAIN"
echo "Time: $(date --iso-8601=seconds)"
echo "═══════════════════════════════════════════════"

echo ""
echo "Checking endpoints..."
check_endpoint "Portal" "https://$DOMAIN/" "200"
check_endpoint "API Health" "https://api.$DOMAIN/v1/health" "200"
check_endpoint "API Modules" "https://api.$DOMAIN/v1/modules" "200"

echo ""
check_pods

echo ""
check_storage

echo ""
check_ai

echo ""
check_logs

# Summary
echo ""
echo "═══════════════════════════════════════════════"
if [ ${#ERRORS[@]} -eq 0 ] && [ ${#WARNINGS[@]} -eq 0 ]; then
  echo "✓ All checks passed"
  send_alert "OK" "All systems operational. Endpoints responding, pods healthy, no errors in logs."
else
  echo "Issues found:"
  [ ${#ERRORS[@]} -gt 0 ] && echo -e "\nERRORS:"
  for e in "${ERRORS[@]}"; do echo "  $e"; done
  [ ${#WARNINGS[@]} -gt 0 ] && echo -e "\nWARNINGS:"
  for w in "${WARNINGS[@]}"; do echo "  $w"; done

  # Build alert message
  msg=""
  if [ ${#ERRORS[@]} -gt 0 ]; then
    msg+="*ERRORS:*
${ERRORS[*]}
"
  fi
  if [ ${#WARNINGS[@]} -gt 0 ]; then
    msg+="
*WARNINGS:*
${WARNINGS[*]}"
  fi

  if [ ${#ERRORS[@]} -gt 0 ]; then
    send_alert "FAILED" "$msg"
    exit 1
  else
    send_alert "WARNING" "$msg"
    exit 0
  fi
fi