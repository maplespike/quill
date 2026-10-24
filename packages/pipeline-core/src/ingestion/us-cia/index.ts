// SPDX-License-Identifier: AGPL-3.0-only

import { buildAttribution, withAttribution } from '../../shared/attribution.js';
import { fetchCountryProfile, fetchMultiCountryProfiles, fetchFieldComparison } from './fetcher.js';
import { parseCountryProfile, parseMultiCountryProfiles, buildComparison } from './parser.js';
import { DEFAULT_COUNTRIES, CORE_FIELDS, TOPIC_FIELDS } from './constants.js';
import type { CiaFactRecord, CiaCountryComparison, CiaIngestionResult } from './types.js';

function makeAttribution() {
  return buildAttribution('CIA World Factbook', {
    sourceUrl: 'https://www.cia.gov/the-world-factbook/',
    attributionText: "No publisher license declaration is attached to this source configuration. Consult the publisher's terms and notices for the specific material.",
  });
}

export async function ingestCountry(countryCode: string): Promise<CiaIngestionResult> {
  const start = Date.now();
  const profile = await fetchCountryProfile(countryCode);
  if (!profile) {
    return {
      countryCode,
      records: [],
      fieldsAttempted: CORE_FIELDS.length,
      fieldsSucceeded: 0,
      errors: [`Failed to fetch profile for ${countryCode}`],
      durationMs: Date.now() - start,
    };
  }
  const records = parseCountryProfile(profile);
  return {
    countryCode,
    records,
    fieldsAttempted: CORE_FIELDS.length,
    fieldsSucceeded: records.length,
    errors: [],
    durationMs: Date.now() - start,
  };
}

export async function ingestAllCia(countries?: string[]): Promise<Record<string, CiaFactRecord[]>> {
  const targets = countries ?? DEFAULT_COUNTRIES;
  const profiles = await fetchMultiCountryProfiles(targets);
  return Object.fromEntries(
    [...profiles.entries()].map(([code, profile]) => [code, parseCountryProfile(profile)]),
  );
}

export async function compareCountries(field: string): Promise<CiaCountryComparison> {
  const fieldDef = CORE_FIELDS.find((f) => f.apiField === field);
  const fieldName = fieldDef?.name ?? field;
  const data = await fetchFieldComparison(field);
  return buildComparison(field, fieldName, data);
}

export async function ingestByTopic(
  topicKey: string,
  countries?: string[],
): Promise<{ topic: string; topicName: string; results: Record<string, CiaFactRecord[]> }> {
  const topic = TOPIC_FIELDS[topicKey];
  if (!topic) throw new Error(`Unknown topic: ${topicKey}. Valid: ${Object.keys(TOPIC_FIELDS).join(', ')}`);
  const targets = countries ?? DEFAULT_COUNTRIES;
  const profiles = await fetchMultiCountryProfiles(targets);
  const allRecords = parseMultiCountryProfiles(profiles);
  const results: Record<string, CiaFactRecord[]> = {};
  for (const record of allRecords) {
    if (topic.fields.includes(record.field)) {
      const key = `${record.countryCode}:${record.field}`;
      if (!results[key]) results[key] = [];
      results[key].push(record);
    }
  }
  return { topic: topicKey, topicName: topic.name, results };
}

export async function healthCheck() {
  const attribution = makeAttribution();
  try {
    const profile = await fetchCountryProfile('US');
    return withAttribution({
      healthy: profile !== null,
      testCountry: 'US',
      recordsFound: profile ? Object.keys(profile.fields ?? {}).length : 0,
    }, attribution);
  } catch {
    return withAttribution({ healthy: false, testCountry: 'US', recordsFound: 0 }, attribution);
  }
}

export type { CiaFactRecord, CiaRawProfile, CiaCountryComparison, CiaIngestionResult } from './types.js';
export { CORE_FIELDS, TOPIC_FIELDS, DEFAULT_COUNTRIES } from './constants.js';
