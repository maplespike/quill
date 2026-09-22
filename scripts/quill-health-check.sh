#!/usr/bin/env bash
# Quill Cluster Health Monitor
# Checks cluster state and creates/updates a GitHub issue for problems.
# Usage: quill-health-check.sh [--create-issue]
#
# 2026-09-21 rewrite:
# - node checks are DYNAMIC (the old hardcoded list produced false positives:
#   zephyr is not a k3s node, and sentry's node name is sentry-agent)
# - empty namespaces no longer produce "Non-running pods" false positives
# - dead nix-era checks removed (ai-inference namespace + sentry:8001/forge:8002)
# - issue matching is by EXACT TITLE (the old --label infrastructure lookup
#   hijacked and overwrote unrelated issues, e.g. #754)
# - a healthy run auto-closes the monitor's own stale issue
set -euo pipefail

REPO="reverb256/quill"
TITLE="fix: Cluster Health Issues Detected"
ISSUES=""
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Nodes: report any node that is genuinely NotReady.
# Use the Ready CONDITION, never the STATUS column: a cordoned node renders as
# "Ready,SchedulingDisabled" and is healthy by design — the old `$2 != "Ready"`
# comparison filed a false p1 the moment zephyr was cordoned (issue #888,
# 2026-09-22).
check_nodes() {
  local bad
  bad=$(kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.conditions[?(@.type=="Ready")].status}{"\n"}{end}' 2>/dev/null \
    | awk '$2 != "True" {print $1 " (NotReady)"}' || true)
  if [ -n "$bad" ]; then
    ISSUES="${ISSUES}Nodes not Ready: $bad\n"
  fi
}

check_pod() {
  local ns="$1"
  local pod_status
  pod_status=$(kubectl get pods -n "$ns" --no-headers 2>/dev/null || echo "unreachable")
  if [ -n "$pod_status" ] && echo "$pod_status" | grep -vq "Running\|Completed"; then
    local bad
    bad=$(echo "$pod_status" | grep -v "Running\|Completed" | awk '{print $1, $3}' | head -5)
    ISSUES="${ISSUES}Non-running pods in $ns: $bad
"
  fi
}

check_http() {
  local url="$1"
  local label="$2"
  if ! curl -sf --connect-timeout 5 "$url" > /dev/null 2>&1; then
    ISSUES="${ISSUES}Unreachable: $label ($url)\n"
  fi
}

# ── Auth-lane probes (2026-09-22) ──────────────────────────────────────
# Every one of these failed live on 2026-09-21 and nothing caught it until
# a human tried to sign in. They now run every 30 minutes.
#   - OAuth start must 302 to GitHub with the LOWERCASE callback + client_id
#     (catches: provider unwired, wrong client id, redirect_uri case bugs)
#   - /exchange must reach its handler (catches wildcard-shadow regressions)
#   - wallet lane needs the astral-key service + free-tier allowlist
#   - llms.txt must stay free; the Stripe webhook must reach its HMAC
#     handler (400), never 402; gov/search must stay 402-gated.
check_auth_lane() {
  local api="https://api.maplespike.ca"

  local loc
  loc=$(curl -s -o /dev/null -w '%{redirect_url}' --connect-timeout 5 "$api/v1/auth/oauth/github" 2>/dev/null || true)
  if ! echo "$loc" | grep -q 'github.com/login/oauth/authorize'; then
    ISSUES="${ISSUES}OAuth start not redirecting to GitHub: ${loc:-<empty>}\n"
  else
    echo "$loc" | grep -q 'redirect_uri=https://api.maplespike.ca/v1/auth/oauth/github/callback' \
      || ISSUES="${ISSUES}OAuth redirect_uri mismatch (must be lowercase /github/callback)\n"
    echo "$loc" | grep -q 'client_id=' \
      || ISSUES="${ISSUES}OAuth client_id missing from authorize URL\n"
  fi

  local exch
  exch=$(curl -s --connect-timeout 5 "$api/v1/auth/oauth/exchange?code=health-probe" 2>/dev/null || true)
  echo "$exch" | grep -q 'INVALID_CODE' \
    || ISSUES="${ISSUES}OAuth /exchange not serving INVALID_CODE (shadowed route?): $(echo "$exch" | head -c 120)\n"

  curl -sf --connect-timeout 5 "$api/v1/astral/health" 2>/dev/null | grep -qE '"status"[: ]*"healthy"' \
    || ISSUES="${ISSUES}Astral health not healthy — wallet lane degraded\n"

  curl -sf --connect-timeout 5 "$api/v1/llms.txt" > /dev/null 2>&1 \
    || ISSUES="${ISSUES}llms.txt not free (free-tier allowlist regression)\n"

  local wh
  wh=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 -X POST "$api/v1/billing/stripe/webhook" -H 'Content-Type: application/json' -d '{}' 2>/dev/null || true)
  if [ "$wh" != "400" ]; then
    ISSUES="${ISSUES}Stripe webhook returned ${wh:-<empty>} (expected 400 signature; 402 = free-tier gate regression)\n"
  fi

  local gs
  gs=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 "$api/v1/gov/search?q=health" 2>/dev/null || true)
  if [ "$gs" != "402" ]; then
    ISSUES="${ISSUES}gov/search returned ${gs:-<empty>} (expected 402; free-tier gate may be open)\n"
  fi
}

