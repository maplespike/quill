// SPDX-License-Identifier: AGPL-3.0-only

import { computeHash } from '../../verification/hashing.js';
import type { TribunalDecision, TribunalName } from './types.js';

export async function toTribunalDecision(
  item: Record<string, unknown>,
  tribunal: TribunalName,
  tribunalName: string,
  baseUrl: string,
  ingestedAt: string,
): Promise<TribunalDecision | null> {
  const caseNum = String(item.caseNumber ?? item.docket ?? item.fileNumber ?? '');
  if (!caseNum) return null;

  return {
    id: await computeHash(`${tribunal}:${caseNum}`, 'sha256'),
    tribunal: tribunalName,
    caseNumber: caseNum,
    title: String(item.title ?? item.name ?? ''),
    applicant: String(item.applicant ?? item.party ?? ''),
    respondent: String(item.respondent ?? ''),
    decisionDate: String(item.date ?? item.decisionDate ?? ingestedAt.split('T')[0]),
    outcome: String(item.outcome ?? item.decision ?? ''),
    summary: String(item.summary ?? item.description ?? null) || null,
    sourceUrl: `${baseUrl}/en/decisions/${item.id ?? ''}`,
    ingestedAt,
  };
}
