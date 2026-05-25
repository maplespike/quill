/**
 * Health Canada Database — MapleSpike Pipeline
 *
 * D1 SQLite persistence for Health Canada recall and approval records.
 * Provides upsert and search operations for the D1 database.
 * Follows the same D1 API pattern as the corporate and committee DB modules.
 */

import type { D1Database } from '../committees/db.js';
import type {
  DrugApproval,
  MedicalDevice,
  FoodRecall,
  AdverseReaction,
  PesticideRegistration,
  CannabisLicence,
  ControlledSubstance,
  HealthCanadaRecord,
} from './types.js';

/* ------------------------------------------------------------------ */
/* DDL */
/* ------------------------------------------------------------------ */

export const HEALTH_CANADA_DDL = `
CREATE TABLE IF NOT EXISTS hc_drug_approvals (
  id TEXT PRIMARY KEY,
  drug_name TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  approval_date TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  citation_hash TEXT,
  trust_score REAL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hcda_drug ON hc_drug_approvals(drug_name);
CREATE INDEX IF NOT EXISTS idx_hcda_manufacturer ON hc_drug_approvals(manufacturer);
CREATE INDEX IF NOT EXISTS idx_hcda_date ON hc_drug_approvals(approval_date DESC);
CREATE INDEX IF NOT EXISTS idx_hcda_status ON hc_drug_approvals(status);

CREATE TABLE IF NOT EXISTS hc_medical_devices (
  id TEXT PRIMARY KEY,
  device_name TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  licence_date TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  citation_hash TEXT,
  trust_score REAL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hcmd_device ON hc_medical_devices(device_name);
CREATE INDEX IF NOT EXISTS idx_hcmd_manufacturer ON hc_medical_devices(manufacturer);
CREATE INDEX IF NOT EXISTS idx_hcmd_date ON hc_medical_devices(licence_date DESC);
CREATE INDEX IF NOT EXISTS idx_hcmd_status ON hc_medical_devices(status);

CREATE TABLE IF NOT EXISTS hc_food_recalls (
  id TEXT PRIMARY KEY,
  product TEXT NOT NULL,
  hazard TEXT NOT NULL,
  date TEXT NOT NULL,
  distribution TEXT,
  source TEXT NOT NULL,
  citation_hash TEXT,
  trust_score REAL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hcfr_product ON hc_food_recalls(product);
CREATE INDEX IF NOT EXISTS idx_hcfr_hazard ON hc_food_recalls(hazard);
CREATE INDEX IF NOT EXISTS idx_hcfr_date ON hc_food_recalls(date DESC);

CREATE TABLE IF NOT EXISTS hc_adverse_reactions (
  id TEXT PRIMARY KEY,
  drug_name TEXT NOT NULL,
  reaction TEXT NOT NULL,
  date TEXT NOT NULL,
  severity TEXT NOT NULL,
  source TEXT NOT NULL,
  citation_hash TEXT,
  trust_score REAL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hcar_drug ON hc_adverse_reactions(drug_name);
CREATE INDEX IF NOT EXISTS idx_hcar_severity ON hc_adverse_reactions(severity);
CREATE INDEX IF NOT EXISTS idx_hcar_date ON hc_adverse_reactions(date DESC);

CREATE TABLE IF NOT EXISTS hc_pesticide_registrations (
  id TEXT PRIMARY KEY,
  product_name TEXT NOT NULL,
  active_ingredient TEXT NOT NULL,
  registration_date TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  citation_hash TEXT,
  trust_score REAL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hcpr_product ON hc_pesticide_registrations(product_name);
CREATE INDEX IF NOT EXISTS idx_hcpr_ingredient ON hc_pesticide_registrations(active_ingredient);
CREATE INDEX IF NOT EXISTS idx_hcpr_date ON hc_pesticide_registrations(registration_date DESC);
CREATE INDEX IF NOT EXISTS idx_hcpr_status ON hc_pesticide_registrations(status);

CREATE TABLE IF NOT EXISTS hc_cannabis_licences (
  id TEXT PRIMARY KEY,
  licence_holder TEXT NOT NULL,
  province TEXT NOT NULL,
  licence_type TEXT NOT NULL,
  facility TEXT NOT NULL,
  source TEXT NOT NULL,
  citation_hash TEXT,
  trust_score REAL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hccl_holder ON hc_cannabis_licences(licence_holder);
CREATE INDEX IF NOT EXISTS idx_hccl_province ON hc_cannabis_licences(province);
CREATE INDEX IF NOT EXISTS idx_hccl_type ON hc_cannabis_licences(licence_type);

CREATE TABLE IF NOT EXISTS hc_controlled_substances (
  id TEXT PRIMARY KEY,
  substance TEXT NOT NULL,
  authorization TEXT NOT NULL,
  facility TEXT NOT NULL,
  province TEXT NOT NULL,
  source TEXT NOT NULL,
  citation_hash TEXT,
  trust_score REAL,
  ingested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hccs_substance ON hc_controlled_substances(substance);
CREATE INDEX IF NOT EXISTS idx_hccs_facility ON hc_controlled_substances(facility);
CREATE INDEX IF NOT EXISTS idx_hccs_province ON hc_controlled_substances(province);
`;

