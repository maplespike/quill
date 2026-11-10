// SPDX-License-Identifier: AGPL-3.0-only
export interface RentalMarketData {
  id: string; municipality: string; province: string;
  vacancyRate: number; averageRent: number; unitType: string;
  year: number; source: string; url: string;
}

export interface PropertyAssessment {
  id: string; jurisdiction: string; province: string;
  assessedValue: number; year: number; propertyType: string;
  municipality: string; parcelId?: string; url?: string;
}

export interface HousingStart {
  id: string; municipality: string; province: string;
  starts: number; year: number; month?: number;
  housingType: string; source: string; url: string;
}

export interface HousePriceIndex {
  id: string; city: string; province: string;
  indexValue: number; changePercent: number; period: string;
  source: string; url: string;
}

export interface RealEstateRecord {
  id: string; title: string; description: string;
  url: string; date: string; sector: string; jurisdiction: string;
}

export interface RealEstateIngestionResult {
  source: string; recordsFound: number; records: RealEstateRecord[];
  errors: string[]; durationMs: number;
}
