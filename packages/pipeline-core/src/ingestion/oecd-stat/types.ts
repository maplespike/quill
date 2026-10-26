// SPDX-License-Identifier: AGPL-3.0-only

export interface OECDIndicator {
  id: string;
  datasetId: string;
  datasetName: string;
  indicatorCode: string;
  country: string;
  year: number;
  value: number;
  unit: string;
}

export interface OECDObservation {
  country: string;
  year: number;
  value: number;
  unit: string;
}

export interface OECDDataset {
  id: string;
  name: string;
}

export interface OECDIngestionResult {
  datasetsAttempted: number;
  datasetsSucceeded: number;
  indicators: OECDIndicator[];
  errors: string[];
  durationMs: number;
}

export interface OECDSdmxResponse {
  dataSets?: Array<{
    series?: Record<string, { observations: Record<string, string[]> }>;
    observations?: Record<string, string[]>;
  }>;
  structure?: {
    dimensions?: {
      series?: Array<{ id: string; values: Array<{ id: string; name: string }> }>;
      observation?: Array<{ id: string; values: Array<{ id: string; name: string }> }>;
    };
  };
}
