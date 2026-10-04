#!/usr/bin/env bash
# Run a command with output captured to a temporary file, then print a bounded
# tail while preserving the command's original exit status.
#
# GitHub Actions invokes run steps with bash -e by default. Do not run the
# command directly before saving its status: a non-zero exit would terminate
# the shell before diagnostics are printed. This helper uses an explicit
# conditional so both success and failure paths reach the tail.
set -u

if [ "$#" -eq 0 ]; then
  echo "Usage: run-with-log-tail.sh COMMAND [ARG ...]" >&2
  exit 2
fi

log_dir="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
log_file="$(mktemp "$log_dir/quill-ci.XXXXXX.log")" || exit 2
trap 'rm -f "$log_file"' EXIT

if "$@" >"$log_file" 2>&1; then
  status=0
else
  status=$?
fi

echo "--- captured output (last 120 lines of $log_file) ---"
tail -n 120 "$log_file"
exit "$status"
