import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaRssMetadataProblems } from './gates/check-media-rss-metadata.mjs';

test('media and NGO RSS ingesters do not assign body text', () => {
  const problems = mediaRssMetadataProblems();
  assert.deepEqual(problems, []);
});
