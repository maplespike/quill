#!/usr/bin/env node
// A ready-to-merge pull request needs a completed check suite on its head.
//
// Green commit statuses, or a queue of suites that never started a run, are
// not a completed suite. Those zero-run suites are stuck (see triage-checks.mjs).
// The merge gate must not squash-merge that head.
//
//   node scripts/gates/completed-suite.mjs --check-suites suites.json
//   node scripts/gates/completed-suite.mjs --repo owner/name --sha <40 hex>
// Exit 0 when at least one suite has status "completed".
// Exit 1 when none do, or the API fails. The refusal line is on stderr.

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

import { asCheckSuites, parseConcatenatedJson } from './triage-checks.mjs';

/**
 * @param {unknown} checkSuites one API document, a page list, or an array of suites
 * @returns {number}
 */
export function completedSuiteCount(checkSuites) {
  const docs = Array.isArray(checkSuites) && checkSuites.every((item) => item && typeof item === 'object' && 'check_suites' in item)
    ? checkSuites
    : [checkSuites];
  const suites = docs.flatMap((doc) => asCheckSuites(doc));
  return suites.filter((suite) => suite?.status === 'completed').length;
}

/**
 * @param {unknown} checkSuites
 * @returns {boolean}
 */
export function hasCompletedCheckSuite(checkSuites) {
  return completedSuiteCount(checkSuites) > 0;
}

function argValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index < 0) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) return null;
  return value;
}

function ghApi(path) {
  const result = spawnSync('gh', ['api', '--paginate', path], {
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(detail || `gh api ${path} failed`);
  }
  return result.stdout ?? '';
}

function suitesFromText(text) {
  const docs = parseConcatenatedJson(text);
  return { check_suites: docs.flatMap((doc) => asCheckSuites(doc)) };
}

function main(argv) {
  const file = argValue(argv, '--check-suites');
  const repo = argValue(argv, '--repo');
  const sha = argValue(argv, '--sha');
  let payload;
  if (file) {
    payload = suitesFromText(readFileSync(file, 'utf8'));
  } else if (repo && sha) {
    if (!/^[0-9a-fA-F]{40}$/.test(sha)) {
      console.error('::error::completed-suite: --sha must be a 40-character commit id');
      return 1;
    }
    try {
      payload = suitesFromText(ghApi(`repos/${repo}/commits/${sha}/check-suites?per_page=100`));
    } catch (error) {
      console.error(`::error::completed-suite API error: ${error instanceof Error ? error.message : error}`);
      return 1;
    }
  } else {
    console.error('::error::completed-suite: pass --check-suites or --repo and --sha');
    return 1;
  }
  const count = completedSuiteCount(payload);
  if (count > 0) {
    console.log(`completed check suites: ${count}`);
    return 0;
  }
  console.error('::error::no completed check suite');
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
