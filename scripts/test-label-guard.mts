#!/usr/bin/env tsx
/**
 * Label guard.
 *
 * `.github/workflows/label-guard.yml` alerts when `ready-to-merge` is removed
 * from an open pull request. It does not put the label back, it does not
 * check out pull-request code, and its token is the workflow GITHUB_TOKEN
 * with issues: write and pull-requests: read.
 *
 * The checks parse the workflow file. They do not call GitHub.
 *
 * Runs as `tsx --test` via `pnpm run test:label-guard` (part of `pnpm test`)
 * and as a CI step in .github/workflows/ci.yml.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = path.join(REPO, '.github/workflows/label-guard.yml');

type Violation = { code: string; message: string };

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

function topBlock(text: string, key: string): string {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line === `${key}:`);
  if (start < 0) return '';
  const buf: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    if (!/^[ \t]/.test(line)) break;
    buf.push(line.trim());
  }
  return buf.join('\n');
}

function jobIf(text: string): string {
  const lines = text.split('\n');
  let inJobs = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^jobs:\s*$/.test(lines[i])) inJobs = true;
    if (!inJobs) continue;
    if (/^[ \t]+steps:\s*$/.test(lines[i])) break;
    const match = lines[i].match(/^([ \t]+)if:\s*(.*)$/);
    if (!match) continue;
    const indent = match[1].length;
    const rest = match[2].trim();
    if (rest && rest !== '>-' && rest !== '>' && rest !== '|' && rest !== '|-') return rest;
    const buf: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === '') continue;
      if (indentOf(line) <= indent) break;
      buf.push(line.trim());
    }
    return buf.join('\n');
  }
  return '';
}

function runBodies(text: string): string[] {
  const lines = text.split('\n');
  const bodies: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const block = lines[i].match(/^(\s*)run:\s*\|\s*$/);
    if (block) {
      const indent = block[1].length;
      const buf: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j];
        if (line.trim() === '') {
          buf.push(line);
          continue;
        }
        if (indentOf(line) <= indent) break;
        buf.push(line);
      }
      bodies.push(buf.join('\n'));
      continue;
    }
    const one = lines[i].match(/^\s*run:\s*([^|>].*)$/);
    if (one) bodies.push(one[1]);
  }
  return bodies;
}

function assess(text: string): Violation[] {
  const violations: Violation[] = [];
  const trigger = topBlock(text, 'on');
  const guard = jobIf(text);
  const perms = topBlock(text, 'permissions');
  const runs = runBodies(text).join('\n');

  if (!/pull_request_target:/.test(trigger) || !/types:\s*\[unlabeled\]/.test(trigger)) {
    violations.push({
      code: 'trigger',
      message: 'trigger must be pull_request_target types: [unlabeled]',
    });
  }
  if (!/github\.event\.label\.name == 'ready-to-merge'/.test(guard)) {
    violations.push({
      code: 'trigger',
      message: 'job must run only when the removed label is ready-to-merge',
    });
  }

  if (/--add-label|labels\[\]=|\/labels|gh\s+pr\s+edit/.test(runs)) {
    violations.push({
      code: 'pr-label',
      message: 'no step may add or remove a label on the pull request',
    });
  }
  if (/create-github-app-token|MERGE_GATE_APP/.test(text)) {
    violations.push({
      code: 'pr-label',
      message: 'the workflow must not mint the merge-gate App token',
    });
  }

  if (/actions\/checkout/.test(text) || /git\s+checkout/.test(text) || /git\s+clone/.test(text)) {
    violations.push({ code: 'checkout', message: 'do not check out the pull request head' });
  }

  const permLines = perms.split('\n').map((line) => line.trim()).filter((line) => line.includes(':'));
  const expectedPerms = ['issues: write', 'pull-requests: read'];
  if (permLines.length !== expectedPerms.length || expectedPerms.some((line) => !permLines.includes(line))) {
    violations.push({
      code: 'permissions',
      message: 'permissions must be only issues: write and pull-requests: read',
    });
  }

  if (/\$\{\{/.test(runs)) {
    violations.push({
      code: 'injection',
      message: 'pass event fields through env, not ${{ }} inside run scripts',
    });
  }

  return violations;
}

const source = fs.readFileSync(WORKFLOW, 'utf8');

test('trigger is unlabeled and the removed label is ready-to-merge', () => {
  const trigger = topBlock(source, 'on');
  const guard = jobIf(source);
  assert.match(trigger, /pull_request_target:/);
  assert.match(trigger, /types:\s*\[unlabeled\]/);
  assert.match(guard, /github\.event\.label\.name == 'ready-to-merge'/);
  assert.match(guard, /github\.event\.pull_request\.state == 'open'/);
  assert.match(guard, /github\.event\.pull_request\.merged == false/);
  assert.deepEqual(
    assess(source).filter((v) => v.code === 'trigger'),
    [],
  );
});

test('no step adds a label to the pull request', () => {
  const runs = runBodies(source).join('\n');
  assert.doesNotMatch(runs, /--add-label/);
  assert.doesNotMatch(runs, /labels\[\]=/);
  assert.doesNotMatch(runs, /\/labels/);
  assert.doesNotMatch(runs, /gh\s+pr\s+edit/);
  assert.doesNotMatch(source, /create-github-app-token/);
  assert.doesNotMatch(source, /MERGE_GATE_APP/);
  assert.deepEqual(
    assess(source).filter((v) => v.code === 'pr-label'),
    [],
  );
});

test('the workflow does not check out the pull request head', () => {
  assert.doesNotMatch(source, /actions\/checkout/);
  assert.doesNotMatch(source, /git\s+checkout/);
  assert.doesNotMatch(source, /git\s+clone/);
  assert.deepEqual(
    assess(source).filter((v) => v.code === 'checkout'),
    [],
  );
});

test('permissions are issues: write and pull-requests: read', () => {
  const perms = topBlock(source, 'permissions');
  assert.match(perms, /^issues:\s*write$/m);
  assert.match(perms, /^pull-requests:\s*read$/m);
  assert.deepEqual(
    perms.split('\n').filter((line) => line.includes(':')).sort(),
    ['issues: write', 'pull-requests: read'],
  );
  assert.match(source, /GH_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/);
  assert.deepEqual(
    assess(source).filter((v) => v.code === 'permissions'),
    [],
  );
});

test('event fields are passed through env vars', () => {
  const runs = runBodies(source).join('\n');
  assert.doesNotMatch(runs, /\$\{\{/);
  assert.match(source, /SENDER:\s*\$\{\{\s*github\.event\.sender\.login\s*\}\}/);
  assert.match(source, /REMOVED_AT:\s*\$\{\{\s*github\.event\.pull_request\.updated_at\s*\}\}/);
  assert.match(source, /PR_NUMBER:\s*\$\{\{\s*github\.event\.pull_request\.number\s*\}\}/);
  assert.match(source, /PR_URL:\s*\$\{\{\s*github\.event\.pull_request\.html_url\s*\}\}/);
  assert.match(source, /RUN_URL:\s*\$\{\{/);
  assert.deepEqual(
    assess(source).filter((v) => v.code === 'injection'),
    [],
  );
});

test('the real workflow satisfies the whole contract', () => {
  assert.deepEqual(assess(source), []);
});
