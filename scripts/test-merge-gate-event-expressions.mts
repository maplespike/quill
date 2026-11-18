/**
 * EVENT_HEAD_REPO / concurrency expressions in merge-when-green.yml.
 *
 * GitHub Actions treats && and || as equal precedence, left-associative.
 * The unparenthesized guard at line 151 therefore evaluated
 * check_suite.pull_requests[0] under workflow_run (and any other event
 * whose earlier operand was truthy). That [0] access is a startup_failure.
 *
 * These tests render every workflow expression against a payload for each
 * event the workflow handles, run the shell jq head-repo helper on the
 * same fixtures, and fail if a ${{ }} or job `if:` expression indexes [0].
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = path.join(REPO, '.github/workflows/merge-when-green.yml');
const workflow = () => fs.readFileSync(WORKFLOW, 'utf8');

const REPO_NAME = 'maplespike/quill';
const SHA = '35e418fd1c330a376b382f9d0bbcd768e5135e88';
const FORK_SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

export type StartupFailure = { startupFailure: true; path: string };

export function isStartupFailure(v: unknown): v is StartupFailure {
  return Boolean(v && typeof v === 'object' && (v as StartupFailure).startupFailure);
}

const INDEX_RE = /\[\s*0\s*\]/;

/** Equal-precedence, left-associative && / ||, plus == !=, format, toJson, paths. */
export function evalGitHubExpression(
  src: string,
  ctx: Record<string, unknown>,
): unknown {
  const s = src.replace(/\s+/g, ' ').trim();
  let i = 0;

  const peek = () => s[i] ?? '';
  const skipWs = () => {
    while (s[i] === ' ') i += 1;
  };
  const eat = (lit: string) => {
    skipWs();
    if (s.slice(i, i + lit.length) !== lit) {
      throw new Error(`expected '${lit}' at ${i} in ${s}`);
    }
    i += lit.length;
  };

  const parseString = (): string => {
    const q = peek();
    i += 1;
    let out = '';
    while (i < s.length && s[i] !== q) {
      out += s[i];
      i += 1;
    }
    if (s[i] !== q) throw new Error('unterminated string');
    i += 1;
    return out;
  };

  const parseIdent = (): string => {
    skipWs();
    const m = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(s.slice(i));
    if (!m) throw new Error(`expected identifier at ${i} in ${s}`);
    i += m[0].length;
    return m[0];
  };

  const isFalsy = (v: unknown) =>
    v === null || v === undefined || v === false || v === '' || v === 0;

  const indexAccess = (val: unknown, idx: unknown, path: string): unknown => {
    if (typeof idx !== 'number' || !Number.isInteger(idx)) {
      throw new Error(`non-integer index ${String(idx)}`);
    }
    if (!Array.isArray(val) || idx < 0 || idx >= val.length) {
      const err: StartupFailure = { startupFailure: true, path };
      throw err;
    }
    return val[idx];
  };

  const prop = (val: unknown, key: string): unknown => {
    if (val === null || val === undefined) return null;
    if (typeof val !== 'object') return null;
    return (val as Record<string, unknown>)[key] ?? null;
  };

  function parsePrimary(): unknown {
    skipWs();
    if (peek() === "'" || peek() === '"') return parseString();
    if (peek() === '(') {
      eat('(');
      const v = parseLogical();
      eat(')');
      return v;
    }
    if (/[0-9]/.test(peek())) {
      const m = /^[0-9]+/.exec(s.slice(i))!;
      i += m[0].length;
      return Number(m[0]);
    }
    const id = parseIdent();
    if (id === 'true') return true;
    if (id === 'false') return false;
    if (id === 'null') return null;

    skipWs();
    if (peek() === '(') {
      eat('(');
      const args: unknown[] = [];
      skipWs();
      if (peek() !== ')') {
        args.push(parseLogical());
        skipWs();
        while (peek() === ',') {
          eat(',');
          args.push(parseLogical());
          skipWs();
        }
      }
      eat(')');
      if (id === 'format') {
        const fmt = String(args[0] ?? '');
        return fmt.replace(/\{(\d+)\}/g, (_, n) => String(args[Number(n) + 1] ?? ''));
      }
      if (id === 'toJson' || id === 'toJSON') {
        return JSON.stringify(args[0] ?? null);
      }
      throw new Error(`unknown function ${id}`);
    }

    let val: unknown = ctx[id];
    let path = id;
    for (;;) {
      skipWs();
      if (peek() === '.') {
        eat('.');
        const key = parseIdent();
        path += `.${key}`;
        val = prop(val, key);
        continue;
      }
      if (peek() === '[') {
        eat('[');
        const idx = parseLogical();
        eat(']');
        path += `[${String(idx)}]`;
        val = indexAccess(val, idx, path);
        continue;
      }
      break;
    }
    return val ?? null;
  }

  function parseUnary(): unknown {
    skipWs();
    if (peek() === '!') {
      eat('!');
      return isFalsy(parseUnary()) ? true : false;
    }
    return parsePrimary();
  }

  function parseEq(): unknown {
    let left = parseUnary();
    skipWs();
    if (s.slice(i, i + 2) === '==') {
      eat('==');
      const right = parseUnary();
      return left === right;
    }
    if (s.slice(i, i + 2) === '!=') {
      eat('!=');
      const right = parseUnary();
      return left !== right;
    }
    return left;
  }

  // Same precedence, left-associative — this is the GitHub Actions rule.
  function parseLogical(): unknown {
    let left = parseEq();
    for (;;) {
      skipWs();
      if (s.slice(i, i + 2) === '&&') {
        eat('&&');
        const right = parseEq();
        left = isFalsy(left) ? left : right;
        continue;
      }
      if (s.slice(i, i + 2) === '||') {
        eat('||');
        const right = parseEq();
        left = isFalsy(left) ? right : left;
        continue;
      }
      break;
    }
    return left;
  }

  const result = parseLogical();
  skipWs();
  if (i !== s.length) throw new Error(`trailing input at ${i}: ${s.slice(i)}`);
  return result;
}

