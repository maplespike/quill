/**
 * Health Canada Parser — MapleSpike Pipeline
 *
 * Parses raw Health Canada records into structured HealthCanadaRecall objects.
 * Normalizes data across different source formats and classifications.
 */

import { createHash } from 'node:crypto';
import { RECALL_CLASSIFICATION_MAP, RISK_LEVEL_MAP, TRUST_THRESHOLD } from './constants.js';
import type { HealthCanadaRecall, RawHealthCanadaRecord, HealthCanadaCategory } from './types.js';

/**
 * Generate SHA-256 citation hash for a record.
 */
function generateCitationHash(record: RawHealthCanadaRecord): string {
  const citationString = JSON.stringify(record);
  return createHash('sha256').update(citationString).digest('hex');
}

/**
 * Parse recall date from various formats.
 */
function parseRecallDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;

  const isoMatch = dateStr.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];

  const dmyMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  }

  const mdyMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (mdyMatch) {
    return `${mdyMatch[3]}-${mdyMatch[1]}-${mdyMatch[2]}`;
  }

  return null;
}

/**
 * Parse incident count from string.
 */
function parseIncidentCount(incidents: string | undefined): number | null {
  if (!incidents) return null;

  const match = incidents.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Infer category from product description.
 */
function inferCategory(product: string | undefined): HealthCanadaCategory {
  if (!product) return 'consumer';

  const lower = product.toLowerCase();

  if (lower.includes('food') || lower.includes('beverage') || lower.includes('restaurant')) {
    return 'food';
  }

  if (lower.includes('drug') || lower.includes('medication') || lower.includes('pharmaceutical')) {
    return 'drug';
  }

  if (lower.includes('device') || lower.includes('medical') || lower.includes('equipment')) {
    return 'device';
  }

  if (lower.includes('advisory') || lower.includes('warning') || lower.includes('safety')) {
    return 'advisory';
  }

  return 'consumer';
}

/**
 * Safely convert a raw field to string.
 */
function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

/**
 * Safely get a field value as string with optional default.
 */
function getStringField(raw: RawHealthCanadaRecord, keys: string[], defaultValue: string): string {
  for (const key of keys) {
    const value = raw[key];
    if (value !== null && value !== undefined && value !== '') {
      return asString(value);
    }
  }
  return defaultValue;
}

/**
 * Calculate trust score for a record based on completeness.
 */
export function calculateTrustScore(recall: Partial<Pick<HealthCanadaRecall, 'productName' | 'company' | 'hazard' | 'recallDate' | 'distribution' | 'recallType' | 'sourceUrl' | 'ckanPackageId'>>): number {
  let score = 0;
  const maxScore = 8;

  if (recall.productName && recall.productName !== 'Unknown Product') score += 1;
  if (recall.company && recall.company !== 'Unknown Company') score += 1;
  if (recall.hazard && recall.hazard !== 'Not specified') score += 1;
  if (recall.recallDate) score += 1;
  if (recall.distribution && recall.distribution !== 'Not specified') score += 1;
  if (recall.recallType) score += 1;
  if (recall.sourceUrl && recall.sourceUrl !== 'https://open.canada.ca') score += 1;
  if (recall.ckanPackageId) score += 1;

  return score / maxScore;
}

/**
 * Parse raw Health Canada record into structured object.
 */
export function parseHealthCanadaRecord(
  raw: RawHealthCanadaRecord,
  options: {
    category?: HealthCanadaCategory;
    sourceSystem?: string;
    ckanPackageId?: string;
    ckanResourceId?: string;
  } = {},
): HealthCanadaRecall {
  const productName = getStringField(raw, ['product', 'Product', 'Product Name'], 'Unknown Product');
  const company = getStringField(raw, ['company', 'Company', 'Company Name'], 'Unknown Company');
  const classification = getStringField(raw, ['classification', 'Classification'], 'Advisory');
  const hazard = getStringField(raw, ['hazard', 'Hazard', 'Issue Description'], 'Not specified');

  const recallType = RECALL_CLASSIFICATION_MAP[classification] || classification;
  const riskLevel = RISK_LEVEL_MAP[classification] || 'moderate';

  const recallDate = parseRecallDate(getStringField(raw, ['recall_date', 'Recall Date', 'date'], ''));

  const distribution = getStringField(raw, ['distribution', 'Distribution', 'Distribution Area'], 'Not specified');

  const incidentCount = parseIncidentCount(getStringField(raw, ['incidents', 'Incidents', 'Incident Count'], ''));

  const incidentsField = getStringField(raw, ['injuries', 'Injuries'], '');
  const injuries = incidentsField.toLowerCase().includes('yes') || false;

  const deathsField = getStringField(raw, ['deaths', 'Deaths'], '');
  const deaths = deathsField.toLowerCase().includes('yes') || false;

  const category = options.category || inferCategory(productName);

  const sourceUrl = asString(raw.url) || 'https://open.canada.ca';

  const result: HealthCanadaRecall = {
    id: generateCitationHash(raw),
    category,
    productName,
    company,
    recallType,
    riskLevel,
    hazard,
    recallDate: recallDate || new Date().toISOString().split('T')[0],
    distribution,
    unitsAffected: null,
    incidents: (incidentCount ?? 0) > 0,
    incidentCount: incidentCount,
    injuries,
    deaths,
    sourceUrl,
    ckanPackageId: options.ckanPackageId || null,
    ckanResourceId: options.ckanResourceId || null,
    ingestedAt: new Date().toISOString(),
    trustScore: 0,
  };

  result.trustScore = calculateTrustScore(result);

  return result;
}

/**
 * Parse multiple raw records.
 */
export function parseHealthCanadaRecords(
  rawRecords: RawHealthCanadaRecord[],
  options: {
    category?: HealthCanadaCategory;
    sourceSystem?: string;
    ckanPackageId?: string;
    ckanResourceId?: string;
  } = {},
): HealthCanadaRecall[] {
  return rawRecords
    .map(raw => parseHealthCanadaRecord(raw, options))
    .filter(recall => recall.trustScore >= TRUST_THRESHOLD);
}