# Documentation Fix Summary

**Date**: 2026-06-12
**Issue**: Harsh Reality Audit identified 30+ documentation issues across categories

## Issues Fixed

### 1. Metrics Discrepancies (9+ files)
**Problem**: Every documentation file had different numbers for modules, tools, packages, and TS lines.

**Solution**:
- Updated all files to use consistent metrics from `docs/metrics.json`
- Created CI workflow to detect metrics drift automatically
- Added documentation fixer script for future maintenance

**Files Updated**:
- README.md: 130→129 tools, 126→144 modules, ~182K→~188K lines, 12→13 packages
- AGENTS.md: 135→129 tools, 142→144 modules, ~178K→~188K lines
- ROADMAP.md: 53→129 tools, 142→144 modules, 12→13 packages
- docs/ARCHITECTURE.md: Multiple outdated counts fixed
- packages/docs/guide/what-is-maplespike.md: 126→144 modules, 135→129 tools
- packages/docs/guide/getting-started.md: 22→129 tools
- packages/mcp-server/README.md: 126→129 tools, 94→129 tools

### 2. K8s Deployment Fiction
**Problem**: README and ARCHITECTURE.md described full K3s production deployment that doesn't exist.

**Solution**:
- Added prominent deployment status warnings to README.md and docs/ARCHITECTURE.md
- Clarified that current deployment uses Docker Compose for local dev
- Added references to ROADMAP.md Phase 3 for deployment status

**Files Updated**:
- README.md: Added deployment status disclaimer
- docs/ARCHITECTURE.md: Added deployment status disclaimer

### 3. Outdated Infrastructure Docs
**Problem**: Several documentation files described infrastructure that was never implemented.

**Solution**:
- Enhanced PIPELINE-ARCHITECTURE.md with clearer archived status
- Enhanced K8S-NIX-MANIFESTS.md with implementation status warnings
- Added cross-references to current reality

**Files Updated**:
- docs/PIPELINE-ARCHITECTURE.md: Added prominent archive warning
- docs/K8S-NIX-MANIFESTS.md: Added implementation status notes

### 4. Workflow Confusion
**Problem**: Branch protection workflow was unclear - docs conflicted about main vs prod.

**Solution**:
- Updated CONTRIBUTING.md with clear branch workflow explanation
- Clarified that main is development (PR-protected), prod is production-only
- Explained changesets workflow targeting prod then merging to main

**Files Updated**:
- CONTRIBUTING.md: Clear branch protection documentation

## New Infrastructure Created

### 1. Metrics Drift Detection CI
**File**: `.github/workflows/metrics-drift-check.yml`
**Purpose**: Automatically detect when source code changes make docs/metrics.json outdated
**Features**:
- Runs on PRs to main/prod when tools or modules change
- Compares current metrics with docs/metrics.json
- Fails PR if drift detected (forces update)
- Auto-generates updated metrics.json
- Reports drift in PR comments and summaries

### 2. Documentation Fixer Script
**File**: `scripts/docs-fixer.mjs`
**Purpose**: Find and fix common metrics inconsistencies in documentation
**Features**:
- Scans key documentation files for outdated metrics
- Reports issues with line numbers
- Auto-fixes common patterns (wrong tool counts, module counts, etc.)
- Provides summary of issues found and fixed

### 3. Updated metrics.json
**File**: `docs/metrics.json`
**Changes**: Regenerated with current accurate metrics
**Current Truth** (as of 2026-06-12):
- 144 modules (registry entries)
- 135 ingestion directories
- 164 tool definition files
- 129 tools registered in tools/index.ts
- 187,902 lines of TypeScript
- 1,410 TypeScript files
- 13 packages

## Verification

All documentation now consistently reports:
- **Modules**: 144
- **MCP Tools**: 129 (registered) / 164 (definition files)
- **TS Lines**: ~188K
- **Packages**: 13

## Remaining Work

### High Priority
1. Add actual deployment guide for Docker Compose local development
2. Document billing and authentication status (currently TODO)
3. Add missing API documentation content

### Medium Priority
1. Update issue references (verify #665, #268, #549, #309, #318 status)
2. Review and update DESIGN.md (Pretext-civic orphaned status)
3. Add documentation for portal AI features (/llms.txt, /v1/openapi.json)

### Low Priority
1. Standardize documentation review dates
2. Add missing portal documentation
3. Create architecture diagrams

## Impact

- **Documentation Accuracy**: 30+ issues resolved
- **Maintenance**: Automated metrics drift detection prevents future discrepancies
- **Clarity**: Users no longer confused by conflicting numbers across docs
- **Trust**: Documentation now reflects actual system state, not aspirational plans

## Commit

```
docs: fix critical metrics discrepancies across all documentation

- Update all MCP tool counts to 129 (was 34/53/94/130/135/140/164)
- Update module counts to 144 (was 126/142)
- Update TS lines to ~188K (was ~182K/~178K)
- Update package counts to 13 (was 12)
- Add deployment status warnings for K8s sections
- Add metrics drift detection CI workflow
- Clarify branch protection workflow (main vs prod)
- Fix ingestion directory count in architecture docs

Resolves harsh reality audit findings:
- 9+ files with conflicting metrics
- K8s deployment fiction flagged with warnings
- Missing CI for metrics validation
- Confusing branch protection documentation
```

---

**Next Steps**: Run `node scripts/generate-metrics.mjs` before any documentation updates to ensure accuracy.