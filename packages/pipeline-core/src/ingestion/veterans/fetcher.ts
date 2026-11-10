// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Veterans data fetchers — Quill
 *
 * Multi-source fetcher for Canadian veterans data including:
 *   - VAC Facts and Figures (CKAN CSV)
 *   - VAC Benefits by Program (CKAN)
 *   - VAC Disability Benefits (CKAN)
 *   - VAC Education Benefits (CKAN)
 *   - VAC Wait Times (CKAN)
 *   - VAC Client Caseload (CKAN)
 *   - Veterans Suicide Mortality Statistics (CKAN + web)
 *   - OSISS Operational Stress Injury Clinics (web + CKAN)
 *   - DND Personnel and Transition Programs (CKAN)
 *   - DND Defence Procurement Veteran-related (CKAN)
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import { VAC_DATASETS, DND_DATASETS, VETERANS_TIMEOUT_MS, MAX_VETERANS_RECORDS } from './constants.js';
import type { VeteransRecord, VacBenefitStat, OsissClinicRecord, VeteranSuicideStat, DndVeteranProgramRecord } from './types.js';

const CKAN_BASE = 'https://open.canada.ca/data/api/3/action';
const VETERANS_UA = 'MapleSpike-Veterans/1.0';

/* ------------------------------------------------------------------ */
/*  Generic HTTP helpers                                                */
/* ------------------------------------------------------------------ */

async function fetchJson(url: string): Promise<any> {
  try {
    const resp = await httpGet(url, {
      timeoutMs: VETERANS_TIMEOUT_MS,
      headers: { 'User-Agent': VETERANS_UA },
    });
    return resp.statusCode >= 400 ? null : await resp.json();
  } catch { return null; }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const resp = await httpGet(url, {
      timeoutMs: VETERANS_TIMEOUT_MS,
      headers: { 'User-Agent': VETERANS_UA },
    });
    return resp.statusCode >= 400 ? null : resp.body;
  } catch { return null; }
}

/* ------------------------------------------------------------------ */
/*  CKAN helpers                                                       */
/* ------------------------------------------------------------------ */

async function fetchCkanPackage(ckanId: string): Promise<any> {
  const resp = await fetchJson(`${CKAN_BASE}/package_show?id=${ckanId}`);
  return resp?.result ?? null;
}

async function fetchCsv(url: string): Promise<string | null> {
  try {
    const resp = await httpGet(url, { timeoutMs: 30000 });
    return resp.statusCode >= 400 ? null : resp.body;
  } catch { return null; }
}

/** Parse CSV text into array of header-indexed rows */
function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? ''; });
    return row;
  });
}

/* ------------------------------------------------------------------ */
/*  VAC Facts and Figures — CKAN CSV parser                            */
/* ------------------------------------------------------------------ */

export async function fetchVacFactsFigures(): Promise<VeteransRecord[]> {
  const results: VeteransRecord[] = [];
  const now = new Date().toISOString();
  const pkg = await fetchCkanPackage(VAC_DATASETS.FACTS_FIGURES.id);
  if (!pkg?.resources) return results;

  for (const r of pkg.resources) {
    if (r.format?.toUpperCase() !== 'CSV') continue;
    const raw = await fetchCsv(r.url);
    if (!raw) continue;
    const rows = parseCsv(raw);
    for (const row of rows) {
      const year = parseInt(row['year'] || '0') || 0;
      const val = parseFloat(row['value'] || row['count'] || row['number'] || '0');
      if (isNaN(val)) continue;
      const id = await computeHash(`veterans:facts:${r.id}:${year}:${row['category'] || ''}:${row['indicator'] || ''}`, 'sha256');
      results.push({
        id, year,
        category: row['category'] || row['indicator'] || 'VAC Facts and Figures',
        program: row['program'] || '',
        value: val,
        description: row['description'] || `${row['indicator'] || 'VAC indicator'} for ${year}`,
        region: row['region'] || row['province'] || 'Canada',
        metricType: row['metric'] || row['measure'] || '',
        sourceUrl: r.url,
        sourceName: 'VAC Facts and Figures',
        ingestedAt: now,
      });
    }
  }
  return results;
}

