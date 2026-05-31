import { HOUSING_DATASETS } from './constants.js';

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

export { HOUSING_DATASETS } from './constants.js';
