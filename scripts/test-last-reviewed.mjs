/**
 * Issues #955, #956, #957, and #959: these four docs must carry
 * `last-reviewed`. Skill files keep the field inside the opening YAML
 * block. The OpenCode command file must not: current OpenCode decodes
 * command frontmatter with a strict Effect Schema (description, agent,
 * model, subagent, subtask). An unknown key fails the decode and the
 * loader skips the file, so `/opsx-apply` would disappear.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const TRACKED = [
  '.agents/skills/quill-provenance-briefing/SKILL.md',
  '.agents/skills/review-animations/SKILL.md',
  '.agents/skills/review-animations/STANDARDS.md',
  '.opencode/commands/opsx-apply.md',
];

const SKILL_FRONTMATTER = TRACKED.slice(0, 3);

/** Keys OpenCode's command schema accepts in markdown frontmatter. */
const OPENCODE_COMMAND_KEYS = new Set(['description', 'agent', 'model', 'subagent', 'subtask']);

const REVIEWED = /^last-reviewed:\s*(\d{4}-\d{2}-\d{2})\s*$/;

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function openingFrontmatter(content, rel) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  assert.ok(match, `${rel} must open with a YAML frontmatter block`);
  return { yaml: match[1], rest: content.slice(match[0].length) };
}

function topLevelKeys(yaml) {
  return [...yaml.matchAll(/^([A-Za-z0-9_-]+):\s*(.*)$/gm)].map((m) => ({
    key: m[1],
    value: m[2],
  }));
}

function assertIsoDate(value, rel) {
  const match = REVIEWED.exec(value.includes('last-reviewed:') ? value : `last-reviewed: ${value}`);
  assert.ok(match, `${rel} last-reviewed must be YYYY-MM-DD`);
  const [year, month, day] = match[1].split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  assert.equal(date.getUTCFullYear(), year, rel);
  assert.equal(date.getUTCMonth() + 1, month, rel);
  assert.equal(date.getUTCDate(), day, rel);
  return match[1];
}

test('the four docs carry a last-reviewed date', () => {
  for (const rel of TRACKED) {
    const line = read(rel).split(/\r?\n/).find((row) => row.startsWith('last-reviewed:'));
    assert.ok(line, `${rel} is missing last-reviewed`);
    assertIsoDate(line, rel);
  }
});

test('skill and standards files keep last-reviewed inside frontmatter', () => {
  for (const rel of SKILL_FRONTMATTER) {
    const { yaml } = openingFrontmatter(read(rel), rel);
    const row = topLevelKeys(yaml).find((entry) => entry.key === 'last-reviewed');
    assert.ok(row, `${rel} frontmatter is missing last-reviewed`);
    assert.equal(assertIsoDate(`last-reviewed: ${row.value}`, rel), '2026-11-09');
  }
});

test('provenance and animation skills keep the keys their loaders read', () => {
  const provenance = topLevelKeys(openingFrontmatter(read(SKILL_FRONTMATTER[0]), SKILL_FRONTMATTER[0]).yaml)
    .map((entry) => entry.key);
  for (const key of ['name', 'description', 'version', 'platforms', 'metadata']) {
    assert.ok(provenance.includes(key), `provenance skill dropped ${key}`);
  }

  const animation = topLevelKeys(openingFrontmatter(read(SKILL_FRONTMATTER[1]), SKILL_FRONTMATTER[1]).yaml);
  assert.equal(animation.find((entry) => entry.key === 'name')?.value, 'review-animations');
  assert.equal(animation.find((entry) => entry.key === 'disable-model-invocation')?.value, 'true');
});

test('opsx-apply frontmatter stays inside the OpenCode command schema', () => {
  const rel = TRACKED[3];
  const content = read(rel);
  const { yaml, rest } = openingFrontmatter(content, rel);
  const keys = topLevelKeys(yaml);
  assert.deepEqual(keys.map((entry) => entry.key), ['description']);
  assert.equal(keys[0].value, 'Implement tasks from an OpenSpec change (Experimental)');
  for (const entry of keys) {
    assert.ok(OPENCODE_COMMAND_KEYS.has(entry.key), `${entry.key} is not an OpenCode command field`);
  }
  assert.equal(yaml.includes('last-reviewed:'), false);
  const bodyLine = rest.split(/\r?\n/).find((row) => row.startsWith('last-reviewed:'));
  assert.equal(bodyLine, 'last-reviewed: 2026-11-09');
  assert.equal(content.includes('/opsx-continue'), false);
});

test('an unknown command frontmatter key is rejected', () => {
  const keys = topLevelKeys('description: Apply\nlast-reviewed: 2026-11-09\n');
  const unknown = keys.filter((entry) => !OPENCODE_COMMAND_KEYS.has(entry.key));
  assert.deepEqual(unknown.map((entry) => entry.key), ['last-reviewed']);
});
