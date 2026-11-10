// SPDX-License-Identifier: AGPL-3.0-only
import { httpGet } from '../../utils/http.js';
import { SOURCES } from './constants.js';
import type { ResearchGrant } from './types.js';
import { toMitacsGrant } from './parser.js';
import { parseCsvLine } from '../../utils/csv.js';

export async function fetchMitacsGrants(): Promise<ResearchGrant[]> {
  const grants: ResearchGrant[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await httpGet(SOURCES.MITACS.datasets.projects, {
      timeoutMs: 15000,
    });

    if (resp.statusCode < 400) {
      const csv = resp.body;
      const lines = csv.split('\n').filter(Boolean);

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 4) continue;

        const year = parseInt(cols[2], 10);
        const amount = parseFloat(cols[3].replace(/[$,]/g, ''));
        if (isNaN(year)) continue;

        grants.push(await toMitacsGrant(cols, year, amount, SOURCES.MITACS.openDataCsv, now));
      }
    }
  } catch {
  }

  return grants;
}
