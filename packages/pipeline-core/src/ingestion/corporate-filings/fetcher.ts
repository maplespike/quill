// SPDX-License-Identifier: AGPL-3.0-only
import { computeHash } from '../../verification/hashing.js';
import type { CorporateFiling, CorporateFilingsIngestionResult } from './types.js';
import { FILINGS_USER_AGENT, FILINGS_TIMEOUT_MS, MAX_FILINGS, FED_CORP_CSV_URLS } from './constants.js';

function parseCsvLine(line: string): string[] {
  const cols: string[] = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  cols.push(cur.trim());
  return cols;
}

function parseDate(raw: string): string { const m = raw.match(/\d{4}-\d{2}-\d{2}/); return m ? m[0] : raw; }

export async function fetchAllFilings(): Promise<CorporateFilingsIngestionResult> {
  const start = Date.now();
  const records: CorporateFiling[] = []; const errors: string[] = [];

  for (const csv of FED_CORP_CSV_URLS) {
    try {
      const resp = await fetch(csv.url, { headers: { 'User-Agent': FILINGS_USER_AGENT }, signal: AbortSignal.timeout(FILINGS_TIMEOUT_MS) });
      if (!resp.ok) { errors.push(`HTTP ${resp.status} for ${csv.name}`); continue; }
      const text = await resp.text();
      const lines = text.split('\n').filter((l: string) => l.trim());
      if (lines.length < 2) continue;
      const header = parseCsvLine(lines[0]);
      const nameIdx = header.findIndex(h => /corporation_name|company_name|legal_name/i.test(h));
      const numIdx = header.findIndex(h => /corporation_number|company_number|business_number/i.test(h));
      const statusIdx = header.findIndex(h => /status|state|corporation_status/i.test(h));
      const incorpIdx = header.findIndex(h => /incorporation_date|incorporation/i.test(h));

      for (let i = 1; i < lines.length && records.length < MAX_FILINGS; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 2) continue;
        const corpName = nameIdx >= 0 ? cols[nameIdx] : cols[0] || '';
        const corpNum = numIdx >= 0 ? cols[numIdx] : `UNKNOWN-${i}`;
        const content = `${csv.name}:${corpNum}`;
        records.push({
          id: await computeHash(content, 'sha256'),
          corporationName: corpName || 'Unknown',
          corporationNumber: corpNum,
          status: statusIdx >= 0 ? cols[statusIdx] : 'active',
          incorporationDate: incorpIdx >= 0 ? parseDate(cols[incorpIdx]) : '',
          jurisdiction: 'CA',
          source: csv.name,
          category: csv.name.includes('inactive') ? 'inactive' : 'active',
        });
      }
    } catch (e) { errors.push(`${csv.name}: ${e instanceof Error ? e.message : 'Unknown'}`); }
  }

  return { records, totalFetched: records.length, errors, durationMs: Date.now() - start };
}
