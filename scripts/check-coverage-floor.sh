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
#
# The two coverage scripts are invoked as `node --import tsx ...`, not through
# the `tsx` CLI. Since tsx 4.23.9 the CLI unshifts `--enable-source-maps` onto
# every `--test` child it spawns (privatenumber/tsx@2f55884, "map Node test
# locations"). Under `--experimental-test-coverage` that startup flag makes
# Node attribute V8 coverage ranges against the transpiled source instead of
# the .ts file, so almost every module reports its import header and any
# line-shifted body as uncovered: api-server fell from 76.8% to 59.1% lines
# and quill-mcp from 75.6% to 58.2% on the npm-minor-patch bump with all
# 894/606 tests still green (2026-11-05). `node --import tsx` gets the same
# transform hooks without tsx's `--test` interception, so coverage mapping is
# unchanged. Keep the flags below in the scripts — test-hang-bounds.mts pins them.
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

# node --test prints the spec reporter (ℹ) on some runners and TAP (#) on
# others (arc-maplespike, PR #1188 coverage job), so accept both prefixes.
SUMMARY="$(grep -E '^(ℹ|#) all files' "$LOG" | tail -1)"
if [ -z "$SUMMARY" ]; then
  echo "FAIL: $FILTER produced no coverage summary (did the suite run zero tests?)"
  exit 1
fi

LINES="$(printf '%s' "$SUMMARY" | awk -F'|' '{gsub(/[ %]/,"",$2); print $2}')"
BRANCH="$(printf '%s' "$SUMMARY" | awk -F'|' '{gsub(/[ %]/,"",$3); print $3}')"
TESTS="$(grep -E '^(ℹ|#) tests ' "$LOG" | tail -1 | awk '{print $3}')"
PASS="$(grep -E '^(ℹ|#) pass ' "$LOG" | tail -1 | awk '{print $3}')"
FAIL="$(grep -E '^(ℹ|#) fail ' "$LOG" | tail -1 | awk '{print $3}')"

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
