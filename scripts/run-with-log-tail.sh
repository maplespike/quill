#!/usr/bin/env bash
# Run a command with output captured to a temporary file, then print a bounded
# tail while preserving the command's original exit status — plus a stall
# watchdog that makes a silently-hanging child visible in the live job log.
#
# GitHub Actions invokes run steps with bash -e by default. Do not run the
# command directly before saving its status: a non-zero exit would terminate
# the shell before diagnostics are printed. This helper uses an explicit
# conditional so both success and failure paths reach the tail.
#
# Why the watchdog exists (#996): on 2026-10-04 four CI steps hung mid-run
# with ZERO output until their job timeout cancelled them (59 minutes each;
# the qa api-and-mcp-validation job had no timeout-minutes and burned 3h17m
# of a runner slot at 0.0% CPU). The job log showed nothing between step
# start and cancel, so a hang was impossible to tell from progress. This
# wrapper now prints a timestamped warning as soon as the child has been
# silent for the warn window, so the job log shows WHEN the stall began
# and what the child last said.
#
# Configuration (environment):
#   STALL_WATCHDOG_MINUTES    silence window before each warning (default: 5)
#   STALL_KILL_AFTER_MINUTES  silence window before killing the child;
#                             0 or empty disables the kill (default: 0)
#   STALL_WATCHDOG_SECONDS / STALL_KILL_AFTER_SECONDS
#                             same windows in seconds; when set they override
#                             the minute forms (used by scripts/test-stall-watchdog.mts
#                             to exercise the watchdog quickly)
#
# Exit status: the child's exit status; 124 if the watchdog killed it.

set -u

if [ "$#" -eq 0 ]; then
  echo "Usage: run-with-log-tail.sh COMMAND [ARG ...]" >&2
  exit 2
fi

: "${STALL_WATCHDOG_MINUTES:=5}"
: "${STALL_KILL_AFTER_MINUTES:=0}"

log_dir="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
log_file="$(mktemp "$log_dir/quill-ci.XXXXXX.log")" || exit 2
trap 'rm -f "$log_file"' EXIT

start_ts=$(date +%s)
if [ -n "${STALL_WATCHDOG_SECONDS:-}" ]; then
  warn_seconds=$STALL_WATCHDOG_SECONDS
else
  warn_seconds=$(( STALL_WATCHDOG_MINUTES * 60 ))
fi
if [ -n "${STALL_KILL_AFTER_SECONDS:-}" ]; then
  kill_seconds=$STALL_KILL_AFTER_SECONDS
else
  kill_seconds=$(( STALL_KILL_AFTER_MINUTES * 60 ))
fi

# The child runs in its own process group (setsid when available) so a
# watchdog kill reaches the whole tree. On 2026-10-04 the runner's cancel
# left ten orphaned node grandchildren behind because only the direct
# child had been signalled.
if command -v setsid >/dev/null 2>&1; then
  setsid "$@" >"$log_file" 2>&1 &
  cmd_pid=$!
  pgid=$cmd_pid
else
  "$@" >"$log_file" 2>&1 &
  cmd_pid=$!
  pgid=""
fi

fmt_elapsed() {
  # seconds -> "1m23s"
  local s=$1
  printf '%dm%02ds' $(( s / 60 )) $(( s % 60 ))
}

fmt_window() {
  # seconds -> "5m" or "3s" (for the armed banner)
  local s=$1
  if [ "$s" -ge 60 ] && [ $(( s % 60 )) -eq 0 ]; then
    printf '%dm' $(( s / 60 ))
  else
    printf '%ds' "$s"
  fi
}

last_size=0
last_change_ts=$start_ts
last_warn_ts=$start_ts
killed=0

if [ "$kill_seconds" -gt 0 ]; then
  echo "--- stall watchdog armed: warn after $(fmt_window "$warn_seconds") of silence, hard kill after $(fmt_window "$kill_seconds") ---"
else
  echo "--- stall watchdog armed: warn after $(fmt_window "$warn_seconds") of silence (no hard kill) ---"
fi

# Poll interval: fine (1s) when a seconds-level override is in play (tests),
# coarse (5s) otherwise — cheap enough either way.
if [ -n "${STALL_WATCHDOG_SECONDS:-}" ] || [ -n "${STALL_KILL_AFTER_SECONDS:-}" ]; then
  poll_seconds=1
else
  poll_seconds=5
fi

while kill -0 "$cmd_pid" 2>/dev/null; do
  sleep "$poll_seconds"
  now=$(date +%s)
  size=$(stat -c %s "$log_file" 2>/dev/null || echo 0)
  if [ "$size" -ne "$last_size" ]; then
    last_size=$size
    last_change_ts=$now
    continue
  fi
  silent_s=$(( now - last_change_ts ))
  total_s=$(( now - start_ts ))
  since_warn_s=$(( now - last_warn_ts ))
  if [ "$silent_s" -ge "$warn_seconds" ] && [ "$since_warn_s" -ge "$warn_seconds" ]; then
    last_warn_ts=$now
    echo "::warning::STALL WATCHDOG: no output from '$*' for $(fmt_elapsed "$silent_s") (step elapsed $(fmt_elapsed "$total_s")). Last output follows."
    echo "--- last output (tail of $log_file, captured at $(date -u +%Y-%m-%dT%H:%M:%SZ)) ---"
    tail -n 30 "$log_file" | sed 's/^/  | /'
    echo "--- end last output ---"
  fi
  if [ "$kill_seconds" -gt 0 ] && [ "$silent_s" -ge "$kill_seconds" ]; then
    killed=1
    echo "::error::STALL WATCHDOG: killing '$*' after $(fmt_elapsed "$silent_s") of silence (step elapsed $(fmt_elapsed "$total_s")). Last 60 lines follow."
    tail -n 60 "$log_file" | sed 's/^/  | /'
    if [ -n "$pgid" ]; then
      kill -TERM -"$pgid" 2>/dev/null || kill -TERM "$cmd_pid" 2>/dev/null
    else
      kill -TERM "$cmd_pid" 2>/dev/null
    fi
    # Grace period for a clean shutdown, then force.
    for _ in 1 2 3 4 5 6; do
      kill -0 "$cmd_pid" 2>/dev/null || break
      sleep "$poll_seconds"
    done
    if kill -0 "$cmd_pid" 2>/dev/null; then
      if [ -n "$pgid" ]; then
        kill -KILL -"$pgid" 2>/dev/null || kill -KILL "$cmd_pid" 2>/dev/null
      else
        kill -KILL "$cmd_pid" 2>/dev/null
      fi
    fi
    break
  fi
done

if [ "$killed" -eq 1 ]; then
  wait "$cmd_pid" 2>/dev/null
  echo "::error::STALL WATCHDOG: '$*' was killed by the stall watchdog; the step fails instead of hanging to the job timeout."
  exit 124
fi

# Wait for command to finish and get exit status (safe under bash -e).
wait "$cmd_pid"
status=$?

echo "--- captured output (last 120 lines of $log_file) ---"
tail -n 120 "$log_file"
if [ "$status" -ne 0 ]; then
  # The tail rarely contains the failing test in a long run. Name every
  # failed or cancelled test from the full log so the cause is visible.
  echo "--- failed or cancelled tests (full log) ---"
  grep -n -A14 -E '^[[:space:]]*not ok ' "$log_file" | head -n 400 || true
fi
exit "$status"
