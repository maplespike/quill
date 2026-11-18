// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Proactive Disclosure Types — Quill
 *
 * Types for federal government proactive disclosure records published by
 * every Canadian department: contracts over $10K, travel expenses,
 * hospitality expenses, and reclassification of positions.
 *
 * Sources:
 *   - open.canada.ca CKAN aggregate search
 *   - Individual department CKAN packages
 *   - Each department publishes in a different schema format — normalized here.
 */

/**
 * A single proactive disclosure record (typically a contract over $10K).
 *
 * Federal departments are required to proactively disclose:
 *   - Contracts over $10,000 (including amendments)
 *   - Travel expenses of senior officials
 *   - Hospitality expenses
 *   - Reclassification of public service positions
 *
 * This type normalises the various schema formats used by different
 * departments into a unified structure.
 */
export interface ProactiveDisclosureRecord {
  /** SHA-256 hash of the record content (primary key) */
  id: string;

  /** Department name (e.g. "Public Services and Procurement Canada") */
  department: string;

  /** Department acronym (e.g. "PSPC", "DND", "HC") */
  departmentAcronym: string | null;

  /** Vendor / supplier name */
  vendorName: string;

  /** Total contract value in CAD (parsed numeric) */
  contractValue: number | null;

  /** Currency code (default "CAD") */
  currency: string;

  /** Contract award date (ISO-8601) */
  awardDate: string | null;

  /** Description of goods or services procured */
  description: string | null;

  /** Classification: 'goods', 'services', 'construction', or null */
  goodsOrServices: string | null;

  /** Procurement method (e.g. "Competitive", "Non-Competitive", "Sole Source") */
  procurementMethod: string | null;

  /** Contract period start date (ISO-8601) */
  contractPeriodStart: string | null;

  /** Contract period end date (ISO-8601) */
  contractPeriodEnd: string | null;

  /** Additional comments (often includes amendment notes, exceptions) */
  comments: string | null;

  /** Source URL where the record was originally published */
  sourceUrl: string;

  /** CKAN package ID if sourced from open.canada.ca */
  ckanPackageId: string | null;

  /** CKAN resource ID if sourced from a specific resource */
  ckanResourceId: string | null;

  /** Fiscal year the record pertains to (e.g. "2024-2025") */
  fiscalYear: string | null;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/**
 * Shape of a raw CKAN Solr search result document from
 * search.open.canada.ca or an individual department CKAN API.
 *
 * Field names vary between departments; this uses a superset of common
 * field names found across federal proactive disclosure datasets.
 */
export interface RawCKANProactiveDisclosureDoc {
  /** CKAN resource-level identifier */
  id?: string;
  /** CKAN package ID */
  package_id?: string;
  /** Resource ID within the package */
  resource_id?: string;
  /** Department name — various field names used across departments */
  owner_org?: string;
  org_title_at_publication?: string;
  owner_org_title?: string;
  department_name_en?: string;
  department?: string;
  /** Vendor name — multiple possible field names */
  vendor_name?: string;
  supplier_name?: string;
  supplier?: string;
  contract_holder_name?: string;
  name?: string;
  /** Contract value */
  contract_value?: number;
  value?: number;
  total_value?: number;
  contract_amount?: number;
  amendment_value?: number;
  original_value?: number;
  /** Award date */
  award_date?: string;
  date?: string;
  contract_date?: string;
  start_date?: string;
  /** Description */
  description?: string;
  description_fr?: string;
  notes?: string;
  comments?: string;
  commodity_description?: string;
  goods_services_description?: string;
  /** Goods or services flag */
  goods_or_services?: string;
  commodity_type?: string;
  procurement_type?: string;
  /** Procurement method */
  procurement_method?: string;
  method?: string;
  method_of_supply?: string;
  /** Contract period */
  contract_period_start?: string;
  contract_period_end?: string;
  delivery_date?: string;
  end_date?: string;
  expiry_date?: string;
  /** Comments / additional notes */
  comments_en?: string;
  additional_comments?: string;
  amendment_comments?: string;
  /** Fiscal year */
  fiscal_year?: string;
  fiscal_year_id?: string;
  /** Department acronym or short form */
  owner_acronym?: string;
  department_acronym?: string;
  acronym?: string;
  /** Source URL */
  url?: string;
  source_url?: string;
  resource_url?: string;

  /** Catch-all for any department-specific fields */
  [key: string]: unknown;
}

/**
 * Result from the CKAN Solr aggregate search API.
 */
export interface CKANSearchResponse {
  response?: {
    numFound?: number;
    start?: number;
    docs?: RawCKANProactiveDisclosureDoc[];
  };
  responseHeader?: {
    status?: number;
    QTime?: number;
    params?: Record<string, unknown>;
  };
}

/**
 * Options for searching proactive disclosure records.
 */
export interface ProactiveDisclosureSearchOptions {
  /** Search query (default: "proactive disclosure contracts") */
  query?: string;
  /** Results per page (default: 100, max: 500) */
  rows?: number;
  /** Page offset (default: 0) */
  start?: number;
  /** Filter by specific department(s) */
  departments?: string[];
  /** Filter by fiscal year (e.g. "2024-2025") */
  fiscalYear?: string;
  /** Filter by minimum contract value */
  minValue?: number;
  /** Filter by date range (start) */
  dateFrom?: string;
  /** Filter by date range (end) */
  dateTo?: string;
  /** Sort field and direction (e.g. "award_date desc") */
  sort?: string;
  /** Specific CKAN package ID to target */
  packageId?: string;
}

/**
 * Ingestion result for a proactive disclosure run.
 */
export interface ProactiveDisclosureIngestionResult {
  department?: string;
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  durationMs: number;
}

/**
 * List of known major federal departments and their acronyms.
 * Used for filtering and matching in CKAN searches.
 */
export interface DepartmentInfo {
  /** Full English name */
  nameEn: string;
  /** Full French name */
  nameFr: string;
  /** Standard acronym */
  acronym: string;
  /** CKAN owner_org value (if known) */
  ownerOrg?: string;
}
