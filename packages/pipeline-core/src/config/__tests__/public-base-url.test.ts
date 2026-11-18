import test from 'node:test';
import assert from 'node:assert/strict';
import {
  apiOrigin,
  billingEmail,
  configuredCorsOrigins,
  mcpOrigin,
  portalOrigin,
  publicBaseUrl,
  relyingPartyDomain,
  statusOrigin,
} from '../public-base-url.js';

const KEYS = [
  'QUILL_PUBLIC_BASE_URL',
  'MAPLESPIKE_PUBLIC_URL',
  'MAPLESPIKE_DOMAIN',
  'APP_URL',
  'MAPLESPIKE_BILLING_EMAIL',
] as const;

function withEnv(values: Partial<Record<(typeof KEYS)[number], string | undefined>>, fn: () => void): void {
  const saved = new Map<string, string | undefined>();
  for (const key of KEYS) {
    saved.set(key, process.env[key]);
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try {
    fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('brand hosts are the default when no public URL env is set', () => {
  withEnv({}, () => {
    assert.equal(publicBaseUrl(), 'https://quill.maplespike.ca');
    assert.equal(portalOrigin(), 'https://quill.maplespike.ca');
    assert.equal(apiOrigin(), 'https://api.maplespike.ca');
    assert.equal(mcpOrigin(), 'https://mcp.maplespike.ca');
    assert.equal(statusOrigin(), 'https://status.maplespike.ca');
    assert.equal(billingEmail(), 'billing@maplespike.ca');
    assert.equal(relyingPartyDomain(), 'maplespike.ca');
    assert.ok(configuredCorsOrigins().includes('https://quill.maplespike.ca'));
    assert.ok(configuredCorsOrigins().includes('https://api.maplespike.ca'));
  });
});

test('QUILL_PUBLIC_BASE_URL overrides the older public URL env vars', () => {
  withEnv({
    QUILL_PUBLIC_BASE_URL: 'https://quill.example.org/',
    MAPLESPIKE_PUBLIC_URL: 'https://ignored.example',
    MAPLESPIKE_DOMAIN: 'ignored.example',
    APP_URL: 'http://localhost:8082',
  }, () => {
    assert.equal(publicBaseUrl(), 'https://quill.example.org');
    assert.equal(apiOrigin(), 'https://api.example.org');
    assert.equal(mcpOrigin(), 'https://mcp.example.org');
    assert.equal(statusOrigin(), 'https://status.example.org');
  });
});

test('MAPLESPIKE_DOMAIN builds the portal origin when the base URL is unset', () => {
  withEnv({ MAPLESPIKE_DOMAIN: 'maplespike.ca', APP_URL: 'https://quill.maplespike.ca' }, () => {
    assert.equal(publicBaseUrl(), 'https://quill.maplespike.ca');
    assert.equal(apiOrigin(), 'https://api.maplespike.ca');
    assert.equal(relyingPartyDomain(), 'maplespike.ca');
  });
});

test('a loopback APP_URL is used only after the domain fallbacks', () => {
  withEnv({ APP_URL: 'http://localhost:8082' }, () => {
    assert.equal(publicBaseUrl(), 'http://localhost:8082');
    assert.equal(apiOrigin(), 'http://localhost:8082');
    assert.equal(billingEmail(), 'billing@maplespike.ca');
  });
});
