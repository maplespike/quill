// SPDX-License-Identifier: AGPL-3.0-only
export interface BaseEnergyRecord {
  [key: string]: unknown;
  id: string;
  title: string;
  description: string;
  url: string;
  date: string;
  sector: string;
  category: string;
}

export interface OilProductionRecord extends BaseEnergyRecord {
  province?: string;
  barrelsPerDay?: number;
  apiGravity?: number;
}

export interface GasProductionRecord extends BaseEnergyRecord {
  province?: string;
  millionCubicFeetPerDay?: number;
  heatContent?: number;
}

export interface ElectricityRecord extends BaseEnergyRecord {
  province?: string;
  megawattHours?: number;
  fuelType?: string;
  capacityMw?: number;
}

export interface PipelineRecord extends BaseEnergyRecord {
  pipelineName?: string;
  throughputBarrelsPerDay?: number;
  capacityBarrelsPerDay?: number;
  incidents?: number;
}

export interface RenewableEnergyRecord extends BaseEnergyRecord {
  technologyType?: string;
  capacityMw?: number;
  province?: string;
  generationMwh?: number;
}

export interface MiningRecord extends BaseEnergyRecord {
  commodity?: string;
  productionTonnes?: number;
  province?: string;
  mineType?: string;
}

export type EnergyRecord = BaseEnergyRecord;

export interface EnergyIngestionResult {
  source: string;
  recordsFound: number;
  records: EnergyRecord[];
  errors: string[];
  durationMs: number;
}
