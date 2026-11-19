import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  DEFAULT_SKILL_REVIEW_FILES,
  checkSkillReviewFiles,
  reviewAgeDays,
} from './gates/check-skill-review-freshness.mjs';

const gate = 'scripts/gates/check-skill-review-freshness.mjs';

function run(args, env = {}) {
  return spawnSync(process.execPath, [gate, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function withFile(body, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'skill-review-'));
  const file = join(dir, 'SKILL.md');
  try {
    writeFileSync(file, body);
    fn(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('the five flagged skill docs are the default set', () => {
  assert.deepEqual(DEFAULT_SKILL_REVIEW_FILES, [
    '.agents/skills/animation-vocabulary/SKILL.md',
    '.agents/skills/apple-design/SKILL.md',
    '.agents/skills/emil-design-eng/SKILL.md',
    '.agents/skills/quill-influence-mapping/SKILL.md',
    '.agents/skills/quill-influence-mapping/references/tools.md',
  ]);
});

test('flagged skill docs have a last-reviewed date within 30 days', () => {
  const failures = checkSkillReviewFiles(DEFAULT_SKILL_REVIEW_FILES);
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('age is whole UTC days and 30 is still fresh', () => {
  assert.equal(reviewAgeDays('2026-10-10', '2026-11-09'), 30);
  assert.equal(reviewAgeDays('2026-10-09', '2026-11-09'), 31);
  assert.equal(reviewAgeDays('2026-11-09', '2026-11-09'), 0);
});

test('a date 30 days old passes', () => {
  withFile('---\nlast-reviewed: 2026-10-10\n---\n', (file) => {
    const result = run([file], { SKILL_REVIEW_AS_OF: '2026-11-09' });
    assert.equal(result.status, 0, result.stderr);
  });
});

test('a date 31 days old fails', () => {
  withFile('---\nlast-reviewed: 2026-10-09\n---\n', (file) => {
    const result = run([file], { SKILL_REVIEW_AS_OF: '2026-11-09' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /31 days before 2026-11-09/);
  });
});

test('a missing last-reviewed date fails', () => {
  withFile('---\ntitle: tools\n---\n', (file) => {
    const result = run([file], { SKILL_REVIEW_AS_OF: '2026-11-09' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing last-reviewed date/);
  });
});

test('a future date fails', () => {
  withFile('---\nlast-reviewed: 2026-11-10\n---\n', (file) => {
    const result = run([file], { SKILL_REVIEW_AS_OF: '2026-11-09' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /is after 2026-11-09/);
  });
});

test('an impossible calendar date fails', () => {
  withFile('---\nlast-reviewed: 2026-02-31\n---\n', (file) => {
    const result = run([file], { SKILL_REVIEW_AS_OF: '2026-11-09' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /not a calendar date/);
  });
});
