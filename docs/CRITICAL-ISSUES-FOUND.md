---
status: archival-snapshot
last-reviewed: 2026-06-12
classification: historical-snapshot
---

# Additional Issues Found — Priority Fixes Needed

> **Snapshot notice:** This document is a historical record of issues
> found during the 2026-06-12 audit cycle. Every issue in the
> "IMMEDIATE ACTION PLAN" section was addressed in the three follow-up
> commits documented in `docs/HARSH-REALITY-AUDIT-COMPLETE.md`. Do not
> re-execute the action plan; it is preserved here for traceability of
> the audit trail, not as a live todo.

**Date**: 2026-06-12
**Follow-up to**: Harsh reality audit + stale content cleanup

---

## 🔴 CRITICAL: Broken Deployment Workflows

### Issue: 4 GitHub workflows reference non-existent infrastructure

**Files**:
- `.github/workflows/deploy-dev.yml` — 180 lines, will fail
- `.github/workflows/deploy-prod.yml` — Similar issues
- `.github/workflows/deploy-cluster.yml` — 200 lines, references Dockerfile
- `.github/workflows/deploy-docs.yml` — Needs review

**Problems Found**:
1. **Missing script**: References `./scripts/decrypt-secrets.sh` (doesn't exist)
2. **K8s deployment**: Tries to deploy to K8s that doesn't exist
3. **Archived scripts**: Calls `auto-rollback.sh` and `escalate-incident.sh` (now archived)
4. **Non-existent images**: References `maplespike-api`, `maplespike-quill`, `maplespike-portal` images
5. **Secret references**: References `SLACK_WEBHOOK_URL` and other secrets
6. **Manual trigger only**: These would fail on push to main

**Evidence**:
```bash
# Missing script
$ bash scripts/decrypt-secrets.sh
bash: scripts/decrypt-secrets.sh: No such file or directory

# Non-existent package names
$ find packages/ -name "package.json" | xargs grep "maplespike-api"
(no results)

# K8s manifests exist but deployment doesn't work
$ ls k8s/
dev.nix  prod.nix  infra.nix  cron.nix  manual/
```

**Impact**: HIGH — These workflows will fail if triggered, wasting CI resources and confusing contributors

**Fix Required**: DISABLE these workflows immediately

---

## 🟡 HIGH PRIORITY: API Documentation Using Fictional Domain

### Issue: API docs reference `maplespike.lan` domain that doesn't exist

**Files**:
- `packages/docs/api/ai-ask.md`
- `packages/docs/api/endpoints.md`
- `packages/docs/api/gov-search.md`
- `packages/docs/api/health.md`
- `packages/docs/api/mock.md`
- `packages/docs/api/usage.md`
- `packages/docs/guide/authentication.md`
- `packages/docs/guide/quickstart.md`
- `packages/docs/guide/sdk.md`

**Problem**: All examples use `http://maplespike.lan/v1/...` but this domain doesn't exist

**Examples**:
```bash
# From packages/docs/api/usage.md
curl "http://maplespike.lan/v1/gov/search?q=housing&limit=5"

# From packages/docs/guide/quickstart.md
curl http://maplespike.lan/v1/health
curl "http://maplespike.lan/v1/gov/search?q=McKinsey&limit=5"
```

**Reality Check**: Documentation says K8s deployment doesn't exist, but API docs assume deployed system

**Fix Required**: Update all examples to use `localhost:PORT` or add "DEPLOYMENT REQUIRED" disclaimer

---

## 🔵 MEDIUM PRIORITY: Orphaned Infrastructure Scripts (3 more files)

### Issue: Additional scripts reference non-existent K8s infrastructure

**Files**:
- `scripts/escalate-incident.sh` — PagerDuty/Slack escalation (no integration)
- `scripts/validate-k8s-manifests.sh` — K8s validation (no deployment)
- `scripts/flaky-test-retry.sh` — CI retry (not wired into CI)

**Status**: Already identified but not yet archived like `auto-rollback.sh`

**Fix Required**: Add ARCHIVED headers with disclaimers

---

## 🟢 LOW PRIORITY: Minor Issues

### 1. Non-executable library script
**File**: `scripts/lib/common.sh`
**Issue**: Not executable but sourced by other scripts
**Fix**: `chmod +x scripts/lib/common.sh`

### 2. Package naming confusion
**Issue**: Workflows reference `maplespike-api`, `maplespike-quill`, `maplespike-portal` but actual packages are `api-server`, `quill-mcp`, `portal`
**Fix**: Either rename packages or update workflows (but workflows are broken anyway)

### 3. Documentation example consistency
**Issue**: Some docs use `localhost:3001`, others use `maplespike.lan`
**Files**: `packages/docs/mcp/setup.md`, `packages/quill-mcp/README.md`
**Fix**: Standardize on localhost for development examples

---

## 🎯 IMMEDIATE ACTION PLAN

### Priority 1 (Today — Do Now)
1. **DISABLE BROKEN WORKFLOWS** — Rename or add `workflow_run: false` to prevent execution
   - `.github/workflows/deploy-dev.yml` → `deploy-dev.yml.disabled`
   - `.github/workflows/deploy-prod.yml` → `deploy-prod.yml.disabled`
   - `.github/workflows/deploy-cluster.yml` → `deploy-cluster.yml.disabled`

### Priority 2 (This Week)
2. **Fix API documentation domain references**
   - Replace `maplespike.lan` with `localhost:PORT` in examples
   - Add deployment status disclaimer to API docs

3. **Archive remaining orphaned scripts**
   - Add ARCHIVED headers to `escalate-incident.sh`
   - Add ARCHIVED headers to `validate-k8s-manifests.sh`
   - Add ARCHIVED headers to `flaky-test-retry.sh`

### Priority 3 (This Month)
4. **Fix minor issues**
   - Make `scripts/lib/common.sh` executable
   - Standardize localhost vs domain examples
   - Review `deploy-docs.yml` for issues

---

## 📊 SEVERITY ASSESSMENT

| Issue | Severity | Impact | Effort | Priority |
|-------|----------|--------|--------|----------|
| Broken deployment workflows | 🔴 CRITICAL | CI failures, contributor confusion | Low | **DO NOW** |
| Fictional domain in API docs | 🟡 HIGH | User confusion, broken examples | Medium | This week |
| Orphaned infrastructure scripts | 🔵 MEDIUM | Maintenance confusion | Low | This week |
| Non-executable library script | 🟢 LOW | Minor inconvenience | 1 min | This month |
| Package naming confusion | 🟢 LOW | Developer confusion | Medium | Low priority |

---

## 🔍 ROOT CAUSE ANALYSIS

**Why do these issues exist?**

1. **Aspirational Architecture** — Original docs described planned K8s deployment
2. **Incomplete Implementation** — Workflows written before infrastructure was built
3. **Documentation Drift** — API docs written assuming deployment existed
4. **Script Accumulation** — Infrastructure scripts added but never cleaned up

**Prevention for Future:**
- Add "IMPLEMENTATION STATUS" headers to all infrastructure files
- CI check for references to non-existent scripts/domains
- Quarterly audit of GitHub workflows
- Documentation must match deployment reality

---

## 🚨 IMMEDIATE ACTION REQUIRED

**The 4 broken deployment workflows MUST be disabled immediately.**

They will:
- Fail when triggered
- Waste CI resources
- Confuse contributors
- Create false expectations about deployment capabilities

**Command to disable:**
```bash
cd .github/workflows
mv deploy-dev.yml deploy-dev.yml.disabled
mv deploy-prod.yml deploy-prod.yml.disabled
mv deploy-cluster.yml deploy-cluster.yml.disabled
# Review deploy-docs.yml before deciding
```

---

**Next Steps After Disabling Workflows:**
1. Fix API documentation domain references
2. Archive remaining orphaned scripts
3. Update ROADMAP.md to reflect workflow status
4. Create proper deployment guide for Docker Compose (current reality)

---

*This analysis complements the STALE-CONTENT-SUMMARY.md and should be addressed immediately.*