// SPDX-License-Identifier: AGPL-3.0-only

import type { CiaRawProfile, CiaFactRecord, CiaCountryComparison } from './types.js';
import { CORE_FIELDS } from './constants.js';

export function parseCountryProfile(profile: CiaRawProfile): CiaFactRecord[] {
  const records: CiaFactRecord[] = [];
  const countryCode = profile.country_code?.toUpperCase() ?? '';
  const countryName = profile.country_name ?? '';
  if (!countryCode) return records;

  for (const fieldDef of CORE_FIELDS) {
    const fieldData = profile.fields?.[fieldDef.apiField];
    if (!fieldData) continue;
    records.push({
      id: `CIA:${countryCode}:${fieldDef.apiField}`,
      countryCode,
      countryName,
      field: fieldDef.apiField,
      fieldName: fieldDef.name,
      category: fieldDef.category,
      value: fieldData.value ?? null,
      rank: fieldData.rank ?? null,
      year: fieldData.comparison_date ?? fieldData.date ?? null,
    });
  }
  return records;
}

export function parseMultiCountryProfiles(profiles: Map<string, CiaRawProfile>): CiaFactRecord[] {
  const allRecords: CiaFactRecord[] = [];
  for (const [, profile] of profiles) {
    allRecords.push(...parseCountryProfile(profile));
  }
  return allRecords;
}

export function buildComparison(
  field: string,
  fieldName: string,
  data: Array<{ country: string; value: string | number | null; rank: number | null }>,
): CiaCountryComparison {
  return {
    field,
    fieldName,
    entries: data.map((d) => ({
      countryCode: d.country,
      countryName: d.country,
      value: d.value,
      rank: d.rank,
    })),
    lastUpdated: new Date().toISOString(),
  };
}
