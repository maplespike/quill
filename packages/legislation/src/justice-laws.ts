/**
 * Justice Canada Laws XML Client for Legislation package
 *
 * Re-exports from @maplespike/legal-core for package boundary clarity.
 * This package adds provincial legislation sources on top.
 */

export { JusticeLawsClient } from '@maplespike/legal-core';
export type {
  JusticeAct,
  JusticeRegulation,
  JusticeLawsSearchOptions,
  JusticeLawsSearchResult,
} from '@maplespike/legal-core';
