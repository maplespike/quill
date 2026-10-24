// SPDX-License-Identifier: AGPL-3.0-only
/**
 * MapleSpike Legislation — point-in-time federal & provincial legislation
 *
 * ```ts
 * import { JusticeLawsClient } from '@maplespike/legislation';
 *
 * const laws = new JusticeLawsClient();
 * const result = await laws.search({ query: 'privacy' });
 * console.log(result.acts); // matched federal Acts
 * ```
 *
 * @module @maplespike/legislation
 */

export { JusticeLawsClient } from './justice-laws.js';
export type { JusticeAct, JusticeRegulation, JusticeLawsSearchOptions, JusticeLawsSearchResult } from './justice-laws.js';
