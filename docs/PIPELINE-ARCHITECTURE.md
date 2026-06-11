---
last-reviewed: 2026-06-11
status: active
---

# CI/CD Pipeline Architecture

**Last Verified:** 2026-06-06  
**Status:** ⚠️ ASPIRATIONAL — CI/CD infrastructure not yet implemented (June 2026)  
**NOTE:** This document describes the *planned* CI/CD pipeline. As of June 2026, GitHub Actions workflows, K8s deployment manifests, and the self-healing infrastructure documented below do not exist yet. See `ci.yml` in `.github/workflows/` for the actual CI status. The ingestion/API/engine packages build and test locally with >460 passing tests.

## Overview

MapleSpike uses a multi-stage CI/CD pipeline with self-healing capabilities, running on GitHub Actions with self-hosted NixOS runners. The pipeline supports:

- **Continuous Integration** - Automated testing, validation, and security checks on every PR/push
- **Continuous Deployment** - Automatic deployment to dev/staging on merge, production on promotion
- **Self-Healing** - Automatic retry, rollback, and escalation on failures

## Pipeline Architecture

```
┌──────────────┐
│   Push/PR    │
└──────┬───────┘
       │
       v
┌─────────────────────────────────────────────────────────────┐
│                      CI Pipeline                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Build   │→ │  Test    │→ │  Validate│→ │  Audit   │    │
│  │ Packages │  │(w/retry) │  │  K8s     │  │  Docs    │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
       │
       │ (on merge to main)
       v
┌─────────────────────────────────────────────────────────────┐
│                   Deploy Dev Pipeline                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Build   │→ │  Push    │→ │  Deploy  │→ │  Verify  │    │
│  │  Images  │  │  to GHCR │  │  to K8s  │  │  Health  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                              │               │
│                              ┌───────────────┴───────────┐  │
│                              │                           │  │
│                              v                           v  │
│                     ┌──────────────┐           ┌──────────┐ │
│                     │ Auto-Rollback│           │ Escalate │ │
│                     │  on Failure  │           │(Slack/PD)│ │
│                     └──────────────┘           └──────────┘ │
└─────────────────────────────────────────────────────────────┘
       │
       │ (auto-promote on success)
       v
┌─────────────────────────────────────────────────────────────┐
│                  Deploy Prod Pipeline                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Merge   │→ │  Build   │→ │  Deploy  │→ │  Verify  │    │
│  │  to prod │  │  Stable  │  │  to K8s  │  │  Health  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Workflow Files

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `.github/workflows/ci.yml` | PR/push to main/prod | Build, test, validate |
| `.github/workflows/deploy-dev.yml` | Push to main | Deploy to dev namespace |
| `.github/workflows/deploy-prod.yml` | Push to prod | Deploy to prod namespace |
| `.github/workflows/auto-merge.yml` | PR approval + CI pass | Auto-merge approved PRs |
| `.github/workflows/dependabot-auto-merge.yml` | Dependabot PR + CI pass | Auto-merge security updates |

## Self-Healing Components

### 1. Flaky Test Retry (`scripts/flaky-test-retry.sh`)

**Purpose:** Automatically retry tests that fail due to known flaky patterns (timeouts, network issues, port conflicts).

**Behavior:**
- Detects flaky patterns: `ETIMEDOUT`, `EADDRINUSE`, `timeout`, `ECONNREFUSED`, `5xx`
- Retries up to 3 times with exponential backoff: 30s → 60s → 120s
- Fails immediately for non-flaky failures
- Logs all attempts to `.ci/retry-log.json`

**Usage in workflows:**
```yaml
- name: Test pipeline-core
  run: |
    bash ${{ env.WORKSPACE }}/scripts/flaky-test-retry.sh 3 "pnpm test"
  working-directory: packages/pipeline-core
```

### 2. Auto-Rollback (`scripts/auto-rollback.sh`)

**Purpose:** Automatically rollback deployments that fail health checks.

**Behavior:**
- Deploys with `kubectl apply`
- Waits for rollout completion
- Performs health check against specified endpoint
- Triggers `kubectl rollout undo` on failure
- Falls back to scaling to 0 if no rollback history

**Commands:**
```bash
# Deploy with rollback protection
bash scripts/auto-rollback.sh deploy <namespace> <deployment> <health_endpoint> <manifests_path>

# Manual rollback
bash scripts/auto-rollback.sh rollback <namespace> <deployment>

