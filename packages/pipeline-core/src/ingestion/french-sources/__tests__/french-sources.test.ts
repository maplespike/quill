// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildFrenchCitation, getFrenchSource, getFrenchSources } from '../index.js';
import { NO_REUSE_LICENSE_NOTICE } from '../../../shared/attribution.js';

describe('French-source citation license metadata', () => {
  it('does not assert a blanket publisher licence for the StatCan French source', () => {
    const source = getFrenchSource('statcan-fr');
    assert.ok(source);
    const citation = buildFrenchCitation(source, 'https://www150.statcan.gc.ca/n1/fra/table', 'abc123');
    // StatCan does publish an Open Licence, but no declaration was returned to
    // Quill for this dataset, so the citation must not name one as the basis.
    assert.equal(citation.license, NO_REUSE_LICENSE_NOTICE);
    assert.equal(citation.licenseBasis, 'no-publisher-declaration');
    assert.equal(citation.licenseUrl, undefined);
    assert.match(citation.attributionText ?? '', /Statistics Canada/);
    assert.match(citation.attributionText ?? '', /terms/i);
    assert.doesNotMatch(citation.license, /licence ouverte|open licence/i);
  });

  it('applies the same no-publisher-declaration basis to every French source', () => {
    const citations = getFrenchSources().map((source) =>
      buildFrenchCitation(source, `${source.baseUrl}/sample`, 'abc123'),
    );
    for (const citation of citations) {
      assert.equal(citation.license, NO_REUSE_LICENSE_NOTICE);
      assert.equal(citation.licenseBasis, 'no-publisher-declaration');
    }
  });

  it('does not claim a publisher license declaration for sources without terms metadata', () => {
    const source = getFrenchSource('canlii-fr');
    assert.ok(source);
    const citation = buildFrenchCitation(source, 'https://rechercher.canlii.org/search', 'abc123');
    assert.equal(citation.license, NO_REUSE_LICENSE_NOTICE);
    assert.equal(citation.licenseBasis, 'no-publisher-declaration');
    assert.match(citation.attributionText ?? '', /CanLII's terms govern/);
  });
});
