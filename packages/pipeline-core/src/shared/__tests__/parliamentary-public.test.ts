// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMONS_PUBLIC_URL,
  PARLIAMENTARY_EXCERPT_MAX,
  PARLIAMENTARY_REUSE_LINE,
  PARLIAMENTARY_TOOL_NAMES,
  SENATE_PUBLIC_URL,
  isParliamentaryApiPath,
  isParliamentaryTool,
  parliamentaryAttribution,
  parliamentaryToolMetersQuota,
  presentParliamentary,
  truncateParliamentaryExcerpt,
} from '../parliamentary-public.js';
import { SHORT_EXCERPT_MAX } from '../source-policy.js';

describe('parliamentary public helper', () => {
  it('keeps the excerpt cap aligned with the source-policy short excerpt', () => {
    assert.equal(PARLIAMENTARY_EXCERPT_MAX, SHORT_EXCERPT_MAX);
    assert.equal(PARLIAMENTARY_EXCERPT_MAX, 300);
  });

  it('truncates on a word boundary and stays within 300 characters', () => {
    const words = 'committee evidence on the fiscal update '.repeat(20);
    const cut = truncateParliamentaryExcerpt(words);
    assert.ok(cut.length <= 300);
    assert.ok(cut.endsWith('…'));
    assert.equal(cut.endsWith(' e…'), false);
    assert.equal(truncateParliamentaryExcerpt('short note'), 'short note');
    const solid = truncateParliamentaryExcerpt('x'.repeat(500));
    assert.equal(solid.length, 300);
    assert.ok(solid.endsWith('…'));
  });

  it('puts the reuse line and the matching house link on the response', () => {
    const commons = presentParliamentary(
      { summary: 'word '.repeat(200), results: [{ title: 'FINA', url: 'https://www.ourcommons.ca/DocumentViewer/en/44-1/FINA/meeting-1/evidence', description: 'y'.repeat(400) }] },
      { chamber: 'commons' },
    );
    assert.match(String(commons.attribution), new RegExp(PARLIAMENTARY_REUSE_LINE.replace(/[.]/g, '\\.')));
    assert.match(String(commons.attribution), /ourcommons\.ca/);
    assert.equal(String(commons.attribution).includes('sencanada.ca'), false);
    const row = (commons.results as Record<string, unknown>[])[0];
    assert.ok(String(row.description).length <= 300);
    assert.match(String(row.attribution), /ourcommons\.ca/);
    assert.match(String(row.attribution), /not an official version/);
    assert.match(String(row.attribution), /does not imply endorsement/);

    const senate = presentParliamentary({ notes: 'brief' }, { chamber: 'senate' });
    assert.match(String(senate.attribution), /sencanada\.ca/);
    assert.equal(String(senate.source_url), SENATE_PUBLIC_URL);

    const both = parliamentaryAttribution('both');
    assert.match(both, /ourcommons\.ca/);
    assert.match(both, /sencanada\.ca/);
    assert.match(both, /non-commercial use/);
    assert.equal(COMMONS_PUBLIC_URL.includes('ourcommons.ca'), true);
  });

  it('does not count parliamentary tools or export paths toward a paid quota', () => {
    for (const name of PARLIAMENTARY_TOOL_NAMES) {
      assert.equal(isParliamentaryTool(name), true, name);
      assert.equal(isParliamentaryTool(name.replace(/_/g, '-')), true, name);
      assert.equal(parliamentaryToolMetersQuota(name), false, name);
    }
    assert.equal(isParliamentaryTool('search_gazette'), false);
    assert.equal(parliamentaryToolMetersQuota('search_gazette'), true);
    assert.equal(isParliamentaryApiPath('/v1/export/committees'), true);
    assert.equal(isParliamentaryApiPath('/v1/export/committees/abc'), true);
    assert.equal(isParliamentaryApiPath('/v1/export/parliamentary-voting'), true);
    assert.equal(isParliamentaryApiPath('/v1/export/sedi'), false);
    assert.equal(isParliamentaryApiPath('/v1/export/gazette'), false);
  });
});