# Health check only
bash scripts/auto-rollback.sh check <namespace> <deployment> <health_endpoint>
```

### 3. Health Verification (`scripts/health-verification.sh`)

**Purpose:** Comprehensive post-deployment health audit.

**Checks:**
- Pod status (running/pending/failed)
- Deployment readiness (readyReplicas ≥ spec)
- Service endpoint connectivity
- Rollout completion status

**Output:** JSON report to `/tmp/health-verification-<timestamp>.json`

### 4. Incident Escalation (`scripts/escalate-incident.sh`)

**Purpose:** Multi-channel notifications when auto-remediation fails.

**Channels:**
1. **GitHub Issue** - Creates incident ticket with full details
2. **Slack** - Sends formatted message to on-call channel
3. **PagerDuty** - Triggers on-call page for critical incidents
4. **Audit Log** - Records to `/tmp/incidents-<date>.json`

**Incident Types:**
- `deployment_failure` (Critical)
- `rollback_triggered` (High)
- `health_check_failed` (High)
- `test_flaky_repeated` (Medium)
- `cluster_resource_exhaustion` (Critical)

## Adding New Workflows

### Step 1: Create workflow file

```yaml
# .github/workflows/my-new-workflow.yml
name: My New Workflow

on:
  workflow_dispatch:  # Manual trigger
  schedule:
    - cron: '0 9 * * *'  # Daily at 9am UTC

permissions:
  contents: read
  packages: write

env:
  NAMESPACE: maplespike-dev

jobs:
  my-job:
    runs-on: [self-hosted, nixos]
    steps:
      - uses: actions/checkout@v4
      
      - run: pnpm install --frozen-lockfile
      
      - name: Set workspace
        run: echo "WORKSPACE=$(pwd)" >> $GITHUB_ENV
      
      - name: Run with self-healing
        run: |
          bash ${{ env.WORKSPACE }}/scripts/flaky-test-retry.sh 3 "pnpm run my-command"
```

### Step 2: Add self-healing integration

**For test jobs:**
```yaml
- name: Test with retry
  run: |
    bash ${{ env.WORKSPACE }}/scripts/flaky-test-retry.sh 3 "your-test-command"
```

**For deployment jobs:**
```yaml
- name: Deploy with rollback
  run: |
    bash ${{ env.WORKSPACE }}/scripts/auto-rollback.sh deploy \
      "${{ env.NAMESPACE }}" \
      "my-deployment" \
      "http://my-service.${{ env.NAMESPACE }}.svc.cluster.local/health" \
      "k8s/my-env/"

- name: Verify health
  run: |
    bash ${{ env.WORKSPACE }}/scripts/health-verification.sh "${{ env.NAMESPACE }}"

- name: Escalate on failure
  if: failure()
  run: |
    bash ${{ env.WORKSPACE }}/scripts/escalate-incident.sh \
      deployment_failure \
      "{\"namespace\": \"${{ env.NAMESPACE }}\", \"service\": \"my-service\"}"
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Step 3: Test locally

```bash
# Test the workflow logic
cd /home/j_kro/projects/maplespike

# Simulate the job
export WORKSPACE=$(pwd)
export NAMESPACE=maplespike-dev

# Test retry logic
bash scripts/flaky-test-retry.sh 3 "echo 'test command'"

# Test health check
bash scripts/health-verification.sh maplespike-dev
```

### Step 4: Validate workflow syntax

```bash
# Install actionlint
nix shell nixpkgs#actionlint

# Validate
actionlint .github/workflows/my-new-workflow.yml
```

## Runbooks

### Runbook 1: Manual Deployment

When automated deployment fails and you need to deploy manually:

```bash
# 1. Build images
cd /home/j_kro/projects/maplespike
nix build .#maplespike-api-image
nix build .#maplespike-mcp-image
nix build .#maplespike-portal-image

# 2. Load and tag
podman load < result
podman tag maplespike-api:latest ghcr.io/reverb256/maplespike/maplespike-api:manual-$(date +%Y%m%d)
podman push ghcr.io/reverb256/maplespike/maplespike-api:manual-$(date +%Y%m%d)

# 3. Deploy with health check
bash scripts/auto-rollback.sh deploy \
  maplespike-dev \
  maplespike-api \
  http://maplespike-api.maplespike-dev.svc.cluster.local/v1/health \
  k8s/dev/

# 4. Verify
bash scripts/health-verification.sh maplespike-dev
```

### Runbook 2: Emergency Rollback

When a deployment is causing issues and needs immediate rollback:

```bash
# Quick rollback
kubectl rollout undo deployment/maplespike-api -n maplespike-dev
kubectl rollout undo deployment/maplespike-mcp -n maplespike-dev
kubectl rollout undo deployment/maplespike-portal -n maplespike-dev

# Verify rollback
bash scripts/health-verification.sh maplespike-dev

# Create incident ticket
bash scripts/escalate-incident.sh \
  rollback_triggered \
  "{\"reason\": \"manual_emergency_rollback\", \"triggered_by\": \"$(whoami)\"}"
```

