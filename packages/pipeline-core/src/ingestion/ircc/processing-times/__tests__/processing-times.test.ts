import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('ircc:processing-times', () => {
  it('should define the ingest function', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.ingestProcessingTime, 'function');
  });
  it('should define search functions', async () => {
    const mod = await import('../index.js');
    assert.strictEqual(typeof mod.searchByVisaOffice, 'function');
    assert.strictEqual(typeof mod.searchByApplicationType, 'function');
  });
});
