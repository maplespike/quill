// SPDX-License-Identifier: AGPL-3.0-only
export interface BankData {
  id: string; institutionName: string; institutionType: string;
  assetsUnderManagement?: number; capitalAdequacyRatio?: number;
  domesticStabilityBuffer?: number; jurisdiction: string;
  source: string; url: string; date: string;
}

export interface InsuranceData {
  id: string; companyName: string; sector: string;
  totalAssets?: number; premiumsWritten?: number;
  jurisdiction: string; source: string; url: string; date: string;
}

export interface CDICMember {
  id: string; institutionName: string; memberCategory: string;
  premiumClass?: string; coverageLimit?: number;
  jurisdiction: string; source: string; url: string;
}

export interface Complaint {
  id: string; institutionName: string; complaintType: string;
  count: number; year: number; category: string;
  jurisdiction: string; source: string; url: string;
}

export interface FinRegRecord {
  id: string; regulator: string; title: string; description: string;
  url: string; date: string; category: string; jurisdiction: string;
}

export interface FinRegIngestionResult {
  source: string; recordsFound: number; records: FinRegRecord[];
  errors: string[]; durationMs: number;
}
