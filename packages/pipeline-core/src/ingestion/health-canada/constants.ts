// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Health Canada Ingestion Constants — Quill
 *
 * Source URLs, product type enums, DDL, and defaults for ingesting
 * Health Canada regulated product data from:
 *   - Drug Product Database (DPD)
 *   - Medical Devices Active License Listing (MDALL)
 *   - Licensed Natural Health Products (LNHP)
 *   - Recalls and Safety Alerts
 */

import type { HealthCanadaProductType, HealthCanadaLicenseStatus } from './types.js';

/* ------------------------------------------------------------------ */
/*  Source URLs                                                        */
/* ------------------------------------------------------------------ */

export const HC_SOURCES: Record<string, Record<string, string>> = {
  DPD: {
    BASE: 'https://health-products.canada.ca/dpd-bdpp',
    SEARCH: 'https://health-products.canada.ca/dpd-bdpp/index-eng.jsp',
    JSON_API: 'https://health-products.canada.ca/api/drug',
    DETAIL: 'https://health-products.canada.ca/dpd-bdpp/info.do?lang=en&code=',
    ACTIVE_INGREDIENT_SEARCH: 'https://health-products.canada.ca/api/active-ingredient',
  },
  MDALL: {
    BASE: 'https://health-products.canada.ca/mdall-limh',
    SEARCH: 'https://health-products.canada.ca/mdall-limh/index-eng.jsp',
    JSON_API: 'https://health-products.canada.ca/api/medical-devices',
    LICENCE_DETAIL: 'https://health-products.canada.ca/mdall-limh/info.do?lang=en&licenceNumber=',
  },
  LNHP: {
    BASE: 'https://health-products.canada.ca/lnhpd-bdpsnh',
    SEARCH: 'https://health-products.canada.ca/lnhpd-bdpsnh/index-eng.jsp',
    JSON_API: 'https://health-products.canada.ca/api/natural-products',
    DETAIL: 'https://health-products.canada.ca/lnhpd-bdpsnh/info.do?lang=en&npn=',
  },
  RECALLS: {
    BASE: 'https://recalls.canada.ca',
    SEARCH: 'https://recalls.canada.ca/en',
    RSS: 'https://recalls.canada.ca/en/feed',
    API: 'https://recalls.canada.ca/api/recall',
    JSON: 'https://recalls.canada.ca/en/search/json',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Product Type Configuration                                         */
/* ------------------------------------------------------------------ */

export interface HealthCanadaSourceConfig {
  /** Human-readable label */
  label: string;
  /** API base URL */
  apiUrl: string;
  /** Source system identifier used in DB */
  sourceSystem: string;
  /** Default limit for fetches */
  defaultLimit: number;
}

export const HC_PRODUCT_TYPE_CONFIG: Record<HealthCanadaProductType, HealthCanadaSourceConfig> = {
  drug: {
    label: 'Drug Product Database',
    apiUrl: HC_SOURCES.DPD.JSON_API,
    sourceSystem: 'hc-dpd',
    defaultLimit: 500,
  },
  device: {
    label: 'Medical Devices Active License Listing',
    apiUrl: HC_SOURCES.MDALL.JSON_API,
    sourceSystem: 'hc-mdall',
    defaultLimit: 500,
  },
  natural: {
    label: 'Licensed Natural Health Products',
    apiUrl: HC_SOURCES.LNHP.JSON_API,
    sourceSystem: 'hc-lnhp',
    defaultLimit: 500,
  },
  recall: {
    label: 'Recalls and Safety Alerts',
    apiUrl: HC_SOURCES.RECALLS.API,
    sourceSystem: 'hc-recalls',
    defaultLimit: 200,
  },
};

export const ALL_HC_PRODUCT_TYPES: HealthCanadaProductType[] = ['drug', 'device', 'natural', 'recall'];

/* ------------------------------------------------------------------ */
/*  Status Mappings                                                    */
/* ------------------------------------------------------------------ */

export const HC_LICENSE_STATUS_MAP: Record<string, HealthCanadaLicenseStatus> = {
  'active': 'active',
  'approved': 'active',
  'marketed': 'active',
  'suspended': 'suspended',
  'revoked': 'revoked',
  'cancelled': 'cancelled',
  'cancelled post-market': 'cancelled',
  'expired': 'expired',
  'discontinued': 'discontinued',
  'discontinued - market': 'discontinued',
  'recalled': 'recalled',
  'recall': 'recalled',
  'pending': 'pending',
  'pending review': 'pending',
  'under review': 'pending',
};

/* ------------------------------------------------------------------ */
/*  DDL — Database Schema Definition                                   */
/* ------------------------------------------------------------------ */

export const HEALTH_CANADA_DDL = `
-- Health Canada — regulated product records
-- Tracks drug approvals, medical device licenses, natural product licenses,
-- and safety recalls from Health Canada.
CREATE TABLE IF NOT EXISTS health_canada_records (
  id TEXT PRIMARY KEY,

  -- Product identity
  product_name TEXT NOT NULL,
  product_type TEXT NOT NULL CHECK(product_type IN (
    'drug', 'device', 'natural', 'recall'
  )),

  -- Licensing
  license_number TEXT,
  license_status TEXT NOT NULL DEFAULT 'unknown' CHECK(license_status IN (
    'active', 'suspended', 'revoked', 'cancelled', 'expired',
    'discontinued', 'recalled', 'pending', 'unknown'
  )),

  -- Manufacturer / company
  manufacturer TEXT,

  -- Drug-specific fields
  therapeutic_area TEXT,
  active_ingredient TEXT,
  din TEXT,
  npn TEXT,

  -- Dates
  license_date TEXT,
  expiry_date TEXT,

  -- Recall-specific fields
  recall_severity TEXT,
  recall_reason TEXT,
  recall_classification TEXT,

  -- Dosage / administration
  dosage_form TEXT,
  route_of_administration TEXT,
  company_status TEXT,

  -- Provenance
  source_url TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'hc-dpd',

  -- Pipeline metadata
  ingested_at TEXT NOT NULL,

  UNIQUE(product_name, product_type, source_url)
);

CREATE INDEX IF NOT EXISTS idx_hc_product_name ON health_canada_records(product_name);
CREATE INDEX IF NOT EXISTS idx_hc_product_type ON health_canada_records(product_type);
CREATE INDEX IF NOT EXISTS idx_hc_license_number ON health_canada_records(license_number);
CREATE INDEX IF NOT EXISTS idx_hc_license_status ON health_canada_records(license_status);
CREATE INDEX IF NOT EXISTS idx_hc_manufacturer ON health_canada_records(manufacturer);
CREATE INDEX IF NOT EXISTS idx_hc_therapeutic_area ON health_canada_records(therapeutic_area);
CREATE INDEX IF NOT EXISTS idx_hc_active_ingredient ON health_canada_records(active_ingredient);
CREATE INDEX IF NOT EXISTS idx_hc_din ON health_canada_records(din);
CREATE INDEX IF NOT EXISTS idx_hc_npn ON health_canada_records(npn);
CREATE INDEX IF NOT EXISTS idx_hc_license_date ON health_canada_records(license_date DESC);
CREATE INDEX IF NOT EXISTS idx_hc_expiry_date ON health_canada_records(expiry_date DESC);
CREATE INDEX IF NOT EXISTS idx_hc_recall_severity ON health_canada_records(recall_severity);
CREATE INDEX IF NOT EXISTS idx_hc_product_type_status ON health_canada_records(product_type, license_status);
CREATE INDEX IF NOT EXISTS idx_hc_ingested ON health_canada_records(ingested_at DESC);
`;

/* ------------------------------------------------------------------ */
/*  Default Options                                                    */
/* ------------------------------------------------------------------ */

export const DEFAULT_MAX_RECORDS = 500;
export const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:hello@maplespike.ca)';
export const DEFAULT_TIMEOUT_MS = 30_000;

export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/json,text/html,*/*',
};

/* ------------------------------------------------------------------ */
/*  Error Type                                                         */
/* ------------------------------------------------------------------ */

export class HealthCanadaError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'HC_ERROR',
    public readonly productType?: string,
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'HealthCanadaError';
  }
}
