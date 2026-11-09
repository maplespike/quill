#!/usr/bin/env tsx
/**
 * Label guard.
 *
 * `.github/workflows/label-guard.yml` leaves `ready-to-merge` off when the
 * owner account `reverb256`, the fleet-merge-gate App, or the
 * merge-when-green workflow removes it. It puts the label back only when
 * some other Bot removes it.
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

/** The job-level condition. Removing it is the hold-exemption fixture. */
const HOLD_EXEMPTION = "!contains(github.event.pull_request.labels.*.name, 'hold')";

const APP_LOGIN = 'fleet-merge-gate[bot]';

type Violation = { code: string; message: string };

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/** The `on:` block, stopped at the next top-level key. */
function triggerBlock(text: string): string {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line === 'on:');
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

/** The job `if:` before `steps:`. Step `if:` values are not this condition. */
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

/** Bodies of `run:` steps. `env:` expressions are not script text. */
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

function stepBlock(text: string, nameIncludes: string): string {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/name:/.test(lines[i]) || !lines[i].includes(nameIncludes)) continue;
    const indent = indentOf(lines[i]);
    const buf = [lines[i]];
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === '') {
        buf.push(line);
        continue;
      }
      if (indentOf(line) <= indent && /^\s*-\s+/.test(line)) break;
      buf.push(line);
    }
    return buf.join('\n');
  }
  return '';
}

