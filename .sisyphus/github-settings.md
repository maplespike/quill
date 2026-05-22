# GitHub Repository Configuration Guide

This document specifies the mandatory GitHub settings for MapleSpike to ensure repository integrity and enforce the issue-driven workflow. Since these settings are configured via the GitHub UI, this file serves as the source of truth for auditors and maintainers.

## 1. Branch Protection Rules
Apply the following rules to the `main` and `prod` branches:

### Required Status Checks
- **Require status checks to pass before merging:** ✅ Enabled
- **Required Checks:**
  - `ci.yml` (Standard CI build and test)
  - `pr-validation.yml` (PR structural checks)
  - `metrics-validation.yml` (If applicable to the change)

### Review Requirements
- **Require a pull request before merging:** ✅ Enabled
- **Required approving reviews:** 1
- **Dismiss stale pull request approvals when new commits are pushed:** ✅ Enabled
- **Require review from Code Owners:** ✅ Enabled (if CODEOWNERS file is present)

### History Integrity
- **Allow force pushes:** ❌ Disabled
- **Allow deletions:** ❌ Disabled
- **Require linear history:** ✅ Enabled (Encourages rebasing and prevents merge-commit noise)

---

## 2. General Repository Settings
Configure the following in the "General" settings tab:

### Pull Requests
- **Allow squash merging:** ✅ Enabled (Recommended for a clean linear history)
- **Allow merge commits:** ❌ Disabled
- **Allow rebase merging:** ✅ Enabled
- **Automatically delete head branches:** ✅ Enabled (Crucial for preventing branch rot)

### Issues
Tying all work to issues is mandatory. Ensure the issue template `task.md` is the default for all agent-driven work.

---

## 3. Verification Checklist
- [ ] `main` branch protection active
- [ ] `prod` branch protection active
- [ ] Auto-delete head branches enabled
- [ ] Linear history enforced
