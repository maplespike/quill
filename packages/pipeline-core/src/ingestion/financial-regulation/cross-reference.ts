// SPDX-License-Identifier: AGPL-3.0-only
import { computeHash } from '../../verification/hashing.js';
import { httpGet } from '../../utils/http.js';
import { FINREG_TIMEOUT_MS, FINREG_UA } from './constants.js';

export interface BankingLobbyingMatch {
  id: string;
  institutionName: string;
  totalComplaints: number;
  latestComplaintYear: number;
  lobbyingCount: number;
  lobbyingSubjects: string[];
  latestLobbyingDate: string;
  riskSignal: 'HIGH' | 'MEDIUM' | 'LOW';
  lobbyingUrls: string[];
  fcacUrls: string[];
  analyzedAt: string;
}

export interface BankingLobbyingReport {
  generatedAt: string;
  institutionsScanned: number;
  matchedInstitutions: number;
  matches: BankingLobbyingMatch[];
  complaintsOnly: number;
  lobbyingOnly: number;
  errors: string[];
}

function normalizeBankName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"]/g, '')
    .replace(/\b(inc|limited|ltd|corp|corporation|co|company|bank|financial|trust|credit|union)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeRiskSignal(
  totalComplaints: number,
  lobbyingCount: number,
  subjects: string[],
): 'HIGH' | 'MEDIUM' | 'LOW' {
  const highComplaints = totalComplaints > 500;
  const activeLobbying = lobbyingCount >= 3;
  const regulatorySubjects = subjects.some(s =>
    /regulat|oversight|bank act|compliance|consumer|capital/i.test(s)
  );
  if (highComplaints && activeLobbying) return 'HIGH';
  if (highComplaints || (activeLobbying && regulatorySubjects)) return 'MEDIUM';
  return 'LOW';
}

interface FcacComplaintSummary {
  name: string;
  totalComplaints: number;
  latestYear: number;
  urls: string[];
}

async function aggregateFcacComplaints(): Promise<FcacComplaintSummary[]> {
  try {
    const resp = await httpGet(
      `https://open.canada.ca/data/api/3/action/package_search?q=${encodeURIComponent('fcac complaint banking')}&rows=50`,
      { timeoutMs: FINREG_TIMEOUT_MS, headers: { 'User-Agent': FINREG_UA } },
    );
    if (resp.statusCode >= 400) return [];

    const data = JSON.parse(resp.body);
    const packages = data?.result?.results ?? [];
    const bankMap = new Map<string, { total: number; year: number; urls: string[] }>();

    for (const pkg of packages) {
      const title: string = pkg.title || '';
      const url = `https://open.canada.ca/data/en/dataset/${pkg.id}`;
      const match = title.match(/FCAC\s+Complaint\s+Data\s*[-–—]\s*(.+?)\s*[-–—]\s*(\d{4})/i);
      if (!match) continue;

      const bankName = match[1].trim();
      const year = parseInt(match[2], 10);
      const normalized = normalizeBankName(bankName);
      if (!normalized) continue;

      const existing = bankMap.get(normalized) || { total: 0, year: 0, urls: [] };
      existing.total += 1;
      existing.year = Math.max(existing.year, year);
      existing.urls.push(url);
      bankMap.set(normalized, existing);
    }

    return Array.from(bankMap.entries()).map(([normalized, data]) => ({
      name: normalized,
      totalComplaints: data.total,
      latestYear: data.year,
      urls: data.urls,
    }));
  } catch (err) {
    console.warn(`[Banking×Lobbying] Failed to aggregate FCAC complaints: ${(err as Error).message}`);
    return [];
  }
}

interface LobbyingSummary {
  registrationCount: number;
  subjects: string[];
  latestDate: string;
  urls: string[];
}

async function searchLobbyingForBank(bankName: string): Promise<LobbyingSummary> {
  const subjects = new Set<string>();
  const urls: string[] = [];
  let latestDate = '';

  try {
    const resp = await httpGet(
      `https://lobbycanada.gc.ca/app/secure/ocr/lobbyistsregistry/registrationsearch.shtml?search=${encodeURIComponent(bankName)}`,
      { timeoutMs: FINREG_TIMEOUT_MS, headers: { 'User-Agent': FINREG_UA } },
    );
    if (resp.statusCode >= 400) {
      return { registrationCount: 0, subjects: [], latestDate: '', urls: [] };
    }

    const html = resp.body;
    const linkRe = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html)) !== null) {
      const text = m[2].replace(/<[^>]+>/g, '').trim();
      if (text.length < 5) continue;
      const href = m[1].startsWith('http') ? m[1] : `https://lobbycanada.gc.ca${m[1]}`;
      urls.push(href);
      if (/bank|financial|insurance|regulat|compliance|capital/i.test(text)) {
        subjects.add(text.substring(0, 100));
      }
    }

    const dateRe = /(\d{4}[-/]\d{2}[-/]\d{2})/g;
    let dm: RegExpExecArray | null;
    let foundDate = '';
    while ((dm = dateRe.exec(html)) !== null) {
      if (dm[1] > foundDate) foundDate = dm[1];
    }
    latestDate = foundDate;
  } catch (err) {
    console.warn(`[Banking×Lobbying] Search failed for "${bankName}": ${(err as Error).message}`);
  }

  return {
    registrationCount: urls.length,
    subjects: Array.from(subjects).slice(0, 10),
    latestDate,
    urls: urls.slice(0, 20),
  };
}

export async function crossReferenceBankingLobbying(
  institutionNames?: string[],
): Promise<BankingLobbyingReport> {
  const generatedAt = new Date().toISOString();
  const errors: string[] = [];
  const matches: BankingLobbyingMatch[] = [];
  let complaintsOnly = 0;
  let lobbyingOnly = 0;

  let institutions = await aggregateFcacComplaints();
  if (institutionNames && institutionNames.length > 0) {
    const filterSet = new Set(institutionNames.map(n => normalizeBankName(n)));
    institutions = institutions.filter(i => filterSet.has(i.name));
  }
  const institutionsScanned = institutions.length;

  for (const inst of institutions) {
    try {
      const lobbying = await searchLobbyingForBank(inst.name);
      if (lobbying.registrationCount === 0) {
        complaintsOnly++;
        continue;
      }
      const idContent = `banking-lobbying|${inst.name}|${generatedAt}`;
      const id = await computeHash(idContent, 'sha256');
      const riskSignal = computeRiskSignal(
        inst.totalComplaints, lobbying.registrationCount, lobbying.subjects,
      );
      matches.push({
        id,
        institutionName: inst.name,
        totalComplaints: inst.totalComplaints,
        latestComplaintYear: inst.latestYear,
        lobbyingCount: lobbying.registrationCount,
        lobbyingSubjects: lobbying.subjects,
        latestLobbyingDate: lobbying.latestDate,
        riskSignal,
        lobbyingUrls: lobbying.urls,
        fcacUrls: inst.urls,
        analyzedAt: generatedAt,
      });
    } catch (err) {
      errors.push(`${inst.name}: ${(err as Error).message}`);
    }
  }

  const riskOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  matches.sort((a, b) => {
    const ra = riskOrder[a.riskSignal];
    const rb = riskOrder[b.riskSignal];
    if (ra !== rb) return ra - rb;
    return b.totalComplaints - a.totalComplaints;
  });

  return {
    generatedAt, institutionsScanned,
    matchedInstitutions: matches.length,
    matches, complaintsOnly, lobbyingOnly, errors,
  };
}
