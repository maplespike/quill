// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SOURCE_POLICY,
  policyForModule,
  policyForSource,
  isCommercialUseBlocked,
  restrictsPersonProfiles,
  aggregateOnlySources,
  statcanAttributionNotice,
  applySourcePolicy,
  stripContentBodies,
  minimizePersonalInfo,
  SHORT_EXCERPT_MAX,
} from '../source-policy.js';

describe('source licence policy — flags', () => {
  it('committee sources are commercial-use-blocked and discovery-only', () => {
    for (const id of ['committees', 'parliamentary-voting']) {
      const policy = policyForModule(id);
      assert.equal(policy.commercialUse, false, `${id} must block commercial use`);
      assert.equal(policy.discoveryOnly, true, `${id} must be discovery-only`);
    }
    assert.equal(isCommercialUseBlocked('committees'), true);
    assert.equal(isCommercialUseBlocked('committees-not'), false);
  });

  it('lobbying and charity sources minimize personal information', () => {
    for (const id of [
      'federal-lobbying-monthly',
      'provincial-lobbying',
      'quebec-lobbying',
      'ontario-lobbying',
      'cra-charity',
      'political-donations',
    ]) {
      assert.equal(policyForModule(id).minimizePersonalInformation, true, `${id} must minimize PII`);
    }
    // The entity graph and backfills use the umbrella name 'lobbying'.
    assert.equal(policyForModule('lobbying').minimizePersonalInformation, true);
    assert.equal(restrictsPersonProfiles('lobbying'), true);
    assert.equal(restrictsPersonProfiles('bank-of-canada'), false);
  });

  it('Statistics Canada sources are aggregate-only', () => {
    for (const id of ['statcan', 'nu-statcan']) {
      assert.equal(policyForModule(id).aggregateOnly, true, `${id} must be aggregate-only`);
    }
    assert.equal(aggregateOnlySources().includes('statcan'), true);
    assert.equal(aggregateOnlySources().includes('committees'), false);
  });

  it('link-only sources restrict content to citations, metadata, and short excerpts', () => {
    for (const id of ['canlii', 'sedar-plus', 'sedi', 'media-broadcasting', 'ngo-influence-rss']) {
      assert.equal(policyForModule(id).linkOnly, true, `${id} must be link-only`);
    }
    // Module aliases resolve to the underlying family policy.
    assert.equal(policyForModule('canlii-fr').linkOnly, true);
    assert.equal(policyForModule('rss').linkOnly, true);
  });

  it('Gazette and legislation carry the not-official-version policy', () => {
    for (const id of ['gazette', 'legislation']) {
      assert.equal(policyForModule(id).notOfficialVersion, true, `${id} must carry the notice`);
    }
  });

  it('unknown sources default to unrestricted (negative control)', () => {
    assert.deepEqual(policyForSource('no-such-family'), DEFAULT_SOURCE_POLICY);
    assert.deepEqual(policyForModule('bank-of-canada'), DEFAULT_SOURCE_POLICY);
  });
});

describe('content projection', () => {
  it('strips content bodies at any depth and keeps metadata', () => {
    const record = {
      id: 'm1',
      title: 'Meeting 37',
      date: '2026-01-15',
      url: 'https://www.ourcommons.ca/example',
      interventions: [
        { speakerName: 'A. Person', text: 'long speech', speech: 'x', transcript: 'y' },
      ],
      content: '<html>',
    };
    const out = stripContentBodies(record) as Record<string, never>;
    const intervention = (out.interventions as unknown as Record<string, unknown>[])[0];
    assert.equal(intervention.text, undefined);
    assert.equal(intervention.speech, undefined);
    assert.equal(intervention.transcript, undefined);
    assert.equal(out.content, undefined);
    assert.equal(intervention.speakerName, 'A. Person');
    assert.equal(out.title, 'Meeting 37');
    assert.equal(out.url, 'https://www.ourcommons.ca/example');
  });

  it('truncates summaries to the short excerpt limit when asked', () => {
    const out = stripContentBodies(
      { summary: 'x'.repeat(600), description: 'short', abstract: 'y'.repeat(400) },
      { maxSummaryLength: SHORT_EXCERPT_MAX },
    ) as Record<string, string>;
    assert.equal(out.summary.length, SHORT_EXCERPT_MAX);
    assert.equal(out.description, 'short');
    assert.equal(out.abstract.length, SHORT_EXCERPT_MAX);
  });
});

describe('personal-information minimization', () => {
  it('strips personal contact fields inside person-like objects', () => {
    const record = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '555-1234',
      role: 'Registrant',
    };
    const out = minimizePersonalInfo(record) as Record<string, unknown>;
    assert.equal(out.email, undefined);
    assert.equal(out.phone, undefined);
    assert.equal(out.name, 'Jane Doe');
    assert.equal(out.role, 'Registrant');
  });

  it('keeps organization contact details on org-like objects (negative control)', () => {
    const record = {
      name: 'Acme Foundation',
      bn: '123456789RR0001',
      email: 'info@acme.org',
      address: '1 Main St',
    };
    const out = minimizePersonalInfo(record) as Record<string, unknown>;
    assert.equal(out.email, 'info@acme.org');
    assert.equal(out.address, '1 Main St');
  });

  it('always strips home addresses and government identifiers', () => {
    const record = { org: 'X', homeAddress: '12 Elm St', sin: '123-456-789' };
    const out = minimizePersonalInfo(record) as Record<string, unknown>;
    assert.equal(out.homeAddress, undefined);
    assert.equal(out.sin, undefined);
    assert.equal(out.org, 'X');
  });
});

