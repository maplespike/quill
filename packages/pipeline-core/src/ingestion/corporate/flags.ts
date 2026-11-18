// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Corporate Data Flagging — Quill
 *
 * Statistical flagging for anomalies in corporate/government data:
 *   - Lobbying activity spikes: detect when lobbying on a subject
 *     suddenly increases above baseline expectations.
 */

import type { LobbyingRecord, ContractAward, ContractFlag } from './types.js';


export interface LobbyingSpike {
  subject: string;
  currentCount: number;
  baselineAvg: number;
  spikeFactor: number;
  timeframe: string;
  topOrganizations: string[];
  relatedCommittee: string | null;
}


interface MonthKey {
  year: number;
  month: number;
}


function toMonthKey(dateStr: string): MonthKey | null {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}


function monthKeyToString(mk: MonthKey): string {
  return `${mk.year}-${String(mk.month).padStart(2, '0')}`;
}


export function detectLobbyingSpikes(records: LobbyingRecord[]): LobbyingSpike[] {
  if (records.length === 0) return [];

  const subjectMonthCounts = new Map<string, Map<string, { count: number; orgs: Map<string, number>; committees: Map<string, number> }>>();

  for (const record of records) {
    const mk = toMonthKey(record.communicationDate);
    if (!mk) continue;
    const monthStr = monthKeyToString(mk);

    for (const subject of record.subjectMatter) {
      if (!subject) continue;
      const trimmedSubject = subject.trim();
      if (!trimmedSubject) continue;

      let monthMap = subjectMonthCounts.get(trimmedSubject);
      if (!monthMap) {
        monthMap = new Map();
        subjectMonthCounts.set(trimmedSubject, monthMap);
      }

      let bucket = monthMap.get(monthStr);
      if (!bucket) {
        bucket = { count: 0, orgs: new Map(), committees: new Map() };
        monthMap.set(monthStr, bucket);
      }

      bucket.count++;
      bucket.orgs.set(record.clientName, (bucket.orgs.get(record.clientName) ?? 0) + 1);
      if (record.governmentInstitution) {
        bucket.committees.set(record.governmentInstitution, (bucket.committees.get(record.governmentInstitution) ?? 0) + 1);
      }
    }
  }

  const spikes: LobbyingSpike[] = [];

  for (const [subject, monthMap] of subjectMonthCounts) {
    const sortedMonths = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    if (sortedMonths.length < 2) continue;

    const [currentMonthStr, currentBucket] = sortedMonths[sortedMonths.length - 1];
    const currentCount = currentBucket.count;

    const otherMonths = sortedMonths.slice(0, -1);
    const totalOther = otherMonths.reduce((sum, [, b]) => sum + b.count, 0);
    const baselineAvg = totalOther / otherMonths.length;

    if (baselineAvg <= 0) continue;

    const spikeFactor = currentCount / baselineAvg;
    if (spikeFactor < 2) continue;

    const topOrgs = Array.from(currentBucket.orgs.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name]) => name);

    let relatedCommittee: string | null = null;
    let topCommitteeCount = 0;
    for (const [committee, count] of currentBucket.committees) {
      if (count > topCommitteeCount) {
        topCommitteeCount = count;
        relatedCommittee = committee;
      }
    }

    spikes.push({
      subject,
      currentCount,
      baselineAvg: Math.round(baselineAvg * 100) / 100,
      spikeFactor: Math.round(spikeFactor * 100) / 100,
      timeframe: currentMonthStr,
      topOrganizations: topOrgs,
      relatedCommittee,
    });
  }

  return spikes.sort((a, b) => b.spikeFactor - a.spikeFactor);
}


/**
 * Flag sole-source contracts that exceed risk thresholds.
 * Returns flags for contracts awarded without competitive process.
 */
export function detectSoleSourceContracts(records: ContractAward[]): ContractFlag[] {
  const flags: ContractFlag[] = [];

  for (const contract of records) {
    if (!contract.isSoleSource) continue;

    const val = contract.contractValue || 0;
    const title = contract.description || contract.id;
    const flag: ContractFlag = {
      type: 'sole-source',
      severity: val > 1_000_000 ? 'high' : val > 100_000 ? 'medium' : 'low',
      contractId: contract.id,
      title: title.substring(0, 200),
      organization: contract.vendorName,
      value: val,
      reason: `Sole-source contract awarded to ${contract.vendorName} worth $${val.toLocaleString()}`,
      sourceUrl: contract.sourceUrl,
    };
    flags.push(flag);
  }

  return flags.sort((a, b) => (b.value || 0) - (a.value || 0));
}
