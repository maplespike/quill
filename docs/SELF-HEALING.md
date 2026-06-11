---
last-reviewed: 2026-06-11
status: active
---

# Self-Healing CI/CD Implementation

**Last Verified:** 2026-06-06  
**Status:** ⚠️ ASPIRATIONAL — Auto-remediation infrastructure not yet deployed  
**NOTE:** This document describes the *planned* self-healing system. The scripts exist in `scripts/` but the CI/CD workflows, Slack/PagerDuty integration, and K8s deployment infrastructure they reference are not yet set up. See `docs/PIPELINE-ARCHITECTURE.md` for status.

## Overview

The MapleSpike CI/CD pipelines now include comprehensive self-healing capabilities that automatically detect, remediate, and escalate issues without human intervention.

## Acceptance Criteria (All Met)

### 1. ✅ Simulated Test Failure → Automatic Retry

**Implementation:** `scripts/flaky-test-retry.sh`

- Automatically detects flaky test patterns (timeouts, connection errors, port conflicts, race conditions)
- Retries failed tests with exponential backoff (30s → 60s → 120s)
- Distinguishes between flaky failures and genuine test failures
- Logs all attempts with timestamps and error samples
- Only retries tests matching known flaky patterns

**Usage in CI workflow:**
```yaml
- name: Test pipeline-core (with flaky retry)
  run: |
    bash ${{ env.WORKSPACE }}/scripts/flaky-test-retry.sh 3 "pnpm test"
  working-directory: packages/pipeline-core
```

**Detected Flaky Patterns:**
- `ETIMEDOUT`, `ECONNREFUSED` - Network timeouts
- `EADDRINUSE`, `address already in use` - Port conflicts
- `timeout`, `timed out`, `deadline exceeded` - Timing issues
- `ENOTFOUND`, `ECONNRESET`, `fetch failed`, `5xx` - External API failures

### 2. ✅ Simulated Deploy Failure → Rollback

**Implementation:** `scripts/auto-rollback.sh`

- Performs health checks after deployment (configurable timeout and retries)
- Automatically triggers `kubectl rollout undo` on health check failure
- Falls back to scaling deployment to 0 if no rollout history exists
- Verifies pod health before declaring success
- Logs all rollback events with timestamps

**Usage in deploy workflow:**
```yaml
- name: Apply K8s manifests with rollback protection
  run: |
    bash ${{ env.WORKSPACE }}/scripts/auto-rollback.sh deploy \
      "$NAMESPACE" \
      "maplespike-api" \
      "http://maplespike-api.$NAMESPACE.svc.cluster.local/v1/health" \
      "k8s/dev/"
```

**Commands:**
- `deploy <namespace> <deployment> <health_endpoint> <manifests_path>` - Deploy with rollback protection
- `rollback <namespace> <deployment>` - Manual rollback
- `check <namespace> <deployment> <health_endpoint>` - Health check only

### 3. ✅ Failed Remediation → Notification/Escalation

**Implementation:** `scripts/escalate-incident.sh`

Creates multi-channel notifications when auto-remediation fails:

1. **GitHub Issue** - Creates incident ticket with full details
2. **Slack Alert** - Sends formatted message to on-call channel
3. **PagerDuty Alert** - Triggers on-call page for critical incidents
4. **Incident Log** - Records all incidents in JSON format for tracking

**Incident Types:**
- `deployment_failure` - Critical severity
- `rollback_triggered` - High severity
- `health_check_failed` - High severity
- `test_flaky_repeated` - Medium severity
- `cluster_resource_exhaustion` - Critical severity

**Usage:**
```yaml
- name: Escalate on deployment failure
  if: failure()
  run: |
    bash ${{ env.WORKSPACE }}/scripts/escalate-incident.sh \
      deployment_failure \
      "{\"namespace\": \"$NAMESPACE\", \"commit\": \"$GITHUB_SHA\"}"
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

**Required Secrets:**
- `GITHUB_TOKEN` - For issue creation (auto-provided in GH Actions)
- `SLACK_WEBHOOK_URL` - For Slack notifications (optional)
- `PAGERDUTY_ROUTING_KEY` - For PagerDuty alerts (optional, critical only)

## Supporting Infrastructure

### Health Verification

**Implementation:** `scripts/health-verification.sh`

Comprehensive post-deployment health checks:

- Pod status verification (running/pending/failed counts)
- Deployment replica status (ready/available/updated)
- Service endpoint health checks with retries
- JSON report generation for audit trail
- Automatic notification on unhealthy status

**Checks Performed:**
1. Pod phase status across namespace
2. Deployment readiness (readyReplicas ≥ spec.replicas)
3. Health endpoint connectivity for each service
4. Rollout completion status

**Output:** JSON report saved to `/tmp/health-verification-<timestamp>.json`

## Integration Points

### GitHub Actions Workflows

All three deployment workflows integrate self-healing:

- `.github/workflows/ci.yml` - Flaky test retry on all test jobs
- `.github/workflows/deploy-dev.yml` - Rollback + health verification
- `.github/workflows/deploy-prod.yml` - Rollback + health verification + wait

### Workflow Diagram

```
┌─────────────────┐
│  Test Failure   │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Flaky Pattern?  │
└────────┬────────┘
    Yes  │  No
    ┌────┴─────┐
    │          │
    v          v
┌─────────┐  ┌──────────────┐
│  Retry  │  │ Fail Immediately │
│ (30-60s)│  └──────────────┘
└────┬────┘
     │ Pass
     v
┌─────────────────┐
│   Success ✓    │
└─────────────────┘

┌─────────────────┐
│ Deploy Failure  │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Health Check    │◄─────┐
└────────┬────────┘      │
    Fail │               │ Retry
         v               │
┌─────────────────┐      │
│ kubectl undo    │──────┘
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Notify On-Call  │
│ (Slack/PD/GH)   │
└─────────────────┘
```

## Testing

Run the verification script to confirm all components are functional:

```bash
cd scripts
bash verify-self-healing.sh
```

Expected output: `✅ ALL ACCEPTANCE CRITERIA VERIFIED`

## Configuration

All scripts support environment variable configuration:

| Variable | Script | Default | Purpose |
|----------|--------|---------|---------|
| `MAX_ATTEMPTS` | flaky-test-retry.sh | 3 | Max retry attempts |
| `WORKSPACE` | flaky-test-retry.sh | $(pwd) | Working directory |
| `NAMESPACE` | auto-rollback.sh | maplespike-dev | K8s namespace |
| `HEALTH_CHECK_TIMEOUT` | auto-rollback.sh | 30 | Health check timeout (s) |
| `GITHUB_TOKEN` | escalate-incident.sh | (required) | GitHub API auth |
| `SLACK_WEBHOOK_URL` | escalate-incident.sh | (optional) | Slack webhook |
| `PAGERDUTY_ROUTING_KEY` | escalate-incident.sh | (optional) | PagerDuty integration |

## Logs and Audit Trail

All self-healing events are logged:

- **Retry logs:** `${WORKSPACE}/.ci/retry-log.json` + `retry-output.log`
- **Rollback logs:** `/tmp/rollback-log.json`
- **Health reports:** `/tmp/health-verification-<timestamp>.json`
- **Incident logs:** `/tmp/incidents-<date>.json`

## Future Enhancements

- [ ] automatic test quarantining for repeatedly flaky tests
- [ ] Slack thread for incident follow-up
- [ ] Automated rollback analysis (root cause detection)
- [ ] Integration with Hermes Kanban for auto-created remediation tasks