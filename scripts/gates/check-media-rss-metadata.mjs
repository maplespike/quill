#!/usr/bin/env node
/**
 * Gate: news, media, and NGO RSS must not store or assign feed body text.
 *
 * Fails when an ingester copies description, summary, excerpt, or body into
 * the record it keeps. Pure Node — no build.
 *
 *   node scripts/gates/check-media-rss-metadata.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Assignments that put feed prose on a stored or served record. */
const FORBIDDEN = [
  {
    file: 'packages/pipeline-core/src/ingestion/rss.ts',
    patterns: [
      /contentSnippet\s*=/,
      /item\.content\s*=/,
      /RSS_EXCERPT_MAX/,
    ],
  },
  {
    file: 'packages/pipeline-core/src/ingestion/ngo-influence-rss/fetcher.ts',
    patterns: [
      /summary:\s*desc/,
      /summary:\s*[^/\n]*substring/,
    ],
  },
  {
    file: 'packages/pipeline-core/src/ingestion/media-broadcasting/types.ts',
    patterns: [
      /description\??:\s*string/,
    ],
  },
  {
    file: 'packages/pipeline-core/src/shared/source-policy.ts',
    patterns: [],
    mustInclude: ['projectFeedMetadata'],
  },
];

export function mediaRssMetadataProblems(root = ROOT) {
  const problems = [];
  for (const rule of FORBIDDEN) {
    const text = readFileSync(resolve(root, rule.file), 'utf8');
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        problems.push(`${rule.file} matches ${pattern} — feed body text would be stored again`);
      }
    }
    for (const needle of rule.mustInclude ?? []) {
      if (!text.includes(needle)) {
        problems.push(`${rule.file} no longer contains "${needle}"`);
      }
    }
  }
  const migration = readFileSync(resolve(root, 'packages/database/src/media-rss-migration.ts'), 'utf8');
  for (const name of ['applyMediaRssMetadataSqlite', 'applyMediaRssMetadataPostgres', 'applyMediaRssMetadataD1', 'applyMediaRssMetadataMemory']) {
    if (!migration.includes(`export function ${name}`) && !migration.includes(`export async function ${name}`)) {
      problems.push(`media-rss migration is missing ${name}`);
    }
  }
  return problems;
}

function main() {
  const problems = mediaRssMetadataProblems();
  if (problems.length > 0) {
    console.error('media/NGO RSS metadata gate failed:');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log('media/NGO RSS metadata gate passed');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
