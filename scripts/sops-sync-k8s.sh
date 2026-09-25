#!/usr/bin/env bash
# sops-sync-k8s.sh — deliver Quill secrets from git to the cluster, declaratively.
#
# SOURCE OF TRUTH: secrets/runtime.yaml (sops-encrypted, committed). The cluster
# is a *rendering* of that file; nothing secret is ever typed into kubectl by
# hand. That is the whole point: `git log` on runtime.yaml is the changelog of
# every credential, and a lost cluster is recoverable by running this script.
#
# MIGRATION (2026-09-25): these credentials now deliver via ESO pull from
# Bitwarden Secrets Manager (project k3s; CRs in media-k8s
# cluster/addons/eso-secrets/). runtime.yaml remains the historical changelog;
# the MAPPING below is retired (empty) and kept as the pattern for credentials
# not yet on the ESO rail.
#
# WHY A SCRIPT AND NOT A CHART SECRET: charts/quill/templates/secrets.yaml
# deliberately does not render quill-secrets / maplespike-secrets. ArgoCD
# selfHeal owns that chart, and it syncs on every change; if the chart rendered
# these keys, a sync would blank any value written out of band (it did, on
# 2026-09-21: the secret was emptied and GitHub OAuth + JWT vanished from the
# pod env). So: db/user keys come from the chart, credentials come from here.
#
# Usage:
#   scripts/sops-sync-k8s.sh            # apply sops -> cluster (idempotent)
#   scripts/sops-sync-k8s.sh --check    # report drift, change nothing (exit 1 on drift)
#   scripts/sops-sync-k8s.sh --dry-run  # show what would change
#
# Requires: sops, kubectl, and an age key that can decrypt runtime.yaml.
#   SOPS_AGE_KEY_FILE=~/.config/sops/age/cluster-age-key.txt scripts/sops-sync-k8s.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SECRETS_FILE="${SECRETS_FILE:-$REPO_ROOT/secrets/runtime.yaml}"
NAMESPACE="${NAMESPACE:-maplespike}"

MODE="apply"
case "${1:-}" in
  --check)   MODE="check" ;;
  --dry-run) MODE="dry-run" ;;
  "")        ;;
  -h|--help) sed -n '2,26p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) echo "unknown argument: $1" >&2; exit 2 ;;
esac

command -v sops   >/dev/null || { echo "ERROR: sops not found" >&2; exit 2; }
command -v kubectl >/dev/null || { echo "ERROR: kubectl not found" >&2; exit 2; }
[ -f "$SECRETS_FILE" ] || { echo "ERROR: $SECRETS_FILE not found" >&2; exit 2; }

# sops key -> <k8s secret name>.<data key>
# Only credentials live here. postgres-* is chart-rendered from values (see
# charts/quill/templates/secrets.yaml); QUILL_GATEWAY_API_KEY has no consumer in
# this namespace. Add a row when a new credential appears — never a kubectl patch.
# RETIRED 2026-09-25 — all rows migrated to the ESO/BSM rail (see header note).
MAPPING=(
)

echo "== quill sops sync ($MODE) =="
echo "  source: $SECRETS_FILE"
echo "  namespace: $NAMESPACE"

# Decrypt once, into a private temp dir, and shred on exit. Values are never echoed.
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
PLAIN="$WORK/runtime.yaml"
if ! sops -d "$SECRETS_FILE" > "$PLAIN" 2>"$WORK/err"; then
  echo "  ERROR: sops could not decrypt $SECRETS_FILE" >&2
  sed 's/^/    /' "$WORK/err" >&2
  exit 3
fi
chmod 600 "$PLAIN"

get() { # get VAR -> value (empty if absent)
  awk -v k="$1" 'BEGIN{FS=": "} $1==k {sub(/^[^:]*: /,""); print; exit}' "$PLAIN"
}

# Group the mapping by secret so we patch each Secret once.
declare -A BY_SECRET
for row in "${MAPPING[@]}"; do
  IFS='|' read -r var sec key <<< "$row"
  val="$(get "$var")"
  if [ -z "$val" ]; then
    printf '  %-24s -> %s/%s  SKIP (not in sops)\n' "$var" "$sec" "$key"
    continue
  fi
  BY_SECRET["$sec"]+="$key=$var "
done

drift=0
for sec in "${!BY_SECRET[@]}"; do
  args=()
  for pair in ${BY_SECRET[$sec]}; do
    key="${pair%%=*}"; var="${pair##*=}"
    args+=(--from-literal="$key=$(get "$var")")
  done

  if [ "$MODE" = "check" ]; then
    # Compare in-cluster values against sops without printing either.
    cur="$(kubectl -n "$NAMESPACE" get secret "$sec" -o json 2>/dev/null \
           | python3 -c 'import json,sys,base64
d=json.load(sys.stdin)
for k,v in sorted((d.get("data") or {}).items()): print(k+"="+base64.b64decode(v).decode())' 2>/dev/null || true)"
    for pair in ${BY_SECRET[$sec]}; do
      key="${pair%%=*}"; var="${pair##*=}"; want="$(get "$var")"
      got="$(printf '%s\n' "$cur" | awk -F= -v k="$key" '$1==k {sub(/^[^=]*=/,""); print; exit}')"
      if [ "$got" != "$want" ]; then
        printf '  DRIFT  %s/%s  (sops %s: %d chars, cluster: %s)\n' "$sec" "$key" "$var" "${#want}" \
          "$([ -z "$got" ] && echo 'absent' || echo "${#got} chars")"
        drift=1
      else
        printf '  ok     %s/%s\n' "$sec" "$key"
      fi
    done
  else
    printf '  %s %s (%d keys)\n' "$([ "$MODE" = dry-run ] && echo 'would update' || echo 'updating')" "$sec" "$(wc -w <<< "${BY_SECRET[$sec]}")"
    if [ "$MODE" = "apply" ]; then
      kubectl -n "$NAMESPACE" create secret generic "$sec" "${args[@]}" \
        --dry-run=client -o yaml | kubectl apply -f - >/dev/null
    fi
  fi
done

if [ "$MODE" = "check" ] && [ "$drift" != "0" ]; then
  echo "  RESULT: drift detected — run without --check to converge"
  exit 1
fi
echo "  RESULT: $([ "$MODE" = check ] && echo 'cluster matches sops' || echo 'done')"
