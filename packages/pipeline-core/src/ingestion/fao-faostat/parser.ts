// SPDX-License-Identifier: AGPL-3.0-only

import type { FaoRecord } from './types.js';
import { FAO_DOMAINS } from './constants.js';

/**
 * Parse FAO FAOSTAT bulk API response into typed records.
 * The FAO API returns data in the shape: { data: [...] }
 * Each item has fields like Area, Area Code, Item, Item Code, Year, Value, etc.
 */
export function parseFaoResponse(raw: any, domainCode: string): FaoRecord[] {
  const records: FaoRecord[] = [];

  if (!raw || typeof raw !== 'object') {
    return records;
  }

  // FAO API response may wrap data under 'data' key or be the array directly
  const items = Array.isArray(raw) ? raw : (raw.data ?? raw.Data ?? []);

  for (const item of items) {
    const year = parseInt(String(item.Year ?? item.year ?? 0), 10);
    const valueStr = String(item.Value ?? item.value ?? '');
    const value = valueStr !== '' && valueStr !== 'null' && !isNaN(Number(valueStr))
      ? parseFloat(valueStr)
      : null;

    const area = String(item.Area ?? item.area ?? '');
    const areaCode = String(item['Area Code'] ?? item.areaCode ?? '');
    const element = String(item.Element ?? item.element ?? '');
    const elementCode = String(item['Element Code'] ?? item.elementCode ?? '');
    const itemName = String(item.Item ?? item.item ?? '');
    const itemCode = String(item['Item Code'] ?? item.itemCode ?? '');

    // Generate deterministic ID from unique record keys
    const idInput = `${domainCode}:${areaCode}:${elementCode}:${itemCode}:${year}`;
    const id = computeSimpleHash(idInput);

    records.push({
      domain: FAO_DOMAINS[domainCode] ?? domainCode,
      domainCode,
      indicator: element,
      indicatorCode: elementCode,
      area,
      areaCode,
      element,
      elementCode,
      item: itemName,
      itemCode,
      year,
      value,
      flag: item.Flag ?? item.flag ?? null,
      flagDescription: item['Flag Description'] ?? item.flagDescription ?? null,
      id,
      timestamp: new Date().toISOString(),
    });
  }

  return records;
}

/**
 * Simple deterministic hash for record IDs.
 * Not cryptographic — just for deduplication identity.
 */
function computeSimpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, '0') + '0'.repeat(48);
}
