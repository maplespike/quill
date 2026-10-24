// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { MediaRecord, MediaSource } from './types.js';

export async function toMediaRecord(
  source: MediaSource,
  title: string,
  url: string,
  year: number,
  description: string,
  additionalData: {
    value?: number;
    entity?: string;
    category?: string;
  } = {},
): Promise<MediaRecord> {
  const hashInput = JSON.stringify({ source, title, url, year });
  const hash = await computeHash(hashInput, 'sha256');

  return {
    source,
    title,
    url,
    year,
    value: additionalData.value,
    entity: additionalData.entity,
    category: additionalData.category,
    description,
    hash,
    ingestedAt: new Date().toISOString(),
  };
}

export async function parseCrtcReports(html: string, maxRecords: number): Promise<MediaRecord[]> {
  const records: MediaRecord[] = [];
  const lp = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = lp.exec(html)) !== null) {
    const t = m[2].replace(/<[^>]+>/g, '').trim();
    if (t.length < 10 || !/(communication|broadcasting|telecom|media|internet|wireless|revenue|audience)/i.test(t)) continue;
    if (records.length >= maxRecords) break;

    const year = t.match(/\b(20\d{2})\b/)?.[1];
    records.push(await toMediaRecord(
      'crtc-market-reports',
      t,
      m[1].startsWith('http') ? m[1] : `https://crtc.gc.ca${m[1]}`,
      year ? parseInt(year) : new Date().getFullYear(),
      'CRTC market report',
    ));
  }

  return records;
}

export async function parseCrtcOwnership(html: string, maxRecords: number): Promise<MediaRecord[]> {
  const records: MediaRecord[] = [];
  const lp = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = lp.exec(html)) !== null) {
    const t = m[2].replace(/<[^>]+>/g, '').trim();
    if (t.length < 5 || !/(ownership|group|radio|tv|cable|satellite|broadcaster|publisher)/i.test(t)) continue;
    if (records.length >= maxRecords) break;

    records.push(await toMediaRecord(
      'crtc-ownership',
      t,
      m[1].startsWith('http') ? m[1] : `https://crtc.gc.ca${m[1]}`,
      new Date().getFullYear(),
      'CRTC ownership chart',
    ));
  }

  return records;
}

export async function parseCmfData(html: string, maxRecords: number): Promise<MediaRecord[]> {
  const records: MediaRecord[] = [];
  const lp = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = lp.exec(html)) !== null) {
    const t = m[2].replace(/<[^>]+>/g, '').trim();
    if (t.length < 10 || !/(csv|data|investment|production|funding|report)/i.test(t)) continue;
    if (records.length >= maxRecords) break;

    const year = t.match(/\b(20\d{2})\b/)?.[0];
    records.push(await toMediaRecord(
      'canada-media-fund',
      t,
      m[1].startsWith('http') ? m[1] : `https://www.cmf-fmc.ca${m[1]}`,
      year ? parseInt(year) : new Date().getFullYear(),
      'CMF open data',
    ));
  }

  return records;
}

export async function parseTelefilm(html: string, maxRecords: number): Promise<MediaRecord[]> {
  const records: MediaRecord[] = [];
  const lp = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = lp.exec(html)) !== null) {
    const t = m[2].replace(/<[^>]+>/g, '').trim();
    if (t.length < 10 || !/(report|study|funding|production|data)/i.test(t)) continue;
    if (records.length >= maxRecords) break;

    const year = t.match(/\b(20\d{2})\b/)?.[0];
    records.push(await toMediaRecord(
      'telefilm',
      t,
      m[1].startsWith('http') ? m[1] : `https://telefilm.ca${m[1]}`,
      year ? parseInt(year) : new Date().getFullYear(),
      'Telefilm report',
    ));
  }

  return records;
}