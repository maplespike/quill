import { httpGet } from '../../utils/http.js';
import { CMHC_CKAN, RE_TIMEOUT_MS, RE_UA } from './constants.js';

async function searchCkan(query: string, rows = 10) {
  try {
    const resp = await httpGet(`${CMHC_CKAN}?q=${encodeURIComponent(query)}&rows=${rows}`, {
      timeoutMs: RE_TIMEOUT_MS, headers: { 'User-Agent': RE_UA },
    });
    if (resp.statusCode >= 400) return [];
    const data = JSON.parse(resp.body);
    return (data?.result?.results ?? []).map((r: any) => ({
      id: r.id, title: r.title || '',
      description: (r.notes || '').substring(0, 300),
      url: `https://open.canada.ca/data/en/dataset/${r.id}`,
      date: r.metadata_created?.substring(0, 10) || '',
      license: r.license,
      license_id: r.license_id,
      license_title: r.license_title,
      license_url: r.license_url,
      attribution: r.attribution,
    }));
  } catch { return []; }
}

export async function ingestRentalMarket() {
  const start = Date.now();
  const records = (await searchCkan('cmhc rental market survey vacancy rates', 10)).map((r: any) => ({ ...r, sector: 'rental', jurisdiction: 'federal' }));
  return { source: 'rental-market', recordsFound: records.length, records, errors: [], durationMs: Date.now() - start };
}

export async function ingestHousingStarts() {
  const start = Date.now();
  const records = (await searchCkan('cmhc housing starts municipality', 10)).map((r: any) => ({ ...r, sector: 'housing-starts', jurisdiction: 'federal' }));
  return { source: 'housing-starts', recordsFound: records.length, records, errors: [], durationMs: Date.now() - start };
}

export async function ingestHousePrices() {
  const start = Date.now();
  const records = (await searchCkan('new housing price index mls home prices canada', 10)).map((r: any) => ({ ...r, sector: 'house-prices', jurisdiction: 'federal' }));
  return { source: 'house-prices', recordsFound: records.length, records, errors: [], durationMs: Date.now() - start };
}

export async function ingestLandRegistry() {
  const start = Date.now();
  const records = (await searchCkan('property registry land titles assessment canada', 10)).map((r: any) => ({ ...r, sector: 'land-registry', jurisdiction: 'provincial' }));
  return { source: 'land-registry', recordsFound: records.length, records, errors: [], durationMs: Date.now() - start };
}

export async function ingestRentalRegistries() {
  const start = Date.now();
  const records = (await searchCkan('rental registry licensing property standards canada', 10)).map((r: any) => ({ ...r, sector: 'rental-registries', jurisdiction: 'municipal' }));
  return { source: 'rental-registries', recordsFound: records.length, records, errors: [], durationMs: Date.now() - start };
}

export async function ingestPropertyAssessments() {
  const start = Date.now();
  const [bc, on, ab] = await Promise.all([
    searchCkan('bc assessment property values', 5),
    searchCkan('mpac ontario property assessment', 5),
    searchCkan('alberta property assessment', 5),
  ]);
  const records = [
    ...bc.map((r: any) => ({ ...r, sector: 'property-assessment', jurisdiction: 'bc' })),
    ...on.map((r: any) => ({ ...r, sector: 'property-assessment', jurisdiction: 'on' })),
    ...ab.map((r: any) => ({ ...r, sector: 'property-assessment', jurisdiction: 'ab' })),
  ];
  return { source: 'property-assessments', recordsFound: records.length, records, errors: [], durationMs: Date.now() - start };
}

export async function ingestMortgageArrears() {
  const start = Date.now();
  const records = (await searchCkan('mortgage arrears canada', 10)).map((r: any) => ({ ...r, sector: 'mortgage-arrears', jurisdiction: 'federal' }));
  return { source: 'mortgage-arrears', recordsFound: records.length, records, errors: [], durationMs: Date.now() - start };
}

export async function ingestAllRealEstate() {
  const [rental, starts, prices, land, rentalReg, assessments, arrears] = await Promise.all([
    ingestRentalMarket(), ingestHousingStarts(), ingestHousePrices(),
    ingestLandRegistry(), ingestRentalRegistries(),
    ingestPropertyAssessments(), ingestMortgageArrears(),
  ]);
  return { 'rental-market': rental, 'housing-starts': starts, 'house-prices': prices, 'land-registry': land, 'rental-registries': rentalReg, 'property-assessments': assessments, 'mortgage-arrears': arrears };
}
