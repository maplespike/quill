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

export async function ingestAllRealEstate() {
  const [rental, starts, prices] = await Promise.all([ingestRentalMarket(), ingestHousingStarts(), ingestHousePrices()]);
  return { 'rental-market': rental, 'housing-starts': starts, 'house-prices': prices };
}