/* ------------------------------------------------------------------ */
/*  VAC Benefits by Program                                            */
/* ------------------------------------------------------------------ */

export async function fetchVacBenefits(): Promise<VeteransRecord[]> {
  const results: VeteransRecord[] = [];
  const now = new Date().toISOString();
  const pkg = await fetchCkanPackage(VAC_DATASETS.BENEFITS_DATA.id);
  if (!pkg?.resources) return results;

  for (const r of pkg.resources) {
    if (r.format?.toUpperCase() !== 'CSV' && !r.url.endsWith('.csv')) continue;
    const raw = await fetchCsv(r.url);
    if (!raw) continue;
    const rows = parseCsv(raw);
    for (const row of rows) {
      const year = parseInt(row['year'] || '0') || 0;
      const val = parseFloat(row['expenditure'] || row['amount'] || row['value'] || row['recipients'] || '0');
      if (isNaN(val)) continue;
      const id = await computeHash(`veterans:benefits:${r.id}:${year}:${row['program'] || ''}`, 'sha256');
      results.push({
        id, year,
        category: 'VAC Benefits',
        program: row['program'] || r.name || '',
        value: val,
        description: row['notes'] || row['description'] || `${row['program'] || 'VAC program'} benefit data for ${year}`,
        region: row['region'] || row['province'] || 'Canada',
        demographic: row['demographic'] || row['cohort'] || '',
        metricType: row['metric'] || (r.name?.includes('expenditure') ? 'expenditure' : 'recipients'),
        sourceUrl: r.url,
        sourceName: 'VAC Benefits',
        ingestedAt: now,
      });
    }
  }
  return results;
}

/* ------------------------------------------------------------------ */
/*  VAC Disability Benefits                                            */
/* ------------------------------------------------------------------ */

export async function fetchVacDisabilityBenefits(): Promise<VeteransRecord[]> {
  const results: VeteransRecord[] = [];
  const now = new Date().toISOString();
  const pkg = await fetchCkanPackage(VAC_DATASETS.DISABILITY_BENEFITS.id);
  if (!pkg?.resources) return results;

  for (const r of pkg.resources) {
    if (r.format?.toUpperCase() !== 'CSV' && !r.url.endsWith('.csv')) continue;
    const raw = await fetchCsv(r.url);
    if (!raw) continue;
    const rows = parseCsv(raw);
    for (const row of rows) {
      const year = parseInt(row['year'] || '0') || 0;
      const val = parseFloat(row['applications'] || row['approved'] || row['value'] || '0');
      if (isNaN(val)) continue;
      const id = await computeHash(`veterans:disability:${r.id}:${year}:${row['category'] || ''}`, 'sha256');
      results.push({
        id, year,
        category: 'VAC Disability Benefits',
        program: row['benefit_type'] || row['program'] || 'Disability Benefits',
        value: val,
        description: row['notes'] || `VAC disability benefits ${row['category'] || ''} for ${year}`,
        region: 'Canada',
        demographic: row['demographic'] || '',
        metricType: 'applications',
        sourceUrl: r.url,
        sourceName: 'VAC Disability Benefits',
        ingestedAt: now,
      });
    }
  }
  return results;
}

/* ------------------------------------------------------------------ */
/*  VAC Education and Training Benefits                                 */
/* ------------------------------------------------------------------ */

async function fetchVacEducationBenefits(): Promise<VeteransRecord[]> {
  const results: VeteransRecord[] = [];
  const now = new Date().toISOString();
  const pkg = await fetchCkanPackage(VAC_DATASETS.EDUCATION_BENEFITS.id);
  if (!pkg?.resources) return results;

  for (const r of pkg.resources) {
    if (r.format?.toUpperCase() !== 'CSV' && !r.url.endsWith('.csv')) continue;
    const raw = await fetchCsv(r.url);
    if (!raw) continue;
    const rows = parseCsv(raw);
    for (const row of rows) {
      const year = parseInt(row['year'] || '0') || 0;
      const val = parseFloat(row['enrolment'] || row['graduates'] || row['funding'] || row['value'] || '0');
      if (isNaN(val)) continue;
      const id = await computeHash(`veterans:education:${r.id}:${year}:${row['program'] || ''}`, 'sha256');
      results.push({
        id, year,
        category: 'VAC Education Benefits',
        program: row['program'] || row['institution_type'] || 'Education and Training',
        value: val,
        description: row['notes'] || `VAC education and training benefits for ${year}`,
        region: row['province'] || 'Canada',
        demographic: row['student_demographic'] || '',
        metricType: row['metric'] || 'enrolment',
        sourceUrl: r.url,
        sourceName: 'VAC Education Benefits',
        ingestedAt: now,
      });
    }
  }
  return results;
}

