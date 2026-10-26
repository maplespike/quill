// SPDX-License-Identifier: AGPL-3.0-only

export interface FaoRecord {
  domain: string;
  domainCode: string;
  indicator: string;
  indicatorCode: string;
  area: string;
  areaCode: string;
  element: string;
  elementCode: string;
  item: string;
  itemCode: string;
  year: number;
  value: number | null;
  flag: string | null;
  flagDescription: string | null;
  id: string;
  timestamp: string;
}

export interface FaoIngestionResult {
  success: boolean;
  records: FaoRecord[];
  errors: string[];
  metadata: {
    domain: string;
    indicator: string;
    area?: string;
    yearRange?: [number, number];
    fetchedAt: string;
    totalRecords: number;
  };
}
