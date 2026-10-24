// SPDX-License-Identifier: AGPL-3.0-only

import { AsyncLocalStorage } from 'node:async_hooks';
import type { SourceArtifactEvidenceInput } from './types.js';

const moduleRunArtifacts = new AsyncLocalStorage<SourceArtifactEvidenceInput[]>();

/** Capture artifacts fetched by shared HTTP helpers during a module invocation. */
export async function withIngestionArtifactCapture<T>(operation: () => Promise<T>): Promise<T> {
  return moduleRunArtifacts.run([], operation);
}

/** Record a response in the active ingestion context; no-op outside runModule. */
export function recordIngestionArtifact(evidence: SourceArtifactEvidenceInput): void {
  const artifacts = moduleRunArtifacts.getStore();
  if (artifacts) artifacts.push(evidence);
}

/** Snapshot artifacts for the current async ingestion context. */
export function getIngestionArtifacts(): SourceArtifactEvidenceInput[] {
  return [...(moduleRunArtifacts.getStore() ?? [])];
}