/* ------------------------------------------------------------------ */
/* Drug Approvals */
/* ------------------------------------------------------------------ */

export async function upsertDrugApproval(
  db: D1Database,
  record: DrugApproval,
  ingestedAt: string,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO hc_drug_approvals
    (id, drug_name, manufacturer, approval_date, status, source, citation_hash, trust_score, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.drugName,
    record.manufacturer,
    record.approvalDate,
    record.status,
    record.source,
    record.citationHash ?? null,
    record.trustScore ?? null,
    ingestedAt,
  );
  const result = await stmt.run();
  return result.success;
}

/* ------------------------------------------------------------------ */
/* Medical Devices */
/* ------------------------------------------------------------------ */

export async function upsertMedicalDevice(
  db: D1Database,
  record: MedicalDevice,
  ingestedAt: string,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO hc_medical_devices
    (id, device_name, manufacturer, licence_date, status, source, citation_hash, trust_score, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.deviceName,
    record.manufacturer,
    record.licenceDate,
    record.status,
    record.source,
    record.citationHash ?? null,
    record.trustScore ?? null,
    ingestedAt,
  );
  const result = await stmt.run();
  return result.success;
}

/* ------------------------------------------------------------------ */
/* Food Recalls */
/* ------------------------------------------------------------------ */

export async function upsertFoodRecall(
  db: D1Database,
  record: FoodRecall,
  ingestedAt: string,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO hc_food_recalls
    (id, product, hazard, date, distribution, source, citation_hash, trust_score, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.product,
    record.hazard,
    record.date,
    Array.isArray(record.distribution) ? record.distribution.join(', ') : record.distribution,
    record.source,
    record.citationHash ?? null,
    record.trustScore ?? null,
    ingestedAt,
  );
  const result = await stmt.run();
  return result.success;
}

/* ------------------------------------------------------------------ */
/* Adverse Reactions */
/* ------------------------------------------------------------------ */

export async function upsertAdverseReaction(
  db: D1Database,
  record: AdverseReaction,
  ingestedAt: string,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO hc_adverse_reactions
    (id, drug_name, reaction, date, severity, source, citation_hash, trust_score, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.drugName,
    record.reaction,
    record.date,
    record.severity,
    record.source,
    record.citationHash ?? null,
    record.trustScore ?? null,
    ingestedAt,
  );
  const result = await stmt.run();
  return result.success;
}

/* ------------------------------------------------------------------ */
/* Pesticide Registrations */
/* ------------------------------------------------------------------ */

export async function upsertPesticideRegistration(
  db: D1Database,
  record: PesticideRegistration,
  ingestedAt: string,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO hc_pesticide_registrations
    (id, product_name, active_ingredient, registration_date, status, source, citation_hash, trust_score, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.productName,
    record.activeIngredient,
    record.registrationDate,
    record.status,
    record.source,
    record.citationHash ?? null,
    record.trustScore ?? null,
    ingestedAt,
  );
  const result = await stmt.run();
  return result.success;
}

/* ------------------------------------------------------------------ */
/* Cannabis Licences */
/* ------------------------------------------------------------------ */

export async function upsertCannabisLicence(
  db: D1Database,
  record: CannabisLicence,
  ingestedAt: string,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO hc_cannabis_licences
    (id, licence_holder, province, licence_type, facility, source, citation_hash, trust_score, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.licenceHolder,
    record.province,
    record.licenceType,
    record.facility,
    record.source,
    record.citationHash ?? null,
    record.trustScore ?? null,
    ingestedAt,
  );
  const result = await stmt.run();
  return result.success;
}

/* ------------------------------------------------------------------ */
/* Controlled Substances */
/* ------------------------------------------------------------------ */

export async function upsertControlledSubstance(
  db: D1Database,
  record: ControlledSubstance,
  ingestedAt: string,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO hc_controlled_substances
    (id, substance, authorization, facility, province, source, citation_hash, trust_score, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    record.id,
    record.substance,
    record.authorization,
    record.facility,
    record.province,
    record.source,
    record.citationHash ?? null,
    record.trustScore ?? null,
    ingestedAt,
  );
  const result = await stmt.run();
  return result.success;
}

/* ------------------------------------------------------------------ */
/* Generic upsert — dispatches by record type */
/* ------------------------------------------------------------------ */

const INGESTED_AT = () => new Date().toISOString();

