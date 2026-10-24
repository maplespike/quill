// SPDX-License-Identifier: AGPL-3.0-only

export interface LibraryRecord {
  id: string;
  city: string;
  province: string;
  library: string;
  branchName: string;
  address?: string;
  phone?: string;
  hours?: string;
  services?: string[];
  lat?: number;
  lon?: number;
  url?: string;
}

export interface LibraryIngestionResult {
  city: string;
  library: string;
  province: string;
  branches: LibraryRecord[];
  errors: string[];
  durationMs: number;
}
