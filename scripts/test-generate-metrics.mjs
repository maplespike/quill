/**
 * docs/metrics.json must be a function of the source tree.
 *
 * The generator used to stamp the wall-clock day into //_generated, version,
 * and lastUpdated, and it used to change the module sentence when
 * pipeline-core dist/ was present. Either one makes
 * `git diff --exit-code docs/metrics.json` fail on a later day or on a
 * machine that has already built. These tests pin the stable behaviour.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  countQuotedModulePaths,
  registryCountForMetrics,
  withStableDates,
} from './generate-metrics.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const METRICS = resolve(ROOT, 'docs/metrics.json');
const DIST_INDEX = resolve(ROOT, 'packages/pipeline-core/dist/index.js');

test('quoted modulePath count skips the unquoted interface field', () => {
  const sample = [
    'export interface ModuleInfo {',
    '  modulePath: string;',
    '}',
    "modulePath: './rss.js',",
    'modulePath: "./gov-api.js",',
    '// modulePath: \'./commented.js\',',
  ].join('\n');
  assert.equal(countQuotedModulePaths(sample), 2);
});

test('registry count written to metrics.json ignores a disagreeing dist', () => {
  assert.equal(registryCountForMetrics(207, 207), 207);
  assert.equal(registryCountForMetrics(207, null), 207);
  assert.equal(registryCountForMetrics(207, 3), 207);
  assert.equal(registryCountForMetrics(207, 0), 207);
});

test('date stamps stay put when the payload is unchanged', () => {
  const existing = {
    '//_generated': '2026-10-19',
    version: '2026-10-19',
    modules: { registryCount: 207 },
    lastUpdated: '2026-10-19',
  };
  const next = {
    '//_generated': '2026-11-09',
    version: '2026-11-09',
    modules: { registryCount: 207 },
    lastUpdated: '2026-11-09',
  };
  const stamped = withStableDates(next, existing, '2026-11-09');
  assert.equal(stamped['//_generated'], '2026-10-19');
  assert.equal(stamped.version, '2026-10-19');
  assert.equal(stamped.lastUpdated, '2026-10-19');
  assert.equal(stamped.modules.registryCount, 207);
});

test('date stamps move when a count changes', () => {
  const existing = {
    '//_generated': '2026-10-19',
    version: '2026-10-19',
    modules: { registryCount: 207 },
    lastUpdated: '2026-10-19',
  };
  const next = {
    '//_generated': '2026-11-09',
    version: '2026-11-09',
    modules: { registryCount: 208 },
    lastUpdated: '2026-11-09',
  };
  const stamped = withStableDates(next, existing, '2026-11-09');
  assert.equal(stamped['//_generated'], '2026-11-09');
  assert.equal(stamped.version, '2026-11-09');
  assert.equal(stamped.lastUpdated, '2026-11-09');
  assert.equal(stamped.modules.registryCount, 208);
});

function runGenerator(env = {}) {
  return spawnSync(process.execPath, ['scripts/generate-metrics.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

test('a later calendar day and a disagreeing dist do not rewrite metrics.json', () => {
  const first = runGenerator();
  assert.equal(first.status, 0, first.stderr);
  const committed = readFileSync(METRICS, 'utf8');
  assert.doesNotMatch(committed, /dist was not built/);

  const later = runGenerator({ METRICS_DATE: '1999-01-01' });
  assert.equal(later.status, 0, later.stderr);
  assert.equal(readFileSync(METRICS, 'utf8'), committed);

  const hadDist = existsSync(DIST_INDEX);
  const backup = hadDist ? readFileSync(DIST_INDEX) : null;
  mkdirSync(dirname(DIST_INDEX), { recursive: true });
  writeFileSync(
    DIST_INDEX,
    'export function getAllModules(){ return [1, 2, 3]; }\n',
  );
  try {
    const withDist = runGenerator({ METRICS_DATE: '2030-01-01' });
    assert.equal(withDist.status, 0, withDist.stderr);
    assert.match(withDist.stderr, /does not depend on dist/);
    assert.equal(readFileSync(METRICS, 'utf8'), committed);
    const parsed = JSON.parse(committed);
    assert.equal(parsed.modules.registryCount, 207);
    assert.notEqual(parsed['//_generated'], '2030-01-01');
    assert.notEqual(parsed['//_generated'], '1999-01-01');
  } finally {
    if (backup !== null) writeFileSync(DIST_INDEX, backup);
    else rmSync(DIST_INDEX, { force: true });
  }
});
