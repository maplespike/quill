// SPDX-License-Identifier: AGPL-3.0-only
export interface TribunalDecision {
  id: string;
  tribunal: string;
  caseNumber: string;
  title: string;
  applicant: string;
  respondent: string;
  decisionDate: string;
  outcome: string;
  summary: string | null;
  sourceUrl: string;
  ingestedAt: string;
}

export interface TribunalCase {
  id: string;
  tribunal: string;
  caseNumber: string;
  status: string;
  filedDate: string | null;
  subject: string;
  sourceUrl: string;
  ingestedAt: string;
}

export interface TribunalIngestionResult {
  decisions: TribunalDecision[];
  cases: TribunalCase[];
  errors: string[];
}

export const TRIBUNAL_NAMES = [
  'social-security-tribunal',
  'agri-review-tribunal',
  'public-servants-disclosure-tribunal',
  'copyright-board',
  'citt',
  'rcmp-external-review',
  'courts-admin-service',
  'official-languages',
  'integrity-commissioner',
  'taxpayers-ombudsman',
  'core-ombudsman',
  'human-rights-tribunal',
] as const;

export type TribunalName = typeof TRIBUNAL_NAMES[number];
