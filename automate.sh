#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# automate.sh — single utilitarian entry point for ALL MapleSpike ops tasks.
#
# Requires bash >= 4.0 (for assoc arrays in resolve_commit_sha). macOS users
# must run `/usr/bin/env bash` with /opt/homebrew/bin/bash or similar in PATH.
#
# Replaces a sea of ad-hoc shell commands with a small, well-tested dispatch.
# Every sub-command:
#   - defaults to dry-run / verify-only (safe to invoke)
#   - takes --apply to mutate state
#   - takes --yes-i-meant-it to consent to irreversible ops (gh secret set,
#     wrangler secret put, Cloudflare API POSTs that change prod, sed -i)
#   - is idempotent (safe to re-run)
#
# Usage:
#   ./automate.sh <sub-command> [--apply] [--yes-i-meant-it]
#
# Sub-commands:
#   cloudflare-wire   Create KV/D1/R2 namespaces + wrangler secrets
#   secrets-k8s       Base64-encode kubeconfig + gh secret set
#   pin-actions-sha   Pin all @vN to immutable SHA via gh api (runs sed-safe)
#   domain-cutover    Pre-check + Cloudflare Pages custom-domain attach
#   usage-report      One-shot Cloudflare + D1 + KV + R2 usage dashboard
#   e2e-billing       End-to-end billing smoke test (order → e-Transfer → reconcile)
#   decision-stub     Write docs/decisions/IDENTITY.md template
#   all               Run cloudflare-wire + secrets-k8s + pin-actions-sha
#
# Required env (configurable). All MAPLESPIKE_* have sensible defaults:
#   MAPLESPIKE_PAGES_PROJECT     default: maplespike-brand
#   MAPLESPIKE_APEX_DOMAIN       default: maplespike.ca
#   MAPLESPIKE_PROD_BRANCH       default: main
#   QUILL_API_BASE          default: http://localhost:8787
#
# Required env (for cloudflare-wire --apply):
#   CLOUDFLARE_API_TOKEN         CF API token (or `wrangler login` first)
#   CLOUDFLARE_ACCOUNT_ID        CF account ID
#
# Required env (for secrets-k8s --apply):
#   GH_TOKEN                     GitHub CLI token (with secret:write scope)
#   KUBECONFIG_DEV_PATH          Path to maplespike-dev kubeconfig
#   KUBECONFIG_PROD_PATH         Path to quill-prod kubeconfig
#
# Required env (for cloudflare-wire IMAP secrets):
#   IMAP_HOST / IMAP_USER / IMAP_PASS   e-Transfer reconciliation mailbox
#
# Optional env:
#   AUTOMATE_PLAN_FILE           default: ./automate-plan.json
#
# Exit codes:
#   0 success, 1 user-fixable, 2 network failure, 3 auth/consent missing
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Runtime guard for assoc arrays (used in resolve_commit_sha). Some macOS
# distributions still ship bash 3.2 as /usr/bin/bash; fail loud instead of
# producing cryptic `local -A` parse errors.
((BASH_VERSINFO[0] >= 4)) || {
  printf '\033[1;31m✗\033[0m bash ≥ 4 required (have %s). macOS users: install via brew and re-run with /usr/bin/env bash on PATH.\n' "$BASH_VERSION" >&2
  exit 1
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
REPO_ROOT="$SCRIPT_DIR"

# ─── configurable defaults ───────────────────────────────────────────────────
PAGES_PROJECT="${MAPLESPIKE_PAGES_PROJECT:-maplespike-brand}"
APEX_DOMAIN="${MAPLESPIKE_APEX_DOMAIN:-maplespike.ca}"
PROD_BRANCH="${MAPLESPIKE_PROD_BRANCH:-main}"
API_BASE="${QUILL_API_BASE:-http://localhost:8787}"
PLAN_FILE="${AUTOMATE_PLAN_FILE:-$REPO_ROOT/automate-plan.json}"

# ─── flag parsing ────────────────────────────────────────────────────────────
APPLY=0
YES_MEAN_IT=0
SUBCMD=""
for arg in "$@"; do
  case "$arg" in
    --apply)           APPLY=1 ;;
    --yes-i-meant-it)  YES_MEAN_IT=1 ;;
    --help|-h|help)    SUBCMD="__help__" ;;
    -*)                err "unknown flag: $arg"; exit 1 ;;
    *)
      if [[ -z "$SUBCMD" ]]; then SUBCMD="$arg"; else err "unexpected arg: $arg"; exit 1; fi
      ;;
  esac
