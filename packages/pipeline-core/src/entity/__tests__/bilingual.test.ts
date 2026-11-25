/**
 * Quill — bilingual entity name resolution tests (issue #743)
 *
 * These tests are the guard for the French half of entity resolution:
 *   - every public institution must carry a non-empty official French name
 *   - a French query resolves to the same entity as its English counterpart
 *   - accents and institutional prefixes ("Ministère des …") do not defeat it
 *
 * Deleting any French name (or the French lookup path) makes this suite fail.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BILINGUAL_ENTITY_NAMES,
  normalizeEntityName,
  coreEntityName,
  resolveBilingualEntity,
  bilingualEntityCandidates,
  isBilingualEntityPair,
  localizeEntityName,
  resetBilingualEntityIndex,
} from '../bilingual.js';

describe('bilingual entity name table', () => {
  it('every institution ships a non-empty French name', () => {
    assert.ok(BILINGUAL_ENTITY_NAMES.length >= 25, 'expected at least 25 institutions');
    for (const entity of BILINGUAL_ENTITY_NAMES) {
      assert.ok(entity.id.length > 0, 'id missing');
      assert.ok(entity.en.trim().length > 0, `${entity.id}: English name missing`);
      assert.ok(entity.fr.trim().length > 0, `${entity.id}: French name missing (FR path removed)`);
    }
  });

  it('has genuinely bilingual pairs, not English copied into the French slot', () => {
    const differing = BILINGUAL_ENTITY_NAMES.filter((e) => e.en !== e.fr);
    assert.ok(
      differing.length >= 25,
      `expected at least 25 EN≠FR pairs, got ${differing.length} — the French path looks removed or stubbed`,
    );
    const finance = BILINGUAL_ENTITY_NAMES.find((e) => e.id === 'finance-canada');
    assert.equal(finance?.en, 'Department of Finance Canada');
    assert.equal(finance?.fr, 'Ministère des Finances Canada');
  });
});

describe('normalizeEntityName / coreEntityName', () => {
  it('strips accents and folds case', () => {
    assert.equal(normalizeEntityName('Ministère des Finances Canada'), 'ministere des finances canada');
    assert.equal(normalizeEntityName('SANTÉ CANADA'), 'sante canada');
  });

  it('reduces institutional names to a distinctive core', () => {
    assert.equal(coreEntityName('Ministère des Finances Canada'), 'finances');
    assert.equal(coreEntityName('Department of Finance Canada'), 'finance');
    assert.equal(coreEntityName('Cour suprême du Canada'), 'cour supreme du');
  });
});

describe('resolveBilingualEntity', () => {
  it('matches the French name and reports the English pair', () => {
    resetBilingualEntityIndex();
    const match = resolveBilingualEntity('Ministère des Finances Canada');
    assert.ok(match, 'French name did not resolve');
    assert.equal(match.id, 'finance-canada');
    assert.equal(match.matchedLang, 'fr');
    assert.equal(match.en, 'Department of Finance Canada');
    assert.equal(match.fr, 'Ministère des Finances Canada');
    assert.equal(match.preferredName, 'Department of Finance Canada');
  });

  it('matches the English name and reports the French pair', () => {
    const match = resolveBilingualEntity('Department of Finance Canada');
    assert.ok(match);
    assert.equal(match.matchedLang, 'en');
    assert.equal(match.fr, 'Ministère des Finances Canada');
    assert.equal(resolveBilingualEntity('Department of Finance Canada', 'fr')?.preferredName, 'Ministère des Finances Canada');
  });

  it('matches a French query with accents dropped and lower-cased', () => {
    const match = resolveBilingualEntity('ministere des finances');
    assert.ok(match, 'accent-stripped French query did not resolve');
    assert.equal(match.id, 'finance-canada');
  });

  it('matches each institution in both official languages', () => {
    for (const entity of BILINGUAL_ENTITY_NAMES) {
      const en = resolveBilingualEntity(entity.en);
      const fr = resolveBilingualEntity(entity.fr);
      assert.ok(en, `${entity.id}: English name did not resolve`);
      assert.ok(fr, `${entity.id}: French name did not resolve`);
      assert.equal(en.id, entity.id);
      assert.equal(fr.id, entity.id);
      assert.equal(en.matchedLang, 'en');
      // "Infrastructure Canada" is spelled the same in both languages, so the
      // stored spelling legitimately resolves through the English slot.
      if (entity.fr !== entity.en) {
        assert.equal(fr.matchedLang, 'fr', `${entity.id}: French name did not match the French path`);
      }
    }
  });

  it('returns null for names that are not in the registry', () => {
    assert.equal(resolveBilingualEntity('Nonexistent Ministry of Nothing'), null);
    assert.equal(resolveBilingualEntity('   '), null);
  });
});

describe('bilingualEntityCandidates / isBilingualEntityPair', () => {
  it('returns the other official-language form for the SQL resolver', () => {
    const candidates = bilingualEntityCandidates('Ministère des Finances Canada');
    assert.ok(candidates.length > 0, 'no English candidate returned for French query');
    assert.ok(candidates.includes(normalizeEntityName('Department of Finance Canada')));
  });

  it('returns French candidates for an English query', () => {
    const candidates = bilingualEntityCandidates('Health Canada');
    assert.ok(candidates.includes('sante canada'), `got ${JSON.stringify(candidates)}`);
  });

  it('returns no candidates for unknown names', () => {
    assert.deepEqual(bilingualEntityCandidates('Some Random Org'), []);
  });

  it('recognises EN/FR pairs and rejects unrelated names', () => {
    assert.equal(isBilingualEntityPair('Health Canada', 'Santé Canada'), true);
    assert.equal(isBilingualEntityPair('Health Canada', 'Statistics Canada'), false);
  });
});

describe('localizeEntityName', () => {
  it('returns the locale-appropriate official name', () => {
    assert.equal(localizeEntityName('statcan', 'fr'), 'Statistique Canada');
    assert.equal(localizeEntityName('statcan', 'en'), 'Statistics Canada');
    assert.equal(localizeEntityName('does-not-exist', 'fr'), null);
  });
});
