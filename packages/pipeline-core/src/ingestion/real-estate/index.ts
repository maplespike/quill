export { ingestRentalMarket, ingestHousingStarts, ingestHousePrices, ingestAllRealEstate } from './fetcher.js';

export {
  parseRentalMarketData,
  parseHousingStarts,
  parseHousePriceIndex,
  parsePropertyAssessment,
  parseAllRealEstateRecords,
} from './parser.js';

export type {
  RealEstateRecord,
  RealEstateIngestionResult,
  RentalMarketData,
  HousingStart,
  HousePriceIndex,
  PropertyAssessment,
} from './types.js';

export type {
  ParserOptions,
  ParseResult,
  RawCsvData,
  ParseAllRealEstateResult,
} from './parser.js';
