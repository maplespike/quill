/**
 * OSS export gate: internal hosts and machine paths must not live in
 * non-test source of the packages that ship in the public tree.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGES = ['api-server', 'quill-mcp', 'pipeline-core', 'database', 'engine'];
const NEEDLES = ['nexus:', '/home/j_kro', '/data/projects'];
const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.mts']);

const packagesRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..', '..');

function isSkipped(rel: string): boolean {
  const parts = rel.split(sep);
  if (parts.includes('node_modules') || parts.includes('dist') || parts.includes('coverage')) return true;
  if (parts.includes('__tests__') || parts.includes('__integration__')) return true;
  const base = parts[parts.length - 1] ?? '';
  return base.includes('.test.') || base.includes('.spec.');
}

function walk(dir: string, hits: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const rel = relative(packagesRoot, full);
    if (isSkipped(rel)) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, hits);
      continue;
    }
    const dot = name.lastIndexOf('.');
    if (dot < 0 || !SOURCE_EXT.has(name.slice(dot))) continue;
    const text = readFileSync(full, 'utf8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const needle of NEEDLES) {
        if (lines[i].includes(needle)) {
          hits.push(`${rel}:${i + 1}: ${needle}`);
        }
      }
    }
  }
}

test('non-test source has no internal host or machine path', () => {
  const hits: string[] = [];
  for (const name of PACKAGES) walk(join(packagesRoot, name), hits);
  assert.deepEqual(hits, [], hits.join('\n'));
});
