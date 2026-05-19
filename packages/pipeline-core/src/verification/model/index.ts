export {
  computeHash,
  verifyHash,
  generateVerifyCommand,
} from '../hashing.js';

export type { CitationRecord } from '../hashing.js';

export {
  type ModelHashEntry,
  type ModelVerificationResult,
  type ModelVerificationConfig,
  getExpectedModelHash,
  verifyModelFile,
  verifySelectedModel,
  createModelVerificationMiddleware,
  selectModelForTask,
} from './verifier.js';