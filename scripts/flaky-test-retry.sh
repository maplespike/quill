#!/usr/bin/env bash
# =============================================================================
# MapleSpike — Flaky Test Retry Handler
# =============================================================================
# ⚠️  ARCHIVED: This script is not wired into CI/CD workflows.
# Current CI uses standard test execution without retry logic.
#
# Original Purpose:
# Automatically retries failed tests with exponential backoff
# Usage: ./scripts/flaky-test-retry.sh [max_attempts] [test_command]
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

# Configuration
MAX_ATTEMPTS="${1:-3}"
TEST_COMMAND="${2:-pnpm test}"
WORKSPACE="${WORKSPACE:-$(pwd)}"

log_warning "⚠️  This script is ARCHIVED. Not wired into CI/CD workflows."
log_warning "Current CI uses standard test execution without retry logic."
log_info "To enable: Add to .github/workflows/ci.yml or create retry workflow"
log_error "Cannot execute - script not integrated into CI pipeline"
exit 1