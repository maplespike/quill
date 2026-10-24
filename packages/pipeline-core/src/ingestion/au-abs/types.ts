// SPDX-License-Identifier: AGPL-3.0-only

export interface AbsDataflow {
  id: string;
  name: string;
  description?: string;
  agencyID: string;
  version: string;
}

export interface AbsDataStructure {
  id: string;
  name: string;
  dimensions: AbsDimension[];
  attributes: AbsAttribute[];
}

export interface AbsDimension {
  id: string;
  name: string;
  values: Array<{ id: string; name: string }>;
}

export interface AbsAttribute {
  id: string;
  name: string;
  values: Array<{ id: string; name: string }>;
}

export interface AbsSdmxJsonData {
  structure: {
    dimensions: {
      observation: Array<{ id: string; name: string; values: Array<{ id: string; name: string }> }>;
      series?: Array<{ id: string; name: string; values: Array<{ id: string; name: string }> }>;
    };
  };
  dataSets: Array<{
    series?: Record<string, { observations: Record<string, [number, ...number[]]> }>;
    observations?: Record<string, [number, ...number[]]>;
  }>;
}

export interface AbsFactRecord {
  id: string;
  dataflow: string;
  dataflowName: string;
  dimensions: Record<string, string>;
  value: number | null;
  unit?: string;
  period: string;
  lastUpdated: string;
}

export interface AbsIngestionResult {
  dataflow: string;
  records: AbsFactRecord[];
  observationsExtracted: number;
  errors: string[];
  durationMs: number;
}
