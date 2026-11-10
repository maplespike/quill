// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseUpdateFrequencyToSeconds } from '../data-quality.js';

describe('parseUpdateFrequencyToSeconds', () => {
  it('maps named cadences to seconds', () => {
    assert.strictEqual(parseUpdateFrequencyToSeconds('continuous'), 300);
    assert.strictEqual(parseUpdateFrequencyToSeconds('30 min'), 1800);
    assert.strictEqual(parseUpdateFrequencyToSeconds('hourly'), 3600);
    assert.strictEqual(parseUpdateFrequencyToSeconds('daily'), 86400);
    assert.strictEqual(parseUpdateFrequencyToSeconds('weekly'), 604800);
    assert.strictEqual(parseUpdateFrequencyToSeconds('biweekly'), 1209600);
    assert.strictEqual(parseUpdateFrequencyToSeconds('monthly'), 2592000);
    assert.strictEqual(parseUpdateFrequencyToSeconds('quarterly'), 7776000);
    assert.strictEqual(parseUpdateFrequencyToSeconds('annual'), 31536000);
    assert.strictEqual(parseUpdateFrequencyToSeconds('on-demand'), Infinity);
    assert.strictEqual(parseUpdateFrequencyToSeconds('on-ingest'), Infinity);
    assert.strictEqual(parseUpdateFrequencyToSeconds('unknown'), 86400);
  });

  it('parses numeric patterns', () => {
    assert.strictEqual(parseUpdateFrequencyToSeconds('2 hours'), 7200);
    assert.strictEqual(parseUpdateFrequencyToSeconds('7 days'), 604800);
    assert.strictEqual(parseUpdateFrequencyToSeconds('3 months'), 7776000);
  });

  it('takes the fastest cadence from multi-cadence descriptors', () => {
    assert.strictEqual(
      parseUpdateFrequencyToSeconds('annual (budget), quarterly (fiscal monitor)'),
      7776000,
    );
    assert.strictEqual(
      parseUpdateFrequencyToSeconds('quarterly (NAAG), annual (health, education, tax)'),
      7776000,
    );
  });

  it('handles parenthetical single cadences', () => {
    assert.strictEqual(
      parseUpdateFrequencyToSeconds('daily (during election periods)'),
      86400,
    );
    assert.strictEqual(
      parseUpdateFrequencyToSeconds('daily (fire season)'),
      86400,
    );
  });

  it('falls back to 24 hours for unknown tokens without recursing infinitely', () => {
    assert.strictEqual(parseUpdateFrequencyToSeconds('unknown-token'), 86400);
  });
});