# ── StatCan WDS probe (2026-09-22, issue #722) ────────────────────────
# WDS metadata operations are POST-only: a GET on getCubeMetadata answers
# 405 and a GET on the bare /t1/wds/rest/ root answers 404 — exactly the
# false positive that filed #722 ("API is down"). Probe the real contracts.
check_statcan_wds() {
  local meta
  meta=$(curl -s -o /tmp/quill-wds-meta.json -w '%{http_code}' --max-time 20 \
    -X POST 'https://www150.statcan.gc.ca/t1/wds/rest/getCubeMetadata' \
    -H 'Content-Type: application/json' -d '[{"productId":14100087}]' 2>/dev/null || true)
  if [ "$meta" != "200" ]; then
    ISSUES="${ISSUES}StatCan WDS getCubeMetadata (POST) returned ${meta:-<empty>} — expected 200\n"
  elif ! grep -q '"cubeTitleEn"' /tmp/quill-wds-meta.json 2>/dev/null; then
    ISSUES="${ISSUES}StatCan WDS metadata body missing cubeTitleEn\n"
  fi

  local list
  list=$(curl -s -o /tmp/quill-wds-list.json -w '%{http_code}' --max-time 20 \
    'https://www150.statcan.gc.ca/t1/wds/rest/getAllCubesListLite?limit=1' 2>/dev/null || true)
  if [ "$list" != "200" ]; then
    ISSUES="${ISSUES}StatCan WDS getAllCubesListLite (GET) returned ${list:-<empty>} — expected 200\n"
  fi
}

# ── Tier-boundary honesty probe (2026-09-22) ──────────────────────────
# A free customer who hits a paid endpoint must get a 402 that explains the
# boundary in BOTH languages. The error-code table was missing 61 codes that
# call sites emit, so those bodies shipped message_fr "Erreur inconnue"
# (= "unknown error") on a bilingual product. This keeps the live surface
# honest — the incident's regression guard at the deployed layer, next to the
# unit-level error-codes-i18n.test.ts.
check_tier_boundary() {
  local body
  body=$(curl -s --connect-timeout 5 --max-time 15 \
    "https://api.maplespike.ca/v1/gov/search?q=health-probe" 2>/dev/null || true)

  echo "$body" | grep -q 'UPGRADE_REQUIRED' \
    || ISSUES="${ISSUES}Tier boundary: 402 body missing UPGRADE_REQUIRED code\n"
  echo "$body" | grep -qiE 'plan|tier|upgrade' \
    || ISSUES="${ISSUES}Tier boundary: 402 body does not explain the plan boundary\n"
  if echo "$body" | grep -q 'Erreur inconnue'; then
    ISSUES="${ISSUES}Tier boundary: French message is still the 'Erreur inconnue' placeholder\n"
  fi
  if ! echo "$body" | grep -q 'message_fr'; then
    ISSUES="${ISSUES}Tier boundary: 402 body carries no French message at all\n"
  fi
}

