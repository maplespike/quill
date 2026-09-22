/**
 * Error-code i18n guard.
 *
 * The API is bilingual (EN/FR) and every error a customer can see carries both
 * languages. Until 2026-09-22 the code table was missing 61 codes that call
 * sites actually emit (UPGRADE_REQUIRED among them), so those responses shipped
 * `message_fr: "Erreur inconnue"` — "unknown error" — to French readers.
 *
 * This test walks the source for emitted codes and fails when a new one has no
 * bilingual entry, so the table can never silently fall behind again.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBilingualError } from '../error-codes.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      walk(full, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Codes passed to buildError(...) / buildBilingualError(...) anywhere in src. */
function emittedCodes(): Set<string> {
  const codes = new Set<string>();
  const re = /build(?:Bilingual)?Error\(\s*'([A-Z_][A-Z0-9_]*)'/g;
  for (const file of walk(SRC)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(re)) codes.add(m[1]!);
  }
  return codes;
}

test('every emitted error code carries a real EN and FR message', () => {
  const codes = emittedCodes();
  assert.ok(codes.size >= 40, `expected to discover the emitted codes, found ${codes.size}`);

  const problems: string[] = [];
  for (const code of codes) {
    const err = buildBilingualError(code);
    if (!err.en || err.en === 'Unknown error') problems.push(`${code}: EN missing`);
    if (!err.fr || err.fr === 'Erreur inconnue' || err.fr === 'Unknown error') {
      problems.push(`${code}: FR placeholder ("${err.fr}")`);
    }
  }
  assert.deepEqual(problems, [], `untranslated error codes:\n${problems.join('\n')}`);
});

test('the tier boundary a free customer hits is bilingual and self-explanatory', () => {
  const err = buildBilingualError('UPGRADE_REQUIRED');
  assert.match(err.en, /plan|upgrade|tier/i, 'EN must name the plan boundary');
  assert.match(err.fr, /offre|plan|supérieure/i, 'FR must name the plan boundary');
  assert.notMatch(err.fr, /inconnue/i, 'FR must never be the placeholder');
});

test('an unknown code falls back to the caller sentence, never a placeholder', () => {
  const err = buildBilingualError('TOTALLY_NEW_CODE', { en: 'Something specific went wrong' });
  assert.equal(err.fr, 'Something specific went wrong', 'FR must reuse the meaningful EN text');
});
