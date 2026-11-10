// SPDX-License-Identifier: AGPL-3.0-only
export interface CrimeStatistics {
  id: string;
  city: string;
  province: string;
  year: number;
  crimeType: string;
  count: number;
  ratePer100k: number;
}

export interface IncidentReport {
  id: string;
  city: string;
  province: string;
  date: Date;
  incidentType: string;
  location?: string;
  description?: string;
}

export interface PoliceRecord {
  id: string;
  city: string;
  province: string;
  agency: string;
  incidentType?: string;
  location?: string;
  date?: string;
  disposition?: string;
  lat?: number;
  lon?: number;
}

export interface PoliceIngestionResult {
  city: string;
  agency: string;
  records: PoliceRecord[];
  errors: string[];
  durationMs: number;
}