/* ------------------------------------------------------------------ */
/*  VAC Wait Times                                                     */
/* ------------------------------------------------------------------ */

async function fetchVacWaitTimes(): Promise<VeteransRecord[]> {
  const results: VeteransRecord[] = [];
  const now = new Date().toISOString();
  const pkg = await fetchCkanPackage(VAC_DATASETS.VETERANS_WAIT_TIMES.id);
  if (!pkg?.resources) return results;

  for (const r of pkg.resources) {
    if (r.format?.toUpperCase() !== 'CSV' && !r.url.endsWith('.csv')) continue;
    const raw = await fetchCsv(r.url);
    if (!raw) continue;
    const rows = parseCsv(raw);
    for (const row of rows) {
      const year = parseInt(row['year'] || '0') || 0;
      const val = parseFloat(row['wait_days'] || row['median_wait'] || row['pct_within_standard'] || '0');
      if (isNaN(val)) continue;
      const id = await computeHash(`veterans:waittimes:${r.id}:${year}:${row['service'] || ''}`, 'sha256');
      results.push({
        id, year,
        category: 'VAC Service Wait Times',
        program: row['service'] || row['program'] || 'VAC Services',
        value: val,
        description: row['notes'] || `VAC service wait time for ${row['service'] || 'VAC services'} in ${year}`,
        region: row['region'] || 'Canada',
        metricType: row['metric'] || 'wait_days',
        sourceUrl: r.url,
        sourceName: 'VAC Wait Times',
        ingestedAt: now,
      });
    }
  }
  return results;
}

/* ------------------------------------------------------------------ */
/*  VAC Client Caseload                                                */
/* ------------------------------------------------------------------ */

async function fetchVacCaseload(): Promise<VeteransRecord[]> {
  const results: VeteransRecord[] = [];
  const now = new Date().toISOString();
  const pkg = await fetchCkanPackage(VAC_DATASETS.VAC_CASELOAD.id);
  if (!pkg?.resources) return results;

  for (const r of pkg.resources) {
    if (r.format?.toUpperCase() !== 'CSV' && !r.url.endsWith('.csv')) continue;
    const raw = await fetchCsv(r.url);
    if (!raw) continue;
    const rows = parseCsv(raw);
    for (const row of rows) {
      const year = parseInt(row['year'] || '0') || 0;
      const val = parseFloat(row['clients'] || row['caseload'] || row['count'] || '0');
      if (isNaN(val)) continue;
      const id = await computeHash(`veterans:caseload:${r.id}:${year}`, 'sha256');
      results.push({
        id, year,
        category: 'VAC Client Caseload',
        program: row['program'] || row['service_line'] || 'All Programs',
        value: val,
        description: row['notes'] || `VAC client caseload for ${year}`,
        region: row['region'] || 'Canada',
        demographic: row['client_type'] || row['cohort'] || '',
        metricType: 'clients',
        sourceUrl: r.url,
        sourceName: 'VAC Caseload',
        ingestedAt: now,
      });
    }
  }
  return results;
}

/* ------------------------------------------------------------------ */
/*  Veterans Suicide Mortality Statistics                               */
/* ------------------------------------------------------------------ */

