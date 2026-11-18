// SPDX-License-Identifier: AGPL-3.0-only
export interface ResearchGrant {
  id: string;
  agency: 'csa' | 'mitacs' | 'genome-canada' | 'cifar' | 'canarie' | 'digital-research' | 'polar' | 'onc' | 'perimeter';
  program: string;
  recipient: string;
  recipientType: 'university' | 'college' | 'research-institute' | 'company' | 'nonprofit' | 'individual';
  amountCad: number;
  year: number;
  province: string;
  title: string;
  description: string | null;
  sourceUrl: string;
  ingestedAt: string;
}

export interface SpaceMission {
  id: string;
  mission: string;
  agency: 'csa' | 'nasa' | 'esa' | 'commercial';
  status: 'active' | 'completed' | 'planned' | 'cancelled';
  launchYear: number | null;
  description: string;
  budgetCad: number | null;
  sourceUrl: string;
  ingestedAt: string;
}

export interface OceanObservation {
  id: string;
  station: string;
  region: string;
  latitude: number;
  longitude: number;
  parameter: string;
  value: number;
  unit: string;
  timestamp: string;
  depth: number | null;
  sourceUrl: string;
  ingestedAt: string;
}

export interface PolarRecord {
  id: string;
  title: string;
  investigator: string;
  organization: string;
  region: string;
  discipline: string;
  startYear: number;
  endYear: number | null;
  fundingAmount: number | null;
  sourceUrl: string;
  ingestedAt: string;
}

export interface ScienceIngestionResult {
  grants: ResearchGrant[];
  missions: SpaceMission[];
  observations: OceanObservation[];
  polar: PolarRecord[];
  errors: string[];
}
