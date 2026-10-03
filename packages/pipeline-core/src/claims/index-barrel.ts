// SPDX-License-Identifier: AGPL-3.0-or-later

export * from './index.js';
export type { ClaimProvenanceEvidence, PublisherTermsEvidenceInput, SourceArtifactEvidenceInput } from './types.js';
export { citationStore, CitationStore, CITATION_RECORDS_DDL, type RecentClaim } from './store.js';
export { registerModuleClaims, registerModuleResultClaims } from './ingest-hook.js';
