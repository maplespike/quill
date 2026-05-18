#!/usr/bin/env bash
# Sync ~/.kube/config symlink across all 4 K3s cluster machines.
#
# Each machine has /etc/rancher/k3s/k3s.yaml but ~/.kube/config may be
# missing or stale. This script creates/updates the symlink on every node.
#
# Usage:
#   ./scripts/sync-kubeconfig.sh          # check + fix all machines
#   ./scripts/sync-kubeconfig.sh --check  # check only, no changes
#
set -euo pipefail

MACHINES=(zephyr forge sentry nexus)
LOCAL_HOST="$(hostname -s)"
CHECK_ONLY=false

if [ "${1:-}" = "--check" ]; then
  CHECK_ONLY=true
fi

check_symlink() {
  local host="$1"
  local action="$2"
  local result=""

  if [ "$host" = "$LOCAL_HOST" ] || [ "$host" = "zephyr" ]; then
    if [ -L "$HOME/.kube/config" ]; then
      local target
      target="$(readlink "$HOME/.kube/config")"
      if [ "$target" = "/etc/rancher/k3s/k3s.yaml" ]; then
        result="OK symlink"
      else
        result="WRONG target: $target"
      fi
    elif [ -f "$HOME/.kube/config" ]; then
      result="regular file (not symlink)"
    else
      result="MISSING"
    fi

    if [ "$result" != "OK symlink" ] && [ "$CHECK_ONLY" = false ]; then
      mkdir -p "$HOME/.kube"
      ln -sf /etc/rancher/k3s/k3s.yaml "$HOME/.kube/config"
      result="FIXED"
    fi
  else
    local ssh_cmd
    ssh_cmd="bash --norc --noprofile -c '"
    ssh_cmd+="if [ -L \"\$HOME/.kube/config\" ]; then "
    ssh_cmd+="  t=\$(readlink \"\$HOME/.kube/config\"); "
    ssh_cmd+="  if [ \"\$t\" = \"/etc/rancher/k3s/k3s.yaml\" ]; then "
    ssh_cmd+="    echo \"OK symlink\"; "
    ssh_cmd+="  else "
    ssh_cmd+="    echo \"WRONG target: \$t\"; "
    ssh_cmd+="  fi; "
    ssh_cmd+="elif [ -f \"\$HOME/.kube/config\" ]; then "
    ssh_cmd+="  echo \"regular file (not symlink)\"; "
    ssh_cmd+="else "
    ssh_cmd+="  echo \"MISSING\"; "
    ssh_cmd+="fi'"

    result="$(ssh "$host" "$ssh_cmd" 2>/dev/null || echo "SSH FAILED")"

    if [ "$result" != "OK symlink" ] && [ "$CHECK_ONLY" = false ] && [ "$result" != "SSH FAILED" ]; then
      local fix_cmd
      fix_cmd="bash --norc --noprofile -c 'mkdir -p \"\$HOME/.kube\" && ln -sf /etc/rancher/k3s/k3s.yaml \"\$HOME/.kube/config\"'"
      ssh "$host" "$fix_cmd" 2>/dev/null && result="FIXED" || result="FIX FAILED"
    fi
  fi

  echo "$host: $result"
}

echo "=== K3s kubeconfig sync ==="
echo "Mode: $([ "$CHECK_ONLY" = true ] && echo 'check only' || echo 'check + fix')"
echo ""

for machine in "${MACHINES[@]}"; do
  check_symlink "$machine"
done

echo ""
echo "=== Done ==="
