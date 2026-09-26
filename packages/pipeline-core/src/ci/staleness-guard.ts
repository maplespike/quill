// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Staleness guard for CI Doctor (2026-09-22).
 *
 * PR runs execute a *merge snapshot* `refs/pull/<n>/merge` = PR head merged
 * into the base SHA **recorded at snapshot time**. When main advances after
 * that snapshot is taken (e.g., a workflow fix lands on main), re-running the
 * failed job reuses the same stale merge commit — the lane cannot heal without
 * a new push to the PR head.
 *
 * This module is the pure decision logic. The YAML step calls `gh api compare`
 * and feeds the result here. No API calls, no env reads — unit-testable.
 *
 * Decision matrix:
 *   main run, headSha != mainHead  → skip (existing superseded-main behavior)
 *   main run, headSha == mainHead  → no annotation
 *   PR run,  base  == mainHead     → no annotation (current base)
 *   PR run,  base  != mainHead,
 *           workflow file unchanged → no annotation
 *   PR run,  base  != mainHead,
 *           workflow file changed   → do NOT skip; return annotation
 */

export interface PullRequestRef {
  base: { sha: string };
}

export interface StalenessContext {
  /** head_branch from the workflow_run event. */
  branch: string;
  /** head_sha from the workflow_run event. */
  headSha: string;
  /** pull_requests[] from the workflow_run event (empty for push runs). */
  pullRequests: PullRequestRef[];
  /** Repo-root-relative path to the workflow file that owns the failing job. */
  workflowFile: string;
}

export interface StalenessResult {
  /**
   * True only for superseded main runs (the existing skip path). PR runs
   * never skip — a stale merge snapshot produces a genuinely red lane that
   * needs a new push, so we file the card with an annotation instead.
   */
  skip: boolean;
  /**
   * Non-null for PR runs whose merge-snapshot base predates main HEAD and
   * whose workflow file changed in that span. Prepended to the card body.
   */
  annotation: string | null;
}

export function evaluateStaleness(
  ctx: StalenessContext,
  mainHeadSha: string,
  changedFiles: string[],
): StalenessResult {
  if (!mainHeadSha) {
    return { skip: false, annotation: null };
  }

  // Main branch: preserve the existing skip-on-superseded behavior.
  if (ctx.branch === 'main') {
    return ctx.headSha !== mainHeadSha
      ? { skip: true, annotation: null }
      : { skip: false, annotation: null };
  }

  // PR / branch run: the merge snapshot's base is recorded at snapshot time.
  const baseSha = ctx.pullRequests[0]?.base?.sha ?? '';
  if (!baseSha || baseSha === mainHeadSha) {
    return { skip: false, annotation: null };
  }

  const target = normalizeFile(ctx.workflowFile);
  const hit = changedFiles.some((f) => normalizeFile(f) === target);
  if (!hit) {
    return { skip: false, annotation: null };
  }

  return {
    skip: false,
    annotation: formatAnnotation(ctx.workflowFile, baseSha, mainHeadSha),
  };
}

export function formatAnnotation(
  workflowFile: string,
  baseSha: string,
  mainHeadSha: string,
): string {
  return (
    `Merge snapshot base ${baseSha.slice(0, 7)} ` +
    `predates main HEAD ${mainHeadSha.slice(0, 7)} and ` +
    `${workflowFile} changed since — update the branch ` +
    `(merge main) before diagnosing; the failure may already be fixed.`
  );
}

function normalizeFile(p: string): string {
  return p.replace(/^\.\//, '').replace(/^\//, '');
}
