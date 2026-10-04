/**
 * IRCC Parser — Quill
 *
 * Parse and normalize IRCC family sponsorship CSV data.
 */

import { computeHash } from '../../verification/hashing.js';
import type { FamilySponsorship } from './types.js';

export async function parseFamilySponsorship(csv: string): Promise<FamilySponsorship[]> {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const sponsorships: FamilySponsorship[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const sponsorship: FamilySponsorship = {
      id: await computeHash(lines[i]),
      sponsorCategory: normalizeSponsorCategory(getValue(values, headers, 'category') || getValue(values, headers, 'Sponsor Category')),
      province: normalizeProvince(getValue(values, headers, 'province') || getValue(values, headers, 'Province')),
      processingTime: parseProcessingTime(getValue(values, headers, 'processing_time') || getValue(values, headers, 'Processing Time')),
      year: getValue(values, headers, 'year') || getValue(values, headers, 'Year') || new Date().getFullYear().toString(),
      ingestedAt: new Date().toISOString(),
    };

    if (sponsorship.sponsorCategory) {
      sponsorships.push(sponsorship);
    }
  }

  return sponsorships;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
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

function getValue(values: string[], headers: string[], name: string): string | null {
  const index = headers.indexOf(name);
  return index >= 0 && index < values.length ? values[index] || null : null;
}

function normalizeProvince(value: string | null): string {
  if (!value) return 'CA';
  const normalized = value.trim().toUpperCase();
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

function normalizeSponsorCategory(value: string | null): string {
  if (!value) return 'other-relative';
  const normalized = value.trim().toLowerCase();
  const categoryMap: Record<string, string> = {
    'spousal': 'spousal',
    'spouse': 'spousal',
    'parent': 'parent',
    'grandparent': 'grandparent',
    'dependent child': 'dependent-child',
    'other relative': 'other-relative',
  };
  return categoryMap[normalized] || 'other-relative';
}

function parseProcessingTime(value: string | null): number | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/[^0-9.]/g, '');
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}