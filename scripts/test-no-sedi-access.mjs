import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SEDI_HOST, hostReferences, scheduleKeys, findViolations } from './gates/check-no-sedi-access.mjs';

test('host scan flags a fetch URL and allows the licence inventory', () => {
  const root = mkdtempSync(join(tmpdir(), 'sedi-gate-'));
  try {
    mkdirSync(join(root, 'packages'), { recursive: true });
    writeFileSync(join(root, 'packages', 'probe.ts'), `healthCheckUrl: 'https://www.${SEDI_HOST}'\n`);
    writeFileSync(join(root, 'data-source-licenses.json'), `{ "source_terms": "https://www.${SEDI_HOST}/" }\n`);
    writeFileSync(join(root, 'DATA-LICENSES.md'), `| sedi | https://www.${SEDI_HOST}/ |\n`);
    const hits = hostReferences(root);
    assert.deepEqual(hits, [`packages/probe.ts:1 references ${SEDI_HOST}`]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('schedule key parser ignores comments', () => {
  const text = `
ingestion:
  schedules:
    corporate: "0 2 * * *"
    # sedi: "0 3 * * *"
    gazette: "0 */12 * * *"
  resources:
    requests:
      cpu: 50m
`;
  assert.deepEqual(scheduleKeys(text), ['corporate', 'gazette']);
});

test('the repository has no SEDI module, tool, route, or fetch', () => {
  const problems = findViolations(new URL('..', import.meta.url).pathname);
  assert.deepEqual(problems, [], problems.join('\n'));
});
