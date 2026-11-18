/**
 * Pipeline-data citation fallback is env-only.
 * Unset keeps the claim-store 404. A configured path that is missing is 503.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { getCitationHandler } from '../routes/citation.js';
import { makeCtx } from './_helpers.js';

const HASH = 'ab'.repeat(32);

test('citation lookup stays 404 when pipeline data is not configured', async () => {
  const previous = process.env.QUILL_PIPELINE_DATA_PATH;
  delete process.env.QUILL_PIPELINE_DATA_PATH;
  try {
    const res = await getCitationHandler(
      new Request(`http://test.local/v1/citation/${HASH}`),
      makeCtx(),
      { id: HASH },
    );
    assert.equal(res.status, 404);
  } finally {
    if (previous === undefined) delete process.env.QUILL_PIPELINE_DATA_PATH;
    else process.env.QUILL_PIPELINE_DATA_PATH = previous;
  }
});

test('citation lookup is 503 when the configured pipeline data file is missing', async () => {
  const previous = process.env.QUILL_PIPELINE_DATA_PATH;
  process.env.QUILL_PIPELINE_DATA_PATH = '/tmp/quill-pipeline-data-does-not-exist.json';
  try {
    const res = await getCitationHandler(
      new Request(`http://test.local/v1/citation/${HASH}`),
      makeCtx(),
      { id: HASH },
    );
    assert.equal(res.status, 503);
    const body = await res.json() as { error: { code: string; message: string } };
    assert.equal(body.error.code, 'PIPELINE_DATA_UNAVAILABLE');
    assert.match(body.error.message, /QUILL_PIPELINE_DATA_PATH/);
  } finally {
    if (previous === undefined) delete process.env.QUILL_PIPELINE_DATA_PATH;
    else process.env.QUILL_PIPELINE_DATA_PATH = previous;
  }
});
