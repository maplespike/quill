import { SOURCES } from './constants.js';
import type { ResearchGrant } from './types.js';
import { computeHash } from '../../verification/hashing.js';

export async function fetchMitacsGrants(): Promise<ResearchGrant[]> {
  const grants: ResearchGrant[] = [];
  const now = new Date().toISOString();

  try {
    const resp = await fetch(SOURCES.MITACS.datasets.projects, {
      signal: AbortSignal.timeout(15000),
    });

    if (resp.ok) {
      const csv = await resp.text();
      const lines = csv.split('\n').filter(Boolean);

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 4) continue;

        const year = parseInt(cols[2], 10);
        const amount = parseFloat(cols[3].replace(/[$,]/g, ''));

        if (isNaN(year)) continue;

        const id = await computeHash(`mitacs:${cols[0]}:${cols[1]}:${year}`, 'sha256');
        grants.push({
          id,
          agency: 'mitacs',
          program: cols[4] || 'Accelerate',
          recipient: cols[0],
          recipientType: detectRecipientType(cols[0]),
          amountCad: isNaN(amount) ? 0 : amount,
          year,
          province: cols[5] || '',
          title: cols[1] || '',
          description: cols[6] || null,
          sourceUrl: SOURCES.MITACS.openDataCsv,
          ingestedAt: now,
        });
      }
    }
    } catch {
    }

  return grants;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function detectRecipientType(name: string): ResearchGrant['recipientType'] {
  const lc = name.toLowerCase();
  if (lc.includes('university') || lc.includes('college') || lc.includes('institute')) return 'university';
  if (lc.includes('inc.') || lc.includes('ltd.') || lc.includes('corporation') || lc.includes('corp')) return 'company';
  if (lc.includes('hospital') || lc.includes('foundation')) return 'nonprofit';
  return 'company';
}