# ── Ingestion liveness (gate A1-INGEST, 2026-09-22) ───────────────────
# The pipelines stopped silently: nothing was scheduled, no data flowed, and
# no check noticed. Three probes, all required:
#   1. CronJobs exist in the namespace — a deleted or renamed schedule is
#      invisible from the API side,
#   2. /v1/ingest/status is reachable — it is the run log the jobs write,
#   3. every scheduled pipeline has a recent run and is not in the API's
#      stalePipelines list (stale = last run older than 2x its cron period).
# A job that exists but never completes (image missing, DB unwritable, module
# crash) leaves no run row, so probe 3 catches it as "never reported a run".
check_ingestion() {
  local cjs
  cjs=$(kubectl -n maplespike get cronjobs -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null || true)
  if [ -z "$cjs" ]; then
    ISSUES="${ISSUES}No ingestion CronJobs in namespace maplespike — no data is being ingested (gate A1-INGEST)\n"
    return 0
  fi

  local body
  body=$(curl -s --connect-timeout 5 --max-time 20 "https://api.maplespike.ca/v1/ingest/status" 2>/dev/null || true)
  if [ -z "$body" ]; then
    ISSUES="${ISSUES}/v1/ingest/status unreachable — ingestion liveness unknown\n"
    return 0
  fi

  case "$body" in
    *'"status":"unknown"'*)
      ISSUES="${ISSUES}Ingest run log empty — no pipeline has ever recorded a run (gate A1-INGEST)\n" ;;
  esac

  # stalePipelines: ["committees","gazette"] — extract the array body for matching.
  local stale
  stale=$(printf '%s\n' "$body" | sed -n 's/.*"stalePipelines":\[\([^]]*\)\].*/\1/p')

  local name pipeline
  for name in $cjs; do
    pipeline=${name##*-ingest-}
    case "$body" in
      *"\"pipeline\":\"$pipeline\""*) : ;;
      *) ISSUES="${ISSUES}Ingest pipeline '$pipeline' has never reported a run — CronJob $name is not completing (gate A1-INGEST)\n" ;;
    esac
    case "$stale" in
      *"\"$pipeline\""*) ISSUES="${ISSUES}Ingest pipeline '$pipeline' is stale — last run is older than its schedule allows (gate A1-INGEST)\n" ;;
    esac
  done
}

# Only ever match the monitor's own issue, by exact title.
find_monitor_issue() {
  gh issue list --repo "$REPO" --state open --json number,title \
    --jq "[.[] | select(.title == \"$TITLE\")][0].number // empty" 2>/dev/null || true
}

check_nodes || true
check_pod "maplespike" || true
check_pod "monitoring" || true

check_http "https://quill.maplespike.ca/" "Public portal" || true
check_http "https://api.maplespike.ca/v1/health" "Public API" || true
check_auth_lane || true
check_tier_boundary || true
check_statcan_wds || true
check_ingestion || true

if [ -n "$ISSUES" ]; then
  echo "has_issues=true"
  echo "issues<<ENDISSUES"
  echo "$ISSUES"
  echo "ENDISSUES"

  if [ "${1:-}" = "--create-issue" ]; then
    BODY="## Cluster Health Issues

Detected at: $TIMESTAMP

### Issues
\`\`\`
$ISSUES
\`\`\`

### Next Steps
- Nodes: \`kubectl describe node <name>\`
- Pods: \`kubectl -n <ns> describe pod <name>\`; logs: \`kubectl -n <ns> logs <pod>\`
- quill stack restart: \`kubectl rollout restart deployment -n maplespike --all\`
- Cluster apps are GitOps (ArgoCD, \`reverb256/media-k8s\` helm/apps) — \`kubectl get app -n argocd\`

---
_🤖 Auto-generated by health-monitor_"

    EXISTING=$(find_monitor_issue)
    if [ -n "$EXISTING" ]; then
      gh issue comment "$EXISTING" --repo "$REPO" --body "Updated $TIMESTAMP" >/dev/null
      gh issue edit "$EXISTING" --repo "$REPO" --body "$BODY" >/dev/null 2>&1 || true
      echo "Updated existing issue #$EXISTING"
    else
      gh issue create \
        --repo "$REPO" \
        --title "$TITLE" \
        --label "infrastructure,bug,p1" \
        --body "$BODY"
    fi
  fi
else
  echo "has_issues=false"
  echo "issues=Cluster healthy"
  if [ "${1:-}" = "--create-issue" ]; then
    STALE=$(find_monitor_issue)
    if [ -n "$STALE" ]; then
      gh issue close "$STALE" --repo "$REPO" --comment "All checks healthy as of $TIMESTAMP — auto-closing. The monitor opens a new issue if problems return." >/dev/null
      echo "Closed stale monitor issue #$STALE"
    fi
  fi
fi
