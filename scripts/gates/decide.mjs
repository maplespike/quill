// Merge-gate decision. Pure: no network, no env, no clock.
//
// merge-when-green.yml mirrors this function. A MERGEABLE pull request whose
// mergeStateStatus is UNSTABLE is not always "failing checks". GitHub also
// reports UNSTABLE when the head is behind the base. The compare result
// (GET /repos/{owner}/{repo}/compare/{base}...{head}) is what distinguishes
// those cases. Update the branch only when behind_by > 0.
//
// Reasons the fixtures lock:
//   diverged — behind_by > 0 and the head also has commits the base lacks
//   behind   — behind_by > 0 and the head is not ahead
//   clean    — MERGEABLE + CLEAN (or HAS_HOOKS) and not behind
//   current  — MERGEABLE + UNSTABLE and behind_by == 0 (do not update)

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function numberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^-?[0-9]+$/.test(value)) return Number(value);
  return null;
}

/**
 * @param {{
 *   mergeable?: string | null,
 *   mergeStateStatus?: string | null,
 *   compare?: { status?: string | null, ahead_by?: number | string | null, behind_by?: number | string | null } | null,
 * } | null | undefined} input
 * @returns {{ action: 'merge' | 'update-branch' | 'conflict' | 'wait' | 'fail', reason: string }}
 */
export function decide(input) {
  const mergeable = input?.mergeable ?? null;
  const state = input?.mergeStateStatus ?? null;
  const compare = input?.compare ?? null;
  const behindBy = numberOrNull(compare?.behind_by);
  const aheadBy = numberOrNull(compare?.ahead_by);
  const compareStatus = compare?.status ?? null;

  if (mergeable == null || mergeable === '' || mergeable === 'UNKNOWN' || mergeable === 'null'
      || state == null || state === '' || state === 'UNKNOWN' || state === 'null') {
    return { action: 'fail', reason: 'unknown' };
  }

  if (mergeable === 'CONFLICTING' || state === 'DIRTY') {
    return { action: 'conflict', reason: state === 'DIRTY' ? 'dirty' : 'conflicting' };
  }

  const diverged = compareStatus === 'diverged' || (aheadBy != null && aheadBy > 0 && behindBy != null && behindBy > 0);

  if (state === 'BEHIND') {
    return { action: 'update-branch', reason: diverged ? 'diverged' : 'behind' };
  }

  if (mergeable === 'MERGEABLE' && state === 'UNSTABLE') {
    // UNSTABLE without a compare result is an unknown state. Do not guess.
    if (compare == null || behindBy == null || aheadBy == null || compareStatus == null || compareStatus === '') {
      return { action: 'fail', reason: 'unknown' };
    }
    if (behindBy > 0) {
      return { action: 'update-branch', reason: diverged ? 'diverged' : 'behind' };
    }
    return { action: 'merge', reason: 'current' };
  }

  if (mergeable === 'MERGEABLE' && (state === 'CLEAN' || state === 'HAS_HOOKS')) {
    if (behindBy != null && behindBy > 0) {
      return { action: 'update-branch', reason: diverged ? 'diverged' : 'behind' };
    }
    return { action: 'merge', reason: 'clean' };
  }

  if (state === 'BLOCKED' || state === 'DRAFT') {
    return { action: 'wait', reason: state.toLowerCase() };
  }

  return { action: 'fail', reason: 'unknown' };
}