function extractTemplateExpressions(text: string): string[] {
  const out: string[] = [];
  const re = /\$\{\{([\s\S]*?)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const expr = m[1].trim();
    if (expr) out.push(expr);
  }
  const ifm = text.match(/\n\s*if:\s*>-\n([\s\S]*?)\n    runs-on:/);
  if (ifm) out.push(ifm[1].trim());
  return out;
}

function contextFor(eventName: string, event: Record<string, unknown>) {
  return {
    github: {
      event_name: eventName,
      event,
      repository: REPO_NAME,
      token: 'ghs_dummy',
      actor: 'reverb256',
      run_id: 42,
    },
    vars: { MERGE_GATE_APP_ID: '1' },
    secrets: { MERGE_GATE_APP_PRIVATE_KEY: 'k' },
    steps: { gate: { outputs: { token: 'ghs_gate' } } },
  };
}

const pr = (fullName = REPO_NAME, sha = SHA, number = 1343) => ({
  number,
  head: { sha, repo: { full_name: fullName, url: `https://api.github.com/repos/${fullName}` } },
});

const payloads: { name: string; event: Record<string, unknown> }[] = [
  {
    name: 'pull_request_target',
    event: { pull_request: pr(), action: 'labeled' },
  },
  {
    name: 'pull_request',
    event: { pull_request: pr(), action: 'synchronize' },
  },
  {
    name: 'workflow_dispatch',
    event: { inputs: { pr: '1343' } },
  },
  {
    name: 'workflow_run',
    event: {
      workflow_run: {
        head_sha: SHA,
        head_repository: { full_name: REPO_NAME },
        pull_requests: [pr()],
      },
    },
  },
  {
    name: 'workflow_run',
    event: {
      workflow_run: {
        head_sha: SHA,
        head_repository: { full_name: REPO_NAME },
        // no pull_requests array — the old [0] path blew up here
      },
    },
  },
  {
    name: 'check_suite',
    event: {
      check_suite: {
        head_sha: SHA,
        pull_requests: [pr()],
      },
    },
  },
  {
    name: 'check_suite',
    event: {
      check_suite: {
        head_sha: SHA,
        pull_requests: [],
      },
    },
  },
  {
    name: 'check_suite',
    event: {
      check_suite: {
        head_sha: SHA,
        pull_requests: [
          {
            number: 1343,
            head: {
              sha: SHA,
              repo: { url: `https://api.github.com/repos/${REPO_NAME}` },
            },
          },
        ],
      },
    },
  },
  {
    name: 'workflow_run',
    event: {
      workflow_run: {
        head_sha: FORK_SHA,
        head_repository: { full_name: 'other/quill' },
        pull_requests: [pr('other/quill', FORK_SHA, 9)],
      },
    },
  },
];

const LEGACY_EVENT_HEAD_REPO =
  "github.event_name == 'pull_request_target' && github.event.pull_request.head.repo.full_name || github.event_name == 'workflow_run' && github.event.workflow_run.head_repository.full_name || github.event_name == 'check_suite' && github.event.check_suite.pull_requests[0].head.repo.full_name || ''";

function eventHeadRepoFromPayload(name: string, event: Record<string, unknown>): string {
  const jq = extractEventHeadRepoJq(workflow());
  if (name === 'pull_request_target' || name === 'pull_request') {
    const prEvent = event.pull_request as { head?: { repo?: { full_name?: string } } } | undefined;
    return prEvent?.head?.repo?.full_name ?? '';
  }
  if (name === 'workflow_run') {
    const wr = event.workflow_run as {
      head_repository?: { full_name?: string };
      pull_requests?: unknown;
    };
    if (wr?.head_repository?.full_name) return wr.head_repository.full_name;
    return runJq(jq, wr?.pull_requests ?? null);
  }
  if (name === 'check_suite') {
    const cs = event.check_suite as { pull_requests?: unknown };
    return runJq(jq, cs?.pull_requests ?? null);
  }
  return '';
}

function extractEventHeadRepoJq(text: string): string {
  const start = text.indexOf('          event_head_repo() {');
  assert.notEqual(start, -1, 'event_head_repo helper is missing');
  const jqStart = text.indexOf("            jq -r '", start);
  assert.notEqual(jqStart, -1, 'event_head_repo jq is missing');
  const open = text.indexOf("jq -r '", jqStart);
  const bodyStart = open + "jq -r '".length;
  const bodyEnd = text.indexOf("            ' <<<\"$json\"", bodyStart);
  assert.ok(bodyEnd > bodyStart, 'event_head_repo jq terminator missing');
  return text.slice(bodyStart, bodyEnd);
}

function runJq(program: string, input: unknown): string {
  const proc = spawnSync('jq', ['-r', program], {
    input: JSON.stringify(input),
    encoding: 'utf8',
  });
  if (proc.status !== 0) {
    throw new Error(`jq failed: ${proc.stderr}`);
  }
  return (proc.stdout || '').replace(/\n$/, '');
}

test('workflow expressions never index pull_requests[0]', () => {
  const text = workflow();
  const exprs = extractTemplateExpressions(text);
  assert.ok(exprs.length >= 8, `expected several expressions, got ${exprs.length}`);
  for (const expr of exprs) {
    assert.equal(INDEX_RE.test(expr), false, `indexed [0] in: ${expr}`);
  }
  // The env assignment itself must be gone.
  assert.doesNotMatch(text, /EVENT_HEAD_REPO:\s*\$\{\{/);
  assert.match(text, /EVENT_HEAD_REPO_PR:\s*\$\{\{\s*github\.event\.pull_request\.head\.repo\.full_name\s*\}\}/);
  assert.match(text, /EVENT_HEAD_REPO_WR:\s*\$\{\{\s*github\.event\.workflow_run\.head_repository\.full_name\s*\}\}/);
});

test('legacy unparenthesized EVENT_HEAD_REPO still trips [0] under workflow_run and dispatch', () => {
  const cases = payloads.filter(
    (p) => p.name === 'workflow_run' || p.name === 'workflow_dispatch',
  );
  assert.ok(cases.length >= 3);
  for (const p of cases) {
    assert.throws(
      () => evalGitHubExpression(LEGACY_EVENT_HEAD_REPO, contextFor(p.name, p.event)),
      (err: unknown) => isStartupFailure(err) && /check_suite\.pull_requests\[0\]/.test((err as StartupFailure).path),
      `legacy expression should fail on ${p.name}`,
    );
  }
});

test('legacy expression is safe only when check_suite carries a PR at [0]', () => {
  const ok = payloads.find(
    (p) => p.name === 'check_suite' && Array.isArray((p.event.check_suite as { pull_requests: unknown[] }).pull_requests)
      && (p.event.check_suite as { pull_requests: unknown[] }).pull_requests.length > 0
      && Boolean(((p.event.check_suite as { pull_requests: { head?: { repo?: { full_name?: string } } }[] }).pull_requests[0]).head?.repo?.full_name),
  );
  assert.ok(ok);
  const value = evalGitHubExpression(LEGACY_EVENT_HEAD_REPO, contextFor(ok!.name, ok!.event));
  assert.equal(value, REPO_NAME);
});

test('every current expression evaluates for each handled event without indexing [0]', () => {
  const exprs = extractTemplateExpressions(workflow());
  for (const p of payloads) {
    const ctx = contextFor(p.name, p.event);
    for (const expr of exprs) {
      let value: unknown;
      try {
        value = evalGitHubExpression(expr, ctx);
      } catch (err) {
        assert.equal(isStartupFailure(err), false, `startup_failure on ${p.name}: ${expr}`);
        throw err;
      }
      assert.equal(isStartupFailure(value), false, `unexpected failure value on ${p.name}`);
    }
  }
});

test('shell event_head_repo resolution matches the event payload for each type', () => {
  for (const p of payloads) {
    const resolved = eventHeadRepoFromPayload(p.name, p.event);
    if (p.name === 'workflow_dispatch') {
      assert.equal(resolved, '');
      continue;
    }
    if (p.name === 'workflow_run') {
      const wr = p.event.workflow_run as { head_repository?: { full_name?: string } };
      assert.equal(resolved, wr.head_repository?.full_name ?? '');
      continue;
    }
    if (p.name === 'check_suite') {
      const prs = (p.event.check_suite as { pull_requests?: { head?: { repo?: { full_name?: string; url?: string } } }[] }).pull_requests;
      if (!prs || prs.length === 0) {
        assert.equal(resolved, '');
      } else {
        assert.equal(resolved, REPO_NAME);
      }
      continue;
    }
    assert.equal(resolved, REPO_NAME);
  }
});

test('concurrency groups a PR event by number and a suite/run by head SHA', () => {
  const text = workflow();
  const m = text.match(/group:\s*>-\s*\n\s*gate-\$\{\{([\s\S]*?)\}\}/);
  assert.ok(m, 'concurrency group expression missing');
  const expr = m![1];
  assert.equal(
    evalGitHubExpression(expr, contextFor('pull_request_target', { pull_request: pr() })),
    'pr-1343',
  );
  assert.equal(
    evalGitHubExpression(expr, contextFor('workflow_dispatch', { inputs: { pr: '1343' } })),
    'pr-1343',
  );
  assert.equal(
    evalGitHubExpression(expr, contextFor('workflow_run', { workflow_run: { head_sha: SHA } })),
    SHA,
  );
  assert.equal(
    evalGitHubExpression(expr, contextFor('check_suite', { check_suite: { head_sha: SHA, pull_requests: [] } })),
    SHA,
  );
});

test('job if skips a fork workflow_run and keeps a same-repo check_suite', () => {
  const text = workflow();
  const m = text.match(/\n\s*if:\s*>-\n([\s\S]*?)\n    runs-on:/);
  assert.ok(m);
  const expr = m![1];
  assert.equal(
    evalGitHubExpression(expr, contextFor('workflow_run', { workflow_run: { head_repository: { full_name: 'other/quill' } } })),
    false,
  );
  assert.equal(
    evalGitHubExpression(expr, contextFor('workflow_run', { workflow_run: { head_repository: { full_name: REPO_NAME } } })),
    true,
  );
  assert.equal(
    evalGitHubExpression(expr, contextFor('check_suite', { check_suite: { head_sha: SHA, pull_requests: [] } })),
    true,
  );
  assert.equal(
    evalGitHubExpression(expr, contextFor('workflow_dispatch', { inputs: { pr: '1' } })),
    true,
  );
  assert.equal(
    evalGitHubExpression(
      expr,
      contextFor('pull_request_target', { pull_request: pr('other/quill') }),
    ),
    false,
  );
});

test('token split is unchanged: App token for writes, GITHUB_TOKEN for reads', () => {
  const text = workflow();
  assert.match(text, /GATE_TOKEN:\s*\$\{\{\s*steps\.gate\.outputs\.token\s*\}\}/);
  assert.match(text, /GH_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/);
  assert.match(text, /READ_TOKEN="\$GH_TOKEN"/);
  assert.match(text, /EXPECTED_GATE_APP_SLUG:\s*fleet-merge-gate-maplespike/);
});
