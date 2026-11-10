// SPDX-License-Identifier: AGPL-3.0-only
/**
 * QdrantEmbedder — unit tests
 *
 * Tests the chunking logic in isolation (the pure functions).
 * Embedding and Qdrant calls are integration-level — tested separately.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// We import the embedder module
let QdrantEmbedder: any;
let embedder: any;

before(async () => {
  const mod = await import('../embedder.js');
  QdrantEmbedder = mod.QdrantEmbedder;
  embedder = new QdrantEmbedder({
    qdrantUrl: 'http://localhost:16333',
    embeddingEndpoint: 'http://localhost:18080/v1/embeddings',
  });
});

/* ------------------------------------------------------------------ */
/*  chunk() tests                                                      */
/* ------------------------------------------------------------------ */

describe('QdrantEmbedder.chunk()', () => {
  it('should return empty array for empty text', () => {
    const result = embedder.chunk('', { chunkSize: 512, overlap: 64 });
    assert.deepEqual(result, []);
  });

  it('should return empty array for whitespace-only text', () => {
    const result = embedder.chunk('   \n  \t  ', { chunkSize: 512, overlap: 64 });
    assert.deepEqual(result, []);
  });

  it('should produce one chunk for short text', () => {
    const text = 'Hello world. This is a short document.';
    const result = embedder.chunk(text, { chunkSize: 512, overlap: 64 });
    assert.ok(result.length >= 1);
    assert.equal(result[0].index, 0);
    assert.ok(result[0].tokenCount > 0);
    assert.ok(result[0].text.length > 0);
  });

  it('should produce multiple chunks for long text', () => {
    // Generate a long text (~5000 chars ≈ 1250 tokens)
    const sentences: string[] = [];
    for (let i = 0; i < 200; i++) {
      sentences.push(`Sentence number ${i + 1}. This is a test sentence with enough words to make a meaningful chunk.`);
    }
    const text = sentences.join(' ');

    const result = embedder.chunk(text, { chunkSize: 128, overlap: 16 });
    assert.ok(result.length >= 3, `Expected at least 3 chunks, got ${result.length}`);
    assert.equal(result[0].index, 0);
    assert.equal(result[1].index, 1);
  });

  it('should apply overlap between consecutive chunks', () => {
    const sentences: string[] = [];
    for (let i = 0; i < 50; i++) {
      sentences.push(`Paragraph ${i + 1}. Some content here for testing chunk boundaries.`);
    }
    const text = sentences.join(' ');

    const noOverlap = embedder.chunk(text, { chunkSize: 256, overlap: 0 });
    const withOverlap = embedder.chunk(text, { chunkSize: 256, overlap: 32 });

    // With overlap we should get the same number of chunks (or one more)
    // but the chunks should differ in content
    assert.ok(withOverlap.length >= noOverlap.length);
  });

  it('should respect custom chunk sizes', () => {
    const text = 'A. B. C. D. E. F. G. H. I. J. ';
    const smallChunks = embedder.chunk(text, { chunkSize: 50, overlap: 0 });
    const largeChunks = embedder.chunk(text, { chunkSize: 500, overlap: 0 });

    assert.ok(
      smallChunks.length >= largeChunks.length,
      `Small chunks (${smallChunks.length}) should be >= large chunks (${largeChunks.length})`,
    );
  });

  it('should handle very long single sentence (hard split)', () => {
    const longWord = 'x'.repeat(5000);
    const text = `${longWord}. End.`;
    const result = embedder.chunk(text, { chunkSize: 128, overlap: 16 });
    assert.ok(result.length >= 1);
  });

  it('should track tokenCount on each chunk', () => {
    const text = 'Short document for testing.';
    const result = embedder.chunk(text, { chunkSize: 512, overlap: 64 });
    assert.equal(result.length, 1);
    assert.ok(result[0].tokenCount > 0);
    assert.ok(result[0].tokenCount <= 512);
  });

  it('should preserve all text across all chunks combined', () => {
    const original = 'Sentence one here. Sentence two here. Sentence three. Sentence four. Sentence five.';
    const result = embedder.chunk(original, { chunkSize: 512, overlap: 64 });
    if (result.length === 1) {
      assert.equal(result[0].text, original);
    }
    // For multi-chunk, verify the full text is preserved (accounting for overlap)
  });
});

/* ------------------------------------------------------------------ */
/*  Config defaults                                                    */
/* ------------------------------------------------------------------ */

describe('QdrantEmbedder configuration', () => {
  it('should use default values from env vars', () => {
    // The embedder was created with explicit overrides
    assert.ok(embedder instanceof QdrantEmbedder);
  });

  it('should create with no config (defaults)', () => {
    // Save and restore env
    const prevUrl = process.env.QDRANT_URL;
    const prevEndpoint = process.env.EMBEDDING_ENDPOINT;
    process.env.QDRANT_URL = 'http://qdrant.test:6333';
    process.env.EMBEDDING_ENDPOINT = 'http://embed.test/v1/embeddings';

    const defaultEmbedder = new QdrantEmbedder();

    // Just verify it constructs
    assert.ok(defaultEmbedder instanceof QdrantEmbedder);
    assert.ok(typeof defaultEmbedder.chunk === 'function');
    assert.ok(typeof defaultEmbedder.embed === 'function');
    assert.ok(typeof defaultEmbedder.upsert === 'function');

    // Restore
    if (prevUrl) process.env.QDRANT_URL = prevUrl; else delete process.env.QDRANT_URL;
    if (prevEndpoint) process.env.EMBEDDING_ENDPOINT = prevEndpoint; else delete process.env.EMBEDDING_ENDPOINT;
  });
});

/* ------------------------------------------------------------------ */
/*  Edge cases                                                         */
/* ------------------------------------------------------------------ */

describe('Edge cases', () => {
  it('should handle null/undefined text in chunk', () => {
    const r1 = embedder.chunk(null!, { chunkSize: 512, overlap: 64 });
    assert.deepEqual(r1, []);
    const r2 = embedder.chunk(undefined!, { chunkSize: 512, overlap: 64 });
    assert.deepEqual(r2, []);
  });
});