export async function upsertHealthCanadaRecord(
  db: D1Database,
  record: HealthCanadaRecord,
): Promise<boolean> {
  const ingestedAt = INGESTED_AT();

  if ('drugName' in record) {
    if ('approvalDate' in record) return upsertDrugApproval(db, record as DrugApproval, ingestedAt);
    if ('reaction' in record) return upsertAdverseReaction(db, record as AdverseReaction, ingestedAt);
  }
  if ('deviceName' in record) return upsertMedicalDevice(db, record as MedicalDevice, ingestedAt);
  if ('hazard' in record) return upsertFoodRecall(db, record as FoodRecall, ingestedAt);
  if ('activeIngredient' in record) return upsertPesticideRegistration(db, record as PesticideRegistration, ingestedAt);
  if ('licenceHolder' in record) return upsertCannabisLicence(db, record as CannabisLicence, ingestedAt);
  if ('authorization' in record) return upsertControlledSubstance(db, record as ControlledSubstance, ingestedAt);

  return false;
}

export async function upsertHealthCanadaRecords(
  db: D1Database,
  records: HealthCanadaRecord[],
): Promise<{ inserted: number; failed: number }> {
  let inserted = 0;
  let failed = 0;

  for (const record of records) {
    try {
      const ok = await upsertHealthCanadaRecord(db, record);
      if (ok) inserted++;
      else failed++;
    } catch {
      failed++;
    }
  }

  return { inserted, failed };
}

/* ------------------------------------------------------------------ */
/* Search */
/* ------------------------------------------------------------------ */

export async function searchHealthCanadaRecords(
  db: D1Database,
  query: string,
  limit: number = 50,
): Promise<HealthCanadaRecord[]> {
  const like = `%${query}%`;
  const results: HealthCanadaRecord[] = [];

  const tables = [
    { table: 'hc_drug_approvals', nameCol: 'drug_name' },
    { table: 'hc_medical_devices', nameCol: 'device_name' },
    { table: 'hc_food_recalls', nameCol: 'product' },
    { table: 'hc_adverse_reactions', nameCol: 'drug_name' },
    { table: 'hc_pesticide_registrations', nameCol: 'product_name' },
    { table: 'hc_cannabis_licences', nameCol: 'licence_holder' },
    { table: 'hc_controlled_substances', nameCol: 'substance' },
  ] as const;

  for (const { table, nameCol } of tables) {
    const stmt = db.prepare(
      `SELECT * FROM ${table} WHERE ${nameCol} LIKE ? LIMIT ?`,
    ).bind(like, limit);
    const rows = await stmt.all();
    if (rows.results) {
      results.push(...(rows.results as HealthCanadaRecord[]));
    }
    if (results.length >= limit) break;
  }

  return results.slice(0, limit);
}

export async function getHealthCanadaRecordsByCategory(
  db: D1Database,
  category: string,
  limit: number = 50,
): Promise<HealthCanadaRecord[]> {
  const tableMap: Record<string, string> = {
    'drug-approvals': 'hc_drug_approvals',
    'medical-devices': 'hc_medical_devices',
    'food-recalls': 'hc_food_recalls',
    'adverse-reactions': 'hc_adverse_reactions',
    'pesticides': 'hc_pesticide_registrations',
    'cannabis': 'hc_cannabis_licences',
    'controlled-substances': 'hc_controlled_substances',
  };

  const table = tableMap[category];
  if (!table) return [];

  const stmt = db.prepare(`SELECT * FROM ${table} LIMIT ?`).bind(limit);
  const rows = await stmt.all();
  return (rows.results ?? []) as HealthCanadaRecord[];
}

export async function getHighRiskHealthCanadaRecords(
  db: D1Database,
  limit: number = 100,
): Promise<HealthCanadaRecord[]> {
  const results: HealthCanadaRecord[] = [];

  // Food recalls are inherently high-risk
  const recalls = db.prepare('SELECT * FROM hc_food_recalls ORDER BY date DESC LIMIT ?').bind(limit);
  const recallRows = await recalls.all();
  if (recallRows.results) results.push(...(recallRows.results as HealthCanadaRecord[]));

  // Severe/life-threatening adverse reactions
  const severe = db.prepare(
    "SELECT * FROM hc_adverse_reactions WHERE severity IN ('Severe', 'Life-threatening', 'Fatal') ORDER BY date DESC LIMIT ?",
  ).bind(limit);
  const severeRows = await severe.all();
  if (severeRows.results) results.push(...(severeRows.results as HealthCanadaRecord[]));

  // Suspended/withdrawn drug approvals
  const suspended = db.prepare(
    "SELECT * FROM hc_drug_approvals WHERE status IN ('Suspended', 'Withdrawn') ORDER BY approval_date DESC LIMIT ?",
  ).bind(limit);
  const suspendedRows = await suspended.all();
  if (suspendedRows.results) results.push(...(suspendedRows.results as HealthCanadaRecord[]));

  return results.slice(0, limit);
}
