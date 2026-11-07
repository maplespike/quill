#!/usr/bin/env bash
# Regression: verify-prod.sh must match ingest CronJob images published as
# <registry>/quill/ingest@sha256:... (and the older <registry>/quill-ingest form).
# Runs verify-prod.sh against a stub kubectl; no cluster or network needed.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
PIN="sha256:$(printf 'a%.0s' {1..64})"
OTHER="sha256:$(printf 'b%.0s' {1..64})"
printf 'images:\n  ingest:\n    digest: "%s"\n' "$PIN" > "$TMP/values.yaml"

run() { # $1 = image ref the stub CronJob reports
  mkdir -p "$TMP/bin"
  cat > "$TMP/bin/kubectl" <<STUB
#!/usr/bin/env bash
case "\$*" in
  *"get application"*) echo "Synced Healthy 0123456789ab" ;;
  *"get cronjobs"*)    echo "quill-ingest-a $1 "; echo "quill-ingest-b $1 " ;;
  *) : ;;
esac
STUB
  chmod +x "$TMP/bin/kubectl"
  PATH="$TMP/bin:$PATH" VALUES="$TMP/values.yaml" ARGO_APP=quill SKIP_HTTP=1 \
    ARGO_WAIT_SECONDS=0 bash "$ROOT/scripts/verify-prod.sh" 2>&1 || true
}

check() { # name, image, expect-regex, reject-regex
  out="$(run "$2")"
  if ! grep -Eq "$3" <<<"$out" || grep -Eq "$4" <<<"$out"; then
    echo "FAIL: $1"; echo "$out"; exit 1
  fi
  echo "pass: $1"
}

check "slash ref, pinned digest"  "ghcr.io/maplespike/quill/ingest@$PIN" \
  "ok +cronjob quill-ingest-b uses quill-ingest" "no CronJob uses its image|FAIL +cronjob"
check "dash ref, pinned digest"   "ghcr.io/maplespike/quill-ingest@$PIN" \
  "ok +cronjob quill-ingest-a uses quill-ingest" "no CronJob uses its image|FAIL +cronjob"
check "slash ref, wrong digest"   "ghcr.io/maplespike/quill/ingest@$OTHER" \
  "FAIL +cronjob quill-ingest-a uses" "no CronJob uses its image"
check "unrelated image not matched" "ghcr.io/maplespike/quill/ingester@$PIN" \
  "no CronJob uses its image" "ok +cronjob"
