// SPDX-License-Identifier: AGPL-3.0-only
/**
 * NRCan Parser — Quill
 *
 * Parse and normalize NRCan CSV data into typed records.
 */

import { computeHash } from '../../verification/hashing.js';
import type { MiningActivity, TopographicMap } from './types.js';

/**
 * Parse mining activities CSV
 */
export async function parseMiningActivities(csv: string): Promise<MiningActivity[]> {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const activities: MiningActivity[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    // Map CSV columns to fields
    const activity: MiningActivity = {
      id: await computeHash(lines[i]),
      project: getValue(values, headers, 'project') || getValue(values, headers, 'Project Name') || 'Unknown',
      province: normalizeProvince(getValue(values, headers, 'province') || getValue(values, headers, 'Province')),
      stage: normalizeStage(getValue(values, headers, 'stage') || getValue(values, headers, 'Project Stage')),
      commodity: normalizeCommodity(getValue(values, headers, 'commodity') || getValue(values, headers, 'Commodity')),
      ingestedAt: new Date().toISOString(),
    };

    if (activity.project && activity.project !== 'Unknown') {
      activities.push(activity);
    }
  }

  return activities;
}

/**
 * Parse topographic maps CSV
 */
export async function parseTopographicMaps(csv: string): Promise<TopographicMap[]> {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const maps: TopographicMap[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const map: TopographicMap = {
      id: await computeHash(lines[i]),
      ntsNumber: getValue(values, headers, 'nts_number') || getValue(values, headers, 'NTS Number') || '',
      scale: getValue(values, headers, 'scale') || getValue(values, headers, 'Scale') || '',
      edition: getValue(values, headers, 'edition') || getValue(values, headers, 'Edition') || '',
      year: getValue(values, headers, 'year') || getValue(values, headers, 'Year') || '',
      ingestedAt: new Date().toISOString(),
    };

    if (map.ntsNumber) {
      maps.push(map);
    }
  }

  return maps;
}

/**
 * Parse a CSV line, handling quoted values with commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

/**
 * Get a value from a CSV row by header name
 */
function getValue(values: string[], headers: string[], name: string): string | null {
  const index = headers.indexOf(name);
  return index >= 0 && index < values.length ? values[index] || null : null;
}

/**
 * Normalize province code
 */
function normalizeProvince(value: string | null): string {
  if (!value) return 'CA';
  const normalized = value.trim().toUpperCase();
  // Map province names to codes
  const provinceMap: Record<string, string> = {
    'ONTARIO': 'ON', 'ONT': 'ON', 'ON': 'ON',
    'QUEBEC': 'QC', 'QUE': 'QC', 'QC': 'QC',
    'BRITISH COLUMBIA': 'BC', 'BC': 'BC',
    'ALBERTA': 'AB', 'ALTA': 'AB', 'AB': 'AB',
    'MANITOBA': 'MB', 'MB': 'MB',
    'SASKATCHEWAN': 'SK', 'SASK': 'SK', 'SK': 'SK',
    'NOVA SCOTIA': 'NS', 'NS': 'NS',
    'NEW BRUNSWICK': 'NB', 'NB': 'NB',
    'PRINCE EDWARD ISLAND': 'PE', 'PEI': 'PE', 'PE': 'PE',
    'NEWFOUNDLAND': 'NL', 'LABRADOR': 'NL', 'NL': 'NL',
    'YUKON': 'YT', 'YT': 'YT',
    'NORTHWEST TERRITORIES': 'NT', 'NWT': 'NT', 'NT': 'NT',
    'NUNAVUT': 'NU', 'NU': 'NU',
  };
  return provinceMap[normalized] || 'CA';
}

/**
 * Normalize mining stage
 */
function normalizeStage(value: string | null): string {
  if (!value) return 'unknown';
  const normalized = value.trim().toLowerCase();
  const stageMap: Record<string, string> = {
    'exploration': 'exploration', 'exploring': 'exploration',
    'development': 'development', 'developing': 'development',
    'production': 'production', 'producing': 'production', 'operating': 'production',
    'closure': 'closure', 'closing': 'closure',
    'reclamation': 'reclamation', 'reclaiming': 'reclamation',
  };
  return stageMap[normalized] || 'unknown';
}

/**
 * Normalize commodity
 */
function normalizeCommodity(value: string | null): string {
  if (!value) return 'other';
  const normalized = value.trim().toLowerCase();
  const commodityMap: Record<string, string> = {
    'gold': 'gold',
    'copper': 'copper',
    'iron ore': 'iron-ore', 'iron': 'iron-ore',
    'nickel': 'nickel',
    'zinc': 'zinc',
    'potash': 'potash',
    'diamonds': 'diamonds', 'diamond': 'diamonds',
    'uranium': 'uranium',
    'lithium': 'lithium',
    'cobalt': 'cobalt',
    'rare earth': 'rare-earth',
    'coal': 'coal',
  };
  return commodityMap[normalized] || 'other';
}