describe('applySourcePolicy — committees', () => {
  it('discovery-only projection drops text and attaches the required notices', () => {
    const { records, policy } = applySourcePolicy('committees', [
      { id: 'i1', speakerName: 'X', text: 'speech body', timestamp: '10:00' },
    ]);
    const record = records[0] as Record<string, unknown>;
    assert.equal(record.text, undefined);
    assert.equal(record.speakerName, 'X');
    assert.equal(policy.discovery_only, true);
    assert.equal(policy.commercial_use, false);
    assert.ok(policy.notices.some((n) => n.includes("Speaker's Permission")));
    assert.ok(policy.notices.some((n) => n.includes('Senate')));
  });

  it('negative control: unflagged sources pass through unchanged', () => {
    const input = [{ id: 'r1', title: 'Rate', text: 'kept for unflagged sources' }];
    const { records, policy } = applySourcePolicy('bank-of-canada', input);
    assert.deepEqual(records, input);
    assert.equal(policy.discovery_only, false);
    assert.equal(policy.notices.length, 0);
  });
});

describe('applySourcePolicy — lobbying minimization', () => {
  it('minimizes personal contact fields on lobbying records', () => {
    const { records, policy } = applySourcePolicy('federal-lobbying-monthly', [
      {
        id: 'l1',
        client_name: 'Acme Corp',
        registrant: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '555-1234',
          homeAddress: '12 Elm St',
        },
      },
    ]);
    const record = records[0] as Record<string, any>;
    assert.equal(record.registrant.email, undefined);
    assert.equal(record.registrant.phone, undefined);
    assert.equal(record.registrant.homeAddress, undefined);
    assert.equal(record.registrant.name, 'Jane Doe');
    assert.equal(record.client_name, 'Acme Corp');
    assert.equal(policy.minimize_personal_information, true);
  });

  it('negative control: unflagged sources keep contact fields', () => {
    const input = [{ id: 'b1', email: 'contact@bankofcanada.ca', phone: '1-800-303-1282' }];
    const { records } = applySourcePolicy('bank-of-canada', input);
    assert.deepEqual(records, input);
  });
});

describe('applySourcePolicy — Statistics Canada notices', () => {
  it('builds the licence notices with and without product details', () => {
    assert.equal(
      statcanAttributionNotice(),
      'Source: Statistics Canada. Reproduced and distributed on an "as is" basis with the permission of Statistics Canada.',
    );
    assert.equal(
      statcanAttributionNotice({ product: 'Table 18-10-0004-01', referenceDate: '2026-08' }),
      'Source: Statistics Canada, Table 18-10-0004-01, 2026-08. Reproduced and distributed on an "as is" basis with the permission of Statistics Canada.',
    );
    assert.equal(
      statcanAttributionNotice({ product: 'CPI', referenceDate: '2026-08', adapted: true }),
      'Adapted from Statistics Canada, CPI, 2026-08. This does not constitute an endorsement by Statistics Canada of this product.',
    );
  });

  it('attaches the source notice to StatCan records that carry product fields', () => {
    const { records, policy } = applySourcePolicy('statcan', [
      { id: 's1', productId: '18-10-0004-01', period: '2026-08', value: 161.8 },
    ]);
    const record = records[0] as Record<string, unknown>;
    assert.equal(
      record.attribution_text,
      'Source: Statistics Canada, 18-10-0004-01, 2026-08. Reproduced and distributed on an "as is" basis with the permission of Statistics Canada.',
    );
    assert.equal(policy.aggregate_only, true);
  });

  it('keeps publisher-supplied attribution text when present', () => {
    const { records } = applySourcePolicy('statcan', [
      { id: 's2', attribution_text: 'Source: Statistics Canada, custom.' },
    ]);
    assert.equal((records[0] as Record<string, unknown>).attribution_text, 'Source: Statistics Canada, custom.');
  });
});

describe('applySourcePolicy — link-only sources', () => {
  it('keeps citations/metadata, drops content bodies, and cuts summaries to a short excerpt', () => {
    const { records, policy } = applySourcePolicy('canlii', [
      {
        id: 'c1',
        caseName: 'Dunsmuir v. New Brunswick',
        citation: '2008 SCC 9 (CanLII)',
        url: 'https://www.canlii.org/en/ca/scc/doc/2008/2008scc9/',
        text: 'full decision text',
        summary: 's'.repeat(500),
      },
    ]);
    const record = records[0] as Record<string, unknown>;
    assert.equal(record.text, undefined);
    assert.equal(record.caseName, 'Dunsmuir v. New Brunswick');
    assert.equal(record.citation, '2008 SCC 9 (CanLII)');
    assert.equal(record.url, 'https://www.canlii.org/en/ca/scc/doc/2008/2008scc9/');
    assert.ok(typeof record.summary === 'string' && record.summary.length <= SHORT_EXCERPT_MAX);
    assert.equal(policy.link_only, true);
  });

  it('negative control: unflagged sources keep content fields', () => {
    const input = [{ id: 'x1', text: 'kept for unflagged sources' }];
    const { records } = applySourcePolicy('bank-of-canada', input);
    assert.deepEqual(records, input);
  });
});

describe('applySourcePolicy — not-official-version notices', () => {
  it('attaches the notice to Gazette records and the policy block', () => {
    const { records, policy } = applySourcePolicy('gazette', [
      { id: 'g1', title: 'SOR/2026-123' },
    ]);
    const record = records[0] as Record<string, unknown>;
    assert.ok(String(record.notice).includes('Not an official version'));
    assert.equal(policy.not_official_version, true);
    assert.ok(policy.notices.some((n) => n.includes('official version')));
  });

  it('keeps an existing notice field', () => {
    const { records } = applySourcePolicy('legislation', [
      { id: 'l1', notice: 'custom' },
    ]);
    assert.equal((records[0] as Record<string, unknown>).notice, 'custom');
  });
});
