// SPDX-License-Identifier: AGPL-3.0-only

export interface EmergencyManagementRecord {
  id: string;
  sourceSystem: string;
  recordType: string;
  title: string | null;
  description: string | null;
  url: string | null;
  publishedAt: string | null;
  ingestedAt: string;
  disasterType?: string;
  location?: string;
  eventDate?: string | null;
  estimatedCost?: number | null;
  fatalities?: number | null;
}

export interface RawEmergencyManagementRecord {
  title?: string;
  description?: string;
  url?: string;
  publishedAt?: string;
  sourceSystem?: string;
  [key: string]: unknown;
}

export interface EmergencyManagementIngestionOptions {
  maxRecords?: number;
  force?: boolean;
  initializeTable?: boolean;
  onProgress?: (msg: string) => void;
}

export interface EmergencyManagementIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  durationMs: number;
}
