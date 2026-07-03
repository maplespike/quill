> ⚠️ **Historical artifact** — This document is preserved for context. The single source of truth for the active backlog is [`ROADMAP.md`](./ROADMAP.md). Do not edit without also updating ROADMAP.md.


# Git Branch Consolidation & Rebase Plan: MapleSpike

## 1. Objective
Restore the `maplespike` repository's commit graph to a healthy, linear, and non-redundant state. This plan focuses on removing "ghost" branches, consolidating duplicate work on the same issues, and synchronizing diverged branches with `origin/main`.

## 2. Current State Analysis
- **Ghost Branches:** `issue-65`, `issue-68` (Remote is `[gone]`).
- **Duplicate Work:**
    - Issue 399: 5 branches (`...-compliance`, `...-enforcement`, `...-kelos`, `...-pr398`, `...-pr404`).
    - Issue 34: 2 branches (`...-verification`, `...-restored`).
- **Critical Divergence:**
    - `issue-194`: Behind `origin/main` by ~90 commits.
    - `issue-195`, `issue-200`, `issue-206`, `issue-207`: Tracking `bare/main` and severely diverged.

---

## 3. Execution Phases

### Phase 1: Surgical Pruning (Low Risk)
**Goal:** Remove branches that provide no value.
1. **Remote Prune:** `git fetch --prune` to clean up remote tracking.
2. **Delete Merged:** Delete all local branches already merged into `main`.
3. **Delete Ghosts:** Delete local branches whose remote counterpart is `[gone]`.
   - Target: `issue-65-module-tests`, `issue-68-tier1-mcp-tools`.

### Phase 2: Consolidation (Medium Risk)
**Goal:** Collapse multiple branches for the same issue into a single "source of truth".

**Task 2.1: Issue 399 (License Compliance)**
- **Target Winner:** `issue-399-license-compliance-pr404` (Most recent/refined).
- **Action:**
    1. Checkout `issue-399-license-compliance-pr404`.
    2. Merge/Cherry-pick unique changes from other 399 branches if necessary.
    3. Delete `...-compliance`, `...-enforcement`, `...-kelos`, `...-pr398`.

**Task 2.2: Issue 34 (Weight Verification)**
- **Target Winner:** `issue-34-weight-verification-restored`.
- **Action:**
    1. Checkout `issue-34-weight-verification-restored`.
    2. Merge unique changes from `issue-34-weight-verification`.
    3. Delete `issue-34-weight-verification`.

### Phase 3: The Great Rebase (High Risk)
**Goal:** Bring diverged branches back into alignment with `origin/main`.

**Task 3.1: The 90-Commit Gap**
- **Target:** `issue-194-bug-nt-csv-meeting-registry-fetcher-needs-end-to-end-test-ag`.
- **Action:** `git rebase origin/main`. Resolve conflicts manually.

**Task 3.2: The Bare-Main Drift**
- **Targets:** `issue-195`, `issue-200`, `issue-206`, `issue-207`.
- **Action:**
    1. Switch tracking from `bare/main` to `origin/main`.
    2. `git rebase origin/main`.
    3. Resolve conflicts.

### Phase 4: Final Audit & Verification
**Goal:** Ensure the graph is clean and functional.
1. **Verify:** Run `git branch -vv` to ensure no `[gone]` branches remain.
2. **Check Divergence:** Ensure no active branch is > 20 commits behind `origin/main`.
3. **Build Check:** Run `pnpm build` on the most critical rebased branches to ensure no regression.

---

## 4. Safety Protocol
- **No-Destruction Policy:** Before any `git branch -D` or `git rebase`, create a backup tag: `git tag backup/branch-name`.
- **Force-with-Lease:** Always use `git push --force-with-lease` when updating remote branches after a rebase.
- **Stop-Loss:** If a rebase produces > 10 complex conflicts in a single file, stop and consult Oracle.
