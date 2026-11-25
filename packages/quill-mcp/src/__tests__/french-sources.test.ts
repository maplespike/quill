/**
 * Quill — French data source paths + FR query fixture (issues #741, #743)
 *
 * Pins the French half of the MCP query layer:
 *   - every bilingual source has a real French URL (different from English
 *     where the source publishes a distinct path)
 *   - an English query localized to French carries the official terminology
 *   - the French query fixture returns both `title_en`/`title_fr` fields and
 *     prefers the French field when `lang: "fr"`
 *
 * Removing a French URL, French name, or French fixture title makes this
 * suite fail.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BILINGUAL_DATA_SOURCES,
  assertFrenchSourcePaths,
  sourceUrl,
  sourceName,
  localizeQuery,
  buildBilingualQueryFixture,
  QUERY_TERMINOLOGY,
} from '../i18n/french-sources.js';

describe('bilingual data source registry', () => {
  it('ships a French path for every source', () => {
    assert.doesNotThrow(() => assertFrenchSourcePaths());
    for (const source of Object.values(BILINGUAL_DATA_SOURCES)) {
      assert.ok(source.url.en.startsWith('https://'), `${source.id}: English URL malformed`);
      assert.ok(source.url.fr.startsWith('https://'), `${source.id}: French URL missing (FR path removed)`);
      assert.ok(source.name.fr.trim().length > 0, `${source.id}: French name missing`);
    }
  });

  it('wires the official French entry points named in #741', () => {
    assert.equal(sourceUrl('canlii', 'fr'), 'https://www.canlii.org/fr/');
    assert.equal(sourceUrl('gazette-p1', 'fr'), 'https://gazette.gc.ca/rp-pr/p1/2026/index-fra.html');
    assert.equal(sourceUrl('gazette-p2', 'fr'), 'https://gazette.gc.ca/rp-pr/p2/2026/index-fra.html');
    assert.equal(sourceUrl('gazette-p3', 'fr'), 'https://gazette.gc.ca/rp-pr/p3/2026/index-fra.html');
    assert.equal(sourceUrl('justice-laws', 'fr'), 'https://laws-lois.justice.gc.ca/fra/');
    assert.equal(sourceUrl('statcan', 'fr'), 'https://www150.statcan.gc.ca/n1/fra/');
    assert.equal(sourceUrl('quebec-open-data', 'fr'), 'https://www.donneesquebec.ca/');
    assert.equal(sourceUrl('ontario-elaws', 'fr'), 'https://www.ontario.ca/fr/lois');
  });

  it('returns French URLs that differ from the English ones where the source publishes both', () => {
    for (const id of ['canlii', 'gazette-p1', 'justice-laws', 'statcan', 'ontario-elaws'] as const) {
      assert.notEqual(sourceUrl(id, 'fr'), sourceUrl(id, 'en'), `${id}: FR URL is the English URL`);
    }
  });

  it('localizes source labels', () => {
    assert.equal(sourceName('statcan', 'fr'), 'Statistique Canada');
    assert.equal(sourceName('canlii', 'fr'), 'Jurisprudence CanLII');
    assert.equal(sourceName('statcan', 'en'), 'Statistics Canada');
  });

  it('throws loudly when asked for a source that does not exist', () => {
    assert.throws(() => sourceUrl('nope' as never, 'fr'), /Unknown data source/);
  });
});

describe('localizeQuery', () => {
  it('translates English legal terminology to the official French term', () => {
    const result = localizeQuery('employment law decisions', 'fr');
    assert.equal(result.targetLang, 'fr');
    assert.ok(result.localized.includes('droit du travail'), result.localized);
    assert.deepEqual(result.applied, [{ en: 'employment law', fr: 'droit du travail' }]);
  });

  it('translates longer phrases before shorter overlapping ones', () => {
    const result = localizeQuery('federal court and supreme court rulings', 'fr');
    assert.ok(result.localized.includes('Cour fédérale'), result.localized);
    assert.ok(result.localized.includes('Cour suprême'), result.localized);
  });

  it('leaves unmatched terms untouched', () => {
    const result = localizeQuery('housing starts for 2026', 'fr');
    assert.ok(result.localized.includes('mises en chantier'), result.localized);
    assert.ok(result.localized.includes('2026'), result.localized);
  });

  it('is a no-op for target language English', () => {
    const result = localizeQuery('droit du travail', 'en');
    assert.equal(result.localized, 'droit du travail');
    assert.deepEqual(result.applied, []);
  });

  it('keeps a French-language terminology table populated', () => {
    const entries = Object.entries(QUERY_TERMINOLOGY);
    assert.ok(entries.length >= 20, 'terminology table lost entries');
    for (const [en, fr] of entries) {
      assert.ok(en.length > 0);
      assert.ok(fr.trim().length > 0, `missing French term for "${en}" (FR path removed)`);
    }
  });
});

describe('buildBilingualQueryFixture', () => {
  it('returns bilingual fields for a French query and prefers French', () => {
    const fixture = buildBilingualQueryFixture({ query: 'employment law', lang: 'fr' });
    assert.equal(fixture.lang, 'fr');
    assert.equal(fixture.usedFrenchPath, true, 'French source path was not used');
    assert.ok(fixture.results.length >= 4);

    for (const record of fixture.results) {
      assert.ok(record.title.en.trim().length > 0, `${record.id}: title_en missing`);
      assert.ok(record.title.fr.trim().length > 0, `${record.id}: title_fr missing (FR path removed)`);
      assert.ok(record.summary.fr.trim().length > 0, `${record.id}: summary_fr missing`);
      assert.equal(record.title_preferred, record.title.fr, `${record.id}: preferred title is not French`);
      assert.equal(record.summary_preferred, record.summary.fr);
    }

    const canlii = fixture.results.find((r) => r.id === 'canlii:employment-law-2026');
    assert.ok(canlii);
    assert.equal(canlii.title.en, 'Employment law — recent decisions');
    assert.equal(canlii.title.fr, 'Droit du travail — décisions récentes');
  });

  it('returns bilingual fields for an English query and prefers English', () => {
    const fixture = buildBilingualQueryFixture({ query: 'employment law', lang: 'en' });
    assert.equal(fixture.lang, 'en');
    for (const record of fixture.results) {
      assert.ok(record.title.fr.trim().length > 0, `${record.id}: bilingual FR field missing for EN query`);
      assert.equal(record.title_preferred, record.title.en);
    }
  });

  it('honours the requested source subset', () => {
    const fixture = buildBilingualQueryFixture({ query: 'budget', lang: 'fr', sources: ['statcan'] });
    assert.deepEqual(fixture.results.map((r) => r.source), ['statcan']);
  });
});
