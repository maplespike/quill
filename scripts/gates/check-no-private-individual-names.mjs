#!/usr/bin/env node
/**
 * Gate: private-individual name fields must not return in schema or output.
 *
 * SEDI files are excluded. That source is being removed on another branch.
 *
 *   node scripts/gates/check-no-private-individual-names.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const FORBIDDEN = /\b(donorName|donor_name|donorPersonId|donor_person_id)\b/;

/** Files that define schema or served donation output. */
const SCAN = [
  'packages/database/src/schema.ts',
  'packages/database/src/connection.ts',
  'packages/database/src/migrate-pg.ts',
  'packages/engine/src/types/donation.ts',
  'packages/engine/src/schemas/donation.ts',
  'packages/pipeline-core/src/ingestion/political-donations/types.ts',
  'packages/pipeline-core/src/ingestion/political-donations/parser.ts',
  'packages/pipeline-core/src/shared-db.ts',
  'packages/quill-mcp/src/tools/political-donations.ts',
];

const REQUIRED = [
  ['packages/quill-mcp/src/tools/get-politician-influence.ts', 'stripPrivateIndividualNames'],
  ['packages/pipeline-core/src/ingestion/sedar-plus/fetcher.ts', 'redactPrivateFiling'],
  ['packages/database/src/private-names-migration.ts', 'applyPrivateNamesSqlite'],
  ['packages/database/src/private-names-migration.ts', 'applyPrivateNamesPostgres'],
  ['packages/database/src/private-names-migration.ts', 'applyPrivateNamesD1'],
  ['packages/database/src/private-names-migration.ts', 'applyPrivateNamesMemory'],
];

export function privateNameProblems(root = ROOT) {
  const problems = [];
  for (const file of SCAN) {
    const text = readFileSync(resolve(root, file), 'utf8');
    if (FORBIDDEN.test(text)) {
      problems.push(`${file} still contains a donor name field`);
    }
  }
  for (const [file, needle] of REQUIRED) {
    const text = readFileSync(resolve(root, file), 'utf8');
    if (!text.includes(needle)) problems.push(`${file} no longer contains "${needle}"`);
  }
  return problems;
}

function main() {
  const problems = privateNameProblems();
  if (problems.length) {
    console.error('private-individual name gate failed:');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log('private-individual name gate passed');
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) main();
