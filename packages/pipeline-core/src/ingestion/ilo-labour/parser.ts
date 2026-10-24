// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { IloRecord } from './types.js';

interface RawIloObservation {
  indicator?: { label: string };
  source?: { label: string };
  geo?: { label: string; code?: string };
  time?: number;
  value?: number;
  unit?: { label: string };
}

export async function parseIloResponse(
  data: RawIloObservation[] | undefined,
  indicatorCode: string,
  indicatorName: string,
): Promise<IloRecord[]> {
  if (!data || data.length === 0) return [];

  const records: IloRecord[] = [];

  for (const obs of data) {
    if (obs.value === undefined || obs.value === null) continue;
    if (!obs.time) continue;

    const country = obs.geo?.label ?? 'Unknown';
    const countryCode = obs.geo?.code ?? '';
    const unit = obs.unit?.label ?? 'units';
    const source = obs.source?.label ?? 'ILO';

    const content = `${indicatorCode}:${countryCode}:${obs.time}:${obs.value}:${unit}`;
    const id = await computeHash(content);

    records.push({
      id,
      indicatorCode,
      indicatorName,
      country,
      countryCode,
      year: obs.time,
      value: obs.value,
      unit,
      source,
    });
  }

  return records;
}