done

is_apply() { [[ "$APPLY" -eq 1 ]]; }
is_yolo()  { [[ "$YES_MEAN_IT" -eq 1 ]]; }

# ─── logging ────────────────────────────────────────────────────────────────
log()  { printf '\033[1;36m┃\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m⚠\033[0m  %s\n' "$*" >&2; }
err()  { printf '\033[1;31m✗\033[0m  %s\n' "$*" >&2; }
ok()   { printf '\033[1;32m✓\033[0m  %s\n' >&2; }
hdr()  { printf '\n\033[1;35m══ %s ══\033[0m\n' "$*"; }

require_tool() {
  command -v "$1" >/dev/null 2>&1 || { err "missing tool: $1"; exit 1; }
}

require_yolo() {
  if ! is_yolo; then
    err "this sub-command is irreversible. Re-run with --apply --yes-i-meant-it"
    exit 3
  fi
}

# ─── plan() — every mutating action goes through this ────────────────────────
plan() {
  local desc="$1"; shift
  local cmd="$*"
  if [[ ! -f "$PLAN_FILE" ]]; then printf '[]\n' > "$PLAN_FILE"; fi
  if command -v jq >/dev/null 2>&1; then
    local tmp
    tmp=$(mktemp); jq --arg d "$desc" --arg c "$cmd" \
      '. + [{description:$d, command:$c}]' "$PLAN_FILE" > "$tmp" \
      && mv "$tmp" "$PLAN_FILE"
  else
    printf '  - [%s] %s\n' "$desc" "$cmd" >> "$PLAN_FILE"
  fi
  if is_apply; then
    eval "$cmd"
  else
    printf '    [plan] %s\n        $ %s\n' "$desc" "$cmd"
  fi
}

# ─── create_if_missing — exact name match against wrangler output ───────────
# Tries `wrangler <sub> list --format=json` first (preferred, machine-readable);
# falls back to a word-boundary regex against the human table if JSON is not
# honored. Empty output is treated as "does not exist."
create_if_missing() {
  local kind="$1" name="$2"
  shift 2
  local exists=0 sub out
  case "$kind" in
    kv)             sub="kv namespace"        field="title" ;;
    d1)             sub="d1"                  field="name"  ;;
    r2)             sub="r2 bucket"           field=""      ;;  # top-level array
    pages-project)  sub="pages project"       field="name"  ;;
    *)
      err "create_if_missing: unknown kind: $kind"; exit 1
      ;;
  esac

  # Try JSON mode first.
  out=$(wrangler "$sub" list --format=json 2>/dev/null || true)
  if [[ -n "$out" ]] && printf '%s' "$out" | jq -e . >/dev/null 2>&1; then
    if [[ -n "$field" ]]; then
      jq -e --arg n "$name" --arg f "$field" \
        '[.[$f]] | index($n) != null' <<<"$out" >/dev/null 2>&1 \
        && exists=1 || true
    else
      jq -e --arg n "$name" 'index($n) != null' <<<"$out" >/dev/null 2>&1 \
        && exists=1 || true
    fi
  else
    # Fallback: word-boundary regex on the human table (works across wrangler).
    # Only treat the regex as a match if there's actual table output (not empty).
    out=$(wrangler "$sub" list 2>/dev/null || true)
    if [[ -n "$out" ]] && grep -qE "(^|[[:space:]])${name}([[:space:]]|$)" <<<"$out"; then
      exists=1
    fi
  fi
  if [[ "$exists" -eq 1 ]]; then
    log "  ⤵ already exists: $name (skipping)"
    return 0
  fi
  plan "create $kind: $name" "$*"
}

