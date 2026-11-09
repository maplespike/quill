#!/usr/bin/env node
// Commit status for a merge gate that closed without merging.
//
// Context is `merge-gate`. The state is failure or pending. SUCCESS is
// refused: a closed gate did not merge, and a success status would hide that.
// Description is the reason, trimmed to GitHub's 140-character limit.
//
//   node scripts/gates/commit-status.mjs \
//     --repo owner/name --sha <40 hex> --state failure --description "reason"
// The post uses `gh` and GH_TOKEN (the fleet-merge-gate App token in the workflow).
// Exit 1, with ::error::, when the state is success or the API call fails.

import { spawnSync } from 'node:child_process';

export const MERGE_GATE_CONTEXT = 'merge-gate';

const DESCRIPTION_MAX = 140;

/**
 * @param {{ reason?: string | null, waiting?: boolean }} input
 * @returns {{ context: string, state: 'failure' | 'pending', description: string }}
 */
export function statusForClose(input = {}) {
  const state = input.waiting ? 'pending' : 'failure';
  return {
    context: MERGE_GATE_CONTEXT,
    state,
    description: clipDescription(input.reason),
  };
}

/**
 * @param {string | null | undefined} reason
 * @returns {string}
 */
export function clipDescription(reason) {
  const text = String(reason ?? 'merge gate closed').replace(/\s+/g, ' ').trim();
  return (text || 'merge gate closed').slice(0, DESCRIPTION_MAX);
}

/**
 * @param {string | null | undefined} state
 * @returns {'failure' | 'pending'}
 */
export function assertCloseableState(state) {
  if (state === 'success') {
    throw new Error('merge-gate must not report SUCCESS when the gate closed');
  }
  if (state !== 'failure' && state !== 'pending') {
    throw new Error(`merge-gate state must be failure or pending, not ${state || 'empty'}`);
  }
  return state;
}

function argValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index < 0) return null;
  const value = argv[index + 1];
  if (value == null || value.startsWith('--')) return null;
  return value;
}

function main(argv) {
  const repo = argValue(argv, '--repo');
  const sha = argValue(argv, '--sha');
  const stateArg = argValue(argv, '--state');
  const description = clipDescription(argValue(argv, '--description'));
  if (!repo || !sha || !stateArg) {
    console.error('::error::commit-status: pass --repo, --sha, and --state');
    return 1;
  }
  if (!/^[0-9a-fA-F]{40}$/.test(sha)) {
    console.error('::error::commit-status: --sha must be a 40-character commit id');
    return 1;
  }
  let state;
  try {
    state = assertCloseableState(stateArg);
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : error}`);
    return 1;
  }
  const result = spawnSync('gh', [
    'api', '--method', 'POST',
    `repos/${repo}/statuses/${sha}`,
    '-f', `state=${state}`,
    '-f', `context=${MERGE_GATE_CONTEXT}`,
    '-f', `description=${description}`,
  ], { encoding: 'utf8', env: process.env });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    console.error(`::error::merge-gate status publish failed: ${detail || 'gh api failed'}`);
    return 1;
  }
  console.log(`merge-gate ${state} on ${sha}: ${description}`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
