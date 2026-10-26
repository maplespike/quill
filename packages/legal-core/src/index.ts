// SPDX-License-Identifier: AGPL-3.0-only
/**
 * MapleSpike Legal Core — Canadian case law, legislation & tribunal data
 *
 * Integrates three primary sources:
 *   1. CanLII REST API (official — requires free API key)
 *   2. A2AJ Open Legal Corpus (no key required, fully open)
 *   3. Justice Canada Laws XML (federal point-in-time legislation)
 *
 * ```ts
 * import { CanliiClient, A2ajClient } from '@maplespike/legal-core';
 *
 * // CanLII — browse recent SCC decisions
 * const canlii = new CanliiClient({ apiKey: process.env.CANLII_API_KEY });
 * const scc = await canlii.browseCases({ court: 'scc', maxResults: 10 });
 *
 * // A2AJ — search open corpus
 * const a2aj = new A2ajClient();
 * const results = await a2aj.searchDecisions('charter of rights', { limit: 20 });
 * ```
 *
 * @module @maplespike/legal-core
 */

export { CanliiClient } from './canlii-client.js';
export { A2ajClient } from './a2aj-client.js';
export { JusticeLawsClient } from './justice-laws-client.js';

export type {
  CanliiCaseBrowseResult,
  CanliiSearchOptions,
  CanliiLegislationResult,
} from './canlii-client.js';

export type {
  A2ajSearchResult,
  A2ajSearchOptions,
  A2ajCourtDecision,
  A2ajStatute,
} from './a2aj-client.js';

export type {
  JusticeAct,
  JusticeRegulation,
  JusticeLawsSearchOptions,
  JusticeLawsSearchResult,
} from './justice-laws-client.js';
