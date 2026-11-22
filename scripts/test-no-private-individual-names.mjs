import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privateNameProblems } from './gates/check-no-private-individual-names.mjs';

test('donor name fields stay out of schema and donation output', () => {
  assert.deepEqual(privateNameProblems(), []);
});
