#!/usr/bin/env tsx
/**
 * Doc-link walker for the Quill monorepo.
 *
 * Scans every `.md` file under the repository root (excluding noise dirs),
 * parses every Markdown link of the form `](relative/path)`, and asserts
 * that the resolved path exists on disk.
 *
 * Runs as a `tsx --test` suite so a single `pnpm run test:docs` keeps the
 * Markdown cross-references honest as the repo evolves.
 *
 * Excluded directories (non-authoritative noise):
 *   - node_modules, .git, dist, build, .astro, .next
 *   - .sisyphus, .hermes, .orchestration, coverage
 *   - .claude, .opencode, .hbs, .changeset
 *
 * Excluded link targets (don't false-fail on cross-repo references):
 *   - Anything starting with http://, https://, mailto:, ftp://
 *   - Anything whose resolved path escapes the repo root (e.g., ../sister-project/)
 *   - Pure anchors (`#section-name`)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.astro',
  '.next',
  '.sisyphus',
  '.hermes',
  '.orchestration',
  'coverage',
  '.claude',
  '.opencode',
  '.changeset',
  '.turbo',
  '.wrangler',
  '__snapshots__',
]);

const LINK_RE = /\]\(([^)\s]+)\)/g;

interface MarkdownFile {
  absPath: string;
  relPath: string;
  content: string;
}

function isExcludedDir(name: string): boolean {
  return EXCLUDE_DIRS.has(name) || name.startsWith('.cache');
}

function findMarkdownFiles(root: string): MarkdownFile[] {
  const out: MarkdownFile[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue; // permission errors etc
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!isExcludedDir(e.name)) stack.push(full);
      } else if (e.isFile() && e.name.endsWith('.md')) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          out.push({ absPath: full, relPath: path.relative(root, full), content });
        } catch {
          // unreadable, skip
        }
      }
    }
  }
  return out;
}

function isExternalRef(target: string): boolean {
  return /^(https?:|mailto:|ftp:|tel:|#)/i.test(target);
}

function isOutsideRepo(p: string): boolean {
  const norm = path.normalize(p);
  return norm.startsWith('..') || !p.startsWith(ROOT);
}

const files = findMarkdownFiles(ROOT);
let totalLinksChecked = 0;
const broken: { file: string; target: string; resolved: string }[] = [];

for (const f of files) {
  link_check_loop: for (const m of f.content.matchAll(LINK_RE)) {
    const raw = m[1].trim();
    // strip #fragment and ?query
    const target = raw.split('#')[0].split('?')[0];
    if (!target) continue;
    if (isExternalRef(raw)) continue;
    // resolve relative to the .md file's directory
    const resolved = path.resolve(path.dirname(f.absPath), target);
    if (isOutsideRepo(resolved)) continue; // cross-repo references are not our problem
    totalLinksChecked++;
    // Try several common resolutions: the literal target, target.md (the most
    // common Markdown convention), target/index.md (a folder with an index.md),
    // and target.html (the portal build emits .html siblings for many .md).
    const candidates = [
      resolved,
      `${resolved}.md`,
      `${resolved}/index.md`,
      `${resolved}.html`,
    ];
    const exists = candidates.some((c) => fs.existsSync(c));
    if (!exists) {
      broken.push({ file: f.relPath, target: raw, resolved: path.relative(ROOT, resolved) });
    }
  }
}

test('doc-links: scan completes', () => {
  // Sanity assertion — if this fails the walker itself is broken, not the docs
  assert.ok(files.length > 0, 'expected to scan at least one .md file');
});

test(`doc-links: all ${totalLinksChecked} relative .md links resolve`, () => {
  if (broken.length === 0) {
    assert.ok(true, `scanned ${files.length} files, ${totalLinksChecked} links, 0 broken`);
    return;
  }
  // Build a friendly failure message with up to 30 broken samples
  const sample = broken
    .slice(0, 30)
    .map((b) => `  ${b.file} → ${b.target}   (resolved: ${b.resolved})`)
    .join('\n');
  const more = broken.length > 30 ? `\n  …and ${broken.length - 30} more.` : '';
  assert.fail(
    `Found ${broken.length} broken internal .md link(s) across ${files.length} files:\n${sample}${more}`,
  );
});

/**
 * Regression: the security policy must name the canonical repository.
 *
 * QUILL-AUDIT.md (2026-10-24, P1): SECURITY.md sent vulnerability reports to
 * `github.com/reverb256/quill`, the pre-move repository. A reporter following
 * the policy would open a private issue where the maintainers no longer work.
 * Guard the reporting URL, not the whole file: historical `reverb256` links in
 * CHANGELOG entries are evidence of past issue numbers and stay as written.
 */
test('doc-links: SECURITY.md reporting target is maplespike/quill', () => {
  const security = fs.readFileSync(path.join(ROOT, 'SECURITY.md'), 'utf8');
  const urls = [...security.matchAll(/https?:\/\/github\.com\/[^\s)>\]]+/g)].map((m) => m[0]);
  assert.ok(urls.length > 0, 'SECURITY.md must name a GitHub reporting target');
  for (const url of urls) {
    assert.doesNotMatch(
      url,
      /github\.com\/reverb256\/quill/i,
      `SECURITY.md points at the retired repository: ${url}`,
    );
    assert.match(url, /github\.com\/maplespike\/quill/i, `unexpected repository: ${url}`);
  }
  assert.match(security, /security@maplespike\.ca/, 'SECURITY.md must carry a security mailbox');
});
