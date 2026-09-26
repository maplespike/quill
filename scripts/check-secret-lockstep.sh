#!/usr/bin/env bash
# check-secret-lockstep.sh — fail CI when a deployment references a key that
# scripts/sops-sync-k8s.sh never delivers.
#
# Why: the 2026-08-15 incident — the sync emitted uppercase JWT_SECRET /
# QUILL_BILLING_SECRET while every deployment referenced lowercase
# jwt-secret / quill-billing-secret — took two incident rounds to unwind (api pods
# crash-looping on "JWT_SECRET must be set in production"). This guard makes
# key-name drift a build failure instead of a production outage.
#
# WHAT IT SCANS: charts/quill/templates/** — the Helm chart ArgoCD renders into
# the maplespike namespace — compared against the MAPPING table in
# scripts/sops-sync-k8s.sh ("VAR|secret-name|key"), which is what actually
# reaches the cluster.
#
# It used to scan k8s/maplespike/** + nix/saas-manifests.nix, the legacy Nix-era
# manifest set, which still carries pre-rename key names (jwt-secret,
# quill-api-key, stripe-account-id, stripe-publishable-key) and produced
# permanent false drift. It also grepped a format the sync no longer uses, and
# under `set -e` + pipefail an empty grep killed the script with exit 1 and an
# empty log — so build-and-test was red and audit/coverage/docker/integration
# were skipped with nothing to explain it.
#
# REQUIRED vs OPTIONAL: a ref marked `optional: true` cannot crash a pod, which
# is the incident this gate exists to prevent, so it warns instead of failing.
# Required refs must be emitted. (2026-09-23: auth-critical refs in the chart
# are required — see commit 9866f556 — so the gate now fails, not warns, for the
# original incident class.)
#
# MAPPING rows that keep their line but lose the pipe format are counted
# against the array declaration: extraction short of the declared row count
# fails loud. A row the grep drops silently would mean fewer keys checked and
# still exit 0 — the exact failure class this gate exists to prevent.
#
# Usage: bash scripts/check-secret-lockstep.sh [root]
#   root defaults to the directory above this script.
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SYNC="$ROOT/scripts/sops-sync-k8s.sh"
CHART="$ROOT/charts/quill/templates"

[ -f "$SYNC" ] || { echo "✗ missing $SYNC" >&2; exit 1; }
[ -d "$CHART" ] || { echo "✗ missing $CHART" >&2; exit 1; }

# 1) Keys the rails deliver. Two sources:
#    a) the MAPPING table in scripts/sops-sync-k8s.sh ("VAR|secret-name|key"),
#       when the script still delivers rows directly; and
#    b) secrets/eso-delivered.txt ("secret-name|key") — the ESO/BSM rail
#       (2026-09-25 migration; source of truth: media-k8s
#       cluster/addons/eso-secrets/externalsecrets-migrated.yaml).
#    Fail LOUDLY when BOTH sources come up empty — a format change must never
#    be silent again.
mapping="$(grep -oE '"[A-Za-z0-9_]+\|[a-z0-9-]+\|[A-Za-z0-9_-]+"' "$SYNC" || true)"
ESO="$ROOT/secrets/eso-delivered.txt"
eso_rows=""
if [ -f "$ESO" ]; then
  eso_rows="$(grep -oE '^[a-z0-9-]+\|[A-Za-z0-9_.-]+$' "$ESO" || true)"
  eso_declared="$(grep -cE '^[a-z0-9-]+\|' "$ESO" || true)"
  eso_found="$(printf '%s\n' "$eso_rows" | grep -c '[a-z0-9-]' || true)"
  if [ "$eso_found" -lt "$eso_declared" ]; then
    echo "✗ extracted $eso_found of $eso_declared rows from $ESO — at least one row lost its 'secret|key' format" >&2
    exit 1
  fi
