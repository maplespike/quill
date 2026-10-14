#!/usr/bin/env bash
# Full-history secrets gate.
#
# WHY THIS EXISTS
# ---------------
# The `secrets` job in ci.yml runs gitleaks-action, which scans the *event's*
# commit range — the PR's commits, or a push's commits. Historic leaks are
# outside every range, so they are invisible to it by construction. That is why
# the job has been green on main while a full-history scan reports 17 findings,
# including the two age private keys that issue #854 exists for.
#
# SCAN SCOPE (read this before regenerating the baseline)
# -------------------------------------------------------
# The scope is the origin remote's remote-tracking refs plus HEAD — see the
# LOG_OPTS block below for why it is not a bare `--all`. The practical rule:
# run `git fetch --prune origin` in the clone that generates the baseline. A
# stale remote-tracking ref (its branch was deleted upstream and the clone has
# not pruned) resolves commits CI will never fetch, so local and CI disagree on
# the finding set and the gate fails for a reason that has nothing to do with
# secrets. That is exactly what happened on 2026-10-09 (PR #1045): three
# baseline entries lived only on stale `origin/wt/*` refs.
#
# A gate that cannot see the history it is supposed to guard is worse than no
# gate: it produces a green check that reads as "history is clean".
#
# WHAT IT ENFORCES
# ----------------
# The set of full-history findings must equal the set recorded in
# docs/secrets-history-baseline.txt, exactly.
#
#   * A finding not in the baseline  -> FAIL. A new secret landed in history.
#   * A baseline entry not found     -> FAIL. The baseline is stale; tighten it.
#
# The second direction is deliberate. It is what makes the #854 remediation
# verifiable: once `.secrets/` is rewritten out, the two age-key entries
# disappear from the scan and this gate fails until somebody removes them from
# the baseline — so "we removed the keys" becomes a reviewed diff rather than a
# claim in a comment.
#
# The baseline is an enumeration, not an allow-list: it names each finding by
# commit, path, rule and line so it can be re-verified, and it hides nothing
# from a reader. Adding an entry means writing down what the secret is and why
# it is tolerated.
#
# USAGE
#   bash scripts/check-secrets-history.sh
#   GITLEAKS_BIN=/path/to/gitleaks bash scripts/check-secrets-history.sh
#   GITLEAKS_BIN=... bash scripts/check-secrets-history.sh --print-baseline
#     (prints the current finding set in baseline format — use after a
#      deliberate change to regenerate, then review the diff)
#   GITLEAKS_BIN=... bash scripts/check-secrets-history.sh --all-refs
#     (scan `--all` instead of the origin refs: every local and remote-tracking
#      ref in this clone, including branches that were never pushed. This is the
#      right scope for a pre-public audit — it is a superset of what CI sees —
#      but it is the WRONG scope for the enforced gate, because it is not
#      reproducible in CI.)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BASELINE="docs/secrets-history-baseline.txt"
CONFIG=".gitleaks.toml"
GITLEAKS_BIN="${GITLEAKS_BIN:-gitleaks}"

PRINT_ONLY=0
USE_ALL_REFS=0
for arg in "$@"; do
  case "$arg" in
    --print-baseline) PRINT_ONLY=1 ;;
    --all-refs)       USE_ALL_REFS=1 ;;
    *) echo "check-secrets-history: unknown argument: $arg" >&2; exit 2 ;;
  esac
done

if ! command -v "$GITLEAKS_BIN" >/dev/null 2>&1; then
  echo "check-secrets-history: gitleaks not found (set GITLEAKS_BIN)" >&2
  exit 2
fi

# ── Scan scope ───────────────────────────────────────────────────────────────
# Deliberately NOT a bare `--all`. `--all` resolves every ref in *this clone*,
# which is a different set in every environment: a remote-tracking ref that is
# stale (branch deleted upstream, clone not pruned) resolves commits CI cannot
# fetch, and a local-only branch resolves commits that were never pushed. The
# same repository then yields different finding sets locally and in CI, and the
# gate fails over a ref nobody deleted rather than over a secret. Keep the
# scope explicit so both environments scan the same thing:
#
#   refs/remotes/origin/*  what actions/checkout leaves behind at fetch-depth: 0
#                          (it fetches refs/heads/* into refs/remotes/origin/*),
#                          and what a pruned local clone has too
#   HEAD                   the checked-out branch — in CI, the PR's merge ref,
#                          which already contains that PR's base branch
#
# Out of scope by design: branches that were never pushed. Use --all-refs to
# audit those (a superset), and regenerate the baseline only with the default
# scope, since only that scope is reproducible in CI.
if [[ "$USE_ALL_REFS" -eq 1 ]]; then
  LOG_OPTS="--all"
