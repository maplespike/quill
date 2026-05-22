/**
 * Health Canada Types — MapleSpike Pipeline
 *
 * Strongly-typed interfaces for Health Canada product recalls, safety
 * advisories, and drug products. These modules track health and safety
 * notifications that impact Canadian consumers.
 *
 * Sources:
 *   - Health Canada Product Recalls: https://open.canada.ca/data/en/dataset/food-recalls
 *   - Health Canada Drug Products: https://health-products.canada.ca/dpd-bdpp/
 *   - Health Canada Advisories: https://www.canada.ca/en/health-canada/services/drugs-health-products/recalls-alerts.html
 */

export type HealthCanadaCategory = 'food' | 'drug' | 'device' | 'consumer' | 'advisory';

export type HealthCanadaRiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface HealthCanadaRecall {
  /** SHA-256 citation hash (primary key) */
  id: string;

  /** Category of recall */
  category: HealthCanadaCategory;

  /** Product name(s) affected */
  productName: string;

  /** Company/manufacturer name */
  company: string;

  /** Recall type (Class I, II, III, or advisory) */
  recallType: string;

  /** Risk level classification */
  riskLevel: HealthCanadaRiskLevel;

  /** Summary of hazard or issue */
  hazard: string;

  /** Date recall was issued (ISO-8601) */
  recallDate: string;

  /** Distribution area (province, national, international) */
  distribution: string;

  /** Number of units affected (if available) */
  unitsAffected: number | null;

  /** Whether there have been reported incidents */
  incidents: boolean;

  /** Number of reported incidents (if available) */
  incidentCount: number | null;

  /** Whether injuries have been reported */
  injuries: boolean;

  /** Whether deaths have been reported */
  deaths: boolean;

  /** Source URL where this record was found */
  sourceUrl: string;

  /** CKAN package ID if sourced from open.canada.ca */
  ckanPackageId: string | null;

  /** CKAN resource ID if sourced from a specific resource */
  ckanResourceId: string | null;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;

  /** Trust score (0.0–1.0) based on data completeness */
  trustScore: number;
}

export interface RawHealthCanadaRecord {
  /** Raw product name */
  product?: string;

  /** Raw company name */
  company?: string;

  /** Raw recall classification */
  classification?: string;

  /** Raw hazard description */
  hazard?: string;

  /** Raw recall date (various formats) */
  recall_date?: string;

  /** Raw distribution information */
  distribution?: string;

  /** Raw source URL */
  url?: string;

  /** Additional raw fields */
  [key: string]: string | number | boolean | null | undefined;
}

export interface HealthCanadaIngestionResult {
  /** Module identifier */
  source: string;

  /** Number of raw records found */
  recordsFound: number;

  /** Number of records successfully ingested */
  recordsIngested: number;

  /** Records by category */
  categoriesFound: Record<HealthCanadaCategory, number>;

  /** Records by risk level */
  riskLevelsFound: Record<HealthCanadaRiskLevel, number>;

  /** Number of high/critical risk recalls */
  highRiskCount: number;

  /** Any errors encountered */
  errors: string[];

  /** Total duration in milliseconds */
  durationMs: number;
}