// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTrustScore } from '../trust-scoring.js';

describe('Trust Scoring', () => {
  it('calculates trust score for known sources', async () => {
    const score = await calculateTrustScore([95, 92, 90], ['2024-01-15', '2024-01-10'], 'test entity', ['statcan', 'elections', 'gic']);
    assert.strictEqual(typeof score.overall, 'number');
    // With old dates (2024), recency score is low, so overall should be moderate
    assert.ok(score.overall > 60 && score.overall < 80);
    assert.strictEqual(score.passedThreshold, true); // Default threshold is 0
    assert.strictEqual(typeof score.citationHash, 'string');
    assert.strictEqual(score.citationHash.length, 64);
  });

  it('handles unknown sources with default authority', async () => {
    const score = await calculateTrustScore([50, 50], ['2024-01-15'], 'test entity', ['unknown1', 'unknown2']);
    assert.strictEqual(score.sourceAuthority, 50);
    assert.ok(score.overall < 60);
  });

  it('applies N-source confidence correctly', async () => {
    // With 2 sources and min 2 required -> should get medium confidence
    const score = await calculateTrustScore([90, 85], ['2024-01-15', '2024-01-10'], 'test entity', ['gic', 'elections'], { minSources: 2 });
    assert.strictEqual(score.nSourceConfidence, 60);
    
    // With 3 sources and min 2 required -> should get high confidence
    const score2 = await calculateTrustScore([90, 85, 80], ['2024-01-15', '2024-01-10', '2024-01-05'], 'test entity', ['gic', 'elections', 'statcan'], { minSources: 2 });
    assert.strictEqual(score2.nSourceConfidence, 80);
  });

  it('respects high sensitivity threshold', async () => {
    const score = await calculateTrustScore([70, 65], ['2024-01-15'], 'test entity', ['influence', 'lobbying'], { highSensitivity: true });
    assert.strictEqual(score.passedThreshold, false); // Below 60 threshold for high sensitivity
    
    const score2 = await calculateTrustScore([70, 65], ['2024-01-15'], 'test entity', ['influence', 'lobbying'], { highSensitivity: false });
    assert.strictEqual(score2.passedThreshold, true); // Above 0 threshold for normal sensitivity
  });
});