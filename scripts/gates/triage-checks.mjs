#!/usr/bin/env node
// Why a pull request is not green, one line per check suite.
//
// Reads check-runs?per_page=100 and check-suites for a head SHA (or local
// fixtures) and prints the cause:
//   failed
//   cancelled
//   stuck          a queued suite with zero check runs
//   stale
//
// A success suite prints nothing. Precedence is the list above: a suite that
// both failed and went stale is failed.
//
//   node scripts/gates/triage-checks.mjs --repo owner/name --sha <40 hex>
//   node scripts/gates/triage-checks.mjs --check-runs runs.json --check-suites suites.json
//
// The --repo form uses `gh` and GH_TOKEN. The merge gate passes the
// fleet-merge-gate App token. Exit 1 on unreadable input or an API error.

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

/** Conclusions that mean the suite failed. */
export const FAILED_CONCLUSIONS = ['failure', 'timed_out', 'action_required', 'startup_failure'];

/**
 * The jq program merge-when-green.yml runs when node is not on the runner.
 * `$runs` and `$suites` are arrays of API page documents (gh api --paginate).
 * Keep this string identical to TRIAGE_JQ= in the workflow.
 */
export const TRIAGE_JQ = 'def runs: [$runs[]?.check_runs[]?]; def suites: [$suites[]?.check_suites[]?]; suites | sort_by(.id)[] as $s | (runs | map(select((.check_suite.id == $s.id) or (.check_suite_id == $s.id)))) as $sr | (if ($s.conclusion == "failure" or ([$sr[].conclusion | select(. == "failure" or . == "timed_out" or . == "action_required" or . == "startup_failure")] | length) > 0) then "failed" elif ($s.conclusion == "cancelled" or ([$sr[].conclusion | select(. == "cancelled")] | length) > 0) then "cancelled" elif ($s.status == "queued" and (($s.latest_check_runs_count // 0) == 0) and (($sr | length) == 0)) then "stuck" elif ($s.conclusion == "stale" or ([$sr[].conclusion | select(. == "stale")] | length) > 0) then "stale" else empty end) as $why | "suite \\($s.id) \\($s.app.slug // $s.app.name // "unknown"): \\($why)"';

const FAILED = new Set(FAILED_CONCLUSIONS);

/**
 * @param {string} text
 * @returns {unknown[]}
 */
export function parseConcatenatedJson(text) {
  const source = text.trim();
  if (source === '') return [];
  const out = [];
  let i = 0;
  while (i < source.length) {
    while (i < source.length && /\s/.test(source[i])) i += 1;
    if (i >= source.length) break;
    const start = i;
    const opener = source[i];
    if (opener !== '{' && opener !== '[') {
      throw new Error(`expected a JSON value at index ${i}`);
    }
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (; i < source.length; i += 1) {
      const ch = source[i];
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{' || ch === '[') depth += 1;
      else if (ch === '}' || ch === ']') {
        depth -= 1;
        if (depth === 0) {
          i += 1;
          break;
        }
      }
    }
    if (depth !== 0) throw new Error('unterminated JSON value');
    out.push(JSON.parse(source.slice(start, i)));
  }
  return out;
}

/**
 * @param {unknown} payload
 * @returns {Array<Record<string, unknown>>}
 */
export function asCheckRuns(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && Array.isArray(payload.check_runs)) return payload.check_runs;
  return [];
}

/**
 * @param {unknown} payload
 * @returns {Array<Record<string, unknown>>}
 */
export function asCheckSuites(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && Array.isArray(payload.check_suites)) return payload.check_suites;
  return [];
}

/**
 * @param {Record<string, unknown>} suite
 * @param {Array<Record<string, unknown>>} runs
 * @returns {'failed' | 'cancelled' | 'stuck' | 'stale' | null}
 */
export function suiteCause(suite, runs) {
  const id = suite.id;
  const own = runs.filter((run) => {
    const nested = run?.check_suite && typeof run.check_suite === 'object' ? run.check_suite.id : undefined;
    return nested === id || run?.check_suite_id === id;
  });
  const conclusions = own.map((run) => run?.conclusion).filter((value) => value != null);
  const failedRun = conclusions.some((value) => FAILED.has(String(value)));
  if (suite.conclusion === 'failure' || failedRun) return 'failed';
  if (suite.conclusion === 'cancelled' || conclusions.some((value) => value === 'cancelled')) return 'cancelled';
  const count = suite.latest_check_runs_count ?? 0;
  // A suite that stays queued and never starts a run is stuck, not merely pending.
  if (suite.status === 'queued' && count === 0 && own.length === 0) return 'stuck';
  if (suite.conclusion === 'stale' || conclusions.some((value) => value === 'stale')) return 'stale';
  return null;
}

/**
 * @param {unknown} checkRuns
 * @param {unknown} checkSuites
 * @returns {string[]}
 */
export function triageLines(checkRuns, checkSuites) {
  const runs = asCheckRuns(checkRuns);
  const suites = asCheckSuites(checkSuites);
  return [...suites]
    .sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0))
    .flatMap((suite) => {
      const cause = suiteCause(suite, runs);
      if (!cause) return [];
      const app = suite.app && typeof suite.app === 'object' ? suite.app : {};
      const slug = app.slug || app.name || 'unknown';
      return [`suite ${suite.id} ${slug}: ${cause}`];
    });
}

/**
 * @param {string} text page documents concatenated, as `gh api --paginate` writes them
 * @param {'check_runs' | 'check_suites'} key
 */
export function payloadFromPages(text, key) {
  const docs = parseConcatenatedJson(text);
  if (key === 'check_runs') return { check_runs: docs.flatMap((doc) => asCheckRuns(doc)) };
  return { check_suites: docs.flatMap((doc) => asCheckSuites(doc)) };
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

function main(argv) {
  const runsFile = argValue(argv, '--check-runs');
  const suitesFile = argValue(argv, '--check-suites');
  const repo = argValue(argv, '--repo');
  const sha = argValue(argv, '--sha');

  let runsPayload;
  let suitesPayload;
  if (runsFile && suitesFile) {
    runsPayload = payloadFromPages(readFileSync(runsFile, 'utf8'), 'check_runs');
    suitesPayload = payloadFromPages(readFileSync(suitesFile, 'utf8'), 'check_suites');
  } else if (repo && sha) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
      console.error('triage-checks: --repo must be owner/name');
      return 1;
    }
    if (!/^[0-9a-fA-F]{40}$/.test(sha)) {
      console.error('triage-checks: --sha must be a 40-character commit id');
      return 1;
    }
    try {
      runsPayload = payloadFromPages(
        ghApi(`repos/${repo}/commits/${sha}/check-runs?per_page=100`),
        'check_runs',
      );
      suitesPayload = payloadFromPages(
        ghApi(`repos/${repo}/commits/${sha}/check-suites?per_page=100`),
        'check_suites',
      );
    } catch (error) {
      console.error(`triage-checks: API error: ${error instanceof Error ? error.message : error}`);
      return 1;
    }
  } else {
    console.error('triage-checks: pass --check-runs and --check-suites, or --repo and --sha');
    return 1;
  }

  const lines = triageLines(runsPayload, suitesPayload);
  if (lines.length) process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