async function fetchSuicideStats(): Promise<VeteransRecord[]> {
  const results: VeteransRecord[] = [];
  const now = new Date().toISOString();

  // Try CKAN dataset
  const pkg = await fetchCkanPackage(VAC_DATASETS.VETERANS_SUICIDE.id);
  if (pkg?.resources) {
    for (const r of pkg.resources) {
      if (r.format?.toUpperCase() !== 'CSV' && !r.url.endsWith('.csv')) continue;
      const raw = await fetchCsv(r.url);
      if (!raw) continue;
      const rows = parseCsv(raw);
      for (const row of rows) {
        const year = parseInt(row['year'] || '0') || 0;
        const val = parseFloat(row['deaths'] || row['rate'] || row['count'] || '0');
        if (isNaN(val)) continue;
        const id = await computeHash(`veterans:suicide:${year}:${row['demographic'] || ''}:${row['cohort'] || ''}`, 'sha256');
        results.push({
          id, year,
          category: 'Veterans Suicide Statistics',
          program: 'Suicide Prevention',
          value: val,
          description: row['notes'] || `Veterans suicide mortality statistics for ${year}`,
          region: 'Canada',
          demographic: row['demographic'] || row['cohort'] || 'All Veterans',
          metricType: row['metric'] || 'deaths',
          sourceUrl: r.url,
          sourceName: 'VAC Suicide Mortality Study',
          ingestedAt: now,
        });
      }
    }
  }

  // Web fallback: note this source
  try {
    const webData = await fetchText('https://www.veterans.gc.ca/eng/about-vac/research/suicide-mortality-study');
    if (webData && results.length === 0) {
      const id = await computeHash('veterans:suicide:web-source', 'sha256');
      results.push({
        id, year: new Date().getFullYear(),
        category: 'Veterans Suicide Statistics',
        program: 'Suicide Prevention',
        value: 1,
        description: 'Veterans suicide mortality study — VAC research on suicide rates among Canadian Armed Forces veterans and Regular Force veterans',
        region: 'Canada',
        demographic: 'All Veterans',
        metricType: 'reference',
        sourceUrl: 'https://www.veterans.gc.ca/eng/about-vac/research/suicide-mortality-study',
        sourceName: 'VAC Suicide Mortality Study',
        ingestedAt: now,
      });
    }
  } catch { /* ignore */ }

  return results;
}

/* ------------------------------------------------------------------ */
/*  OSISS Clinics — Operational Stress Injury                           */
/* ------------------------------------------------------------------ */

