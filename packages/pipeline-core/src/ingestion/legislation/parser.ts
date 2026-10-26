// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { LegislationRecord, LegislationSource } from './types.js';

export async function toLegislationRecord(
  source: LegislationSource,
  jurisdiction: string,
  title: string,
  url: string,
  year: number,
  format: string,
  description: string,
  additionalData: {
    actNumber?: string;
    chapter?: string;
  } = {},
): Promise<LegislationRecord> {
  const hashInput = JSON.stringify({ source, jurisdiction, title, actNumber: additionalData.actNumber, chapter: additionalData.chapter });
  const hash = await computeHash(hashInput, 'sha256');

  return {
    source,
    jurisdiction,
    title,
    url,
    year,
    format: 'XML',
    description,
    hash,
    ingestedAt: new Date().toISOString(),
  };
}

export async function parseJusticeCanadaXml(xml: string, maxRecords: number): Promise<LegislationRecord[]> {
  const records: LegislationRecord[] = [];
  const actRegex = /<(Act|Regulation)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  
  while ((m = actRegex.exec(xml)) !== null && records.length < maxRecords) {
    const block = m[0];
    const title = block.match(/<Title[^>]*>([\s\S]*?)<\/Title>/i)?.[1]?.trim() || 'Untitled';
    const chapter = block.match(/<Chapter[^>]*>([\s\S]*?)<\/Chapter>/i)?.[1] || '';
    const year = block.match(/<Year[^>]*>([\s\S]*?)<\/Year>/i)?.[1] || '';
    const fileUrl = block.match(/<URL[^>]*>([\s\S]*?)<\/URL>/i)?.[1] || block.match(/href="([^"]+\.xml)"/i)?.[1] || '';
    
    records.push(await toLegislationRecord(
      'justice-canada-xml',
      'federal',
      title,
      fileUrl.startsWith('http') ? fileUrl : `https://laws-lois.justice.gc.ca/eng/XML/${fileUrl}`,
      year ? parseInt(year) : new Date().getFullYear(),
      'XML',
      `Federal ${m[1].toLowerCase()}: ${title}`,
      { chapter },
    ));
  }

  return records;
}

export async function parseProvincialCkanPackages(pkgs: any[], maxRecords: number): Promise<LegislationRecord[]> {
  const records: LegislationRecord[] = [];

  for (const pkg of pkgs) {
    if (records.length >= maxRecords) break;
    
    records.push(await toLegislationRecord(
      'provincial-ckan',
      pkg.organization?.title || 'Canada',
      pkg.title || pkg.name || '',
      `https://open.canada.ca/data/en/dataset/${pkg.id}`,
      pkg.metadata_created?.substring(0, 4) ? parseInt(pkg.metadata_created.substring(0, 4)) : new Date().getFullYear(),
      'CKAN',
      (pkg.notes || '').substring(0, 300),
    ));
  }

  return records;
}

export async function parseProvincialWebHtml(
  html: string,
  source: 'ontario-elaws' | 'bc-laws',
  jurisdiction: string,
  baseUrl: string,
  maxRecords: number,
): Promise<LegislationRecord[]> {
  const records: LegislationRecord[] = [];
  const lp = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = lp.exec(html)) !== null && records.length < maxRecords) {
    const t = m[2].replace(/<[^>]+>/g, '').trim();
    if (t.length < 10 || !/(act|regulation|statute|bill)/i.test(t)) continue;

    records.push(await toLegislationRecord(
      source,
      jurisdiction,
      t,
      m[1].startsWith('http') ? m[1] : `${baseUrl}${m[1]}`,
      new Date().getFullYear(),
      'HTML',
      `${jurisdiction} legislation: ${t}`,
    ));
  }

  return records;
}