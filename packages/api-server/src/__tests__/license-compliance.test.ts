
// SPDX-License-Identifier: Apache-2.0
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkLicenseCompliance, verifyAttribution } from '@maplespike/pipeline-core';
import { checkLicense, getAllPackageLicenses, withLicenseCheck } from '../middleware/license-check.js';

describe('checkLicenseCompliance', () => {
  it('should allow internal use for all licenses', () => {
    assert.deepEqual(checkLicenseCompliance('AGPL-3.0-or-later', 'internal'), { compliant: true });
    assert.deepEqual(checkLicenseCompliance('Apache-2.0', 'internal'), { compliant: true });
    assert.deepEqual(checkLicenseCompliance('MIT', 'internal'), { compliant: true });
  });

  it('should reject proprietary use for AGPL packages', () => {
    const result = checkLicenseCompliance('AGPL-3.0-or-later', 'proprietary');
    assert.equal(result.compliant, false);
    assert.ok(result.reason?.includes('AGPL-3.0'));
  });

  it('should allow proprietary use for non-AGPL packages', () => {
    assert.deepEqual(checkLicenseCompliance('Apache-2.0', 'proprietary'), { compliant: true });
    assert.deepEqual(checkLicenseCompliance('MIT', 'proprietary'), { compliant: true });
  });

  it('should require commercial license for AGPL packages in commercial use', () => {
    const result = checkLicenseCompliance('AGPL-3.0-or-later', 'commercial');
    assert.equal(result.compliant, false);
    assert.ok(result.reason?.includes('commercial license'));
  });

  it('should allow commercial use for non-AGPL packages', () => {
    assert.deepEqual(checkLicenseCompliance('Apache-2.0', 'commercial'), { compliant: true });
    assert.deepEqual(checkLicenseCompliance('MIT', 'commercial'), { compliant: true });
  });
});

describe('verifyAttribution', () => {
  it('should calculate attribution rate correctly', () => {
    const records = [
      { citation_hash: 'abc123', source_url: 'http://example.com', license: 'OGL-CA', attribution_text: 'OK' },
      { citation_hash: 'def456', source_url: 'http://example.com', license: 'OGL-CA' },
    ];
    const result = verifyAttribution(records);
    assert.equal(result.valid, 1);
    assert.equal(result.missing, 1);
    assert.equal(result.rate, 0.5);
  });

  it('should handle empty records', () => {
    const result = verifyAttribution([]);
    assert.equal(result.rate, 0);
  });
});

describe('checkLicense middleware', () => {
  it('should return compliant for internal use', () => {
    const ctx = { tenant: { tier: 'free' } } as any;
    const result = checkLicense(ctx, 'pipeline-core');
    assert.equal(result.compliant, true);
    assert.equal(result.license, 'AGPL-3.0-or-later');
  });

  it('should return all package licenses', () => {
    const licenses = getAllPackageLicenses();
    assert.equal(licenses['pipeline-core'], 'AGPL-3.0-or-later');
    assert.equal(licenses['sdk'], 'MIT');
    assert.equal(licenses['api-server'], 'Apache-2.0');
  });
});

describe('withLicenseCheck middleware', () => {
  it('should allow compliant requests', () => {
    const ctx = { tenant: { tier: 'free' } } as any;
    const result = withLicenseCheck(ctx, 'sdk');
    assert.equal(result.allowed, true);
  });
});
||||||| e980c07
 origin/main
