/**
 * Suite-coverage guard for the test globs themselves.
 *
 * Why: this lane has shipped a test glob that did not match the whole suite
 * twice, and both times nothing failed:
 *
 *   - the unquoted double-star glob was expanded by `sh` to a one-level glob
 *     before `tsx` saw it, so root-level test files silently dropped out
 *     (fixed by quoting the globs, 3e911a5);
 *   - quill-mcp's `test:unit` reported 79 tests instead of 820 for weeks
 *     (scripts/check-coverage-floor.sh, 2026-09-22).
 *
 * A shrinking suite is invisible: the remaining tests still pass, so the CI
 * step stays green. Nothing in the repo binds the invariant that the declared
 * globs cover every `*.test.ts` under `src/`. This test does, and it fails with
 * the list of files that would never run.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(PKG, 'src');

/** Scripts that are expected to run every test file under `src/`. */
const WHOLE_SRC_SUITES = ['test', 'test:unit', 'test:coverage'];

/** Every `*.test.ts` under `src/`, as `/`-separated paths relative to `src/`. */
function testFiles(dir: string = SRC, base: string = SRC): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      out.push(...testFiles(full, base));
    } else if (entry.name.endsWith('.test.ts')) {
      out.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return out;
}

/**
 * Translate the subset of shell glob syntax the test scripts use into a regexp.
 * A double-star followed by a slash spans zero or more directories (the shell
 * needs `globstar` for that; `tsx` applies it unconditionally), and a single
 * star stays inside one path segment.
 */
function globToRegExp(glob: string): RegExp {
  const body = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\u0000')
    .replace(/\*\*/g, '\u0001')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0000/g, '(?:[^/]+/)*')
    .replace(/\u0001/g, '.*');
  return new RegExp(`^${body}$`);
}

/** Test globs declared by a script, with the quoting the shell sees. */
function declaredGlobs(script: string): Array<{ glob: string; quoted: boolean }> {
  const out: Array<{ glob: string; quoted: boolean }> = [];
  for (const m of script.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) {
    const quoted = m[1] !== undefined || m[2] !== undefined;
    const glob = (m[1] ?? m[2] ?? m[3]) as string;
    if (glob.endsWith('.test.ts')) out.push({ glob, quoted });
  }
  return out;
}

/** Every way one declared suite fails to cover `files`. */
function coverageProblems(name: string, script: string | undefined, files: string[]): string[] {
  if (!script) return [`${name}: script missing from package.json`];
  const globs = declaredGlobs(script);
  if (globs.length === 0) return [`${name}: declares no test glob`];
  const problems: string[] = [];
  for (const { glob, quoted } of globs) {
    if (!quoted) {
      problems.push(`${name}: '${glob}' is unquoted — sh expands '**' to one level before tsx sees it`);
    }
  }
  const matchers = globs.map(({ glob }) => globToRegExp(glob));
  const missed = files.filter((file) => !matchers.some((re) => re.test(file)));
  if (missed.length > 0) {
    problems.push(`${name}: ${missed.length} test file(s) would never run — ${missed.join(', ')}`);
  }
  return problems;
}

test('globToRegExp matches the paths the shell glob would', () => {
  const recursive = globToRegExp('src/**/*.test.ts');
  assert.equal(recursive.test('src/a.test.ts'), true, 'a double-star may span zero directories');
  assert.equal(recursive.test('src/__tests__/a.test.ts'), true, 'a double-star may span one directory');
  assert.equal(recursive.test('src/a/b/c.test.ts'), false, 'the pattern is anchored and extension-bound');
  const shallow = globToRegExp('src/*.test.ts');
  assert.equal(shallow.test('src/a.test.ts'), true);
  assert.equal(shallow.test('src/__tests__/a.test.ts'), false, 'a single star must not cross a directory');
  assert.equal(globToRegExp('src/a?.test.ts').test('src/ab.test.ts'), true);
});

test('declaredGlobs reports the quoting the shell sees', () => {
  const globs = declaredGlobs(`ENV=1 tsx --test "src/**/*.test.ts" 'src/*.test.ts' src/legacy/*.test.ts`);
  assert.deepEqual(globs, [
    { glob: 'src/**/*.test.ts', quoted: true },
    { glob: 'src/*.test.ts', quoted: true },
    { glob: 'src/legacy/*.test.ts', quoted: false },
  ]);
});

test('coverageProblems flags a narrow glob, an unquoted glob, and a missing script', () => {
  const files = ['a.test.ts', '__tests__/b.test.ts'];
  assert.deepEqual(coverageProblems('test:unit', `tsx --test 'src/**/*.test.ts'`, files), []);
  assert.deepEqual(coverageProblems('test:unit', `tsx --test 'src/*.test.ts'`, files), [
    'test:unit: 1 test file(s) would never run — __tests__/b.test.ts',
  ]);
  assert.deepEqual(coverageProblems('test:unit', `tsx --test src/**/*.test.ts`, files), [
    `test:unit: 'src/**/*.test.ts' is unquoted — sh expands '**' to one level before tsx sees it`,
  ]);
  assert.deepEqual(coverageProblems('test:unit', undefined, files), [
    'test:unit: script missing from package.json',
  ]);
  assert.deepEqual(coverageProblems('test:unit', 'tsx --test', files), [
    'test:unit: declares no test glob',
  ]);
});

test('every whole-src suite runs every test file in src', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  const files = testFiles();
  assert.ok(files.length >= 20, `expected to find the suite under src/, found ${files.length} file(s)`);

  const problems = WHOLE_SRC_SUITES.flatMap((name) => coverageProblems(name, pkg.scripts[name], files));
  assert.deepEqual(problems, [], `declared test globs do not cover the suite:\n${problems.join('\n')}`);
});
