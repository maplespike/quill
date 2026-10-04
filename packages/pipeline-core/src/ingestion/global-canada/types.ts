/**
 * Global Canada (GAC / ECCC / CSIS) Types — Quill
 *
 * Combined lighter-weight module tracking three federal sources:
 *   - Global Affairs Canada (GAC): trade agreements, foreign policy, international development projects
 *   - Environment and Climate Change Canada (ECCC): climate data, weather warnings via MSC GeoMet API
 *   - Canadian Security Intelligence Service (CSIS): annual reports, public briefings
 *
 * Primary sources:
 *   GAC Trade Agreements:  https://www.international.gc.ca/trade-commerce/trade-agreements-accords-commerciaux/index.aspx
 *   ECCC MSC GeoMet API:   https://eccc-msc.github.io/open-data/msc-geomet/readme_en/
 *   CSIS Publications:      https://www.canada.ca/en/security-intelligence-service/corporate/publications.html
 *
 * Cross-reference opportunities:
 *   - Committees: parliamentary testimony on trade/climate/security
 *   - Gazette: regulations implementing trade agreements
 *   - Corporate: international development contracts
 *   - Crown Corporations: EDC, CDC climate alignment
 */

/* ------------------------------------------------------------------ */
/*  Source System Enum                                                 */
/* ------------------------------------------------------------------ */

/** The three federal source systems tracked by this module. */
export type GlobalCanadaSource =
  | 'gac'       // Global Affairs Canada
  | 'eccc'      // Environment and Climate Change Canada
  | 'csis';     // Canadian Security Intelligence Service

/* ------------------------------------------------------------------ */
/*  Record Type                                                        */
/* ------------------------------------------------------------------ */

/** Types of records tracked per source system. */
export type GlobalCanadaRecordType =
  // GAC
  | 'trade_agreement'
  | 'foreign_policy'
  | 'development_project'
  | 'international_assistance'
  | 'sanctions'
  | 'treaty'
  // ECCC
  | 'climate_data'
  | 'weather_warning'
  | 'environmental_indicator'
  | 'greenhouse_gas_inventory'
  | 'climate_adaptation'
  | 'weather_forecast'
  // CSIS
  | 'annual_report'
  | 'public_briefing'
  | 'security_advisory'
  | 'other';

/* ------------------------------------------------------------------ */
/*  Core Record Type                                                   */
/* ------------------------------------------------------------------ */

/**
 * A single Global Canada metadata record.
 * Primarily a metadata tracker with links to source URLs/full documents.
 */
export interface GlobalCanadaRecord {
  /** SHA-256 hash of record content (primary key) */
  id: string;

  /** Source system (gac|eccc|csis) */
  sourceSystem: GlobalCanadaSource;

  /** Record type within the source system */
  recordType: GlobalCanadaRecordType;

  /** Title of the record */
  title: string;

  /** Publication or reference date (ISO-8601) */
  date: string | null;

  /** Descriptive text */
  description: string | null;

  /** Source URL */
  url: string;

  /** Government department name */
  department: string;

  /** Topic area (e.g. "Climate", "Trade", "Security") */
  topicArea: string | null;

  /** Geographic focus (e.g. "Global", "Indo-Pacific", "Arctic") */
  geographicFocus: string | null;

  /** Reference number or identifier */
  referenceNumber: string | null;

  /** Document format (e.g. "PDF", "HTML", "JSON", "CSV") */
  format: string | null;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Raw Fetch Types                                                    */
/* ------------------------------------------------------------------ */

/** Generic raw record from any Global Canada source. */
export interface RawGlobalCanadaRecord {
  sourceSystem?: string;
  recordType?: string;
  title?: string;
  date?: string | null;
  description?: string | null;
  url?: string;
  department?: string;
  topicArea?: string | null;
  geographicFocus?: string | null;
  referenceNumber?: string | null;
  format?: string | null;

  /** Catch-all for any other fields */
  [key: string]: unknown;
}

/** Shape of an ECCC GeoMet API feature. */
export interface GeoMetFeature {
  id?: string;
  properties?: {
    /** Phenomenon time */
    phenomenonTime?: string;
    /** Observed property name */
    observedPropertyName?: string;
    /** Value */
    value?: number;
    /** Unit */
    unit?: string;
    /** Parameter name */
    parameterName?: string;
    [key: string]: unknown;
  };
  geometry?: unknown;
  [key: string]: unknown;
}

/** Shape of a GAC trade agreement list entry. */
export interface GacTradeAgreementEntry {
  title?: string;
  url?: string;
  date?: string;
  description?: string;
  status?: string;
  partner?: string;
  type?: string;
  [key: string]: unknown;
}

/** Shape of a CSIS publication entry. */
export interface CsisPublicationEntry {
  title?: string;
  url?: string;
  date?: string;
  publicationType?: string;
  description?: string;
  format?: string;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Options & Result                                         */
/* ------------------------------------------------------------------ */

export interface GlobalCanadaIngestionOptions {
  /** Source systems to ingest (default: all three) */
  sources?: GlobalCanadaSource[];

  /** Record types to ingest */
  recordTypes?: GlobalCanadaRecordType[];

  /** Max records to process per source */
  maxRecords?: number;

  /** Force re-ingest of already-ingested records */
  force?: boolean;

  /** Initialize table if it doesn't exist */
  initializeTable?: boolean;

  /** Progress callback */
  onProgress?: (msg: string) => void;
}

export interface GlobalCanadaIngestionResult {
  recordsFound: number;
  recordsIngested: number;
  newRecords: number;
  errors: string[];
  perSource: Record<string, {
    recordsFound: number;
    recordsIngested: number;
  }>;
  durationMs: number;
}