function assess(text: string): Violation[] {
  const violations: Violation[] = [];
  const trigger = triggerBlock(text);
  const guard = jobIf(text);
  const runs = runBodies(text).join('\n');
  const restore = stepBlock(text, 'Restore the label');
  const mint = stepBlock(text, 'Mint merge-gate app token');

  if (!/pull_request_target:/.test(trigger) || !/types:\s*\[unlabeled\]/.test(trigger)) {
    violations.push({
      code: 'trigger',
      message: 'trigger must be pull_request_target types: [unlabeled]',
    });
  }
  if (/types:\s*\[[^\]]*\]/.test(trigger) && !/types:\s*\[unlabeled\]/.test(trigger)) {
    violations.push({ code: 'trigger', message: 'unlabeled must be the only unlabeled-event type' });
  }
  if (/\btypes:\s*\[[^\]]*\blabeled\b/.test(trigger) || /\bpull_request:\s*$/m.test(trigger)) {
    violations.push({ code: 'trigger', message: 'trigger must not widen past unlabeled' });
  }

  if (!/github\.event\.label\.name == 'ready-to-merge'/.test(guard)) {
    violations.push({
      code: 'ready-to-merge',
      message: 'job must run only when the removed label is ready-to-merge',
    });
  }
  if (!/github\.event\.pull_request\.state == 'open'/.test(guard)) {
    violations.push({
      code: 'open',
      message: 'job must run only when the pull request is open',
    });
  }
  if (!guard.includes(HOLD_EXEMPTION)) {
    violations.push({
      code: 'hold',
      message: 'job must not run when the pull request carries hold',
    });
  }

  const logins = text.match(/fleet-merge-gate\[bot\]/g) ?? [];
  if (logins.length !== 1 || !new RegExp(`ALLOWED_APP_LOGIN:\\s*${APP_LOGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(text)) {
    violations.push({
      code: 'allowed-sender',
      message: 'the App login must be the single ALLOWED_APP_LOGIN variable',
    });
  }
  if (!/\[\[\s*"\$SENDER"\s*==\s*"\$ALLOWED_APP_LOGIN"\s*\]\]/.test(text)) {
    violations.push({
      code: 'allowed-sender',
      message: 'the sender must be compared to ALLOWED_APP_LOGIN',
    });
  }
  if (!/merge-when-green\.yml/.test(text) || !/github-actions\[bot\]/.test(text)) {
    violations.push({
      code: 'allowed-sender',
      message: 'the merge-when-green workflow must be an allowed remover while it merges',
    });
  }
  if (!/\[\[\s*"\$SENDER"\s*==\s*"reverb256"\s*\]\]/.test(text)) {
    violations.push({
      code: 'allowed-sender',
      message: 'reverb256 must be exempt',
    });
  }
  if (!/\[\[\s*"\$SENDER_TYPE"\s*!=\s*"Bot"\s*\]\]/.test(text)) {
    violations.push({
      code: 'allowed-sender',
      message: 'restore only when sender.type is Bot and the remover is not an allowed sender',
    });
  }

  if (!/uses:\s*actions\/create-github-app-token@/.test(mint)) {
    violations.push({ code: 'app-token', message: 'mint the token with actions/create-github-app-token' });
  }
  if (!/app-id:\s*\$\{\{\s*vars\.MERGE_GATE_APP_ID\s*\}\}/.test(mint)) {
    violations.push({ code: 'app-token', message: 'app id must be vars.MERGE_GATE_APP_ID' });
  }
  if (!/private-key:\s*\$\{\{\s*secrets\.MERGE_GATE_APP_PRIVATE_KEY\s*\}\}/.test(mint)) {
    violations.push({ code: 'app-token', message: 'private key must be secrets.MERGE_GATE_APP_PRIVATE_KEY' });
  }
  if (!/if:\s*steps\.decide\.outputs\.restore == 'true'/.test(mint)) {
    violations.push({ code: 'app-token', message: 'mint the App token only when the remover is not allowed' });
  }
  if (!/GH_TOKEN:\s*\$\{\{\s*steps\.gate\.outputs\.token\s*\}\}/.test(restore)) {
    violations.push({ code: 'app-token', message: 'the restore step token must be the App token' });
  }
  if (/github\.token|secrets\.GITHUB_TOKEN/.test(restore) || /steps\.gate\.outputs\.token\s*\|\|/.test(text)) {
    violations.push({
      code: 'app-token',
      message: 'the restore path must not use GITHUB_TOKEN',
    });
  }

  if (/actions\/checkout/.test(text) || /git\s+checkout/.test(text) || /git\s+clone/.test(text)) {
    violations.push({ code: 'checkout', message: 'do not check out the pull request head' });
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

test('trigger is pull_request_target unlabeled only', () => {
  const violations = assess(source).filter((v) => v.code === 'trigger');
  assert.deepEqual(violations, []);
  assert.match(triggerBlock(source), /types:\s*\[unlabeled\]/);
});

test('job runs only for an open pull request that lost ready-to-merge', () => {
  const guard = jobIf(source);
  assert.match(guard, /github\.event\.label\.name == 'ready-to-merge'/);
  assert.match(guard, /github\.event\.pull_request\.state == 'open'/);
  assert.deepEqual(
    assess(source).filter((v) => v.code === 'ready-to-merge' || v.code === 'open'),
    [],
  );
});

test('hold on the pull request exempts it from the guard', () => {
  assert.ok(jobIf(source).includes(HOLD_EXEMPTION));
  assert.deepEqual(
    assess(source).filter((v) => v.code === 'hold'),
    [],
  );
});

test('fixture: removing the hold exemption makes the check fail', () => {
  const fixture = source.replace(HOLD_EXEMPTION, '');
  assert.notEqual(fixture, source, 'the fixture must delete the hold exemption');
  assert.equal(jobIf(fixture).includes(HOLD_EXEMPTION), false);
  const violations = assess(fixture).filter((v) => v.code === 'hold');
  assert.equal(violations.length, 1);
  assert.match(violations[0].message, /hold/);
  // The rest of the contract still holds, so this failure is the exemption.
  const others = assess(fixture).filter((v) => v.code !== 'hold');
  assert.deepEqual(others, []);
});

test('reverb256 and the gate App are exempt; other bots are not', () => {
  assert.equal((source.match(/fleet-merge-gate\[bot\]/g) ?? []).length, 1);
  assert.match(source, /ALLOWED_APP_LOGIN:\s*fleet-merge-gate\[bot\]/);
  assert.match(source, /\[\[\s*"\$SENDER"\s*==\s*"\$ALLOWED_APP_LOGIN"\s*\]\]/);
  assert.match(source, /\[\[\s*"\$SENDER"\s*==\s*"reverb256"\s*\]\]/);
  assert.match(source, /\[\[\s*"\$SENDER_TYPE"\s*!=\s*"Bot"\s*\]\]/);
  assert.match(source, /merge-when-green\.yml/);
  assert.match(source, /github-actions\[bot\]/);
  assert.deepEqual(
    assess(source).filter((v) => v.code === 'allowed-sender'),
    [],
  );
});

test('the restore token is the fleet-merge-gate App, not GITHUB_TOKEN', () => {
  const restore = stepBlock(source, 'Restore the label');
  const mint = stepBlock(source, 'Mint merge-gate app token');
  assert.match(mint, /uses:\s*actions\/create-github-app-token@v1/);
  assert.match(mint, /app-id:\s*\$\{\{\s*vars\.MERGE_GATE_APP_ID\s*\}\}/);
  assert.match(mint, /private-key:\s*\$\{\{\s*secrets\.MERGE_GATE_APP_PRIVATE_KEY\s*\}\}/);
  assert.match(mint, /if:\s*steps\.decide\.outputs\.restore == 'true'/);
  assert.match(restore, /GH_TOKEN:\s*\$\{\{\s*steps\.gate\.outputs\.token\s*\}\}/);
  assert.doesNotMatch(restore, /github\.token|secrets\.GITHUB_TOKEN/);
  assert.doesNotMatch(source, /steps\.gate\.outputs\.token\s*\|\|/);
  assert.deepEqual(
    assess(source).filter((v) => v.code === 'app-token'),
    [],
  );
});

test('the workflow does not check out the pull request head', () => {
  assert.doesNotMatch(source, /actions\/checkout/);
  assert.doesNotMatch(source, /git\s+checkout/);
  assert.doesNotMatch(source, /git\s+clone/);
  const runs = runBodies(source).join('\n');
  assert.doesNotMatch(runs, /\$\{\{/);
  assert.deepEqual(
    assess(source).filter((v) => v.code === 'checkout' || v.code === 'injection'),
    [],
  );
});

test('the real workflow satisfies the whole contract', () => {
  assert.deepEqual(assess(source), []);
});
