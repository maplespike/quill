/**
 * Veterans data ingestion — Quill
 *
 * Orchestrates multi-source Canadian veterans data ingestion:
 *   - VAC Facts and Figures (CKAN CSV)
 *   - VAC Benefits by Program (CKAN)
 *   - VAC Disability Benefits (CKAN)
 *   - VAC Education and Training Benefits (CKAN)
 *   - VAC Service Wait Times (CKAN)
 *   - VAC Client Caseload (CKAN)
 *   - Veterans Suicide Mortality Statistics (CKAN + web)
 *   - OSISS Operational Stress Injury Clinics (CKAN + web)
 *   - DND Regular Force Personnel (CKAN)
 *   - DND Veteran Transition Programs (CKAN)
 *   - Defence Procurement Veteran-related Spending (CKAN)
 *   - CAF Mental Health and Wellness Programs (CKAN)
 *
 * Licensed under AGPL-3.0
 */

import { computeHash } from '../../verification/hashing.js';
import type { VeteransRecord, VeteransIngestionResult } from './types.js';
import { fetchAllVeteransData } from './fetcher.js';

export async function ingestAllVeterans(): Promise<VeteransIngestionResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  let records: VeteransRecord[];
  try {
    records = await fetchAllVeteransData();
  } catch (err) {
    errors.push(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
    records = [];
  }

  return { records, errors, durationMs: Date.now() - startTime };
}

export async function searchVeterans(query: string): Promise<VeteransIngestionResult> {
  const all = await ingestAllVeterans();
  const q = query.toLowerCase();

  return {
    records: all.records.filter(r => {
      const desc = (r.description ?? '').toLowerCase();
      const cat = r.category.toLowerCase();
      const prog = (r.program ?? '').toLowerCase();
      const demo = (r.demographic ?? '').toLowerCase();
      const region = (r.region ?? '').toLowerCase();
      const metric = (r.metricType ?? '').toLowerCase();
      return desc.includes(q) || cat.includes(q) || prog.includes(q) ||
             demo.includes(q) || region.includes(q) || metric.includes(q);
    }),
    errors: all.errors,
    durationMs: all.durationMs,
  };
}

export async function getByCategory(category: string): Promise<VeteransRecord[]> {
  const all = await ingestAllVeterans();
  const q = category.toLowerCase();
  return all.records.filter(r => r.category.toLowerCase().includes(q));
}

export async function getByProgram(program: string): Promise<VeteransRecord[]> {
  const all = await ingestAllVeterans();
  const q = program.toLowerCase();
  return all.records.filter(r => (r.program ?? '').toLowerCase().includes(q));
}

export async function getStatsSummary(): Promise<{
  totalRecords: number;
  categories: Record<string, number>;
  programs: Record<string, number>;
  errors: string[];
}> {
  const all = await ingestAllVeterans();
  const categories: Record<string, number> = {};
  const programs: Record<string, number> = {};

  for (const r of all.records) {
    categories[r.category] = (categories[r.category] ?? 0) + 1;
    if (r.program) {
      programs[r.program] = (programs[r.program] ?? 0) + 1;
    }
  }

  return {
    totalRecords: all.records.length,
    categories,
    programs,
    errors: all.errors,
  };
}

export type { VeteransRecord, VeteransIngestionResult, VacBenefitStat, OsissClinicRecord, VeteranSuicideStat, DndVeteranProgramRecord } from './types.js';
export { parseVeteransRecord, parseVeteransRecords, normalizeDate, parseNumeric } from './parser.js';
