// SPDX-License-Identifier: AGPL-3.0-only
import { HOUSING_DATASETS } from './constants.js';
import type { HousingMarketRecord, HousingStartRecord, HousingCompletionRecord, HousingCategory, HousingType, RawHousingMarketRecord, RawHousingStartRecord, RawHousingCompletionRecord, HousingDataIngestionOptions, HousingDataIngestionResult, HousingDataSearchOptions } from './types.js';

export interface HousingRecord {
  id: string;
  name: string;
  provider: string;
  category: string;
  coverage: string;
  url: string;
}

export function searchHousing(params: { category?: string; provider?: string; query?: string }): HousingRecord[] {
  let results = HOUSING_DATASETS;
  if (params.category) results = results.filter(h => h.category === params.category);
  if (params.provider) results = results.filter(h => h.provider.toLowerCase().includes(params.provider!.toLowerCase()));
  if (params.query) {
    const q = params.query.toLowerCase();
    results = results.filter(h => h.name.toLowerCase().includes(q) || h.category.includes(q));
  }
  return results;
}

export { HOUSING_DATASETS, METRO_AREA_MAP, HOUSING_TYPE_MAP, HOUSING_TIMEOUT_MS } from './constants.js';
export {
  parseHousingMarketRecord,
  parseHousingStartRecord,
  parseHousingCompletionRecord,
  parseHousingDataRecords,
  parseHousingMarketBatch,
  parseHousingStartBatch,
  parseHousingCompletionBatch,
} from './parser.js';

export type { HousingMarketRecord };
export type { HousingStartRecord };
export type { HousingCompletionRecord };
export type { HousingCategory };
export type { HousingType };
export type { RawHousingMarketRecord };
export type { RawHousingStartRecord };
export type { RawHousingCompletionRecord };
export type { HousingDataIngestionOptions };
export type { HousingDataIngestionResult };
export type { HousingDataSearchOptions };