async function fetchOsissClinics(): Promise<VeteransRecord[]> {
  const results: VeteransRecord[] = [];
  const now = new Date().toISOString();

  // Try CKAN dataset
  const pkg = await fetchCkanPackage(VAC_DATASETS.OSISS_DATA.id);
  if (pkg?.resources) {
    for (const r of pkg.resources) {
      if (r.format?.toUpperCase() !== 'CSV' && !r.url.endsWith('.csv')) continue;
      const raw = await fetchCsv(r.url);
      if (!raw) continue;
      const rows = parseCsv(raw);
      for (const row of rows) {
        const year = parseInt(row['year'] || '0') || 0;
        const val = parseFloat(row['patients'] || row['referrals'] || row['sessions'] || '0');
        if (isNaN(val)) continue;
        const id = await computeHash(`veterans:osiss:${r.id}:${year}:${row['clinic'] || ''}`, 'sha256');
        results.push({
          id, year,
          category: 'OSISS Clinics',
          program: row['clinic'] || 'Operational Stress Injury Clinics',
          value: val,
          description: row['notes'] || `OSISS clinic data for ${row['clinic'] || 'OSISS'} in ${year}`,
          region: row['province'] || 'Canada',
          demographic: row['patient_type'] || '',
          metricType: row['metric'] || 'patients',
          sourceUrl: r.url,
          sourceName: 'OSISS',
          ingestedAt: now,
        });
      }
    }
  }

  // Web fallback: reference the OSISS program
  if (results.length === 0) {
    const osissClinics = [
      { name: 'Vancouver OSISS Clinic', province: 'BC' },
      { name: 'Edmonton OSISS Clinic', province: 'AB' },
      { name: 'Winnipeg OSISS Clinic', province: 'MB' },
      { name: 'Toronto OSISS Clinic', province: 'ON' },
      { name: 'Ottawa OSISS Clinic', province: 'ON' },
      { name: 'Montreal OSISS Clinic', province: 'QC' },
      { name: 'Halifax OSISS Clinic', province: 'NS' },
      { name: 'St. John\'s OSISS Clinic', province: 'NL' },
      { name: 'Calgary OSISS Satellite', province: 'AB' },
      { name: 'Quebec City OSISS Clinic', province: 'QC' },
    ];
    for (const clinic of osissClinics) {
      const id = await computeHash(`veterans:osiss:${clinic.name}`, 'sha256');
      results.push({
        id,
        year: new Date().getFullYear(),
        category: 'OSISS Clinics',
        program: clinic.name,
        value: 1,
        description: `${clinic.name} — Operational Stress Injury clinic providing mental health support to Canadian Armed Forces veterans and their families`,
        region: clinic.province,
        metricType: 'reference',
        sourceUrl: 'https://www.veterans.gc.ca/eng/health-support/mental-health-and-wellness/operational-stress-injury-clinics',
        sourceName: 'OSISS',
        ingestedAt: now,
      });
    }
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  DND Personnel and Transition Programs                               */
/* ------------------------------------------------------------------ */

async function fetchDndPersonnel(): Promise<VeteransRecord[]> {
  const results: VeteransRecord[] = [];
  const now = new Date().toISOString();
  const pkg = await fetchCkanPackage(DND_DATASETS.PERSONNEL.id);
  if (!pkg?.resources) return results;

  for (const r of pkg.resources) {
    if (r.format?.toUpperCase() !== 'CSV' && !r.url.endsWith('.csv')) continue;
    const raw = await fetchCsv(r.url);
    if (!raw) continue;
    const rows = parseCsv(raw);
    for (const row of rows) {
      const year = parseInt(row['year'] || row['fiscal_year'] || '0') || 0;
      const val = parseFloat(row['count'] || row['personnel'] || row['strength'] || '0');
      if (isNaN(val)) continue;
      const id = await computeHash(`veterans:dnd:${r.id}:${year}:${row['rank'] || row['category'] || ''}`, 'sha256');
      results.push({
        id, year,
        category: 'DND Personnel',
        program: row['rank'] || row['category'] || row['personnel_type'] || 'Regular Force',
        value: val,
        description: `DND ${row['personnel_type'] || 'Regular Force'} personnel — ${row['rank'] || row['category'] || 'all'} for ${year}`,
        region: 'Canada',
        demographic: row['demographic'] || row['component'] || '',
        metricType: 'personnel',
        sourceUrl: r.url,
        sourceName: 'DND Personnel',
        ingestedAt: now,
      });
    }
  }
  return results;
}

async function fetchDndTransitionPrograms(): Promise<VeteransRecord[]> {
  const results: VeteransRecord[] = [];
  const now = new Date().toISOString();
  const pkg = await fetchCkanPackage(DND_DATASETS.VETERAN_PROGRAMS.id);
  if (!pkg?.resources) return results;

  for (const r of pkg.resources) {
    if (r.format?.toUpperCase() !== 'CSV' && !r.url.endsWith('.csv')) continue;
    const raw = await fetchCsv(r.url);
    if (!raw) continue;
    const rows = parseCsv(raw);
    for (const row of rows) {
      const year = parseInt(row['year'] || '0') || 0;
      const val = parseFloat(row['budget'] || row['participants'] || row['value'] || '0');
      if (isNaN(val)) continue;
      const id = await computeHash(`veterans:dnd-transition:${r.id}:${year}:${row['program'] || ''}`, 'sha256');
      results.push({
        id, year,
        category: 'DND Veteran Transition Programs',
        program: row['program'] || row['initiative'] || 'Transition Services',
        value: val,
        description: row['notes'] || `DND veteran transition program — ${row['program'] || 'transition support'} for ${year}`,
        region: 'Canada',
        demographic: '',
        metricType: row['metric'] || 'participants',
        sourceUrl: r.url,
        sourceName: 'DND Transition Programs',
        ingestedAt: now,
      });
    }
  }
  return results;
}

async function fetchDndProcurementVeteran(): Promise<VeteransRecord[]> {
  const results: VeteransRecord[] = [];
  const now = new Date().toISOString();
  const pkg = await fetchCkanPackage(DND_DATASETS.DEFENCE_PROCUREMENT_VETERAN.id);
  if (!pkg?.resources) return results;

  for (const r of pkg.resources) {
    if (r.format?.toUpperCase() !== 'CSV' && !r.url.endsWith('.csv')) continue;
    const raw = await fetchCsv(r.url);
    if (!raw) continue;
    const rows = parseCsv(raw);
    for (const row of rows) {
      const year = parseInt(row['year'] || row['fiscal_year'] || '0') || 0;
      const val = parseFloat(row['value'] || row['contract_value'] || row['amount'] || '0');
      if (isNaN(val)) continue;
      const id = await computeHash(`veterans:dnd-procurement:${r.id}:${year}:${row['program'] || ''}`, 'sha256');
      results.push({
        id, year,
        category: 'Defence Procurement — Veteran Programs',
        program: row['program'] || row['vendor'] || 'Defence Procurement',
        value: val,
        description: row['notes'] || `Defence procurement spending for veteran-related programs in ${year}`,
        region: 'Canada',
        metricType: 'spending',
        sourceUrl: r.url,
        sourceName: 'DND Procurement',
        ingestedAt: now,
      });
    }
  }
  return results;
}

async function fetchDndMentalHealth(): Promise<VeteransRecord[]> {
  const results: VeteransRecord[] = [];
  const now = new Date().toISOString();
  const pkg = await fetchCkanPackage(DND_DATASETS.MENTAL_HEALTH.id);
  if (!pkg?.resources) return results;

  for (const r of pkg.resources) {
    if (r.format?.toUpperCase() !== 'CSV' && !r.url.endsWith('.csv')) continue;
    const raw = await fetchCsv(r.url);
    if (!raw) continue;
    const rows = parseCsv(raw);
    for (const row of rows) {
      const year = parseInt(row['year'] || '0') || 0;
      const val = parseFloat(row['participants'] || row['referrals'] || row['value'] || '0');
      if (isNaN(val)) continue;
      const id = await computeHash(`veterans:dnd-mentalhealth:${r.id}:${year}:${row['program'] || ''}`, 'sha256');
      results.push({
        id, year,
        category: 'CAF Mental Health Programs',
        program: row['program'] || row['service'] || 'Mental Health and Wellness',
        value: val,
        description: row['notes'] || `CAF mental health and wellness program — ${row['program'] || 'mental health support'} for ${year}`,
        region: 'Canada',
        demographic: row['cohort'] || row['demographic'] || '',
        metricType: 'participants',
        sourceUrl: r.url,
        sourceName: 'CAF Mental Health',
        ingestedAt: now,
      });
    }
  }
  return results;
}

/* ------------------------------------------------------------------ */
/*  Combined fetcher                                                    */
/* ------------------------------------------------------------------ */

export async function fetchAllVeteransData(): Promise<VeteransRecord[]> {
  const allRecords: VeteransRecord[] = [];

  const fetchers = [
    { name: 'VAC Facts & Figures', fn: fetchVacFactsFigures },
    { name: 'VAC Benefits', fn: fetchVacBenefits },
    { name: 'VAC Disability Benefits', fn: fetchVacDisabilityBenefits },
    { name: 'VAC Education Benefits', fn: fetchVacEducationBenefits },
    { name: 'VAC Wait Times', fn: fetchVacWaitTimes },
    { name: 'VAC Caseload', fn: fetchVacCaseload },
    { name: 'Suicide Statistics', fn: fetchSuicideStats },
    { name: 'OSISS Clinics', fn: fetchOsissClinics },
    { name: 'DND Personnel', fn: fetchDndPersonnel },
    { name: 'DND Transition Programs', fn: fetchDndTransitionPrograms },
    { name: 'DND Procurement Veteran', fn: fetchDndProcurementVeteran },
    { name: 'DND Mental Health', fn: fetchDndMentalHealth },
  ];

  for (const f of fetchers) {
    try {
      const records = await f.fn();
      allRecords.push(...records);
    } catch { /* individual source failure ok */ }
  }

  // Deduplicate by ID
  const seen = new Set<string>();
  return allRecords.filter(r => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}
