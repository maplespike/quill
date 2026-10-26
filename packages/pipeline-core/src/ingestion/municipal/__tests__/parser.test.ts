// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseArcGISResponse,
  parseCkanResponse,
  parseSocrataResponse,
} from '../parser.js';

const CKAN_PACKAGE = {
  result: {
    id: 'dataset-id',
    title: 'Dataset title',
    owner_org: 'publisher',
    license_id: 'cc-by',
    license_title: 'Creative Commons Attribution 4.0',
    license_url: 'https://creativecommons.org/licenses/by/4.0/',
    metadata_created: '2026-01-01',
    metadata_modified: '2026-01-02',
    resources: [{
      id: 'resource-id',
      name: 'Dataset resource',
      url: 'https://publisher.example/data.csv',
      format: 'CSV',
      last_modified: '2026-01-02',
    }],
  },
};

describe('municipal publisher license metadata', () => {
  it('passes CKAN package license metadata through to each resource record', async () => {
    const [record] = await parseCkanResponse(CKAN_PACKAGE, 'toronto', 'budget');
    assert.equal(record.license, 'Publisher-declared: Creative Commons Attribution 4.0');
    assert.equal(record.licenseUrl, 'https://creativecommons.org/licenses/by/4.0/');
    assert.equal(record.licenseBasis, 'publisher-metadata');
    assert.match(record.attributionText ?? '', /publisher's attribution and exclusions/);
  });

  it('uses an explicit notice when CKAN package metadata has no license declaration', async () => {
    const input = structuredClone(CKAN_PACKAGE);
    delete input.result.license_id;
    delete input.result.license_title;
    delete input.result.license_url;
    const [record] = await parseCkanResponse(input, 'toronto', 'budget');
    assert.equal(record.licenseBasis, 'no-publisher-declaration');
    assert.match(record.license ?? '', /publisher license was not declared/i);
  });

  it('preserves Socrata publisher metadata when provided with a result', async () => {
    const [record] = await parseSocrataResponse([{
      title: 'Dataset title',
      href: 'https://socrata.example/dataset',
      license_title: 'CC0 1.0',
      license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attribution: 'Publisher attribution string',
    }], 'toronto', 'budget');
    assert.equal(record.license, 'Publisher-declared: CC0 1.0');
    assert.equal(record.licenseUrl, 'https://creativecommons.org/publicdomain/zero/1.0/');
    assert.equal(record.licenseBasis, 'publisher-metadata');
    assert.equal(record.attributionText, 'Publisher attribution string');
  });

  it('does not claim a license when Socrata result metadata omits it', async () => {
    const [record] = await parseSocrataResponse([{ title: 'Dataset title' }], 'toronto', 'budget');
    assert.equal(record.licenseBasis, 'no-publisher-declaration');
    assert.match(record.license ?? '', /publisher license was not declared/i);
  });

  it('does not infer a license for ArcGIS service metadata', async () => {
    const [record] = await parseArcGISResponse([{ name: 'PublicLayer', type: 'FeatureServer' }], 'toronto', 'budget');
    assert.equal(record.licenseBasis, 'no-publisher-declaration');
    assert.match(record.license ?? '', /publisher license was not declared/i);
  });
});
