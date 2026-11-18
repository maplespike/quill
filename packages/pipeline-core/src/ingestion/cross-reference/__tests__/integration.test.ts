// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { searchCrossReference } from '../index.js';

describe('Cross-Reference Integration with Trust Scoring', () => {
  it('exports searchCrossReference function', async () => {
    // Verify the function exists and is callable
    assert.equal(typeof searchCrossReference, 'function');
  });
  
  it('trust score has expected fields when calculated', async () => {
    // Import trust scoring directly to test its output
    const { calculateTrustScore } = await import('../trust-scoring.js');
    
    const score = await calculateTrustScore([90, 85], ['2024-06-01', '2024-05-15'], 'test', ['gic', 'elections']);
    
    // Verify all expected fields are present
    assert.ok('overall' in score);
    assert.ok('sourceAuthority' in score);
    assert.ok('recencyScore' in score);
    assert.ok('consistencyScore' in score);
    assert.ok('nSourceConfidence' in score);
    assert.ok('minSourcesRequired' in score);
    assert.ok('passedThreshold' in score);
    assert.ok('citationHash' in score);
    
    // Verify types
    assert.strictEqual(typeof score.overall, 'number');
    assert.strictEqual(typeof score.sourceAuthority, 'number');
    assert.strictEqual(typeof score.recencyScore, 'number');
    assert.strictEqual(typeof score.consistencyScore, 'number');
    assert.strictEqual(typeof score.nSourceConfidence, 'number');
    assert.strictEqual(typeof score.minSourcesRequired, 'number');
    assert.strictEqual(typeof score.passedThreshold, 'boolean');
    assert.strictEqual(typeof score.citationHash, 'string');
    assert.strictEqual(score.citationHash.length, 64); // SHA-256
  });
});