# ─── resolve_commit_sha — chained dereference of GitHub tag refs ─────────────
# Returns the commit SHA for `org/action@<tag>`. Hard-fails on mistyped tags
# rather than silently falling back to a branch-shaped ref.
resolve_commit_sha() {
  local repo="$1" tag="$2" sha type next next_sha
  local -A seen
  sha=$(gh api "repos/$repo/git/refs/tags/$tag" --jq '.object.sha // ""' 2>/dev/null || echo "")
  if [[ -z "$sha" ]]; then
    err "$repo@$tag: tag ref not found at github.com/$repo/git/refs/tags/$tag"
    err "  remediation: pin to a specific version like @v4.1.7, or set"
    err "  uses: $repo/\${{ github.sha }} in your workflow."
    return 1
  fi
  # Loop until we land on a commit SHA. Cap at 4 hops to prevent infinite loop.
  local hops=0
  while :; do
    hops=$((hops+1))
    [[ $hops -gt 4 ]] && { err "$repo@$tag: too many tag-deref hops (loop?)"; return 1; }
    [[ -n "${seen[$sha]:-}" ]] && { err "$repo@$tag: dereference loop at $sha"; return 1; }
    seen[$sha]=1
    type=$(gh api "repos/$repo/git/tags/$sha" --jq '.object.type // ""' 2>/dev/null || echo "")
    case "$type" in
      commit)
        next_sha=$(gh api "repos/$repo/git/tags/$sha" --jq '.object.sha // ""' 2>/dev/null || echo "")
        if [[ -n "$next_sha" ]]; then printf '%s' "$next_sha"; return 0; fi
        err "$repo@$tag: commit sha missing in tag object"
        err "  remediation: pin to a specific SHA from github.com/$repo/releases/tag/$tag"
        return 1
        ;;
      tag)
        next=$(gh api "repos/$repo/git/tags/$sha" --jq '.object.sha // ""' 2>/dev/null || echo "")
        if [[ -z "$next" || "$next" == "null" ]]; then
          err "$repo@$tag: nested tag dereference broken"
          err "  remediation: pin to a specific SHA manually; this tag chain is unusually deep"
          return 1
        fi
        sha="$next"
        ;;
      "")
        err "$repo@$tag: git tag object $sha has no type (deleted? renamed?)"
        err "  remediation: re-pin to a different tag or release SHA"
        return 1
        ;;
      *)
        err "$repo@$tag: unexpected git object type: $type"
        return 1
        ;;
    esac
  done
}

