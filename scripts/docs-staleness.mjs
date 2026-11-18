#!/usr/bin/env node
// Docs-staleness walker for .github/workflows/auto-issue-creator.yml.
//
// The Monday docs-maintenance job files a review issue for every Markdown
// file that lacks `last-reviewed`, or whose date is older than 30 days.
// Changeset entries under `.changeset/` are transient release notes. They
// are deleted when the release PR lands. They are not documentation, and
// the walker must not file issues against them (#958, #1118).
//
// `node_modules` and `.git` keep the original prefix match. A directory
// whose name starts with `.git` (including `.github`) was already skipped
// by that check.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Path prefixes the walker does not enter. Each entry ends with `/`. */
export const SKIP_LIST = [
  'node_modules/',
  '.git/',
  '.changeset/',
];

const STALE_AFTER_DAYS = 30;

function prefixDir(prefix) {
  return prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
}

/** True when `name` is a directory the walker must not enter. */
export function isSkippedDirName(name) {
  return SKIP_LIST.some((prefix) => name.startsWith(prefixDir(prefix)));
}

/**
 * True when `filePath` sits under a skipped directory.
 * The file's own name is not compared, so a root `notes.md` is still reviewed.
 */
export function isSkippedPath(filePath) {
  const normalized = String(filePath).replace(/\\/g, '/').replace(/^\.\//, '');
  const parts = normalized.split('/').filter((part) => part !== '' && part !== '.');
  return parts.slice(0, -1).some((part) => isSkippedDirName(part));
}

/**
 * Issue payload for one Markdown file, or null when the file is not an issue.
 * @param {string} file
 * @param {string} content
 * @param {Date} [today]
 * @returns {{file: string, missing?: true, daysSinceReview: number, lastReviewed?: string} | null}
 */
export function issueForDoc(file, content, today = new Date()) {
  if (isSkippedPath(file)) return null;

  const lastReviewedMatch = content.match(/^last-reviewed:\s*(\d{4}-\d{2}-\d{2})/m);
  if (lastReviewedMatch) {
    const reviewedDate = new Date(lastReviewedMatch[1]);
    const diffDays = Math.floor((today - reviewedDate) / (1000 * 60 * 60 * 24));
    if (diffDays > STALE_AFTER_DAYS) {
      return { file, daysSinceReview: diffDays, lastReviewed: lastReviewedMatch[1] };
    }
    return null;
  }

  if (file.includes('node_modules') || file.includes('LICENSE.md')) return null;
  if (file.endsWith('README.md')) return null;
  return { file, missing: true, daysSinceReview: -1 };
}

/** Markdown files under `root`, skipping every directory in `SKIP_LIST`. */
export function walkMarkdownFiles(root) {
  const files = [];

  function walkDir(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!isSkippedDirName(entry.name)) walkDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md') && !isSkippedPath(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  walkDir(root);
  return files;
}

/** Stale or missing-metadata findings, in walk order. */
export function findStaleDocs(root = '.', today = new Date()) {
  const issues = [];
  for (const file of walkMarkdownFiles(root)) {
    const content = fs.readFileSync(file, 'utf8');
    const issue = issueForDoc(file, content, today);
    if (issue) issues.push(issue);
  }
  return issues;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  return {
    json: args.includes('--json'),
    root: args.find((arg) => arg !== '--json') || '.',
  };
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (invokedDirectly()) {
  const { json, root } = parseArgs(process.argv);
  const findings = findStaleDocs(root);
  if (json) {
    process.stdout.write(`${JSON.stringify(findings)}\n`);
  } else {
    for (const item of findings) {
      const label = item.missing ? 'missing' : `stale ${item.daysSinceReview}d`;
      process.stdout.write(`${label}\t${item.file}\n`);
    }
  }
}
