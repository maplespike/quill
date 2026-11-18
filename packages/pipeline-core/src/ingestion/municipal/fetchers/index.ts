// SPDX-License-Identifier: AGPL-3.0-only
import { searchToronto } from './toronto.js';
import { searchVancouver } from './vancouver.js';
import { searchMontreal } from './montreal.js';
import { searchCalgary } from './calgary.js';
import { searchOttawa } from './ottawa.js';
import { searchEdmonton } from './edmonton.js';
import { searchWinnipeg } from './winnipeg.js';
import { searchMississauga } from './mississauga.js';
import { searchBurnaby } from './burnaby.js';
import { searchSurrey } from './surrey.js';
import type { MunicipalRecord } from '../types.js';

export const CITY_FETCHERS: Record<string, (query: string, limit?: number, offset?: number) => Promise<MunicipalRecord[]>> = {
  toronto: searchToronto,
  vancouver: searchVancouver,
  montreal: searchMontreal,
  calgary: searchCalgary,
  ottawa: searchOttawa,
  edmonton: searchEdmonton,
  winnipeg: searchWinnipeg,
  mississauga: searchMississauga,
  burnaby: searchBurnaby,
  surrey: searchSurrey,
};

export { searchToronto, searchVancouver, searchMontreal, searchCalgary, searchOttawa, searchEdmonton, searchWinnipeg, searchMississauga, searchBurnaby, searchSurrey };

export function getCityFetcher(city: string): ((query: string, limit?: number, offset?: number) => Promise<MunicipalRecord[]>) | null {
  return CITY_FETCHERS[city.toLowerCase()] || null;
}
