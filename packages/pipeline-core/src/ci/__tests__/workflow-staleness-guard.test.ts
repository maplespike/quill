// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Staleness-guard regression suite — models the "merge snapshot" class
 * (PR #898, run 35679727877: refs/pull/898/merge merged 3ccda3d into
 * 1a526344, predating qa.yml's fix at 879f0cf on main).
 *
 * Cases (a)-(d) required by card t_2535563a:
 *   (a) stale-base PR run + changed file            → annotation
 *   (b) stale-base PR run + unchanged file          → no annotation
 *   (c) up-to-date base (base == main)              → no annotation
 *   (d) main run, superseded                         → skip (unchanged)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateStaleness,
  formatAnnotation,
  type StalenessContext,
} from '../staleness-guard.js';

const MAIN_HEAD = '89b700eabcdef1234567890abcdef1234567890';
const STALE_BASE = '1a52634400000000000000000000000000000000';
const WF = '.github/workflows/qa.yml';

/** A PR run whose merge base predates main HEAD and qa.yml changed. */
function ctx(overrides: Partial<StalenessContext> = {}): StalenessContext {
  return {
    branch: 'wt/some-pr',
    headSha: '3ccda3d000000000000000000000000000000000',
    pullRequests: [{ base: { sha: STALE_BASE } }],
    workflowFile: WF,
    ...overrides,
  };
}

describe('CI Doctor staleness guard', () => {
  it('(a) stale-base PR run + changed file → annotation, no skip', () => {
    const result = evaluateStaleness(
      ctx(),
      MAIN_HEAD,
      [WF, 'packages/pipeline-core/src/claims/index.ts'],
    );
    assert.equal(result.skip, false, 'PR runs never skip');
    assert.ok(result.annotation, 'annotation expected');
    assert.match(result.annotation!, /predates main HEAD/);
    assert.match(result.annotation!, /\.github\/workflows\/qa\.yml/);
  });

  it('(b) stale-base PR run + unchanged workflow file → no annotation', () => {
    const result = evaluateStaleness(
      ctx(),
      MAIN_HEAD,
      ['packages/pipeline-core/src/claims/index.ts'],
    );
    assert.equal(result.skip, false);
    assert.equal(result.annotation, null, 'file unchanged → no annotation');
  });

  it('(c) up-to-date base (base == main HEAD) → no annotation', () => {
    const result = evaluateStaleness(
      ctx({ pullRequests: [{ base: { sha: MAIN_HEAD } }] }),
      MAIN_HEAD,
      [WF],
    );
    assert.equal(result.skip, false);
    assert.equal(result.annotation, null, 'base current → no annotation');
  });

  it('(d) main run, superseded → skip, no annotation (existing behavior)', () => {
    const result = evaluateStaleness(
      { branch: 'main', headSha: STALE_BASE, pullRequests: [], workflowFile: WF },
      MAIN_HEAD,
      [WF],
    );
    assert.equal(result.skip, true, 'superseded main run skips');
    assert.equal(result.annotation, null);
  });

  it('main run at current HEAD → no skip', () => {
    const result = evaluateStaleness(
      { branch: 'main', headSha: MAIN_HEAD, pullRequests: [], workflowFile: WF },
      MAIN_HEAD,
      [],
    );
    assert.equal(result.skip, false);
    assert.equal(result.annotation, null);
  });

  it('PR run with no pull_requests payload → no annotation (defensive)', () => {
    const result = evaluateStaleness(
      ctx({ pullRequests: [] }),
      MAIN_HEAD,
      [WF],
    );
    assert.equal(result.skip, false);
    assert.equal(result.annotation, null);
  });

  it('empty mainHeadSha → no skip, no annotation', () => {
    const result = evaluateStaleness(ctx(), '', [WF]);
    assert.equal(result.skip, false);
    assert.equal(result.annotation, null);
  });

  it('formatAnnotation renders the canonical line', () => {
    const line = formatAnnotation(WF, STALE_BASE, MAIN_HEAD);
    assert.equal(
      line,
      'Merge snapshot base 1a52634 predates main HEAD 89b700e and ' +
        '.github/workflows/qa.yml changed since — update the branch ' +
        '(merge main) before diagnosing; the failure may already be fixed.',
    );
  });
});