elif [[ -n "$(git for-each-ref refs/remotes/origin --format='%(refname)' | head -1)" ]]; then
  LOG_OPTS="--glob=refs/remotes/origin/* HEAD"
else
  echo "check-secrets-history: no refs/remotes/origin/* — no remote fetched? falling back to --all" >&2
  LOG_OPTS="--all"
fi

REPORT="$(mktemp -t gitleaks-history.XXXXXX.json)"
trap 'rm -f "$REPORT"' EXIT

# --redact so a CI log never carries the secret value itself.
# --exit-code 0: findings are data for the comparison below, not the verdict —
# the verdict is the set difference.
"$GITLEAKS_BIN" detect \
  --source "$REPO_ROOT" \
  --config "$CONFIG" \
  --log-opts="$LOG_OPTS" \
  --report-format json \
  --report-path "$REPORT" \
  --redact \
  --no-banner \
  --exit-code 0 >/dev/null 2>&1 || true

# Normalise to the same `<commit>:<file>:<rule>:<line>` shape as
# .gitleaksignore, sorted so the comparison is set-based rather than ordered.
current="$(python3 - "$REPORT" <<'PY'
import json, sys
with open(sys.argv[1]) as fh:
    try:
        findings = json.load(fh)
    except json.JSONDecodeError:
        findings = []
for f in findings:
    print(f"{f.get('Commit','')[:40]}:{f.get('File','')}:{f.get('RuleID','')}:{f.get('StartLine','')}")
PY
)"

current="$(printf '%s\n' "$current" | sed '/^$/d' | sort -u)"

if [[ "$PRINT_ONLY" -eq 1 ]]; then
  printf '%s\n' "$current"
  echo "check-secrets-history: scope was: $LOG_OPTS" >&2
  exit 0
fi

if [[ ! -f "$BASELINE" ]]; then
  echo "check-secrets-history: missing $BASELINE" >&2
  echo "  generate it with: bash scripts/check-secrets-history.sh --print-baseline" >&2
  exit 2
fi

expected="$(sed 's/#.*//' "$BASELINE" | sed '/^[[:space:]]*$/d' | sort -u)"

new_findings="$(comm -23 <(printf '%s\n' "$current") <(printf '%s\n' "$expected"))"
gone_findings="$(comm -13 <(printf '%s\n' "$current") <(printf '%s\n' "$expected"))"

count_current="$(printf '%s\n' "$current" | sed '/^$/d' | wc -l | tr -d ' ')"
count_expected="$(printf '%s\n' "$expected" | sed '/^$/d' | wc -l | tr -d ' ')"

status=0

if [[ -n "$(printf '%s\n' "$new_findings" | sed '/^$/d')" ]]; then
  status=1
  echo "check-secrets-history: FAIL — $(printf '%s\n' "$new_findings" | sed '/^$/d' | wc -l | tr -d ' ') finding(s) in history are not in the baseline:"
  printf '%s\n' "$new_findings" | sed '/^$/d' | sed 's/^/    /'
  echo
  echo "  If this is a real secret: rotate it, then add it to $BASELINE"
  echo "  with a note saying what it is and why it is tolerated."
fi

if [[ -n "$(printf '%s\n' "$gone_findings" | sed '/^$/d')" ]]; then
  status=1
  echo "check-secrets-history: FAIL — the baseline lists $(printf '%s\n' "$gone_findings" | sed '/^$/d' | wc -l | tr -d ' ') finding(s) that no longer exist in history:"
  printf '%s\n' "$gone_findings" | sed '/^$/d' | sed 's/^/    /'
  echo
  echo "  Two causes, and they look identical from here:"
  echo "    1. History really was cleaned — remove these lines from $BASELINE."
  echo "    2. The clone that generated the baseline was scanned over a different"
  echo "       ref set than this run. The usual culprit is a stale"
  echo "       remote-tracking ref: run 'git fetch --prune origin' and re-run"
  echo "       before touching the baseline."
  echo "  (scope this run: $LOG_OPTS)"
fi

if [[ "$status" -eq 0 ]]; then
  echo "check-secrets-history: PASS — $count_current full-history finding(s), all accounted for in the baseline"
  echo "  (baseline entries: $count_expected)"
fi

echo "check-secrets-history: scope: $LOG_OPTS"

exit "$status"
