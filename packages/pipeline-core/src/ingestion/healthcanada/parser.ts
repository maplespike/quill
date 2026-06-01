/**
 * Health Canada Ingestion — MapleSpike Pipeline
 *
 * Parsers for Health Canada dataset formats (CSV/JSON).
 */

import { parseCsvLine, normalizeHeader } from '../../utils/csv.js';
import type {
  DrugApproval,
  MedicalDevice,
  FoodRecall,
  AdverseReaction,
  PesticideRegistration,
  CannabisLicence,
  ControlledSubstance,
} from './types.js';

/**
 * Parse raw string (CSV or JSON) into an array of key-value records.
 */
function splitRows(raw: string): Record<string, string>[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed) as Record<string, string>[]; }
    catch { /* fall through */ }
  }

  if (trimmed.startsWith('{')) {
    try {
      return trimmed.split('\n')
        .filter(l => l.trim())
        .map(l => JSON.parse(l.trim()) as Record<string, string>);
    } catch { /* fall through */ }
  }

  const lines = trimmed.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (fields[j] ?? '').trim();
    }
    records.push(row);
  }

  return records;
}

function val(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== '') return row[k];
  }
  return '';
}

function valList(row: Record<string, string>, key: string, sep = ';'): string[] {
  const v = val(row, key);
  return v ? v.split(sep).map(s => s.trim()).filter(Boolean) : [];
}

/**
 * Parse drug approval data from CSV/JSON format.
 * Expected columns: drug_name, manufacturer, approval_date, status
 */
export function parseDrugApproval(raw: string, source: string): DrugApproval[] {
  const rows = splitRows(raw);
  return rows.map(row => ({
    id: `drug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    drugName: val(row, 'drug_name', 'drugname', 'brand_name', 'brandname', 'product_name', 'productname', 'ingredient', 'substance'),
    manufacturer: val(row, 'manufacturer', 'company', 'sponsor', 'applicant', 'firm'),
    approvalDate: val(row, 'approval_date', 'approvaldate', 'date', 'decision_date', 'decisiondate', 'submission_date'),
    status: (val(row, 'status', 'current_status', 'decision') as DrugApproval['status']) || 'Active',
    source,
    trustScore: 0.6,
  }));
}

/**
 * Parse medical device data.
 * Expected columns: device_name, manufacturer, licence_date, status
 */
export function parseMedicalDevice(raw: string, source: string): MedicalDevice[] {
  const rows = splitRows(raw);
  return rows.map(row => ({
    id: `device-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    deviceName: val(row, 'device_name', 'devicename', 'device', 'product_name', 'productname', 'trade_name', 'tradename'),
    manufacturer: val(row, 'manufacturer', 'company', 'firm', 'licence_holder', 'licenceholder'),
    licenceDate: val(row, 'licence_date', 'licencedate', 'date', 'licence_date', 'authorization_date'),
    status: (val(row, 'status', 'licence_status', 'current_status') as MedicalDevice['status']) || 'Licensed',
    source,
    trustScore: 0.6,
  }));
}

/**
 * Parse food recall data.
 * Expected columns: product, hazard, date, distribution
 */
export function parseFoodRecall(raw: string, source: string): FoodRecall[] {
  const rows = splitRows(raw);
  return rows.map(row => ({
    id: `recall-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product: val(row, 'product', 'product_name', 'productname', 'brand', 'recalled_product'),
    hazard: val(row, 'hazard', 'hazard_classification', 'hazardclassification', 'reason_for_recall', 'risk_reason', 'risk'),
    date: val(row, 'date', 'recall_date', ' recalldate', 'notification_date', 'publication_date', 'start_date'),
    distribution: valList(row, 'distribution', ';'),
    source,
    trustScore: 0.6,
  }));
}

/**
 * Parse adverse reaction data.
 * Expected columns: drug_name, reaction, date, severity
 */
export function parseAdverseReaction(raw: string, source: string): AdverseReaction[] {
  const rows = splitRows(raw);
  return rows.map(row => ({
    id: `adverse-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    drugName: val(row, 'drug_name', 'drugname', 'medication', 'substance', 'product_name', 'productname', 'generic_name'),
    reaction: val(row, 'reaction', 'adverse_reaction', 'adversereaction', 'reaction_description', 'reactiondescription', 'event', 'description'),
    date: val(row, 'date', 'reaction_date', 'reactiondate', 'report_date', 'reportdate', 'start_date'),
    severity: (val(row, 'severity', 'seriousness', 'outcome') as AdverseReaction['severity']) || 'Mild',
    source,
    trustScore: 0.6,
  }));
}

/**
 * Parse pesticide registration data.
 * Expected columns: product_name, active_ingredient, registration_date, status
 */
export function parsePesticideRegistration(raw: string, source: string): PesticideRegistration[] {
  const rows = splitRows(raw);
  return rows.map(row => ({
    id: `pesticide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productName: val(row, 'product_name', 'productname', 'pesticide_product', 'market_product', 'trade_name', 'tradename'),
    activeIngredient: val(row, 'active_ingredient', 'activeingredient', 'ingredient', 'active', 'chemical'),
    registrationDate: val(row, 'registration_date', 'registrationdate', 'date', 'registration', 'approved_date'),
    status: (val(row, 'status', 'registration_status', 'current_status') as PesticideRegistration['status']) || 'Registered',
    source,
    trustScore: 0.6,
  }));
}

/**
 * Parse cannabis licence data.
 * Expected columns: licence_holder, province, licence_type, facility
 */
export function parseCannabisLicence(raw: string, source: string): CannabisLicence[] {
  const rows = splitRows(raw);
  return rows.map(row => ({
    id: `cannabis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    licenceHolder: val(row, 'licence_holder', 'licenceholder', 'holder', 'company', 'legal_name', 'business_legal_name'),
    province: val(row, 'province', 'province_territory', 'provinceterritory', 'region', 'jurisdiction'),
    licenceType: val(row, 'licence_type', 'licencetype', 'type', 'licence_category', 'category', 'class'),
    facility: val(row, 'facility', 'facility_address', 'address', 'site', 'location', 'premise'),
    source,
    trustScore: 0.6,
  }));
}

/**
 * Parse controlled substance data.
 * Expected columns: substance, authorization, facility, province
 */
export function parseControlledSubstance(raw: string, source: string): ControlledSubstance[] {
  const rows = splitRows(raw);
  return rows.map(row => ({
    id: `substance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    substance: val(row, 'substance', 'controlled_substance', 'drug', 'compound', 'chemical', 'product'),
    authorization: val(row, 'authorization', 'authorization_type', 'licence_type', 'type', 'permit', 'class'),
    facility: val(row, 'facility', 'facility_address', 'address', 'site', 'location', 'premise'),
    province: val(row, 'province', 'province_territory', 'provinceterritory', 'region', 'jurisdiction'),
    source,
    trustScore: 0.6,
  }));
}