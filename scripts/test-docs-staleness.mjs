import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SKIP_LIST, findStaleDocs, issueForDoc } from './docs-staleness.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const walker = path.join(repoRoot, 'scripts', 'docs-staleness.mjs');
const workflow = path.join(repoRoot, '.github', 'workflows', 'auto-issue-creator.yml');
const today = new Date('2026-11-09T12:00:00Z');

const changesetBody = [
  '---',
  '"@maplespike/quill-mcp": patch',
  '---',
  '',
  'The quill-mcp bin speaks MCP over stdio.',
  '',
].join('\n');

test('the skip list includes .changeset/', () => {
  assert.ok(
    SKIP_LIST.includes('.changeset/'),
    `SKIP_LIST is ${JSON.stringify(SKIP_LIST)}`,
  );
});

test('a sample changeset path produces no issue', () => {
  assert.equal(
    issueForDoc('.changeset/stdio-transport.md', changesetBody, today),
    null,
  );
  assert.equal(
    issueForDoc('.changeset/nix-first-deployment.md', changesetBody, today),
    null,
  );

  const staleChangeset = '---\nlast-reviewed: 2020-01-01\n---\n\nOld note.\n';
  assert.equal(issueForDoc('.changeset/README.md', staleChangeset, today), null);

  const doc = issueForDoc('docs/guide.md', '# Guide\n\nNo metadata.\n', today);
  assert.ok(doc, 'a documentation path with no metadata must still be an issue');
  assert.equal(doc.missing, true);
  assert.equal(doc.file, 'docs/guide.md');
});

test('the walker reports no issue for a sample changeset file on disk', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'docs-staleness-'));
  try {
    mkdirSync(path.join(dir, '.changeset'));
    writeFileSync(path.join(dir, '.changeset', 'stdio-transport.md'), changesetBody);
    writeFileSync(path.join(dir, 'notes.md'), '# Notes\n\nNo metadata.\n');

    const findings = findStaleDocs(dir, today);
    assert.equal(
      findings.some((item) => item.file.split(path.sep).includes('.changeset')),
      false,
    );
    assert.equal(findings.length, 1);
    assert.equal(path.basename(findings[0].file), 'notes.md');
    assert.equal(findings[0].missing, true);

    const cli = spawnSync(process.execPath, [walker, '--json', dir], { encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stderr);
    const fromCli = JSON.parse(cli.stdout);
    assert.equal(
      fromCli.some((item) => String(item.file).split(path.sep).includes('.changeset')),
      false,
    );
    assert.equal(fromCli.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the auto-issue workflow calls the shared walker', () => {
  const text = readFileSync(workflow, 'utf8');
  assert.match(text, /node scripts\/docs-staleness\.mjs --json/);
  assert.doesNotMatch(text, /function walkDir/);
});
