/**
export { parseStatCanRecord, parseStatCanRecords } from './parser.js';
 * StatCan Ingestion — Quill
 *
 * Orchestrates Statistics Canada data ingestion across all
 * major economic and social indicator categories via the
 * Web Data Service (WDS) REST API.
 */

import { fetchAllCpi } from './cpi.js';
import { fetchGdpByIndustry } from './gdp.js';
import { fetchLabourForceCharacteristics, fetchEmploymentByIndustry, fetchLabourMarketIndicators } from './labour.js';
import { fetchPopulationEstimates, fetchPopulationByAgeGender } from './population.js';
import { fetchInternationalTrade } from './trade.js';
import type { StatCanIngestionResult, StatCanIndicatorType } from './types.js';
import { STATCAN_PRODUCTS } from './constants.js';

function resultFor(
  indicatorType: StatCanIndicatorType,
  productId: string,
  records: unknown[],
  errors: string[],
  startMs: number,
): StatCanIngestionResult {
  return {
    indicatorType,
    productId,
    recordsFound: records.length,
    recordsIngested: records.length,
    errors,
    durationMs: Date.now() - startMs,
  };
}

export async function ingestCpi(): Promise<StatCanIngestionResult> {
  const start = Date.now();
  const errors: string[] = [];
  let records: unknown[] = [];
  try {
    const cpiData = await fetchAllCpi();
    records = cpiData.records;
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }
  return resultFor('cpi', STATCAN_PRODUCTS.CPI_MONTHLY, records, errors, start);
}

export async function ingestGdp(): Promise<StatCanIngestionResult> {
  const start = Date.now();
  const errors: string[] = [];
  const allRecords: unknown[] = [];
  try {
    const industry = await fetchGdpByIndustry().catch((e: unknown) => { errors.push(`GDP industry: ${e}`); return []; });
    allRecords.push(...industry);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }
  return resultFor('gdp', STATCAN_PRODUCTS.GDP_BY_INDUSTRY_MONTHLY, allRecords, errors, start);
}

export async function ingestLabour(): Promise<StatCanIngestionResult> {
  const start = Date.now();
  const errors: string[] = [];
  const allRecords: unknown[] = [];
  try {
    const [force, employment, indicators] = await Promise.all([
      fetchLabourForceCharacteristics().catch((e: unknown) => { errors.push(`Labour force: ${e}`); return []; }),
      fetchEmploymentByIndustry().catch((e: unknown) => { errors.push(`Employment: ${e}`); return []; }),
      fetchLabourMarketIndicators().catch((e: unknown) => { errors.push(`Labour indicators: ${e}`); return []; }),
    ]);
    allRecords.push(...force, ...employment, ...indicators);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }
  return resultFor('labour', STATCAN_PRODUCTS.LABOUR_FORCE_CHARACTERISTICS, allRecords, errors, start);
}

export async function ingestPopulation(): Promise<StatCanIngestionResult> {
  const start = Date.now();
  const errors: string[] = [];
  const allRecords: unknown[] = [];
  try {
    const [estimates, byAgeGender] = await Promise.all([
      fetchPopulationEstimates().catch((e: unknown) => { errors.push(`Pop estimates: ${e}`); return []; }),
      fetchPopulationByAgeGender().catch((e: unknown) => { errors.push(`Pop age/gender: ${e}`); return []; }),
    ]);
    allRecords.push(...estimates, ...byAgeGender);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }
  return resultFor('population', STATCAN_PRODUCTS.POPULATION_ESTIMATES, allRecords, errors, start);
}

export async function ingestTrade(): Promise<StatCanIngestionResult> {
  const start = Date.now();
  const errors: string[] = [];
  const allRecords: unknown[] = [];
  try {
    const records = await fetchInternationalTrade().catch((e: unknown) => { errors.push(`Trade: ${e}`); return []; });
    allRecords.push(...records);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }
  return resultFor('trade', STATCAN_PRODUCTS.INTERNATIONAL_MERCHANDISE_TRADE, allRecords, errors, start);
}

export { STATCAN_PRODUCTS } from './constants.js';

export async function ingestAllStatCan(): Promise<Record<string, StatCanIngestionResult>> {
  const [cpi, gdp, labour, population, trade] = await Promise.all([
    ingestCpi(),
    ingestGdp(),
    ingestLabour(),
    ingestPopulation(),
    ingestTrade(),
  ]);
  return { cpi, gdp, labour, population, trade };
}