fi
if [ -z "$mapping" ] && [ -z "$eso_rows" ]; then
  echo "✗ no delivered-key source: MAPPING table empty AND $ESO missing or unreadable" >&2
  echo "  The gate needs at least one rail's key list; fix the source, do not silence the gate." >&2
  exit 1
fi
emitted="$( { printf '%s\n' "$mapping" | awk -F'|' '{gsub(/["]/, "", $3); print $3}'; printf '%s\n' "$eso_rows" | awk -F'|' '{print $2}'; } | grep -v '^$' | sort -u)"

# A row whose line survives but loses its pipe format is silently dropped by
# the grep above — the gate would check fewer keys and still exit 0. Count the
# rows the MAPPING array declares and require the extraction to find all of them
# (allowing a small floor for genuinely-declared-but-unused rows is NOT safe:
# a silent drop must be loud).
# Count every row the MAPPING array declares (quoted entries between MAPPING=(
# and the closing paren), regardless of whether it kept its pipe format.
declared="$(awk '/^MAPPING=/{in_map=1; next} in_map && /^\s*"/{count++} in_map && /^\)/{exit} END{print count+0}' "$SYNC")"
found="$(printf '%s\n' "$mapping" | wc -l | tr -d ' ')"
if [ "$found" -lt "$declared" ]; then
  echo "✗ extracted $found of $declared MAPPING rows from $SYNC — at least one row lost its pipe format" >&2
  echo "  A silently-dropped row means fewer keys checked and a green gate. Fix the MAPPING table." >&2
  exit 1
fi

# 2) Keys the live chart references, per secret, for the secrets the sync owns.
refs="$(python3 - "$CHART" <<'PY'
import pathlib, re, sys
chart = pathlib.Path(sys.argv[1])
owned = {"quill-secrets", "maplespike-secrets"}
for f in sorted(chart.glob("*.yaml")):
    lines = f.read_text().splitlines()
    for i, ln in enumerate(lines):
        m = re.match(r"\s*name:\s*(\S+)", ln)
        if not m or m.group(1).strip('"\'') not in owned:
            continue
        secret = m.group(1).strip('"\'')
        for j in range(i + 1, min(i + 5, len(lines))):
            km = re.match(r"\s*key:\s*(\S+)", lines[j])
            if not km:
                continue
            key = km.group(1).strip('"\'')
            optional = any("optional: true" in x for x in lines[j:j + 3])
            print(f"{'optional' if optional else 'required'}|{secret}|{key}")
            break
PY
)"

if [ -z "$refs" ]; then
  echo "✗ extracted no secretKeyRef from $CHART" >&2
  echo "  Either the chart stopped referencing the operator-managed secrets or the" >&2
  echo "  template shape changed — check before trusting this gate's silence." >&2
  exit 1
fi

fail=0
required=0
optional=0
while IFS='|' read -r kind secret key; do
  [ -z "$key" ] && continue
  if [ "$kind" = "required" ]; then
    required=$((required + 1))
  else
    optional=$((optional + 1))
  fi
  if ! grep -qxF "$key" <<<"$emitted"; then
    if [ "$kind" = "required" ]; then
      echo "✗ required ref $secret/$key is not delivered by sops-sync-k8s.sh (case mismatch or missing row?)" >&2
      fail=1
    else
      echo "⚠ optional ref $secret/$key is not delivered — the consumer degrades silently"
    fi
  fi
done <<<"$refs"

# 3) Mapping rows nothing references — dead rows drift out of sync silently.
while IFS= read -r key; do
  [ -z "$key" ] && continue
  if ! grep -qF "|$key" <<<"$refs"; then
    echo "⚠ delivered key '$key' is not referenced by the chart — dead MAPPING row?"
  fi
done <<<"$emitted"

if [ "$fail" -ne 0 ]; then
  echo "delivered keys: $(tr '\n' ' ' <<<"$emitted")" >&2
  exit 1
fi

echo "✓ secret lockstep: $required required + $optional optional ref(s) checked against $(grep -c . <<<"$emitted") delivered key(s)"
