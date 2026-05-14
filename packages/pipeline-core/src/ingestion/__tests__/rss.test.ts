import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('RSS Parser', () => {
  it('handles empty string', async () => {
    const mod = await import('../rss.js');
    const res = mod.parseRSS('');
    assert.ok(res);
    assert.ok(Array.isArray(res.items));
    assert.equal(res.items.length, 0);
  });

  it('handles null gracefully', async () => {
    const mod = await import('../rss.js');
    const res = mod.parseRSS(null as unknown as string);
    assert.ok(res);
    assert.ok(Array.isArray(res.items));
  });
});
