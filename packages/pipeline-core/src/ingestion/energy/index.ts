export { ingestOilProduction, ingestGasProduction, ingestElectricity, ingestMining, ingestAllEnergy } from './fetcher.js';
export type { EnergyRecord, EnergyIngestionResult } from './types.js';

export {
  parseOilRecord,
  parseGasRecord,
  parseElectricityRecord,
  parseRenewableRecord,
  parseEnergyBatch,
  parseEnergyRecords,
} from './parser.js';

export type {
  OilProductionRecord,
  GasStorageRecord,
  ElectricityGenerationRecord,
  RenewableEnergyRecord,
  EnergyParsedRecord,
} from './parser.js';

export {
  normalizeProvince,
  normalizeFuelType,
  parseNumeric,
  parseDate,
  detectPeriodType,
  detectEnergySector,
} from './parser.js';
