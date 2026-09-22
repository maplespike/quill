#!/usr/bin/env bash
# Enforce a coverage floor for a package's test suite.
#
# Why: a suite can silently shrink — the quill-mcp `test:unit` glob skipped
# every root-level test file for weeks (79 tests reported instead of 820), and
# nothing failed. This makes the number visible and the floor binding, so
# "everything still works" is measured rather than assumed.
#
# Usage: check-coverage-floor.sh <package-filter> <coverage-script> <min-lines> <min-branch>
# Example: check-coverage-floor.sh @maplespike/api-server test:coverage 71 65
set -uo pipefail

FILTER="${1:?package filter required (e.g. @maplespike/api-server)}"
SCRIPT="${2:?coverage script required (e.g. test:coverage)}"
MIN_LINES="${3:?minimum line coverage required}"
MIN_BRANCH="${4:?minimum branch coverage required}"

LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

echo "::group::coverage — $FILTER ($SCRIPT)"
if ! pnpm --filter "$FILTER" "$SCRIPT" >"$LOG" 2>&1; then
  echo "FAIL: $FILTER $SCRIPT exited non-zero"
  tail -40 "$LOG"
  echo "::endgroup::"
  exit 1
fi
tail -12 "$LOG"
echo "::endgroup::"

SUMMARY="$(grep -E '^ℹ all files' "$LOG" | tail -1)"
if [ -z "$SUMMARY" ]; then
  echo "FAIL: $FILTER produced no coverage summary (did the suite run zero tests?)"
  exit 1
fi

LINES="$(printf '%s' "$SUMMARY" | awk -F'|' '{gsub(/[ %]/,"",$2); print $2}')"
BRANCH="$(printf '%s' "$SUMMARY" | awk -F'|' '{gsub(/[ %]/,"",$3); print $3}')"
TESTS="$(grep -E '^ℹ tests ' "$LOG" | tail -1 | awk '{print $3}')"
PASS="$(grep -E '^ℹ pass ' "$LOG" | tail -1 | awk '{print $3}')"
FAIL="$(grep -E '^ℹ fail ' "$LOG" | tail -1 | awk '{print $3}')"

echo "$FILTER: tests=${TESTS:-?} pass=${PASS:-?} fail=${FAIL:-?} lines=${LINES}% branch=${BRANCH}% (floor ${MIN_LINES}%/${MIN_BRANCH}%)"

if [ "${FAIL:-0}" != "0" ]; then
  echo "FAIL: $FILTER has $FAIL failing test(s)"
  exit 1
fi
awk -v v="$LINES" -v m="$MIN_LINES" 'BEGIN{exit !(v+0 >= m+0)}' || {
  echo "FAIL: $FILTER line coverage ${LINES}% is below the floor ${MIN_LINES}%"
  exit 1
}
awk -v v="$BRANCH" -v m="$MIN_BRANCH" 'BEGIN{exit !(v+0 >= m+0)}' || {
  echo "FAIL: $FILTER branch coverage ${BRANCH}% is below the floor ${MIN_BRANCH}%"
  exit 1
}
echo "OK: $FILTER meets the coverage floor"
