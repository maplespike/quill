---
status: archival-snapshot
last-reviewed: 2026-07-07
classification: historical-snapshot
---

# Stale Content & Outstanding Issues Summary

**Date**: 2026-06-12
**Follow-up to**: Documentation harsh reality audit

> **Snapshot notice:** This document captures the audit findings as of
> 2026-06-12. Items listed below may have been resolved by subsequent
> commits — see `docs/HARSH-REALITY-AUDIT-COMPLETE.md` for the items
> addressed in the three follow-up fix commits, and `docs/CRITICAL-ISSUES-FOUND.md`
> for the broader issue list that drove the sweep. Do not treat the
> "NEEDS ATTENTION" sections as a live todo; treat them as a record of
> what was true on 2026-06-12.

---

## ✅ ALREADY FIXED

- Metrics discrepancies across 9+ documentation files
- K8s deployment fiction flagged with warnings
- Missing CI for metrics validation
- Confusing branch protection documentation

---

## 🟡 NEEDS ATTENTION (Medium Priority)

### 1. Orphaned Infrastructure Scripts
**Status**: Scripts exist but reference infrastructure that was never built

**Files**:
- `scripts/auto-rollback.sh` — K8s rollback (no K8s deployment exists)
- `scripts/escalate-incident.sh` — PagerDuty/Slack escalation (no PagerDuty/Slack integration)
- `scripts/validate-k8s-manifests.sh` — K8s manifest validation (no manifests exist)
- `scripts/flaky-test-retry.sh` — CI test retry (not wired into CI)

**Recommendation**: Archive these scripts or add clear "NOT IMPLEMENTED" headers

---

### 2. Stale Changeset
**File**: `.changeset/tiny-maybe-test.md`
**Content**: Test OIDC publish pipeline from May 20
**Issue**: Changeset has been sitting for 3 weeks, suggests publish workflow issues

**Recommendation**: Either consume the changeset or delete it if testing is complete

---

### 3. Pretext-Civic Orphan References
**Status**: Package mentioned but doesn't exist

**Files**:
- `README.md` — mentions `pretext-civic/` in repository structure
- `docs/ARCHITECTURE.md` — extensive orphaned package documentation
- `DESIGN.md` — entire design system based on Pretext (orphaned package)

**Reality Check**:
```bash
$ ls packages/ | grep pretext
(no output)

$ grep -r "packages/pretext-civic" packages/
(no output)
```

**Recommendation**: Remove Pretext-civic references from README.md, archive DESIGN.md or add disclaimer

---

### 4. Placeholder Module Tracking
**Status**: ROADMAP.md claims 32 placeholder modules marked, but actual count is 16

**Files**:
- `ROADMAP.md line 33`: "Mark 32 placeholder modules in registry"
- `packages/pipeline-core/src/ingestion/registry.ts`: 16 modules with `status: 'placeholder'`

**Recommendation**: Update ROADMAP.md to reflect actual count (16) or investigate if more should be marked

---

### 5. Billing & Authentication Documentation Gap
**Status**: Docs exist but describe unimplemented features

**Files**:
- `packages/docs/guide/billing.md` — Full pricing tiers, Stripe/crypto/Interac support
- `packages/docs/guide/authentication.md` — API keys, JWT, OAuth, Web3, Passkey support

**Reality**: README.md says "Billing (Stripe, crypto, Interac) is the next major build" (Phase 6, 🔴 TODO)

**Recommendation**: Add "PLANNED" or "NOT IMPLEMENTED" warnings to these docs

---

## 🔵 LOW PRIORITY (Nice to Have)

### 6. Documentation Review Dates
**Status**: Some docs haven't been reviewed in 18+ days

**Files**:
- `AGENTS.md`: last-reviewed: 2026-07-07 (20 days old)
- `packages/docs/guide/*.md`: last-reviewed: 2026-07-07 (18 days old)
- `docs/ARCHITECTURE.md`: last-reviewed: 2026-07-07 (11 days old)

**Recommendation**: Consider quarterly documentation review cadence

---

### 7. API Documentation Content
**Status**: Referenced but content not verified during audit

**Files**:
- `packages/docs/api/endpoints.md` — claims "full API catalog"
- `packages/docs/api/usage.md` — usage examples
- `packages/docs/api/*.md` — multiple API docs

**Recommendation**: Review for accuracy against actual implementation

---

### 8. Sisyphus Plans Directory
**Status**: Contains many issue-specific plans that may be stale

**Directory**: `.sisyphus/plans/`
**Content**: 11+ plan files for specific issues (#130, #137, #138, #194, #195, #199, #200, #83, etc.)

**Recommendation**: Review and archive completed issue plans, update in-progress ones

---

## 🟢 CONFIRMED WORKING (No Action Needed)

### Portal AI Features ✅
**Status**: Exist and working as documented

**Files**:
- `packages/portal/llms.txt` — AI agent discovery
- `packages/portal/llms-full.txt` — Full AI documentation
- `packages/portal/v1/openapi.json` — OpenAPI specification

**Recommendation**: None — working as intended

---

### Code Quality ✅
**Status**: Very clean codebase

**Findings**:
- Only 5 TODO/FIXME comments in codebase (all legitimate: CSV patterns, regex patterns)
- No `@ts-ignore` or `@ts-expect-error` abuse
- Clean TypeScript strict mode compliance

**Recommendation**: None — code quality is excellent

---

### Package Versions ✅
**Status**: Consistent versioning across packages

**Finding**: All packages at v0.1.0–v0.3.0 range, consistent with pre-1.0 development

**Recommendation**: None — versioning is appropriate for development stage

---

### Metrics Generation ✅
**Status**: Working and up to date

**File**: `scripts/generate-metrics.mjs`
**Last Run**: 2026-06-12
**Result**: 144 modules, 164 tool files, 129 registered tools, 187K TS lines, 13 packages

**Recommendation**: None — now automated with CI drift detection

---

## 🎯 IMMEDIATE ACTION ITEMS

### Priority 1 (This Week)
1. **Archive orphaned infrastructure scripts** with clear headers
2. **Consume or delete stale changeset** (`.changeset/tiny-maybe-test.md`)
3. **Add billing/auth disclaimer** to planned feature docs

### Priority 2 (This Month)
4. **Clean up Pretext-civic references** from README.md
5. **Update ROADMAP.md** placeholder count (32→16)
6. **Review Sisyphus plans** for completed issues

### Priority 3 (This Quarter)
7. **Quarterly documentation review** update last-reviewed dates
8. **API documentation verification** against implementation
9. **Archive DESIGN.md** with Pretext-civic disclaimer

---

## 📊 SUMMARY STATISTICS

| Category | Count | Status |
|----------|-------|--------|
| ✅ Fixed | 4 issues | Complete |
| 🟡 Medium Priority | 5 issues | Needs attention |
| 🔵 Low Priority | 3 issues | Nice to have |
| 🟢 Working (No Action) | 4 items | Confirmed good |

**Total**: 16 items identified, 4 resolved, 12 remaining

---

## 🔮 FUTURE PREVENTION

1. **Monthly stale check**: Add GH action to flag docs >90 days old
2. **Script audit**: Quarterly review of scripts/ for orphaned infrastructure
3. **Changeset cleanup**: Alert on changesets >7 days old
4. **Package reference check**: CI check for references to deleted packages

---

**Next Audit Date**: 2026-09-12 (Quarterly review)

---

*This summary complements the DOCUMENTATION-FIX-SUMMARY.md from the initial harsh reality audit.*