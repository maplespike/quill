/**
 * Health Canada Records Types — Quill
 *
 * Strongly-typed interfaces for Health Canada regulated product records:
 *   - Drug Product Database (DPD) — approved pharmaceutical drugs
 *   - Medical Devices Active License Listing (MDALL) — licensed medical devices
 *   - Licensed Natural Products Database (LNHP) — licensed natural health products
 *   - Recalls and Safety Alerts — product recalls and safety advisories
 *
 * Primary sources:
 *   Drug Product Database:     https://health-products.canada.ca/dpd-bdpp/index-eng.jsp
 *   Medical Devices:           https://health-products.canada.ca/mdall-limh/index-eng.jsp
 *   Natural Products:          https://health-products.canada.ca/lnhpd-bdpsnh/index-eng.jsp
 *   Recalls & Safety Alerts:   https://recalls.canada.ca/en
 *
 * Cross-reference opportunities:
 *   - Corporate: manufacturers linked to lobbying/procurement records
 *   - Influence: drug company influence on Health Canada policy
 *   - Procurement: vaccine/drug supply contracts
 *   - Committees: parliamentary testimony on drug safety/pricing
 *   - Gazette: proposed regulations under Food and Drugs Act
 */

/* ------------------------------------------------------------------ */
/*  Product Type Enum                                                  */
/* ------------------------------------------------------------------ */

/** The four categories of Health Canada regulated products tracked. */
export type HealthCanadaProductType =
  | 'drug'          // Drug Product Database — approved pharmaceuticals
  | 'device'        // Medical Devices Active License Listing
  | 'natural'       // Licensed Natural Health Products
  | 'recall';       // Recalls and Safety Alerts

/* ------------------------------------------------------------------ */
/*  License Status                                                     */
/* ------------------------------------------------------------------ */

/** Current license/approval status of a Health Canada regulated product. */
export type HealthCanadaLicenseStatus =
  | 'active'        // Currently licensed/approved/marketed
  | 'suspended'     // License temporarily suspended
  | 'revoked'       // License permanently revoked
  | 'cancelled'     // Application cancelled before approval
  | 'expired'       // License expired
  | 'discontinued'  // Product discontinued (marketing status)
  | 'recalled'      // Product recalled from market
  | 'pending'       // Application under review
  | 'unknown';

/* ------------------------------------------------------------------ */
/*  Core Record Type                                                   */
/* ------------------------------------------------------------------ */

/**
 * A single Health Canada regulated product record.
 * Normalised across DPD (drugs), MDALL (devices), LNHP (natural products),
 * and Recalls & Safety Alerts.
 */
export interface HealthCanadaRecord {
  /** SHA-256 hash of record content (primary key) */
  id: string;

  /** Product brand or trade name */
  productName: string;

  /** Product type category */
  productType: HealthCanadaProductType;

  /** License, DIN (Drug Identification Number), or recall identifier */
  licenseNumber: string | null;

  /** Current license/approval status */
  licenseStatus: HealthCanadaLicenseStatus;

  /** Manufacturer / company name */
  manufacturer: string | null;

  /** Therapeutic area or medical specialty (for drugs) */
  therapeuticArea: string | null;

  /** Active ingredient(s) — semi-colon separated for multi-ingredient products */
  activeIngredient: string | null;

  /** DIN (Drug Identification Number) for drugs, or device identifier */
  din: string | null;

  /** NPN (Natural Product Number) for natural products */
  npn: string | null;

  /** Date of license issuance or market approval (ISO-8601) */
  licenseDate: string | null;

  /** Date of license expiration (ISO-8601) */
  expiryDate: string | null;

  /** For recalls: severity level (e.g. "Type I", "Type II", "Serious") */
  recallSeverity: string | null;

  /** For recalls: reason for recall */
  recallReason: string | null;

  /** For recalls: recall classification */
  recallClassification: string | null;

  /** Dose form (e.g. "Tablet", "Injection", "Cream") */
  dosageForm: string | null;

  /** Route of administration (e.g. "Oral", "Intravenous", "Topical") */
  routeOfAdministration: string | null;

  /** Company status (e.g. "Active", "Inactive") */
  companyStatus: string | null;

  /** Source URL on the Health Canada product page */
  sourceUrl: string;

  /** Source system name */
  sourceSystem: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Raw Fetch Types                                                    */
/* ------------------------------------------------------------------ */

/** Generic raw record from any Health Canada source. */
export interface RawHealthCanadaRecord {
  productName?: string;
  productType?: string;
  licenseNumber?: string;
  licenseStatus?: string;
  manufacturer?: string;
  therapeuticArea?: string;
  activeIngredient?: string;
  din?: string;
  npn?: string;
  licenseDate?: string;
  expiryDate?: string;
  recallSeverity?: string;
  recallReason?: string;
  recallClassification?: string;
  dosageForm?: string;
  routeOfAdministration?: string;
  companyStatus?: string;
  sourceUrl?: string;
  sourceSystem?: string;

  /** Catch-all for any other fields */
  [key: string]: unknown;
}

/** Shape of a DPD (Drug Product Database) API JSON response item. */
export interface DpdApiRecord {
  drug_identification_number?: string;
  brand_name?: string;
  descriptor?: string;
  dosage_form?: string;
  route_of_administration?: string;
  active_ingredient_list?: Array<{
    active_ingredient_name?: string;
  }>;
  therapeutic_class?: string;
  pharmaceutical_company?: string;
  status?: string;
  original_market_date?: string;
  expiration_date?: string;
  [key: string]: unknown;
}

/** Shape of an MDALL (Medical Devices) API JSON response item. */
export interface MdallApiRecord {
  licence_number?: string;
  licence_name?: string;
  company_name?: string;
  licence_status?: string;
  licence_date?: string;
  device_type?: string;
  [key: string]: unknown;
}

/** Shape of an LNHP (Natural Products) API JSON response item. */
export interface LnhpApiRecord {
  npn?: string;
  product_name?: string;
  medicinal_ingredients?: string;
  dosage_form?: string;
  route_of_administration?: string;
  company_name?: string;
  status?: string;
  licence_date?: string;
  expiry_date?: string;
  [key: string]: unknown;
}

/** Shape of a Recalls RSS/API item. */
export interface RecallApiRecord {
  title?: string;
  description?: string;
  link?: string;
  pubDate?: string;
  category?: string;
  'recall:severity'?: string;
  'recall:classification'?: string;
  'recall:reason'?: string;
  'recall:company'?: string;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Options & Result                                         */
/* ------------------------------------------------------------------ */

export interface HealthCanadaIngestionOptions {
  /** Product types to ingest (default: all four) */
  productTypes?: HealthCanadaProductType[];

  /** Max records to process per product type */
  maxRecords?: number;

  /** Force re-ingest of already-ingested records */
  force?: boolean;

  /** Initialize table if it doesn't exist */
  initializeTable?: boolean;

  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface HealthCanadaIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perType: Record<string, {
    recordsFound: number;
    recordsIngested: number;
  }>;
  durationMs: number;
}
