#!/usr/bin/env nix-shell
#!nix-shell -p kubectl jq bash -i bash

# K8s Manifest Validation Script
# Validates Nix-generated K8s manifests for schema, security, and resource compliance

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILURES=0
WARNINGS=0

log_info() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; ((WARNINGS++)); }
log_fail() { echo -e "${RED}✗${NC} $1"; ((FAILURES++)); }

MANIFEST=$(nix build .#k8s-manifests --no-link --print-out-paths 2>&1)
if [ $? -ne 0 ]; then
  log_fail "Failed to build K8s manifests"
  exit 1
fi

log_info "Built K8s manifests from: $MANIFEST"

TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"
csplit -s "$MANIFEST" '/^---/' '{*}'

validate_security_context() {
  local file=$1
  local resource=$(jq -r '.kind' < "$file")

  if [ "$resource" != "Deployment" ] && [ "$resource" != "StatefulSet" ] && [ "$resource" != "DaemonSet" ]; then
    return 0
  fi

  if ! jq -e '.spec.template.spec.securityContext.runAsNonRoot == true' "$file" >/dev/null 2>&1; then
    log_warn "Missing runAsNonRoot in $resource $(jq -r '.metadata.name' < "$file")"
  fi

  if ! jq -e '.spec.template.spec.securityContext.allowPrivilegeEscalation == false' "$file" >/dev/null 2>&1; then
    log_warn "Missing allowPrivilegeEscalation: false in $resource $(jq -r '.metadata.name' < "$file")"
  fi

  if jq -e '.spec.template.spec.securityContext.capabilities.drop' "$file" >/dev/null 2>&1; then
    local caps=$(jq -r '.spec.template.spec.securityContext.capabilities.drop[]' "$file")
    if ! echo "$caps" | grep -q "ALL"; then
      log_warn "Missing 'ALL' in capabilities.drop for $resource $(jq -r '.metadata.name' < "$file")"
    fi
  fi

  if jq -e '.spec.template.spec.containers[]?.securityContext.privileged == true' "$file" >/dev/null 2>&1; then
    log_fail "Privileged container found in $resource $(jq -r '.metadata.name' < "$file")"
  fi
}

validate_resources() {
  local file=$1
  local resource=$(jq -r '.kind' < "$file")

  if [ "$resource" != "Deployment" ] && [ "$resource" != "StatefulSet" ]; then
    return 0
  fi

  local has_limits=0
  local has_requests=0

  if jq -e '.spec.template.spec.containers[0].resources.limits' "$file" >/dev/null 2>&1; then
    has_limits=1
  fi

  if jq -e '.spec.template.spec.containers[0].resources.requests' "$file" >/dev/null 2>&1; then
    has_requests=1
  fi

  if [ $has_limits -eq 0 ]; then
    log_warn "Missing resource limits in $resource $(jq -r '.metadata.name' < "$file")"
  fi

  if [ $has_requests -eq 0 ]; then
    log_warn "Missing resource requests in $resource $(jq -r '.metadata.name' < "$file")"
  fi
}

validate_image_policy() {
  local file=$1
  local resource=$(jq -r '.kind' < "$file")
  
  if [ "$resource" != "Deployment" ] && [ "$resource" != "StatefulSet" ] && [ "$resource" != "CronJob" ]; then
    return 0
  fi

  local images=$(jq -r '.spec.template.spec.containers[].image' "$file" 2>/dev/null || jq -r '.spec.jobTemplate.spec.template.spec.containers[].image' "$file" 2>/dev/null)

  # Check for latest tag
  if echo "$images" | grep -q ":latest$"; then
    log_warn "Using :latest tag in $resource $(jq -r '.metadata.name' < "$file")"
  fi

  # Check for untagged images
  if echo "$images" | grep -v ':' | grep -v 'localhost\|127\.0\.0\.1' | grep -q 'ghcr\.io\|docker.io'; then
    log_warn "Untagged image found in $resource $(jq -r '.metadata.name' < "$file")"
  fi
}

validate_namespace() {
  local file=$1
  local resource=$(jq -r '.kind' < "$file")

  if [ "$resource" != "Namespace" ]; then
    local kind=$(jq -r '.kind' < "$file")
    if [ "$kind" != "Namespace" ] && [ "$kind" != "ClusterRole" ] && [ "$kind" != "ClusterRoleBinding" ]; then
      if ! jq -e '.metadata.namespace' "$file" >/dev/null 2>&1; then
        log_fail "Missing namespace in $kind $(jq -r '.metadata.name' < "$file")"
      fi
    fi
  fi
}

validate_replicas() {
  local file=$1
  local resource=$(jq -r '.kind' < "$file")

  if [ "$resource" != "Deployment" ]; then
    return 0
  fi

  local replicas=$(jq -r '.spec.replicas // "1"' < "$file")
  if [ "$replicas" -lt 1 ]; then
    log_warn "Replicas < 1 in Deployment $(jq -r '.metadata.name' < "$file")"
  fi
}

for file in xx*; do
  if [ -s "$file" ]; then
    validate_security_context "$file"
    validate_resources "$file"
    validate_image_policy "$file"
    validate_namespace "$file"
    validate_replicas "$file"
  fi
done

cd -
rm -rf "$TEMP_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "K8s Manifest Validation Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $FAILURES -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  log_info "All validations passed"
  exit 0
elif [ $FAILURES -eq 0 ]; then
  log_warn "Validation passed with $WARNINGS warning(s)"
  exit 0
else
  log_fail "Validation failed with $FAILURES failure(s) and $WARNINGS warning(s)"
  exit 1
fi