# ─── sub-command: cloudflare-wire ────────────────────────────────────────────
cloudflare-wire() {
  hdr "cloudflare-wire — KV/D1/R2 + secrets"
  require_tool wrangler
  require_tool jq

  if is_apply; then require_yolo; fi

  local kv_name="MAPLESPIKE_KV"
  local d1_name="quill-cache"
  local r2_name="maplespike-uploads"

  log "scanning existing resources on project '$PAGES_PROJECT'..."
  if is_apply; then
    create_if_missing kv            "$kv_name" wrangler kv namespace create "$kv_name"
    create_if_missing d1            "$d1_name" wrangler d1 create "$d1_name"
    create_if_missing r2            "$r2_name" wrangler r2 bucket create "$r2_name"
    create_if_missing pages-project "$PAGES_PROJECT" \
      "wrangler pages project create '$PAGES_PROJECT'"
  else
    log "[dry-run] would scan + create these (idempotent via exact-name match):"
    printf '    wrangler kv namespace list          --format=json\n'
    printf '    wrangler d1 list                    --format=json\n'
    printf '    wrangler r2 bucket list             --format=json\n'
    printf '    wrangler pages project list         --format=json\n'
    printf '    plan entries → %s\n' "$PLAN_FILE"
  fi

  # Collect secrets from env, route all writes through plan().
  local secret_actions=()
  if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then secret_actions+=("CLOUDFLARE_API_TOKEN:CLOUDFLARE_API_TOKEN"); fi
  if [[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then secret_actions+=("CLOUDFLARE_ACCOUNT_ID:CLOUDFLARE_ACCOUNT_ID"); fi
  if [[ -n "${IMAP_HOST:-}" ]]; then secret_actions+=("PDS_EMAIL_SMTP_HOST:IMAP_HOST"); fi
  if [[ -n "${IMAP_USER:-}" ]]; then secret_actions+=("PDS_EMAIL_SMTP_USER:IMAP_USER"); fi
  if [[ -n "${IMAP_PASS:-}" ]]; then secret_actions+=("PDS_EMAIL_SMTP_PASS:IMAP_PASS"); fi

  if [[ ${#secret_actions[@]} -eq 0 ]]; then
    log "no IMAP_*/CLOUDFLARE_* secrets in env; skipping secret write"
  else
    log "queueing wrangler pages secret put for ${#secret_actions[@]} key(s)..."
    for a in "${secret_actions[@]}"; do
      local cf_key="${a%%:*}"
      plan "pages secret put $cf_key" \
        "wrangler pages secret put '$cf_key' --project-name '$PAGES_PROJECT'"
    done
  fi
  ok "cloudflare-wire plan written to $PLAN_FILE"
}

# ─── sub-command: secrets-k8s ────────────────────────────────────────────────
secrets-k8s() {
  hdr "secrets-k8s — encode kubeconfigs + gh secret set"
  require_tool gh
  require_tool base64

  if is_apply; then require_yolo; fi

  local repo
  repo=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null \
    || { err "could not detect repo; signed into gh?"; exit 3; })
  log "target repo: $repo"

  for env in dev prod; do
    local path_var="KUBECONFIG_$(tr 'a-z' 'A-Z' <<<"$env")_PATH"
    local path="${!path_var:-}"
    local secret_name="KUBECONFIG_$(tr 'a-z' 'A-Z' <<<"$env")"
    if [[ -z "$path" ]]; then
      warn "$env: $path_var not set; skipping"
      continue
    fi
    if [[ ! -f "$path" ]]; then
      warn "$env: kubeconfig not found at $path; skipping"
      continue
    fi
    plan "gh secret set $secret_name (base64 of $path)" \
      "printf '%s' \"\$(base64 -w0 < '$path')\" | gh secret set '$secret_name' --repo '$repo'"
  done
  ok "secrets-k8s plan written to $PLAN_FILE"
}

# ─── sub-command: pin-actions-sha ────────────────────────────────────────────
# Routes sed -i through plan() so every mutation is auditable. The plan entry
# captures the exact regex that will run; --apply executes them in sequence.
pin-actions-sha() {
  hdr "pin-actions-sha — pin @vN → SHA in *.yml workflows"
  require_tool gh
  require_tool jq

  if is_apply; then require_yolo; fi

  local workflows
  workflows=$(find "$REPO_ROOT" -path '*/.github/workflows/*.yml' \
                -not -path '*/node_modules/*' -not -path '*/dist/*' 2>/dev/null)
  if [[ -z "$workflows" ]]; then
    warn "no workflow files under $REPO_ROOT"
    return 0
  fi

  # Find float pins: line containing `uses:` with `@vN` and not already followed by `# <sha>`.
  local float_hits=()
  while IFS= read -r f; do
    [[ -f "$f" ]] || continue
    while IFS= read -r spec; do
      [[ -n "$spec" ]] && float_hits+=("$spec")
    done < <(awk '
      /^[[:space:]]+uses:[[:space:]]+[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+@v[0-9]+([[:space:]]+[^#]|$)/ {
        # Strip leading whitespace + "uses: " to get repo@version
        ref = $2
        if (ref ~ /^[^#]+\@v[0-9]+([[:space:]]+[^#]|$)/) {
          # Trailing whitespace ok: emit the file:lineno:ref tuple
          printf "%s:%d:%s\n", FILENAME, NR, ref
        }
      }
      { FILENAME = FILENAME; }  # no-op to keep awk happy
    ' "$f")
  done <<<"$workflows"

  if [[ ${#float_hits[@]} -eq 0 ]]; then
    log "no float-pinned @vN uses found"
    return 0
  fi

  log "scanning ${#float_hits[@]} float-pinned uses..."

  local total=0 missing=0
  declare -A resolved  # cache SHAs by repo@tag

  for hit in "${float_hits[@]}"; do
    local file lineno ref repo tag sha key
    file=$(echo "$hit" | cut -d: -f1)
    lineno=$(echo "$hit" | cut -d: -f2)
    ref=$(echo "$hit" | cut -d: -f3-)
    repo=$(echo "$ref" | cut -d@ -f1)
    tag=$(echo "$ref" | cut -d@ -f2)
    key="${repo}@${tag}"

    total=$((total+1))
    if [[ -z "${resolved[$key]:-}" ]]; then
      if ! sha=$(resolve_commit_sha "$repo" "$tag"); then
        missing=$((missing+1))
        continue
      fi
      resolved[$key]="$sha"
    else
      sha="${resolved[$key]}"
    fi

    # Plan the sed. The pattern is repo@tag with literal `@`; sed metachar
    # concern is minimal since repo names exclude @.
    plan "pin ${ref} → sha in $file:$lineno" \
      "sed -i 's|${ref}\([[:space:]]\+\)|${ref} # ${sha} |; s|${ref}\$|${ref} # ${sha}|' '$file'"
  done

  if [[ $total -eq 0 ]]; then
    log "nothing to do"
  else
    log "processed $total uses; missing $missing (see warnings above)"
  fi
  ok "pin-actions-sha plan written to $PLAN_FILE"
}

# ─── sub-command: domain-cutover ─────────────────────────────────────────────
domain-cutover() {
  hdr "domain-cutover — pre-check, attach, post-verify"
  require_tool curl
  require_tool dig

  if is_apply; then require_yolo; fi

  local domain="$APEX_DOMAIN"
  log "checking DNS for $domain..."
  local a aaaa caa
  a=$(dig +short "$domain" A 2>/dev/null || true)
  aaaa=$(dig +short "$domain" AAAA 2>/dev/null || true)
  caa=$(dig +short "$domain" CAA 2>/dev/null || true)
  log "A    record(s): ${a:-<none>}"
  log "AAAA record(s): ${aaaa:-<none>}"
  log "CAA  records:   ${caa:-<none>}"
  if [[ -n "$a" || -n "$aaaa" ]]; then
    log "DNS resolves. CF attach will replace conflicting A/AAAA."
  else
    warn "no A/AAAA — apex not yet pointed at CF services."
  fi
  [[ -n "$caa" ]] && log "CAA present — ensure letsencrypt.org and/or digicert.com is allowed"

  if is_apply; then
    if [[ -n "${CLOUDFLARE_API_TOKEN:-}" && -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
      plan "POST CF API: attach $domain → $PAGES_PROJECT" \
        "curl -fsS -X POST 'https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/$PAGES_PROJECT/domains' -H 'Authorization: Bearer ${CLOUDFLARE_API_TOKEN}' -H 'Content-Type: application/json' --data '{\"name\":\"$domain\"}'"
    else
      warn "CLOUDFLARE_API_TOKEN/ACCOUNT_ID not set; skipping attach"
      warn "use Cloudflare dashboard: Workers & Pages → $PAGES_PROJECT → Custom domains"
    fi
  else
    log "[dry-run] would call CF API to attach $domain → $PAGES_PROJECT"
  fi
  log "post-cutover sanity check:"
  plan "verify HTTPS serving (after attach)" \
    "curl -fsSI 'https://$domain' | head -3"
  ok "domain-cutover complete"
}

# ─── sub-command: usage-report ───────────────────────────────────────────────
usage-report() {
  hdr "usage-report — Cloudflare + D1 + KV + R2 usage dashboard (one-shot)"
  require_tool wrangler

  cat <<'BANNER'

Cloudflare Free-Tier Caps
─────────────────────────
Pages     unlimited sites, 500 builds/mo, 100 custom domains/project
Workers   100k requests/day, 10ms CPU
D1        5GB storage, 5M rows read/day, 100k rows written/day
KV        100k reads/day, 1k writes/day, 1k deletes/day, 1GB storage
R2        10GB-month storage, 1M Class A ops/mo, 10M Class B ops/mo
BANNER

  log "auth state:"
  { wrangler whoami 2>/dev/null || true; } | head -5 | cat || true
  wrangler whoami 2>/dev/null >/dev/null || warn "wrangler not authenticated"

  log "Pages deployments on $PAGES_PROJECT:"
  wrangler pages deployment list --project-name "$PAGES_PROJECT" 2>/dev/null | head -20 || true
  log "D1 databases:"
  wrangler d1 list 2>/dev/null || true
  log "KV namespaces:"
  wrangler kv namespace list 2>/dev/null || true
  log "R2 buckets:"
  wrangler r2 bucket list 2>/dev/null || true
  ok "usage-report complete"
}

# ─── sub-command: e2e-billing ────────────────────────────────────────────────
e2e-billing() {
  hdr "e2e-billing — order → e-Transfer → reconcile"
  local base="$API_BASE"
  require_tool curl
  require_tool jq

  if ! is_apply; then
    log "[dry-run] would exercise POST $base/v1/billing/orders etc."
    return 0
  fi
  require_yolo

  log "fetching plans from $base/v1/billing/plans ..."
  local plan_id
  plan_id=$(curl -fsS "$base/v1/billing/plans" 2>/dev/null | jq -r '.[0].id // "smoke-test-plan"' || echo "smoke-test-plan")
  log "using plan_id=$plan_id"

  log "creating order..."
  local order_resp order_id
  order_resp=$(curl -fsS -X POST "$base/v1/billing/orders" \
    -H 'Content-Type: application/json' \
    -d "{\"planId\":\"$plan_id\",\"email\":\"smoke+$(date +%s)@maplespike.ca\",\"amountCents\":5000}" \
    2>/dev/null || echo "{}")
  order_id=$(printf '%s' "$order_resp" | jq -r '.id // .orderId // ""' 2>/dev/null || echo "")
  log "order_id=$order_id"
  [[ -z "$order_id" ]] && { warn "order creation failed"; log "raw: $order_resp"; return 1; }

  log "fetching order status..."
  plan "GET /v1/billing/orders/$order_id" \
    "curl -fsS '$base/v1/billing/orders/$order_id' | jq ."

  log "running reconcile (IMAP poll dependent):"
  plan "POST /v1/billing/reconcile" \
    "curl -fsS -X POST '$base/v1/billing/reconcile' | jq ."

  log "verifying credit allocation:"
  plan "GET /v1/billing/orders/$order_id (after reconcile)" \
    "curl -fsS '$base/v1/billing/orders/$order_id' | jq ."
  ok "e2e-billing complete"
}

# ─── sub-command: decision-stub ──────────────────────────────────────────────
# Intentional deviation from the plan()/apply contract: file contents are
# heredoc-piped (cannot be safely serialized to a single eval'd command-line),
# AND this sub-command is itself the definition of "TBD" templates — its
# output is deterministically generated from the script, not from any
# operator input. The double defense is the `[[ -f $path ]]` guard.
decision-stub() {
  hdr "decision-stub — write docs/decisions/IDENTITY.md template"
  is_apply || { log "[dry-run] nothing written; --apply to write"; return 0; }

  mkdir -p "$REPO_ROOT/docs/decisions"
  local path="$REPO_ROOT/docs/decisions/IDENTITY.md"
  [[ -f "$path" ]] && { warn "$path exists; not overwriting"; return 0; }

  local today
  today=$(date -u +"%Y-%m-%d")

  # IMPORTANT: heredoc must remain single-quoted ('TEMPLATE') so any future
  # `$` in the template body is preserved literally. Date is injected via
  # __DATE__ token + sed AFTER the write — safer than unquoting the heredoc,
  # which would expand every future `$` in template content.
  cat > "$path" <<'TEMPLATE'
# Decision 0001 — Canonical Identity Path

**Status:** Proposed ⏳ · **Owner:** TBD · **Date:** __DATE__

## Context

MapleSpike has four surfaces, each with (or planning) its own identity:

- **Brand site** (`maplespike-brand`) — Convex auth framework
- **MapleSpike Fabric** (live, edge-worker hyperscale) — server-side
  sessions, API-keyed by `?api_key=`
- **Mosaic** (in design) — Ed25519 + passkey per the original DESIGN.md
- **Social Bridge** (in design) — OAuth per platform (Bluesky atproto,
  Mastodon OAuth, etc.)

Without a single canonical identity, the costs are:

- Customer doubling — one person = three accounts (brand, API, Chat).
  Each surface owns its own user table.
- Billing drift — billing/plan-payment lives in brand side; enterprises
  pay via Fabric; Mosaic users pay via a third path. Revenue is hard
  to attribute to actual users.
- Audit gaps — "who did what" evidence is scattered across three
  identity systems that don't cross-reference.

We need one canonical identity every surface speaks to, with opt-in
sovereignty so Mosaic users retain self-custody.

## Options Considered

### A. Centralized-Convex identity (status quo)
Single identity provider; Convex for the brand + Fabric; Mosaic
becomes an OAuth-style client.

- Pro: Simple. Already in place. One sign-in for everything.
- Con: Sovereignty users in Mosaic have to trust Convex. No portable
  identity. Hostile to "sovereignty by design."

### B. Mosaic Ed25519 identity, deferred Convex bridge
Mosaic owns the identity layer first; everyone else becomes a client.

- Pro: Sovereignty-first. Portable. PLC-compatible.
- Con: Convex auth + Mosaic must interop → duplicate-account risk
  for cross-surface users. None of the brand or Fabric tooling
  speaks Ed25519 yet.

### C. Hybrid — Mosaic owns keys, Convex-friendly bridge
Mosaic issues Ed25519 + passkey at signup. A "Convex-friendly"
projection (a stable user id) is derived and cached in Convex for
the brand portal. Fabric keys either by the same Mosaic key (future)
or fall back to API keys for non-Mosaic users.

- Pro: Sovereignty by default. Convex ergonomics when the user
  chooses brand-side conveniences. Reconciles "who is this person"
  without forcing a single shape.
- Con: Two layers to maintain. Phase 1 of the bridge needs care.

## Decision

**Chosen:** _TBD_

## Consequences

_Fill in once a decision is made._

## Open Questions

- Should Mosaic optionally publish `did:plc` entries? (See
  bluesky-social/atproto `@atproto/identity`.)
- Does brand-portal Convex auth need a "this is also a Mosaic user"
  flag for downstream tooling?
- How does an unauthenticated visitor to the brand portal become a
  customer without knowing Mosaic exists yet?

## References

- `maple-spike/DESIGN.md` §Identity (planned)
- `maplespike-relay/src/auth/atproto.ts` (existing Bluesky atproto
  bridging — useful precedent)
- https://github.com/bluesky-social/pds
- https://github.com/bluesky-social/atproto (`@atproto/identity`)
TEMPLATE
  # Now inject __DATE__ via sed (only after heredoc is written).
  sed -i.bak "s|__DATE__|$today|" "$path" && rm -f "$path.bak"
  # Post-injection assertion: confirm the date actually landed.
  if ! grep -q "$today" "$path"; then
    err "date injection failed: '$today' not present in $path"
    err "  check that __DATE__ sentinel is in the heredoc body"
    return 1
  fi
  ok "wrote $path"

  if [[ ! -f "$REPO_ROOT/docs/decisions/README.md" ]]; then
    local readme="$REPO_ROOT/docs/decisions/README.md"
    cat > "$readme" <<'README'
# Engineering Decisions

Lightweight ADR hub. See IDENTITY.md for the current active record.

New decisions land as `NNNN-slug.md`, follow Status ↔
Proposed ⏳ → Accepted ✅ → Superseded ↩️ → Rejected ❌, and never
get deleted (superseded ones stay in git history as the audit trail).
README
    ok "wrote $REPO_ROOT/docs/decisions/README.md"
  fi
}

# ─── sub-command: all ────────────────────────────────────────────────────────
all() {
  cloudflare-wire
  secrets-k8s
  pin-actions-sha
}

# ─── dispatch ───────────────────────────────────────────────────────────────
case "${SUBCMD:-}" in
  "")              awk '/^# ───/ || /^# Usage:/ || /^# Sub-commands:/ {flag=1} flag' "$0" | sed 's/^# *//' ;;
  __help__)        awk '/^# ───/ || /^# Usage:/ || /^# Sub-commands:/ {flag=1} flag' "$0" | sed 's/^# *//' ;;
  cloudflare-wire) cloudflare-wire ;;
  secrets-k8s)     secrets-k8s ;;
  pin-actions-sha) pin-actions-sha ;;
  domain-cutover)  domain-cutover ;;
  usage-report)    usage-report ;;
  e2e-billing)     e2e-billing ;;
  decision-stub)   decision-stub ;;
  all)             all ;;
  *)
    err "unknown sub-command: $SUBCMD"
    awk '/^# ───/ || /^# Usage:/ || /^# Sub-commands:/ {flag=1} flag' "$0" | sed 's/^# *//' || true
    exit 1
    ;;
esac
