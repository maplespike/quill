// SPDX-License-Identifier: Apache-2.0
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ZodError } from 'zod';
import { validateParams } from './schemas.js';

describe('SDK param schemas on Zod 4', () => {
  it('leaves missing optional coerce fields absent and coerces numeric strings', () => {
    const empty = validateParams('committees', 'committee-membership', {});
    assert.deepEqual(empty, {});

    const coerced = validateParams('committees', 'committee-membership', {
      parliament: '44',
      limit: '10',
    });
    assert.deepEqual(coerced, { parliament: 44, limit: 10 });
  });

  it('reports a missing required field on ZodError.issues', () => {
    assert.throws(
      () => validateParams('corporate', 'corporation-profile', {}),
      (err: unknown) => {
        assert.ok(err instanceof ZodError);
        assert.equal('errors' in err, false);
        assert.equal(err.issues[0]?.path.join('.'), 'business_number');
        return true;
      },
    );
  });
});