### Runbook 3: Stuck Deployment

When a deployment is stuck in progress:

```bash
# Check rollout status
kubectl rollout status deployment/maplespike-api -n maplespike-dev --timeout=30s

# If stuck, cancel and rollback
kubectl rollout cancel deployment/maplespike-api -n maplespike-dev
kubectl rollout undo deployment/maplespike-api -n maplespike-dev

# Check pod events
kubectl get pods -n maplespike-dev -o wide
kubectl describe deployment/maplespike-api -n maplespike-dev

# Verify
bash scripts/health-verification.sh maplespike-dev
```

### Runbook 4: Flaky Test Investigation

When tests repeatedly trigger the retry mechanism:

```bash
# 1. Check retry logs
cat .ci/retry-log.json | jq

# 2. Identify the flaky test
cat .ci/retry-output.log | grep -A 5 "not ok"

# 3. Create tracking issue
gh issue create \
  --title "Flaky test: <test name>" \
  --label "bug,flaky" \
  --body "Test fails intermittently with pattern: <pattern>
  
  Retry log: `.ci/retry-log.json`
  Full output: `.ci/retry-output.log`"

# 4. Quarantine the test (if needed)
# Add .skip() to the test temporarily
```

### Runbook 5: CI Runner Issues

When the self-hosted runner is offline or misbehaving:

```bash
# 1. Check runner status
systemctl --user status github-actions-runner

# 2. Restart runner
systemctl --user restart github-actions-runner

# 3. Check runner logs
journalctl --user -u github-actions-runner -n 50

# 4. Verify runner is online
# Visit: https://github.com/reverb256/maplespike/settings/actions
```

## Monitoring and Observability

### CI/CD Metrics

Monitor these key metrics:

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| CI job duration | GitHub Actions | >30min |
| Test flakiness rate | `.ci/retry-log.json` | >5% |
| Rollback frequency | `/tmp/rollback-log.json` | >1/week |
| Deployment success rate | GitHub Actions | <95% |
| Time to recovery | Incident logs | >1hr |

### Logging Locations

| Log Type | Location | Retention |
|----------|----------|-----------|
| Retry logs | `.ci/retry-log.json`, `.ci/retry-output.log` | 30 days |
| Rollback logs | `/tmp/rollback-log.json` | 30 days |
| Health reports | `/tmp/health-verification-<timestamp>.json` | 30 days |
| Incident logs | `/tmp/incidents-<date>.json` | 90 days |
| GitHub Actions | GitHub Actions tab | 90 days |

## Troubleshooting

### Problem: Tests always fail on first attempt

**Cause:** Genuine test failure, not flakiness.

**Solution:**
```bash
# Run tests without retry to see actual error
pnpm test

# Check if failure matches flaky patterns
# If not, fix the underlying issue
```

### Problem: Rollback not triggered on failure

**Cause:** Health check endpoint unreachable or always returns success.

**Solution:**
```bash
# Test health endpoint manually
curl -v http://maplespike-api.maplespike-dev.svc.cluster.local/v1/health

# Check endpoint configuration in auto-rollback.sh
# Verify the deployment name matches
```

### Problem: Escalation notifications not sent

**Cause:** Missing or invalid secrets.

**Solution:**
```bash
# Verify secrets exist
# GitHub: Settings → Secrets and variables → Actions

# Required secrets:
# - SLACK_WEBHOOK_URL (optional)
# - PAGERDUTY_ROUTING_KEY (optional, prod only)
# - GITHUB_TOKEN (auto-provided)

# Test escalation manually
bash scripts/escalate-incident.sh deployment_failure '{"test": true}'
```

## Security Considerations

### Secrets Management

- All secrets encrypted with agenix
- JIT (just-in-time) decryption in workflows
- PAT tokens scoped to minimum required permissions
- No secrets in logs or error messages

### Access Control

- Deploy to prod requires merged PR to `prod` branch
- Manual deployments require write access to cluster
- Escalation to PagerDuty limited to on-call rotation

### Audit Trail

- All deployments logged with commit SHA
- Rollback events include initiator and reason
- Incident tickets auto-created on escalation
- Health verification reports saved for compliance

## Related Documentation

- [SELF-HEALING.md](./SELF-HEALING.md) - Detailed self-healing architecture
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines
- [SECURITY.md](./SECURITY.md) - Security policies

---

**Maintained by:** DevOps Working Group  
**Owner:** @default profile (kanban task t_708585b8)  
**Next Review:** 2026-07-06