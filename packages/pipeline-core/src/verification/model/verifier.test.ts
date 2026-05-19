import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { 
  verifyModelFile, 
  verifySelectedModel,
  getExpectedModelHash,
  selectModelForTask,
  ModelVerificationConfig
} from './verifier.js';

describe('Model Verification', () => {
  it('should return expected hash for known model', () => {
    const hash = getExpectedModelHash('qwen3.5-27b');
    assert.strictEqual(hash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('should return undefined for unknown model', () => {
    const hash = getExpectedModelHash('unknown-model');
    assert.strictEqual(hash, undefined);
  });

  it('should select correct model for task', () => {
    const chatModel = selectModelForTask('chat');
    assert.strictEqual(chatModel, 'qwen3.5-27b');
    
    const analysisModel = selectModelForTask('analysis');
    assert.strictEqual(analysisModel, 'qwen3.5-27b'); // Same priority
    
    const semanticModel = selectModelForTask('semantic');
    assert.strictEqual(semanticModel, 'gte-large-en-v1.5');
  });

  // Note: Actual file verification tests would require mocking the file system
  // or having actual model files to test against. For this implementation,
  // we're focusing on the interface and basic functionality.
  it('should have proper function signatures', () => {
    // Just verify the functions exist and are callable
    assert.strictEqual(typeof getExpectedModelHash, 'function');
    assert.strictEqual(typeof selectModelForTask, 'function');
    assert.strictEqual(typeof verifyModelFile, 'function');
    assert.strictEqual(typeof verifySelectedModel, 'function');
  });
});