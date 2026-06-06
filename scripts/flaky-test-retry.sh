#!/usr/bin/env bash
# =============================================================================
# MapleSpike — Flaky Test Retry Handler
# Automatically retries failed tests with exponential backoff
# Usage: ./scripts/flaky-test-retry.sh [max_attempts] [test_command]
# =============================================================================
set -euo pipefail

# Configuration
MAX_ATTEMPTS=${1:-3}
TEST_COMMAND=${2:-"pnpm test"}
WORKSPACE="${WORKSPACE:-$(pwd)}"
RETRY_LOG="${WORKSPACE}/.ci/retry-log.json"
FLAKY_THRESHOLD=2  # Number of failures before marking as flaky

# Counters
ATTEMPT=0
SUCCESS=false
FAILED_TESTS=()

# Ensure log directory exists
mkdir -p "$(dirname "$RETRY_LOG")"

# Initialize log
echo '{"attempts": [], "flaky_tests": [], "final_status": "pending"}' > "$RETRY_LOG"

log() {
  echo "[$(date -Iseconds)] $*" | tee -a "${WORKSPACE}/.ci/retry-output.log"
}

# Exponential backoff: 30s, 60s, 120s
get_backoff() {
  local attempt=$1
  echo $((30 * (2 ** (attempt - 1))))
}

# Parse test output to extract failed test names
parse_failed_tests() {
  local output="$1"
  # Extract test names from node:test output
  echo "$output" | grep -oP '(?<=not ok ).*' | head -20
}

# Check if failure matches known flaky patterns
is_known_flaky_pattern() {
  local output="$1"
  
  # Pattern 1: Race conditions in async code
  if echo "$output" | grep -qE "(race condition|ETIMEDOUT|ECONNREFUSED)"; then
    return 0
  fi
  
  # Pattern 2: Port conflicts (tests binding to fixed ports)
  if echo "$output" | grep -qE "(EADDRINUSE|address already in use)"; then
    return 0
  fi
  
  # Pattern 3: Timing-dependent failures
  if echo "$output" | grep -qE "(timeout|timed out|deadline exceeded)"; then
    return 0
  fi
  
  # Pattern 4: External API call failures (RSS feeds, government APIs)
  if echo "$output" | grep -qE "(ENOTFOUND|ECONNRESET|fetch failed|5[0-9]{2})"; then
    return 0
  fi
  
  return 1
}

# Run test with capture
run_test() {
  local attempt=$1
  local output
  local exit_code
  
  log "Attempt $attempt/$MAX_ATTEMPTS: Running: $TEST_COMMAND"
  
  # Run test and capture both stdout and stderr
  output=$(cd "$WORKSPACE" && eval "$TEST_COMMAND" 2>&1) || exit_code=$?
  exit_code=${exit_code:-0}
  
  echo "$output"
  return $exit_code
}

# Record attempt in log
record_attempt() {
  local attempt=$1
  local status=$2
  local duration=$3
  local error_output=$4
  
  local timestamp
  timestamp=$(date -Iseconds)
  
  # Read current log (handle concurrent writes)
  local current_log
  current_log=$(cat "$RETRY_LOG" 2>/dev/null || echo '{"attempts": [], "flaky_tests": []}')
  
  # Add new attempt using Python for JSON manipulation
  python3 << PYEOF
import json
import sys

log_data = json.loads('''$current_log''')
attempt_record = {
    "attempt": $attempt,
    "timestamp": "$timestamp",
    "status": "$status",
    "duration_sec": $duration,
    "error_sample": """$error_output"""[:500]  # Truncate for log
}
log_data["attempts"].append(attempt_record)
log_data["final_status"] = "$status"

with open("$RETRY_LOG", "w") as f:
    json.dump(log_data, f, indent=2)
PYEOF
}

# Main retry loop
log "Starting flaky test retry handler"
log "Max attempts: $MAX_ATTEMPTS"
log "Test command: $TEST_COMMAND"
log "Workspace: $WORKSPACE"

START_TIME=$(date +%s)

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  ATTEMPT_START=$(date +%s)
  
  # Run test
  TEST_OUTPUT=$(run_test $ATTEMPT) || TEST_EXIT_CODE=$?
  TEST_EXIT_CODE=${TEST_EXIT_CODE:-0}
  
  ATTEMPT_END=$(date +%s)
  DURATION=$((ATTEMPT_END - ATTEMPT_START))
  
  if [ $TEST_EXIT_CODE -eq 0 ]; then
    log "✅ Tests passed on attempt $ATTEMPT (${DURATION}s)"
    SUCCESS=true
    record_attempt $ATTEMPT "passed" $DURATION ""
    break
  else
    log "❌ Tests failed on attempt $ATTEMPT (${DURATION}s)"
    log "Error output:\n$TEST_OUTPUT" | head -50
    
    # Check if this is a known flaky pattern
    if is_known_flaky_pattern "$TEST_OUTPUT"; then
      log "⚠️ Failure matches known flaky pattern"
      
      # Extract failed test names
      FAILED=$(parse_failed_tests "$TEST_OUTPUT")
      if [ -n "$FAILED" ]; then
        log "Failed tests: $FAILED"
      fi
      
      # Record flaky attempt
      record_attempt $ATTEMPT "flaky" $DURATION "$TEST_OUTPUT"
      
      # Retry with backoff if not last attempt
      if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
        BACKOFF=$(get_backoff $ATTEMPT)
        log "Waiting ${BACKOFF}s before retry (exponential backoff)"
        sleep "$BACKOFF"
      fi
    else
      log "❌ Failure does NOT match known flaky patterns — failing immediately"
      record_attempt $ATTEMPT "failed" $DURATION "$TEST_OUTPUT"
      # Exit immediately for non-flaky failures
      echo "$TEST_OUTPUT"
      exit 1
    fi
  fi
done

# Final status
if [ "$SUCCESS" = true ]; then
  TOTAL_TIME=$(($(date +%s) - START_TIME))
  log "✅ Tests passed after $ATTEMPT attempt(s) (total: ${TOTAL_TIME}s)"
  
  # Update final status in log
  python3 << PYEOF
import json
with open("$RETRY_LOG", "r") as f:
    log_data = json.load(f)
log_data["final_status"] = "passed"
log_data["total_attempts"] = $ATTEMPT
log_data["total_duration_sec"] = $TOTAL_TIME
with open("$RETRY_LOG", "w") as f:
    json.dump(log_data, f, indent=2)
PYEOF
  
  exit 0
else
  log "❌ Tests failed after $MAX_ATTEMPTS attempts"
  
  # Mark tests as flaky in log
  python3 << PYEOF
import json
with open("$RETRY_LOG", "r") as f:
    log_data = json.load(f)
log_data["final_status"] = "failed"
log_data["total_attempts"] = $ATTEMPT
log_data["needs_investigation"] = True
with open("$RETRY_LOG", "w") as f:
    json.dump(log_data, f, indent=2)
PYEOF
  
  # Create GitHub issue for flaky test tracking
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    log "Creating GitHub issue for flaky test tracking..."
    # Issue creation would go here (see escalation workflow below)
  fi
  
  exit 1
fi