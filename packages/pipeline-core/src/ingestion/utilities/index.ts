// SPDX-License-Identifier: AGPL-3.0-only
import { UTILITY_PROVIDERS } from './constants.js';

export function searchUtilities(params: { province?: string; type?: string; query?: string }) {
  let results = UTILITY_PROVIDERS;
  if (params.province) results = results.filter(u => u.province === params.province);
  if (params.type) results = results.filter(u => u.type === params.type);
  if (params.query) {
    const q = params.query.toLowerCase();
    results = results.filter(u => u.name.toLowerCase().includes(q) || u.serviceArea.toLowerCase().includes(q));
  }
  return results.map((u, i) => ({
    id: `util:${i}`,
    name: u.name,
    province: u.province,
    type: u.type,
    serviceArea: u.serviceArea,
    url: u.url,
  }));
}

export { UTILITY_PROVIDERS } from './constants.js';

export {
  parseHydroRecord,
  parseGasRecord,
  parseUtilityRecords,
  detectUtilityType,
  normalizeProvince,
  normalizeUtilityName,
  normalizeRateType,
  parseNumeric,
} from './parser.js';

export type {
  UtilityType,
  HydroRecord,
  GasRecord,
  UtilityParsedRecord,
  UtilityParserOptions,
} from './types.js';
