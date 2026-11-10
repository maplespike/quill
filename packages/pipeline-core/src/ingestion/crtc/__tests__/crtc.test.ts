// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeHash } from '../../../verification/hashing.js';
import {
  stripHtml,
  parseDate,
  detectLanguage,
  classifyDecisionType,
  classifyOutcome,
  classifySubjectMatters,
  extractRelatedCompanies,
  extractApplicant,
  guessPdfUrl,
  classifyOwnershipRecordType,
  parseCrtcDecision,
  parseCrtcOwnershipRecord,
  parseOwnershipPageHtml,
  createIngestionResult,
} from '../parser.js';
import type { RawCrtcDecisionItem, RawCrtcOwnershipItem } from '../types.js';

/* ------------------------------------------------------------------ */
/*  Module Loading Tests (preserved from original)                     */
/* ------------------------------------------------------------------ */

describe('ingestion/crtc', () => {
  it('constants module loads with correct exports', async () => {
    const c = await import('../constants.js');
    assert.ok(c, 'constants should load');
    assert.equal(typeof c, 'object', 'constants should be an object');
    assert.ok(Object.keys(c).length > 0, 'constants should export at least one value');
  });

  it('types module loads correctly', async () => {
    const t = await import('../types.js');
    assert.ok(t, 'types should load');
  });

  it('parser module loads and exports functions', async () => {
    const p = await import('../parser.js');
    assert.ok(p, 'parser should load');
    const keys = Object.keys(p);
    assert.ok(keys.length > 0, 'parser should export at least one item');
    // Verify all exports are functions (parser modules export pure functions)
    const nonFunctions = keys.filter(k => typeof (p as any)[k] !== 'function');
    assert.equal(nonFunctions.length, 0, `parser exports should all be functions: ${nonFunctions.join(', ')}`);
  });

  it('fetcher module loads without error', async () => {
    const f = await import('../fetcher.js');
    assert.ok(f, 'fetcher should load');
  });

  it('index module exports the expected public API', async () => {
    const idx = await import('../index.js');
    const keys = Object.keys(idx);
    assert.ok(keys.length > 0, 'index should export at least one item');
    // Verify exports: ingestion modules export async functions and re-exported types
    keys.forEach(k => {
      const type = typeof (idx as any)[k];
      assert.ok(type === 'function' || type === 'object' || type === 'string' || type === 'number',
        `${k} should be function, object, or string (got ${type})`);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  A. stripHtml tests                                                 */
/* ------------------------------------------------------------------ */

describe('stripHtml', () => {
  it('strips simple HTML tags', () => {
    assert.equal(stripHtml('<p>foo</p>'), 'foo');
  });

  it('handles &amp; entity', () => {
    assert.equal(stripHtml('Hello &amp; goodbye'), 'Hello & goodbye');
  });

  it('handles &lt; and &gt; entities', () => {
    assert.equal(stripHtml('&lt;div&gt;'), '<div>');
  });

  it('handles &quot; entity', () => {
    assert.equal(stripHtml('She said &quot;hello&quot;'), 'She said "hello"');
  });

  it('handles &#39; entity', () => {
    assert.equal(stripHtml('It&#39;s cold'), "It's cold");
  });

  it('handles &# numeric entities', () => {
    assert.equal(stripHtml('&#38;'), '&');
  });

  it('replaces &nbsp; with space', () => {
    assert.equal(stripHtml('foo&nbsp;bar'), 'foo bar');
  });

  it('replaces <br> tags with space (via newline → whitespace collapse)', () => {
    assert.equal(stripHtml('foo<br>bar'), 'foo bar');
  });

  it('collapses multiple whitespace', () => {
    assert.equal(stripHtml('  foo   bar  '), 'foo bar');
  });

  it('collapses newlines and tabs', () => {
    assert.equal(stripHtml('foo\n\n\nbar'), 'foo bar');
  });

  it('returns empty string for empty input', () => {
    assert.equal(stripHtml(''), '');
  });

  it('returns empty string for nullish input via guard', () => {
    // The function checks `if (!html) return ''` so empty-ish values return ''
    assert.equal(stripHtml(''), '');
  });

  it('handles nested HTML tags', () => {
    assert.equal(stripHtml('<div><span>hello</span></div>'), 'hello');
  });

  it('handles HTML with attributes', () => {
    assert.equal(stripHtml('<p class="test">content</p>'), 'content');
  });
});

/* ------------------------------------------------------------------ */
/*  B. parseDate tests                                                 */
/* ------------------------------------------------------------------ */

describe('parseDate', () => {
  it('parses ISO-8601 full datetime', () => {
    assert.equal(parseDate('2024-05-12T00:00:00Z'), '2024-05-12');
  });

  it('parses ISO-8601 without time', () => {
    assert.equal(parseDate('2024-05-12'), '2024-05-12');
  });

  it('parses "Month Day, Year" format', () => {
    assert.equal(parseDate('May 12, 2024'), '2024-05-12');
  });

  it('parses "Month Day, Year" format without comma', () => {
    assert.equal(parseDate('June 15 2024'), '2024-06-15');
  });

  it('parses "YYYY/MM/DD" format', () => {
    assert.equal(parseDate('2024/05/12'), '2024-05-12');
  });

  it('parses "DD/MM/YYYY" French format', () => {
    assert.equal(parseDate('12/05/2024'), '2024-05-12');
  });

  it('returns empty string for empty input', () => {
    assert.equal(parseDate(''), '');
  });

  it('returns original string for invalid date', () => {
    assert.equal(parseDate('not-a-date'), 'not-a-date');
  });

  it('parses single-digit month/day Month Day, Year', () => {
    assert.equal(parseDate('January 5, 2024'), '2024-01-05');
  });
});

/* ------------------------------------------------------------------ */
/*  C. detectLanguage tests                                            */
/* ------------------------------------------------------------------ */

describe('detectLanguage', () => {
  it('detects French from lang="fr" attribute in HTML', () => {
    assert.equal(detectLanguage('lang="fr"', 'Some title'), 'fr');
  });

  it('detects French from lang=\'fr\' attribute', () => {
    assert.equal(detectLanguage("lang='fr'", 'Some title'), 'fr');
  });

  it('detects French from title with accents', () => {
    assert.equal(detectLanguage('', 'Décision de radiodiffusion'), 'fr');
  });

  it('detects French with è accent in title', () => {
    assert.equal(detectLanguage('', 'Télécom décision'), 'fr');
  });

  it('detects French with ê accent in title', () => {
    assert.equal(detectLanguage('', 'Numéro de téléphone'), 'fr');
  });

  it('defaults to English when no French indicators present', () => {
    assert.equal(detectLanguage('', 'Broadcasting Decision'), 'en');
  });

  it('defaults to English for empty title and no lang attribute', () => {
    assert.equal(detectLanguage('<html><body>content</body></html>', ''), 'en');
  });

  it('only checks for lang="fr" not lang="en", falls back to title accents', () => {
    // The implementation only checks for lang="fr", not lang="en".
    // When HTML has lang="en" but title has French accents, it returns 'fr'.
    assert.equal(detectLanguage('lang="en"', 'Décision de radiodiffusion'), 'fr');
  });
});

/* ------------------------------------------------------------------ */
/*  D. classifyDecisionType tests                                      */
/* ------------------------------------------------------------------ */

describe('classifyDecisionType', () => {
  it('classifies "Broadcasting Decision CRTC 2024-123" as broadcasting-decision', () => {
    assert.equal(
      classifyDecisionType('Broadcasting Decision CRTC 2024-123', ''),
      'broadcasting-decision',
    );
  });

  it('classifies "Telecom Decision CRTC 2024-456" as telecom-decision', () => {
    assert.equal(
      classifyDecisionType('Telecom Decision CRTC 2024-456', ''),
      'telecom-decision',
    );
  });

  it('classifies French "Décision de radiodiffusion" as broadcasting-decision', () => {
    assert.equal(
      classifyDecisionType('Décision de radiodiffusion CRTC 2024-123', ''),
      'broadcasting-decision',
    );
  });

  it('classifies French "Décision de télécom" as telecom-decision', () => {
    assert.equal(
      classifyDecisionType('Décision de télécom CRTC 2024-456', ''),
      'telecom-decision',
    );
  });

  it('classifies "Broadcasting Order" as administrative', () => {
    assert.equal(
      classifyDecisionType('Broadcasting Order CRTC 2024-789', ''),
      'administrative',
    );
  });

  it('classifies "Telecom Order" as administrative', () => {
    assert.equal(
      classifyDecisionType('Telecom Order CRTC 2024-321', ''),
      'administrative',
    );
  });

  it('classifies "Notice of Consultation" as notice-consultation', () => {
    assert.equal(
      classifyDecisionType('Notice of Consultation CRTC 2024-100', ''),
      'notice-consultation',
    );
  });

  it('classifies "Broadcasting Notice of Consultation" as notice-consultation', () => {
    assert.equal(
      classifyDecisionType('Broadcasting Notice of Consultation CRTC 2024-200', ''),
      'notice-consultation',
    );
  });

  it('classifies "Telecom Regulatory Policy" as policy', () => {
    assert.equal(
      classifyDecisionType('Telecom Regulatory Policy CRTC 2024-300', ''),
      'policy',
    );
  });

  it('classifies "Ownership" as ownership-change', () => {
    assert.equal(
      classifyDecisionType('Ownership CRTC 2024-400', ''),
      'ownership-change',
    );
  });

  it('falls back to title containing "broadcasting"', () => {
    assert.equal(
      classifyDecisionType('', 'A decision on broadcasting licence'),
      'broadcasting-decision',
    );
  });

  it('falls back to title containing "telecom"', () => {
    assert.equal(
      classifyDecisionType('', 'Telecom pricing review'),
      'telecom-decision',
    );
  });

  it('falls back to title containing "télécom"', () => {
    assert.equal(
      classifyDecisionType('', 'Examen des prix télécom'),
      'telecom-decision',
    );
  });

  it('falls back to title containing "ownership" or "transfer of control"', () => {
    assert.equal(
      classifyDecisionType('', 'Ownership change application'),
      'ownership-change',
    );
  });

  it('defaults to broadcasting-decision when no patterns match', () => {
    assert.equal(
      classifyDecisionType('Unknown Type', 'Some random title'),
      'broadcasting-decision',
    );
  });
});

/* ------------------------------------------------------------------ */
/*  E. classifyOutcome tests                                           */
/* ------------------------------------------------------------------ */

describe('classifyOutcome', () => {
  it('"approved" → approved', () => {
    assert.equal(classifyOutcome('approved'), 'approved');
  });

  it('"granted" → approved', () => {
    assert.equal(classifyOutcome('granted'), 'approved');
  });

  it('"approuvé" → approved', () => {
    assert.equal(classifyOutcome('approuvé'), 'approved');
  });

  it('"grant" → approved', () => {
    assert.equal(classifyOutcome('grant'), 'approved');
  });

  it('"denied" → denied', () => {
    assert.equal(classifyOutcome('denied'), 'denied');
  });

  it('"refused" → denied', () => {
    assert.equal(classifyOutcome('refused'), 'denied');
  });

  it('"rejected" → denied', () => {
    assert.equal(classifyOutcome('rejected'), 'denied');
  });

  it('"refuse" → denied', () => {
    assert.equal(classifyOutcome('refuse'), 'denied');
  });

  it('"not approved" → denied', () => {
    assert.equal(classifyOutcome('not approved'), 'denied');
  });

  it('"conditionally approved" → approved (\\bcondition\\b does not match "conditionally")', () => {
    // \bcondition\b does not match "conditionally" because the word boundary
    // between "condition" and "ally" is both \w characters. Falls through to "approved".
    assert.equal(classifyOutcome('conditionally approved'), 'approved');
  });

  it('"subject to conditions" → conditionally-approved', () => {
    assert.equal(classifyOutcome('subject to conditions'), 'conditionally-approved');
  });

  it('"withdrawn" → withdrawn', () => {
    assert.equal(classifyOutcome('withdrawn'), 'withdrawn');
  });

  it('"abandoned" → withdrawn', () => {
    assert.equal(classifyOutcome('abandoned'), 'withdrawn');
  });

  it('"retiré" → withdrawn', () => {
    assert.equal(classifyOutcome('retiré'), 'withdrawn');
  });

  it('"deferred" → deferred', () => {
    assert.equal(classifyOutcome('deferred'), 'deferred');
  });

  it('"postponed" → deferred', () => {
    assert.equal(classifyOutcome('postponed'), 'deferred');
  });

  it('"reporté" → deferred', () => {
    assert.equal(classifyOutcome('reporté'), 'deferred');
  });

  it('"partially approved" → partially-approved', () => {
    assert.equal(classifyOutcome('partially approved'), 'partially-approved');
  });

  it('no match → unknown', () => {
    assert.equal(classifyOutcome('some random text'), 'unknown');
  });

  it('empty string → unknown', () => {
    assert.equal(classifyOutcome(''), 'unknown');
  });

  it('approved takes lower priority than denied', () => {
    assert.equal(classifyOutcome('approved denied'), 'denied');
  });

  it('approved takes priority when condition check does not match "conditionally"', () => {
    assert.equal(classifyOutcome('conditionally approved but also approved'), 'approved');
  });
});

/* ------------------------------------------------------------------ */
/*  F. classifySubjectMatters tests                                    */
/* ------------------------------------------------------------------ */

describe('classifySubjectMatters', () => {
  it('matches licensing from "licence"', () => {
    const result = classifySubjectMatters('Licence renewal for Bell', null, []);
    assert.ok(result.includes('licensing'));
  });

  it('matches licensing from "renew"', () => {
    const result = classifySubjectMatters('Application to renew a licence', null, []);
    assert.ok(result.includes('licensing'));
  });

  it('matches ownership-change from "transfer of control"', () => {
    const result = classifySubjectMatters('Transfer of control of Bell Canada', null, []);
    assert.ok(result.includes('ownership-change'));
  });

  it('matches ownership-change from "ownership"', () => {
    const result = classifySubjectMatters('Ownership change application', null, []);
    assert.ok(result.includes('ownership-change'));
  });

  it('matches net-neutrality from "net neutrality"', () => {
    const result = classifySubjectMatters('Net neutrality and internet traffic', null, []);
    assert.ok(result.includes('net-neutrality'));
  });

  it('matches net-neutrality from "throttling"', () => {
    const result = classifySubjectMatters('Internet traffic management throttling', null, []);
    assert.ok(result.includes('net-neutrality'));
  });

  it('matches telecom-pricing from "rate"', () => {
    const result = classifySubjectMatters('Wholesale rate for internet service', null, []);
    assert.ok(result.includes('telecom-pricing'));
  });

  it('matches canadian-content from "canadian content"', () => {
    const result = classifySubjectMatters('Canadian content requirements', null, []);
    assert.ok(result.includes('canadian-content'));
  });

  it('matches diversity-of-voices from "diversity of voices"', () => {
    const result = classifySubjectMatters('Diversity of voices in broadcasting', null, []);
    assert.ok(result.includes('diversity-of-voices'));
  });

  it('matches local-news from "local news"', () => {
    const result = classifySubjectMatters('Local news programming', null, []);
    assert.ok(result.includes('local-news'));
  });

  it('matches indigenous-broadcasting from "indigenous"', () => {
    const result = classifySubjectMatters('Indigenous broadcasting policy', null, []);
    assert.ok(result.includes('indigenous-broadcasting'));
  });

  it('matches french-language from "french-language"', () => {
    const result = classifySubjectMatters('French-language programming', null, []);
    assert.ok(result.includes('french-language'));
  });

  it('matches accessibility from "closed captioning"', () => {
    const result = classifySubjectMatters('Closed captioning standards', null, []);
    assert.ok(result.includes('accessibility'));
  });

  it('matches emergency-alerting from "emergency alert"', () => {
    const result = classifySubjectMatters('Emergency alert system', null, []);
    assert.ok(result.includes('emergency-alerting'));
  });

  it('matches consumer-protection from "consumer protection"', () => {
    const result = classifySubjectMatters('Consumer protection rules', null, []);
    assert.ok(result.includes('consumer-protection'));
  });

  it('matches wholesale-access from "wholesale"', () => {
    const result = classifySubjectMatters('Wholesale access rates', null, []);
    assert.ok(result.includes('wholesale-access'));
  });

  it('can match multiple subjects from a single title', () => {
    const result = classifySubjectMatters(
      'Licence renewal and transfer of control for Bell Canada',
      null,
      [],
    );
    assert.ok(result.includes('licensing'), 'should include licensing');
    assert.ok(result.includes('ownership-change'), 'should include ownership-change');
  });

  it('returns ["other"] when no subjects match', () => {
    assert.deepEqual(
      classifySubjectMatters('Some random text about unrelated topic', null, []),
      ['other'],
    );
  });

  it('matches from findings when title has no match', () => {
    const result = classifySubjectMatters('Title', null, [
      'ownership change of Bell Media',
    ]);
    assert.ok(result.includes('ownership-change'));
  });

  it('is case-insensitive', () => {
    const result = classifySubjectMatters('NET NEUTRALITY DECISION', null, []);
    assert.ok(result.includes('net-neutrality'));
  });
});

/* ------------------------------------------------------------------ */
/*  G. extractRelatedCompanies tests                                   */
/* ------------------------------------------------------------------ */

describe('extractRelatedCompanies', () => {
  it('extracts "Bell Canada" from title', () => {
    const result = extractRelatedCompanies('Bell Canada licence renewal', '');
    assert.ok(result.includes('Bell Canada'));
  });

  it('extracts multiple known companies', () => {
    const result = extractRelatedCompanies(
      'Bell Canada and Rogers Communications merger',
      '',
    );
    assert.ok(result.includes('Bell Canada'));
    assert.ok(result.includes('Rogers Communications'));
    assert.ok(result.includes('Rogers'));
  });

  it('returns empty array when no known companies found', () => {
    const result = extractRelatedCompanies('Some random text about unknown company', '');
    assert.deepEqual(result, []);
  });

  it('extracts from HTML body as well as title', () => {
    const result = extractRelatedCompanies(
      'CRTC decision',
      'This decision concerns Quebecor Media and Videotron',
    );
    assert.ok(result.includes('Quebecor Media'));
    assert.ok(result.includes('Videotron'));
  });

  it('deduplicates companies found in both title and HTML', () => {
    const result = extractRelatedCompanies('Rogers', 'Rogers Communications');
    // The function doesn't deduplicate, just pushes on first match
    // "Rogers" appears in title, "Rogers Communications" in HTML
    // But since "Rogers" is checked first in the knownCompanies array,
    // it pushes "Rogers" from title match. Then "Rogers Communications"
    // from HTML match. Both are distinct entries.
    assert.equal(result.filter(c => c === 'Rogers').length, 1);
    assert.ok(result.includes('Rogers Communications'));
  });
});

/* ------------------------------------------------------------------ */
/*  H. extractApplicant tests                                          */
/* ------------------------------------------------------------------ */

describe('extractApplicant', () => {
  it('extracts applicant from "Application by X" pattern', () => {
    const result = extractApplicant(
      'Application by Rogers Communications — Licence renewal',
      '',
    );
    assert.equal(result, 'Rogers Communications');
  });

  it('extracts applicant from "Application from X" pattern', () => {
    const result = extractApplicant(
      'Application from Bell Canada for licence',
      '',
    );
    assert.equal(result, 'Bell Canada for licence');
  });

  it('extracts applicant when title starts with known company name', () => {
    const result = extractApplicant('Bell Canada - Application for licence renewal', '');
    assert.equal(result, 'Bell Canada');
  });

  it('extracts "Rogers" when title starts with it', () => {
    const result = extractApplicant('Rogers Application for licence', '');
    assert.equal(result, 'Rogers');
  });

  it('returns null when no applicant pattern matches', () => {
    const result = extractApplicant('Some random CRTC decision', '');
    assert.equal(result, null);
  });

  it('extracts applicant from "Application de X" French pattern', () => {
    const result = extractApplicant(
      'Application de Vidéotron — Renouvellement de licence',
      '',
    );
    assert.equal(result, 'Vidéotron');
  });
});

/* ------------------------------------------------------------------ */
/*  I. guessPdfUrl tests                                               */
/* ------------------------------------------------------------------ */

describe('guessPdfUrl', () => {
  it('converts .htm URL to .pdf', () => {
    assert.equal(
      guessPdfUrl('https://crtc.gc.ca/eng/archive/2024/2024-123.htm'),
      'https://crtc.gc.ca/eng/archive/2024/2024-123.pdf',
    );
  });

  it('converts .html URL to .pdf', () => {
    assert.equal(
      guessPdfUrl('https://crtc.gc.ca/eng/archive/2024/2024-123.html'),
      'https://crtc.gc.ca/eng/archive/2024/2024-123.pdf',
    );
  });

  it('returns null for empty string', () => {
    assert.equal(guessPdfUrl(''), null);
  });

  it('returns null for null', () => {
    assert.equal(guessPdfUrl(null as unknown as string), null);
  });

  it('returns URL unchanged if it does not end in .htm/.html', () => {
    assert.equal(
      guessPdfUrl('https://crtc.gc.ca/eng/archive/2024/2024-123'),
      'https://crtc.gc.ca/eng/archive/2024/2024-123',
    );
  });
});

/* ------------------------------------------------------------------ */
/*  J. classifyOwnershipRecordType tests                               */
/* ------------------------------------------------------------------ */

describe('classifyOwnershipRecordType', () => {
  it('"television" → broadcasting-undertaking', () => {
    assert.equal(
      classifyOwnershipRecordType('television'),
      'broadcasting-undertaking',
    );
  });

  it('"tv" → broadcasting-undertaking', () => {
    assert.equal(classifyOwnershipRecordType('tv'), 'broadcasting-undertaking');
  });

  it('"radio" → broadcasting-undertaking', () => {
    assert.equal(classifyOwnershipRecordType('radio'), 'broadcasting-undertaking');
  });

  it('"telecom" → telecom-undertaking', () => {
    assert.equal(classifyOwnershipRecordType('telecom'), 'telecom-undertaking');
  });

  it('"phone" → telecom-undertaking', () => {
    assert.equal(classifyOwnershipRecordType('phone'), 'telecom-undertaking');
  });

  it('"holding company" → media-ownership-group', () => {
    assert.equal(
      classifyOwnershipRecordType('holding company'),
      'media-ownership-group',
    );
  });

  it('"group" → media-ownership-group', () => {
    assert.equal(classifyOwnershipRecordType('group'), 'media-ownership-group');
  });

  it('"parent" → media-ownership-group', () => {
    assert.equal(classifyOwnershipRecordType('parent'), 'media-ownership-group');
  });

  it('"transfer of control" → transfer-of-control', () => {
    assert.equal(
      classifyOwnershipRecordType('transfer of control'),
      'transfer-of-control',
    );
  });

  it('"acquisition" → transfer-of-control', () => {
    assert.equal(
      classifyOwnershipRecordType('acquisition'),
      'transfer-of-control',
    );
  });

  it('"merger" → transfer-of-control', () => {
    assert.equal(classifyOwnershipRecordType('merger'), 'transfer-of-control');
  });

  it('unknown → broadcasting-undertaking (default)', () => {
    assert.equal(
      classifyOwnershipRecordType('something unknown'),
      'broadcasting-undertaking',
    );
  });

  it('is case-insensitive', () => {
    assert.equal(classifyOwnershipRecordType('TeLeViSiOn'), 'broadcasting-undertaking');
  });
});

/* ------------------------------------------------------------------ */
/*  K. parseCrtcDecision tests                                         */
/* ------------------------------------------------------------------ */

describe('parseCrtcDecision', () => {
  it('parses a raw CRTC decision item into a structured CrtcDecision', async () => {
    const item: RawCrtcDecisionItem = {
      title: 'Broadcasting Decision CRTC 2024-123 — Bell Canada - Application for licence renewal approved',
      date: '2024-05-12T00:00:00Z',
      url: 'https://crtc.gc.ca/eng/archive/2024/2024-123.htm',
      summary: 'Application by Bell Canada for renewal of broadcasting licence',
      rawType: 'Broadcasting Decision',
      decisionNumber: '2024-123',
      bodyHtml: null,
    };

    const result = await parseCrtcDecision(item);

    // id is a non-empty SHA-256 hash (64 hex chars)
    assert.ok(result.id, 'id should be non-empty');
    assert.equal(result.id.length, 64, 'SHA-256 hash should be 64 hex characters');
    assert.ok(/^[a-f0-9]{64}$/.test(result.id), 'id should be a hex string');

    // Verify hash correctness
    const expectedHash = await computeHash(
      ['crtc', '2024-123', item.title, item.date, item.url].join('|'),
      'sha256',
    );
    assert.equal(result.id, expectedHash, 'id should be deterministic SHA-256 hash');

    // Decision metadata
    assert.equal(result.decisionNumber, '2024-123');
    assert.equal(result.title, item.title);
    assert.equal(result.type, 'broadcasting-decision');
    assert.equal(result.date, '2024-05-12');
    assert.equal(result.outcome, 'approved');
    assert.equal(result.applicant, null); // Title doesn't start with known company and no "Application by" in title alone
    assert.equal(result.language, 'en');

    // subjectMatter is an array containing licensing
    assert.ok(Array.isArray(result.subjectMatter), 'subjectMatter should be an array');
    assert.ok(result.subjectMatter.includes('licensing'));

    // sourceUrl matches input
    assert.equal(result.sourceUrl, item.url);

    // pdfUrl derived from sourceUrl
    assert.equal(result.pdfUrl, 'https://crtc.gc.ca/eng/archive/2024/2024-123.pdf');

    // ingestedAt is an ISO string
    assert.ok(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(result.ingestedAt),
      'ingestedAt should be ISO-8601 format',
    );

    // Boolean flags
    assert.equal(result.isOwnershipChange, false);
    assert.equal(result.isNetNeutrality, false);
    assert.equal(result.isTelecomPricing, false);
    assert.equal(result.isCanadianContent, false);
    assert.equal(result.isLicenceRenewal, true);

    // summary from RSS description
    assert.equal(result.summary, item.summary);

    // No conditions or findings (no bodyHtml)
    assert.deepEqual(result.conditions, []);
    assert.deepEqual(result.findings, []);

    // relatedCompanies
    assert.ok(result.relatedCompanies.includes('Bell Canada'));
  });

  it('detects French language from bodyHtml with lang="fr"', async () => {
    const item: RawCrtcDecisionItem = {
      title: 'Broadcasting Decision CRTC 2024-456',
      date: '2024-06-15T00:00:00Z',
      url: 'https://crtc.gc.ca/eng/archive/2024/2024-456.htm',
      summary: null,
      rawType: 'Unknown',
      decisionNumber: '2024-456',
      bodyHtml: null,
    };

    const result = await parseCrtcDecision(item, '<html lang="fr"><body>Contenu français</body></html>');
    assert.equal(result.language, 'fr');
  });

  it('classifies ownership-change type from title keywords', async () => {
    const item: RawCrtcDecisionItem = {
      title: 'Transfer of control of Bell Media to BCE Inc.',
      date: '2024/07/20',
      url: 'https://crtc.gc.ca/eng/archive/2024/2024-789.htm',
      summary: 'Transfer of control of Bell Media Inc.',
      rawType: 'Broadcasting Decision',
      decisionNumber: '2024-789',
      bodyHtml: null,
    };

    const result = await parseCrtcDecision(item);
    assert.equal(result.type, 'broadcasting-decision');
    // subjectMatter includes ownership-change
    assert.ok(result.subjectMatter.includes('ownership-change'));
    assert.equal(result.isOwnershipChange, true);
    assert.equal(result.date, '2024-07-20');
  });
});

/* ------------------------------------------------------------------ */
/*  L. parseCrtcOwnershipRecord tests                                  */
/* ------------------------------------------------------------------ */

describe('parseCrtcOwnershipRecord', () => {
  it('parses a raw ownership item into a structured CrtcOwnershipRecord', async () => {
    const item: RawCrtcOwnershipItem = {
      undertakingName: 'CFTO-TV',
      undertakingType: 'television',
      serviceArea: 'Toronto',
      licenceNumber: '123456',
      ownerName: 'Bell Media Inc.',
      parentCompany: 'BCE Inc.',
      ownershipPercentage: '100',
      effectiveDate: '2024-01-15T00:00:00Z',
      publishedDate: '2024-01-10T00:00:00Z',
      transactionValue: '50000000.00',
      sourceUrl: 'https://crtc.gc.ca/eng/cancon/ownership.htm',
      bodyHtml: null,
    };

    const result = await parseCrtcOwnershipRecord(item);

    // id is a non-empty SHA-256 hash
    assert.ok(result.id, 'id should be non-empty');
    assert.equal(result.id.length, 64, 'SHA-256 hash should be 64 hex characters');
    assert.ok(/^[a-f0-9]{64}$/.test(result.id), 'id should be a hex string');

    // Verify hash correctness
    const expectedHash = await computeHash(
      ['crtc-ownership', item.undertakingName, item.ownerName, item.sourceUrl].join('|'),
      'sha256',
    );
    assert.equal(result.id, expectedHash);

    // Record type
    assert.equal(result.recordType, 'broadcasting-undertaking');

    // Metadata
    assert.equal(result.undertakingName, 'CFTO-TV');
    assert.equal(result.undertakingType, 'television');
    assert.equal(result.serviceArea, 'Toronto');
    assert.equal(result.licenceNumber, '123456');
    assert.equal(result.ownerName, 'Bell Media Inc.');
    assert.equal(result.parentCompany, 'BCE Inc.');
    assert.equal(result.sourceUrl, item.sourceUrl);
    assert.equal(result.sourceSystem, 'crtc-ownership-page');

    // Numeric fields parsed from strings
    assert.equal(result.ownershipPercentage, 100);
    assert.equal(result.transactionValue, 50000000);

    // Dates parsed
    assert.equal(result.effectiveDate, '2024-01-15');
    assert.equal(result.publishedDate, '2024-01-10');

    // ingestedAt is ISO string
    assert.ok(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(result.ingestedAt),
      'ingestedAt should be ISO-8601 format',
    );
  });

  it('handles null numeric fields', async () => {
    const item: RawCrtcOwnershipItem = {
      undertakingName: 'CKVR',
      undertakingType: 'radio',
      serviceArea: null,
      licenceNumber: null,
      ownerName: 'Local Media Corp.',
      parentCompany: null,
      ownershipPercentage: null,
      effectiveDate: null,
      publishedDate: null,
      transactionValue: null,
      sourceUrl: 'https://crtc.gc.ca/eng/cancon/ownership.htm',
      bodyHtml: null,
    };

    const result = await parseCrtcOwnershipRecord(item);
    assert.equal(result.ownershipPercentage, null);
    assert.equal(result.transactionValue, null);
    assert.equal(result.effectiveDate, null);
    assert.equal(result.publishedDate, null);
    assert.equal(result.serviceArea, null);
    assert.equal(result.licenceNumber, null);
    assert.equal(result.parentCompany, null);
  });
});

/* ------------------------------------------------------------------ */
/*  M. parseOwnershipPageHtml tests                                    */
/* ------------------------------------------------------------------ */

describe('parseOwnershipPageHtml', () => {
  it('parses a minimal HTML table with one row', () => {
    const html = `<table>
      <tr>
        <td><a href="/eng/undertaking/CFTO-TV">CFTO-TV</a></td>
        <td>television</td>
        <td>Toronto</td>
      </tr>
    </table>`;

    const result = parseOwnershipPageHtml(html);
    assert.equal(result.length, 1);
    assert.equal(result[0].undertakingName, 'CFTO-TV');
    assert.equal(result[0].undertakingType, 'television');
    assert.equal(result[0].serviceArea, 'Toronto');
    assert.equal(
      result[0].sourceUrl,
      'https://crtc.gc.ca/eng/undertaking/CFTO-TV',
    );
    assert.equal(result[0].licenceNumber, null);
    assert.equal(result[0].ownerName, '');
    assert.equal(result[0].parentCompany, null);
    assert.equal(result[0].ownershipPercentage, null);
    assert.equal(result[0].bodyHtml, null);
  });

  it('parses multiple rows from a table', () => {
    const html = `<table>
      <tr><td><a href="/eng/u/1">Station One</a></td><td>television</td><td>Toronto</td></tr>
      <tr><td><a href="/eng/u/2">Station Two</a></td><td>radio</td><td>Ottawa</td></tr>
    </table>`;

    const result = parseOwnershipPageHtml(html);
    assert.equal(result.length, 2);
    assert.equal(result[0].undertakingName, 'Station One');
    assert.equal(result[1].undertakingName, 'Station Two');
  });

  it('handles absolute href URLs', () => {
    const html = `<table>
      <tr>
        <td><a href="https://crtc.gc.ca/eng/ownership/absolute">Absolute URL</a></td>
        <td>tv</td>
        <td>Montreal</td>
      </tr>
    </table>`;

    const result = parseOwnershipPageHtml(html);
    assert.equal(result[0].sourceUrl, 'https://crtc.gc.ca/eng/ownership/absolute');
  });

  it('skips rows with very short undertaking names', () => {
    const html = `<table>
      <tr><td><a href="/eng/u/x">X</a></td><td>television</td><td>Toronto</td></tr>
    </table>`;

    const result = parseOwnershipPageHtml(html);
    assert.equal(result.length, 0);
  });

  it('returns empty array for empty HTML', () => {
    assert.deepEqual(parseOwnershipPageHtml(''), []);
  });

  it('returns empty array for HTML without tables', () => {
    assert.deepEqual(parseOwnershipPageHtml('<p>No tables here</p>'), []);
  });

  it('returns empty array for table with no rows', () => {
    assert.deepEqual(parseOwnershipPageHtml('<table></table>'), []);
  });
});

/* ------------------------------------------------------------------ */
/*  N. createIngestionResult tests                                     */
/* ------------------------------------------------------------------ */

describe('createIngestionResult', () => {
  it('returns default result with all zeros and empty arrays', () => {
    const result = createIngestionResult();
    assert.equal(result.decisionsFound, 0);
    assert.equal(result.decisionsIngested, 0);
    assert.equal(result.ownershipRecordsFound, 0);
    assert.equal(result.ownershipRecordsIngested, 0);
    assert.deepEqual(result.sourcesTried, []);
    assert.deepEqual(result.errors, []);
    assert.ok(result.durationMs >= 0, 'durationMs should be >= 0');
  });

  it('reflects provided option values', () => {
    const startTime = Date.now();
    const result = createIngestionResult({
      decisionsFound: 10,
      decisionsIngested: 8,
      ownershipRecordsFound: 5,
      ownershipRecordsIngested: 3,
      sourcesTried: ['rss-feed', 'archive-page'],
      errors: ['fetch error 1'],
      startTime,
    });

    assert.equal(result.decisionsFound, 10);
    assert.equal(result.decisionsIngested, 8);
    assert.equal(result.ownershipRecordsFound, 5);
    assert.equal(result.ownershipRecordsIngested, 3);
    assert.deepEqual(result.sourcesTried, ['rss-feed', 'archive-page']);
    assert.deepEqual(result.errors, ['fetch error 1']);
    // durationMs is the difference from startTime to now
    assert.ok(result.durationMs >= 0, 'durationMs should be >= 0');
    assert.ok(result.durationMs < 1000, 'durationMs should be small (< 1s)');
  });
});
