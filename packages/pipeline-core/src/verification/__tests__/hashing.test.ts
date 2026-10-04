/**
 * Hashing Utility Tests — Quill
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeHash, verifyHash, generateVerifyCommand } from '../../../dist/verification/hashing.js';

describe('computeHash', () => {
  it('should compute SHA-256 hash of simple string', async () => {
    const hash = await computeHash('hello world');
    assert.strictEqual(typeof hash, 'string');
    assert.strictEqual(hash.length, 64);
  });

  it('should compute same hash for identical content', async () => {
    const hash1 = await computeHash('test content');
    const hash2 = await computeHash('test content');
    assert.strictEqual(hash1, hash2);
  });

  it('should compute different hashes for different content', async () => {
    const hash1 = await computeHash('content A');
    const hash2 = await computeHash('content B');
    assert.notStrictEqual(hash1, hash2);
  });

  it('should handle empty string', async () => {
    const hash = await computeHash('');
    assert.strictEqual(typeof hash, 'string');
    assert.strictEqual(hash.length, 64);
  });

  it('should handle Unicode content', async () => {
    const hash = await computeHash('Hello 世界 🌍');
    assert.strictEqual(typeof hash, 'string');
    assert.strictEqual(hash.length, 64);
  });

  it('should support SHA-384 algorithm', async () => {
    const hash = await computeHash('test', 'sha384');
    assert.strictEqual(typeof hash, 'string');
    assert.strictEqual(hash.length, 96);
  });

  it('should support SHA-512 algorithm', async () => {
    const hash = await computeHash('test', 'sha512');
    assert.strictEqual(typeof hash, 'string');
    assert.strictEqual(hash.length, 128);
  });

  it('should produce deterministic hashes', async () => {
    const content = 'MapleSpike test data';
    const hashes = await Promise.all([
      computeHash(content),
      computeHash(content),
      computeHash(content),
    ]);
    assert.strictEqual(hashes[0], hashes[1]);
    assert.strictEqual(hashes[1], hashes[2]);
  });
});

describe('verifyHash', () => {
  it('should verify correct hash', async () => {
    const content = 'test content';
    const expectedHash = await computeHash(content);
    const isValid = await verifyHash(content, expectedHash);
    assert.strictEqual(isValid, true);
  });

  it('should reject incorrect hash', async () => {
    const content = 'test content';
    const wrongHash = '0'.repeat(64);
    const isValid = await verifyHash(content, wrongHash);
    assert.strictEqual(isValid, false);
  });

  it('should handle mismatched content length', async () => {
    const hash1 = await computeHash('short');
    const hash2 = await computeHash('short but different');
    const isValid = await verifyHash('short', hash2);
    assert.strictEqual(isValid, false);
  });

  it('should support different algorithms', async () => {
    const content = 'test';
    const sha256Hash = await computeHash(content, 'sha256');
    const sha384Hash = await computeHash(content, 'sha384');
    assert.strictEqual(await verifyHash(content, sha256Hash, 'sha256'), true);
    assert.strictEqual(await verifyHash(content, sha384Hash, 'sha384'), true);
  });
});

describe('generateVerifyCommand', () => {
  it('should generate shell command for URL', () => {
    const url = 'https://example.com/article';
    const cmd = generateVerifyCommand(url);
    assert.ok(cmd.includes('curl'));
    assert.ok(cmd.includes(url));
    assert.ok(cmd.includes('sha256sum'));
  });

  it('should support different algorithms', () => {
    const url = 'https://example.com/article';
    const sha512Cmd = generateVerifyCommand(url, 'sha512');
    assert.ok(sha512Cmd.includes('sha512sum'));
  });

  it('should escape single quotes in URL', () => {
    const url = "https://example.com/article's";
    const cmd = generateVerifyCommand(url);
    assert.ok(cmd.includes('curl'));
  });
});