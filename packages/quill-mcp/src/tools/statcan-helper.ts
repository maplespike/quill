// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Shared StatCan table fetcher — downloads ZIP from WDS, extracts CSV, parses rows.
 */
import { extractFromZip } from './optimization/zip-util.js';

const USER_AGENT = 'MapleSpike/0.2 (+https://maplespike.lan)';

export async function fetchStatCanTable(tableId: string): Promise<{ header: string[]; rows: Record<string, string>[] }> {
  const resp = await fetch(`https://www150.statcan.gc.ca/n1/tbl/csv/${tableId}-eng.zip`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(20000),
  });
  if (!resp.ok) return { header: [], rows: [] };
  const buf = await resp.arrayBuffer();
  const csvText = await extractFromZip(buf);
  const lines = csvText.split('\n').filter((l: string) => l.trim());
  if (lines.length < 2) return { header: [], rows: [] };
  const header = lines[0].split(',').map((h: string) => h.trim());
  const rows = lines.slice(1).map((line: string) => {
    const cols = line.split(',');
    const row: Record<string, string> = {};
    header.forEach((h: string, i: number) => { row[h] = (cols[i] || '').trim(); });
    return row;
  });
  return { header, rows };
}
