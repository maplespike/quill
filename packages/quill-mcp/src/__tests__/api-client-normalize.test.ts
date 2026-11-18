import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Test the normalization logic in isolation (replicate the logic)
function normalize(base: string): string {
  const raw = base.replace(/\/+$/, '');
  if (raw === '') return '';
  return raw.endsWith('/v1') ? raw : `${raw}/v1`;
}

describe('api-client API_BASE normalization', () => {
  it('appends /v1 when missing', () => {
    assert.equal(normalize('https://api.maplespike.ca'), 'https://api.maplespike.ca/v1');
  });
  it('keeps /v1 when present', () => {
    assert.equal(normalize('https://api.maplespike.ca/v1'), 'https://api.maplespike.ca/v1');
  });
  it('strips trailing slashes', () => {
    assert.equal(normalize('https://api.maplespike.ca/v1/'), 'https://api.maplespike.ca/v1');
    assert.equal(normalize('https://api.maplespike.ca///'), 'https://api.maplespike.ca/v1');
  });
  it('returns empty for empty input', () => {
    assert.equal(normalize(''), '');
  });
  it('handles internal cluster URL', () => {
    assert.equal(normalize('http://quill-api:8082'), 'http://quill-api:8082/v1');
  });
});