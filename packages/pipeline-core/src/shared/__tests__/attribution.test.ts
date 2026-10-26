// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NO_REUSE_LICENSE_NOTICE,
  OGL_CANADA_ATTRIBUTION_STATEMENT,
  LOBBYING_ODLA_ATTRIBUTION_STATEMENT,
  buildAttribution,
  formatAttribution,
  resolvePublisherLicense,
  withPublisherLicense,
} from '../attribution.js';

const withPublisherLicenseForTest = withPublisherLicense;

describe('publisher license metadata', () => {
  it('preserves CKAN license identifier, display name, and URL', () => {
    const terms = resolvePublisherLicense({
      license_id: 'ogl-alberta-2.2',
      license_title: 'Open Government Licence - Alberta',
      license_url: 'https://open.alberta.ca/licence',
    });
    assert.equal(terms.license, 'Publisher-declared: Open Government Licence - Alberta');
    assert.equal(terms.licenseUrl, 'https://open.alberta.ca/licence');
    assert.equal(terms.basis, 'publisher-metadata');
    assert.match(terms.attributionText, /publisher's attribution and exclusions/);
  });

  it('normalizes a raw publisher license label from search results', () => {
    const terms = resolvePublisherLicense({
      license: 'CC BY 4.0',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
    });
    assert.equal(terms.license, 'Publisher-declared: CC BY 4.0');
    assert.equal(terms.licenseUrl, 'https://creativecommons.org/licenses/by/4.0/');
    assert.equal(terms.basis, 'publisher-metadata');
  });

  it('does not mislabel a configured source license as a publisher declaration', () => {
    const terms = resolvePublisherLicense({
      license: 'Open Data License',
      license_basis: 'source-configuration',
    });
    assert.equal(terms.license, 'Open Data License');
    assert.equal(terms.basis, 'source-configuration');
    assert.match(terms.attributionText, /source configuration/);
  });

  it('does not treat a bare Quill-owned license field as publisher metadata', () => {
    const terms = resolvePublisherLicense({ license: 'Open Data License' });
    assert.equal(terms.basis, 'no-publisher-declaration');
    assert.equal(terms.license, NO_REUSE_LICENSE_NOTICE);
  });

  it('does not promote wrapped source configuration to publisher metadata', () => {
    const terms = resolvePublisherLicense({
      data: { id: 'wrapped' },
      attribution: {
        source: 'Statistics Canada',
        sourceUrl: 'https://www.statcan.gc.ca/',
        license: 'Statistics Canada Open Licence (source configuration; dataset coverage not verified)',
        licenseUrl: 'https://www.statcan.gc.ca/en/terms-conditions/open-licence',
        licenseBasis: 'source-configuration',
        attributionText: "Statistics Canada's Open Licence governs covered information.",
      },
    });
    assert.equal(terms.basis, 'source-configuration');
    assert.equal(terms.licenseUrl, 'https://www.statcan.gc.ca/en/terms-conditions/open-licence');
    assert.match(terms.attributionText, /source configuration|Statistics Canada's Open Licence/);
  });

  it('preserves attribution from a wrapped record without calling it a license', () => {
    const terms = resolvePublisherLicense({
      data: { id: 'wrapped' },
      attribution: {
        source: 'Example publisher',
        license: NO_REUSE_LICENSE_NOTICE,
        licenseBasis: 'no-publisher-declaration',
        attributionText: 'Publisher attribution note.',
      },
    });
    assert.equal(terms.basis, 'no-publisher-declaration');
    assert.equal(terms.license, NO_REUSE_LICENSE_NOTICE);
    assert.equal(terms.attributionText, 'Publisher attribution note.');
  });

  it('preserves normalized publisher metadata across cache passes', () => {
    const record = withPublisherLicenseForTest({
      license_title: 'CC BY 4.0',
      license_url: 'https://creativecommons.org/licenses/by/4.0/',
    });
    const terms = resolvePublisherLicense(record);
    assert.equal(terms.license, 'Publisher-declared: CC BY 4.0');
    assert.equal(terms.basis, 'publisher-metadata');
  });

  it('preserves a publisher terms URL without inventing a named license', () => {
    const terms = resolvePublisherLicense({
      license_url: 'https://example.org/terms-of-use',
    });
    assert.equal(terms.license, 'Publisher-declared: terms at https://example.org/terms-of-use');
    assert.equal(terms.licenseUrl, 'https://example.org/terms-of-use');
    assert.equal(terms.basis, 'publisher-metadata');
  });

  it('emits an explicit no-declaration notice without implying the publisher prohibits reuse', () => {
    const terms = resolvePublisherLicense({ title: 'Dataset without license metadata' });
    assert.equal(terms.license, NO_REUSE_LICENSE_NOTICE);
    assert.equal(terms.basis, 'no-publisher-declaration');
    assert.match(terms.attributionText, /returned dataset metadata contains no publisher license declaration/i);
    assert.doesNotMatch(terms.license, /unknown/i);
  });

  it('marks configured attribution terms as source configuration', () => {
    const attribution = buildAttribution('StatCan', {
      license: 'Statistics Canada Open Licence',
      licenseUrl: 'https://www.statcan.gc.ca/en/terms-conditions/open-licence',
    });
    assert.equal(attribution.licenseBasis, 'source-configuration');
  });

  it('formats source and license terms additively', () => {
    const text = formatAttribution(buildAttribution('Example Dataset', {
      sourceUrl: 'https://example.org/data',
      license: 'Publisher-declared: CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      licenseBasis: 'publisher-metadata',
    }));
    assert.match(text, /Example Dataset/);
    assert.match(text, /CC BY 4.0/);
    assert.match(text, /creativecommons.org/);
  });
});

describe('fixed licence attribution statements', () => {
  it('uses the OGL–Canada required statement when the publisher declares OGL–Canada', () => {
    const terms = withPublisherLicenseForTest({
      license_id: 'ca-ogl-lgo',
      license_title: 'Open Government Licence - Canada',
      license_url: 'https://open.canada.ca/en/open-government-licence-canada',
    });
    assert.equal(terms.license, 'Publisher-declared: Open Government Licence - Canada');
    assert.equal(terms.attribution_text, 'Contains information licensed under the Open Government Licence – Canada.');
    assert.equal(terms.license_basis, 'publisher-metadata');
    assert.equal(terms.license_url, 'https://open.canada.ca/en/open-government-licence-canada');
  });

  it('defaults the OGL–Canada licence URL when the declaration omits a link', () => {
    const terms = resolvePublisherLicense({ license_title: 'Open Government Licence – Canada' });
    assert.equal(terms.licenseUrl, 'https://open.canada.ca/en/open-government-licence-canada');
    assert.equal(terms.attributionText, OGL_CANADA_ATTRIBUTION_STATEMENT);
  });

  it('does not attach the federal OGL statement to a non-federal open government licence', () => {
    const terms = resolvePublisherLicense({
      license_title: 'Open Government Licence - Alberta',
      license_url: 'https://open.alberta.ca/licence',
    });
    assert.match(terms.attributionText, /Alberta/);
    assert.doesNotMatch(terms.attributionText, /licence\s*[–—-]\s*canada/i);
    assert.equal(terms.licenseUrl, 'https://open.alberta.ca/licence');
  });

  it('uses the lobbying open data licence statement when the publisher declares it', () => {
    const terms = resolvePublisherLicense({
      license_title: 'Open Data Licence Agreement - Office of the Commissioner of Lobbying',
      license_url: 'https://lobbycanada.gc.ca/en/open-data/open-data-licence-agreement/',
    });
    assert.equal(terms.attributionText, LOBBYING_ODLA_ATTRIBUTION_STATEMENT);
  });

  it('keeps a publisher-supplied attribution text instead of the default statement', () => {
    const terms = resolvePublisherLicense({
      license_title: 'Open Government Licence - Canada',
      attribution_text: 'Source: Example Department, dataset X.',
    });
    assert.equal(terms.attributionText, 'Source: Example Department, dataset X.');
  });

  it('keeps the fixed statement across a cache pass', () => {
    const record = withPublisherLicenseForTest({
      license_title: 'Open Government Licence - Canada',
      license_url: 'https://open.canada.ca/open-government-licence-canada',
    });
    const terms = resolvePublisherLicense(record);
    assert.equal(terms.attributionText, OGL_CANADA_ATTRIBUTION_STATEMENT);
    assert.equal(terms.basis, 'publisher-metadata');
  });

  it('never attaches a fixed statement to a no-declaration record', () => {
    const terms = resolvePublisherLicense({ title: 'record with no licence fields' });
    assert.equal(terms.basis, 'no-publisher-declaration');
    assert.doesNotMatch(terms.attributionText, /Contains information licensed/);
  });
});
