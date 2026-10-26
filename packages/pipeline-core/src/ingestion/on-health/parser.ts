// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { OntarioHealthRecord, OntarioHealthRecordType, RawOntarioHealthRecord } from './types.js';

export function normalizeOntarioHealthRecordType(raw: string | null | undefined): OntarioHealthRecordType {
  if (!raw) return 'ohip_claim';
  const t = raw.trim().toLowerCase();
  if (t.includes('ohip') || t === 'ohip_claim' || t === 'physician' || t === 'lab') return 'ohip_claim';
  if (t.includes('public') || t.includes('health') || t === 'public_health') return 'public_health';
  return 'ohip_claim';
}

function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.substring(0, 10);
  const rfcMatch = trimmed.match(/^\w{3},\s+(\d{1,2})\s+(\w{3})\s+(\d{4})/);
  if (rfcMatch) {
    const months: Record<string, string> = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
    const day = rfcMatch[1].padStart(2, '0');
    const month = months[rfcMatch[2].toLowerCase()] ?? '01';
    return `${rfcMatch[3]}-${month}-${day}`;
  }
  const slashMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slashMatch) return `${slashMatch[1]}-${slashMatch[2].padStart(2,'0')}-${slashMatch[3].padStart(2,'0')}`;
  return trimmed.substring(0, 10);
}

export async function parseOntarioHealthRecord(raw: RawOntarioHealthRecord, options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<OntarioHealthRecord | null> {
  const sourceUrl = (raw.source_url ?? '') as string;
  if (!sourceUrl) return null;
  const sourceSystem = options.sourceSystem ?? 'on-health-ohip';
  const now = options.ingestedAt ?? new Date().toISOString();
  const contentForHash = JSON.stringify({
    recordType: normalizeOntarioHealthRecordType(raw.recordType),
    claimType: raw.claimType ?? '',
    serviceCode: raw.serviceCode ?? '',
    feeSchedule: raw.feeSchedule ?? '',
    serviceDate: normalizeDate(raw.serviceDate),
    providerType: raw.providerType ?? '',
    claimsCount: raw.claimsCount ?? null,
    totalPaid: raw.totalPaid ?? null,
    fiscalYear: raw.fiscalYear ?? '',
    title: raw.title ?? '',
    topic: raw.topic ?? '',
    publicationDate: raw.publicationDate ?? '',
    summary: raw.summary ?? '',
    sourceUrl,
    sourceSystem,
  });
  const id = await computeHash(contentForHash, 'sha256');
  const recordType = normalizeOntarioHealthRecordType(raw.recordType);
  return {
    id, recordType,
    claimType: (raw.claimType as any) ?? null,
    serviceCode: raw.serviceCode ?? null,
    feeSchedule: raw.feeSchedule ?? null,
    serviceDate: normalizeDate(raw.serviceDate),
    providerType: raw.providerType ?? null,
    claimsCount: typeof raw.claimsCount === 'number' ? raw.claimsCount : typeof raw.claimsCount === 'string' ? parseInt(raw.claimsCount, 10) : null,
    totalPaid: typeof raw.totalPaid === 'number' ? raw.totalPaid : typeof raw.totalPaid === 'string' ? parseFloat(raw.totalPaid) : null,
    fiscalYear: raw.fiscalYear ?? null,
    title: (raw.title as any) ?? null,
    topic: (raw.topic as any) ?? null,
    publicationDate: normalizeDate(raw.publicationDate),
    summary: (raw.summary as any) ?? null,
    sourceUrl, sourceSystem, ingestedAt: now,
  };
}

export async function parseOntarioHealthBatch(rawRecords: RawOntarioHealthRecord[], options: { sourceSystem?: string; ingestedAt?: string } = {}): Promise<OntarioHealthRecord[]> {
  const results: OntarioHealthRecord[] = [];
  for (const raw of rawRecords) {
    const parsed = await parseOntarioHealthRecord(raw, options);
    if (parsed !== null) results.push(parsed);
  }
  return results;
}
