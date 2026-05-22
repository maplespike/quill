# Git Maintenance Plan for MapleSpike

## Overview
The repository currently exhibits significant git hygiene issues, including workflow inconsistencies, branch rot, and redundant naming conventions. This plan outlines a phased approach to restore a clean, predictable git state aligned with the mandated issue-driven workflow.

## Phase 0: Prerequisites
- Ensure all developers have git version ≥ 2.30.
- Enable `git config --global pull.rebase false` (or true, per team preference) to avoid unnecessary merge commits.
- Verify that GitHub Actions and CI pipelines are green on `main` before starting.

---

## Phase 1: Immediate Cleanup (Low Risk)
*Goal: Remove obvious noise without risking loss of unique work.*

1. **Prune Stale Remote-Tracking Branches**
   ```bash
   git fetch --prune
   ```
   This removes local references to remote branches that have been deleted (e.g., `remotes/origin/issue-146-body-validation`).

2. **Delete Local Branches Already Merged into `main`**
   ```bash
   git branch --merged main | grep -vE '^\*?\s*main$' | xargs git branch -d
   ```
   Branches like `issue-118-shared-database-package`, `fix/doc-blitz-p1`, and `kelos-task-18-restored` are safe to delete.

3. **Remove Obvious Test Artifacts**
   ```bash
   git branch -d issue-200-test issue-200-test-2
   ```

4. **Delete Local Branches Tracking Gone Remotes (if any remain)**
   ```bash
   git branch | grep '\[gone\]' | sed 's/.*\[gone\]//' | xargs git branch -D
   ```

*Expected Outcome:* Local branch count reduced by ~30-40%.

---

## Phase 2: Structural Alignment (Medium Risk)
*Goal: Align remaining active work with the issue-driven workflow and rebase stale branches.*

### 2.1 Identify Active Work
List branches **not** merged into `main` (these may contain unique commits):
```bash
git branch --no-merged main
```
Current candidates (as of analysis):
- `feat/ci-auto-merge-guardrails`
- `fix/veterans-data-placeholders`
- `issue-194-bug-nt-csv-meeting-registry-fetcher-needs-end-to-end-test-ag`
- `issue-195-bug-nu-federal-lobbying-proxy-needs-live-test-against-ocl-re`
- `issue-200-fix-multi-machine-k3s-access-missing-kubeconfig-on-forge-sen`
- `issue-201-mcp-smoke-tests`
- `issue-206-sedar-scraper`
- `issue-207-statcan-throttle`
- `issue-212-test-fixes`
- `issue-237-ci-build-order`
- `issue-237-ci-gh-token`
- `issue-237-npmrc-inject`
- `issue-399-license-compliance`
- `issue-65-module-tests`
- `issue-68-tier1-mcp-tools`
- `kelos-task-16`
- `kelos-task-34`
- `kelos-task-34-restored`
- `kelos-task-386`
- `kelos-task-387`
- `kelos-task-388`
- `kelos-task-389-k8s-nixification`
- `kelos-task-399`
- `pipeline-improvements`
- `pr-248`
- `pr-249`
- `pr-266`
- `pr-358`
- `pr396`
- `pr398`
- `pr403`
- `pr404`
- `prod`
- `remove-metrics-validation`

### 2.2 Map to Issues & Rename (if needed)
For each branch, check if it corresponds to a GitHub issue:
- If branch name already matches `issue-NNN-...`, keep it.
- If branch is `feat/...`, `fix/...`, or `pr-NNN` and links to an issue, rename it to `issue-NNN-description`.
  Example: `git branch -m feat/ci-auto-merge-guardrails issue-237-ci-auto-merge-guardrails`
- If branch is a `kelos-task-NNN` and the work is complete (PR merged), consider deletion.
- If branch is `kelos-task-NNN` and work is active, evaluate if it should be converted to an issue.

### 2.3 Rebase Stale Branches onto `main`
Branches that are significantly behind `main` (e.g., `issue-194` is behind 90 commits) should be rebased to avoid merge conflicts later.
```bash
git checkout issue-194-bug-nt-csv-meeting-registry-fetcher-needs-end-to-end-test-ag
git fetch origin main
git rebase origin/main
# Resolve any conflicts, then:
git push --force-with-lease
```
*Caution:* Only rebase branches that are **not** shared with others. For shared branches, prefer merging `main` into the branch.

### 2.4 Clean Up Redundant PR Branches
Branches like `pr-248`, `pr-358`, `pr396`, etc., should be deleted if their changes are already in `main` via a merge commit. If they represent active work, rename them to follow `issue-NNN-...`.

---

## Phase 3: Workflow Enforcement (Cultural Shift)
*Goal: Prevent regression by embedding the issue-driven workflow into team habits.*

### 3.1 Branch Policy (Enforce via Documentation & CI)
- **All branches MUST originate from an issue.**
- **Branch naming format:** `issue-NNN-short-description` (all lowercase, hyphens).
- **No `feat/`, `fix/`, `pr-`, or `kelos-task-` prefixes allowed for new work.**
- **Exception:** Autonomous agent branches may use `kelos-task-` but must still link to an issue.

### 3.2 PR Discipline
- PR title: `feat: description (#NNN)` or `fix: description (#NNN)`.
- PR body **must** contain `Closes #NNN` (or `Fixes #NNN`).
- No PR should be opened without an issue reference.

### 3.3 Automation Suggestions
- Add a `prepare-commit-msg` hook to warn if commit message lacks issue reference.
- Use GitHub Actions to label PRs missing issue numbers as `needs-issue`.
- Consider a `stale` bot that comments on branches inactive for >30 days.

### 3.4 Education
- Add a section to `CONTRIBUTING.md` detailing the branch/PR workflow.
- Run a 15-minute git hygiene workshop for the team.

---

## Timeline & Ownership
| Phase | Duration | Owner(s) | Definition of Done |
|-------|----------|----------|---------------------|
| Phase 1 (Cleanup) | 1 day | Any maintainer (can be solo) | Local branch count < 30; no `gone` branches. |
| Phase 2 (Alignment) | 2-3 days | Tech lead + volunteers | All active branches follow `issue-NNN-...` naming; rebased onto `main`; no redundant `pr-` branches. |
| Phase 3 (Enforcement) | Ongoing | Team lead (initial), then all | Zero new branches violating naming policy; PR template enforces issue link. |

## Success Metrics
- **Branch Count:** < 20 active local branches (excluding `main`, `prod`).
- **Issue Linkage:** 100% of branches traceable to a GitHub issue.
- **Rebase Health:** No branch > 20 commits behind `main` without active rebase plan.
- **PR Quality:** 100% of PRs reference an issue in title and body.

---

## Notes
- This plan assumes the team agrees to adopt the issue-driven workflow strictly.
- If autonomous agents (`kelos-task-`) are to remain a permanent fixture, create a separate namespace like `agents/kelos-task-NNN` to keep them distinct from human work.
- Always back up the repository (or create a temporary mirror) before performing bulk deletions or rebases.
