// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash, verifyHash } from '../verification/hashing.js';
import type { TestResult } from './types.js';

export interface CitationCheckInput {
  moduleName: string;
  recordId: string;
  content: string;
  expectedHash: string;
}

export async function verifyCitationHash(
  input: CitationCheckInput,
): Promise<TestResult> {
  const start = Date.now();

  if (!input.content) {
    return {
      moduleName: input.moduleName,
      testName: `citation_content:${input.recordId}`,
      status: 'fail',
      severity: 'error',
      message: `Record ${input.recordId} has no content to hash`,
      durationMs: Date.now() - start,
    };
  }

  if (!input.expectedHash) {
    return {
      moduleName: input.moduleName,
      testName: `citation_hash:${input.recordId}`,
      status: 'fail',
      severity: 'error',
      message: `Record ${input.recordId} has no expected hash`,
      durationMs: Date.now() - start,
    };
  }

  const isValid = await verifyHash(input.content, input.expectedHash, 'sha256');

  if (!isValid) {
    const actualHash = await computeHash(input.content, 'sha256');
    return {
      moduleName: input.moduleName,
      testName: `citation_integrity:${input.recordId}`,
      status: 'fail',
      severity: 'error',
      message: `Citation hash mismatch for ${input.recordId}`,
      durationMs: Date.now() - start,
      expected: input.expectedHash,
      actual: actualHash,
    };
  }

  return {
    moduleName: input.moduleName,
    testName: `citation_integrity:${input.recordId}`,
    status: 'pass',
    severity: 'info',
    message: `Citation hash verified for ${input.recordId}`,
    durationMs: Date.now() - start,
  };
}

export async function verifyCitationBatch(
  inputs: CitationCheckInput[],
): Promise<TestResult[]> {
  return Promise.all(inputs.map(verifyCitationHash));
}
