// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type {
  SpaceMission, ResearchGrant, OceanObservation, PolarRecord,
} from './types.js';

export function mapMissionStatus(raw: string): SpaceMission['status'] {
  const s = raw.toLowerCase();
  if (s.includes('operational') || s.includes('active')) return 'active';
  if (s.includes('complete') || s.includes('ended')) return 'completed';
  if (s.includes('plan') || s.includes('future')) return 'planned';
  if (s.includes('cancel')) return 'cancelled';
  return 'planned';
}

export function mapRecipientType(name: string): ResearchGrant['recipientType'] {
  const lc = name.toLowerCase();
  if (lc.includes('university') || lc.includes('college') || lc.includes('institute')) return 'university';
  if (lc.includes('inc.') || lc.includes('ltd.') || lc.includes('corporation') || lc.includes('corp')) return 'company';
  if (lc.includes('hospital') || lc.includes('foundation')) return 'nonprofit';
  return 'company';
}

export async function toSpaceMission(
  raw: Record<string, unknown>,
  ingestedAt: string,
): Promise<SpaceMission | null> {
  const id = raw.id ?? raw.name;
  if (!id) return null;
  return {
    id: await computeHash(`csa:mission:${id}`, 'sha256'),
    mission: String(raw.name ?? ''),
    agency: 'csa',
    status: mapMissionStatus(String(raw.status ?? '')),
    launchYear: raw.launchYear ? Number(raw.launchYear) : null,
    description: String(raw.description ?? ''),
    budgetCad: raw.budget ? Number(raw.budget) : null,
    sourceUrl: '',
    ingestedAt,
  };
}

export async function toMitacsGrant(
  cols: string[],
  year: number,
  amount: number,
  sourceUrl: string,
  ingestedAt: string,
): Promise<ResearchGrant> {
  return {
    id: await computeHash(`mitacs:${cols[0]}:${cols[1]}:${year}`, 'sha256'),
    agency: 'mitacs',
    program: cols[4] || 'Accelerate',
    recipient: cols[0],
    recipientType: mapRecipientType(cols[0]),
    amountCad: isNaN(amount) ? 0 : amount,
    year,
    province: cols[5] || '',
    title: cols[1] || '',
    description: cols[6] || null,
    sourceUrl,
    ingestedAt,
  };
}

export async function toOceanObservation(
  station: Record<string, unknown>,
  stationId: string,
  baseUrl: string,
  ingestedAt: string,
): Promise<OceanObservation> {
  const locationCode = String(station.locationCode ?? station.region ?? '');
  return {
    id: await computeHash(`onc:${stationId}`, 'sha256'),
    station: String(station.name ?? stationId),
    region: locationCode,
    latitude: Number(station.latitude ?? 0),
    longitude: Number(station.longitude ?? 0),
    parameter: 'location',
    value: 0,
    unit: '',
    timestamp: ingestedAt,
    depth: null,
    sourceUrl: `${baseUrl}/${stationId}`,
    ingestedAt,
  };
}

export async function toPolarRecord(
  raw: Record<string, unknown>,
  baseUrl: string,
  ingestedAt: string,
): Promise<PolarRecord> {
  return {
    id: await computeHash(`polar:${raw.id ?? raw.title}`, 'sha256'),
    title: String(raw.title ?? ''),
    investigator: String(raw.investigator ?? raw.principalInvestigator ?? ''),
    organization: String(raw.organization ?? ''),
    region: String(raw.region ?? ''),
    discipline: String(raw.discipline ?? ''),
    startYear: Number(raw.startYear ?? new Date().getFullYear()),
    endYear: raw.endYear ? Number(raw.endYear) : null,
    fundingAmount: raw.fundingAmount ? Number(raw.fundingAmount) : null,
    sourceUrl: `${baseUrl}/dataset/${raw.id ?? ''}`,
    ingestedAt,
  };
}
