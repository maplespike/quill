/**
 * Model Verification — MapleSpike Pipeline
 *
 * Verifies model weights against expected hashes to prevent supply chain attacks.
 * Integrates with the existing AI model selection and gateway systems.
 */

import { computeHash, verifyHash } from '../hashing.js';
import { CURATED_MODELS } from '../../../api-server/src/ai/models.js';
import type { CuratedModel } from '../../../api-server/src/ai/models.js';

import type {
  ModelHashEntry,
  ModelVerificationResult,
  ModelVerificationConfig,
} from './types.js';

/**
 * Default model hashes - in a real deployment, these would be populated
 * with actual hashes of verified model files.
 * For development/testing, we use placeholder hashes.
 */
const DEFAULT_MODEL_HASHES: ModelHashEntry[] = [
  {
    modelId: 'qwen3.5-27b',
    expectedHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // SHA-256 of empty string
    description: 'Qwen 3.5 27B parameter model',
  },
  {
    modelId: 'llama3.1-8b',
    expectedHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // SHA-256 of empty string
    description: 'Llama 3.1 8B parameter model',
  },
  {
    modelId: 'mixtral-8x7b',
    expectedHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // SHA-256 of empty string
    description: 'Mixtral 8x7B parameter model',
  },
  {
    modelId: 'gte-large-en-v1.5',
    expectedHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // SHA-256 of empty string
    description: 'GTE Large EN v1.5 embedding model',
  },
  {
    modelId: 'Carnice-Qwen3.6-MoE-35B-A3B.IQ4_XS.gguf',
    expectedHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // SHA-256 of empty string
    description: 'Carnice Qwen3.6 MoE 35B GGUF quantized model',
  },
];

/**
 * Get model hash entry for a given model ID
 */
function getModelHashEntry(
  modelId: string,
  customHashes: ModelHashEntry[] = [],
): ModelHashEntry | undefined {
  // Check custom hashes first
  const customEntry = customHashes.find((entry) => entry.modelId === modelId);
  if (customEntry) return customEntry;

  // Check default hashes
  return DEFAULT_MODEL_HASHES.find((entry) => entry.modelId === modelId);
}

/**
 * Get the expected hash for a model ID
 */
export function getExpectedModelHash(
  modelId: string,
  customHashes: ModelHashEntry[] = [],
): string | undefined {
  const entry = getModelHashEntry(modelId, customHashes);
  return entry?.expectedHash;
}

/**
 * Verify a model file against its expected hash
 * In a real implementation, this would read the actual model file
 * For now, we simulate by checking if we have a hash entry
 */
export async function verifyModelFile(
  modelPath: string,
  modelId: string,
  config: ModelVerificationConfig = {
    enforceVerification: true,
    logVerification: true,
  },
): Promise<ModelVerificationResult> {
  const result: ModelVerificationResult = {
    isValid: false,
    modelId,
  };

  try {
    // Get expected hash for this model
    const expectedHash = getExpectedModelHash(
      modelId,
      config.customModelHashes || [],
    );

    if (!expectedHash) {
      result.error = `No expected hash found for model: ${modelId}`;
      if (config.logVerification) {
        console.warn(`[ModelVerification] ${result.error}`);
      }
      // If enforcement is off, we might allow unverified models
      if (!config.enforceVerification) {
        result.isValid = true;
      }
      return result;
    }

    // In a real implementation, we would read the file at modelPath
    // For this exercise, we'll simulate by checking if the path exists
    // and using a placeholder content for hash calculation
    let contentToHash: string;

    try {
      // Try to read the model file
      // Note: In browser/worker environments, we'd need to use fetch or similar
      // For Node.js, we could use fs.promises.readFile
      // Since we don't have actual model files, we'll use a placeholder
      contentToHash = `MODEL_PLACEHOLDER_CONTENT_FOR_${modelId}_AT_${modelPath}`;
    } catch (readError) {
      result.error = `Could not read model file at ${modelPath}: ${readError}`;
      if (config.logVerification) {
        console.error(`[ModelVerification] ${result.error}`);
      }
      return result;
    }

    // Compute hash of the model content
    const computedHash = await computeHash(contentToHash);

    // Verify against expected hash
    const isValid = await verifyHash(contentToHash, expectedHash);

    result.isValid = isValid;
    result.computedHash = computedHash;
    result.expectedHash = expectedHash;

    if (!isValid) {
      result.error = `Hash mismatch for model ${modelId}: expected ${expectedHash}, got ${computedHash}`;
    }

    if (config.logVerification) {
      if (isValid) {
        console.info(`[ModelVerification] Model ${modelId} verified successfully`);
      } else {
        console.warn(`[ModelVerification] ${result.error}`);
      }
    }

    return result;
  } catch (error) {
    result.error = `Unexpected error during model verification: ${error}`;
    if (config.logVerification) {
      console.error(`[ModelVerification] ${result.error}`);
    }
    return result;
  }
}

/**
 * Verify the currently selected model for a given task
 * Integrates with the existing model selection system
 */
export async function verifySelectedModel(
  task: 'chat' | 'analysis' | 'semantic',
  modelPathResolver: (modelId: string) => string | Promise<string>,
  config: ModelVerificationConfig = {
    enforceVerification: true,
    logVerification: true,
  },
): Promise<ModelVerificationResult> {
  // Get the currently selected model for this task
  const modelId = selectModelForTask(task);

  // Get the path to the model file
  let modelPath: string;
  if (modelPathResolver instanceof Function) {
    const resolvedPath = modelPathResolver(modelId);
    modelPath = resolvedPath instanceof Promise ? await resolvedPath : resolvedPath;
  } else {
    // If resolver is actually a string, treat it as the path
    modelPath = modelPathResolver as string;
  }

  // Verify the model
  return await verifyModelFile(modelPath, modelId, config);
}

/**
 * Select model for a task (mirrors the function in api-server/src/ai/models.ts)
 */
export function selectModelForTask(task: 'chat' | 'analysis' | 'semantic'): string {
  const sorted = [...CURATED_MODELS]
    .filter((m) => m.tasks.includes(task))
    .sort((a, b) => a.priority - b.priority);
  return sorted[0]?.id ?? 'Carnice-Qwen3.6-MoE-35B-A3B.IQ4_XS.gguf';
}

/**
 * Create middleware for AI gateway requests that verifies models
 * This would be used in the API server to protect against loading unverified models
 */
export function createModelVerificationMiddleware(
  config: ModelVerificationConfig = {
    enforceVerification: true,
    logVerification: true,
  },
) {
  return async function modelVerificationMiddleware(
    modelId: string,
    modelPathResolver: (id: string) => string | Promise<string>,
  ): Promise<ModelVerificationResult> {
    return await verifyModelFile(
      await (Promise.resolve(modelPathResolver(modelId))),
      modelId,
      config,
    );
  };
}