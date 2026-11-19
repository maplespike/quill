import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractRIASText } from '../parser.js';
import { capRiasExcerpt, GAZETTE_SOURCE_LINK, RIAS_EXCERPT_MAX } from '../rias.js';

describe('Gazette RIAS excerpt', () => {
  it('caps extracted RIAS text at 300 characters', () => {
    const paragraph = 'A'.repeat(480);
    const html = `<h2>Regulatory Impact Analysis Statement</h2><p>${paragraph}</p><h2>Contact</h2>`;
    const text = extractRIASText(html);
    assert.equal(text?.length, RIAS_EXCERPT_MAX);
    assert.equal(text, 'A'.repeat(300));
  });

  it('keeps a short RIAS and drops empty text', () => {
    assert.equal(capRiasExcerpt('Short statement.'), 'Short statement.');
    assert.equal(capRiasExcerpt('   '), null);
    assert.equal(capRiasExcerpt(null), null);
  });

  it('points at the canada.ca gazette source', () => {
    assert.equal(GAZETTE_SOURCE_LINK, 'https://www.canada.ca/en/gazette.html');
  });
});
