// SPDX-License-Identifier: AGPL-3.0-only
export interface ParkRecord {
  id: string;
  city: string;
  province: string;
  parkName: string;
  parkType?: string;
  address?: string;
  amenities?: string[];
  sizeHa?: number;
  lat?: number;
  lon?: number;
  url?: string;
}

export interface ParkIngestionResult {
  city: string;
  parks: ParkRecord[];
  errors: string[];
  durationMs: number;
}
