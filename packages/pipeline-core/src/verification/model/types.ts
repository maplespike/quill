/**
 * Model Verification — MapleSpike Pipeline
 *
 * Types and interfaces for model weight verification to prevent supply chain attacks.
 */

export interface ModelHashEntry {
  /** Model identifier (matches CURATED_MODELS.id) */
  modelId: string;
  /** Expected SHA-256 hash of the model file */
  expectedHash: string;
  /** Optional: human-readable description */
  description?: string;
  /** Optional: when this hash was last verified/updated */
  lastUpdated?: string; // ISO date string
}

export interface ModelVerificationResult {
  /** Whether the model hash matched the expected value */
  isValid: boolean;
  /** The computed hash of the model */
  computedHash?: string;
  /** The expected hash (if verification was attempted) */
  expectedHash?: string;
  /** Error message if verification failed */
  error?: string;
  /** Model ID that was verified */
  modelId: string;
}

/**
 * Configuration for model verification behavior
 */
export interface ModelVerificationConfig {
  /** Whether to enforce verification (block unverified models) */
  enforceVerification: boolean;
  /** Whether to log verification results */
  logVerification: boolean;
  /** Custom model hash entries (overrides defaults) */
  customModelHashes?: ModelHashEntry[];
}