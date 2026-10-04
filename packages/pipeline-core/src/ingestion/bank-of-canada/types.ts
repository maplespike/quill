/**
 * Bank of Canada Ingestion Types — Quill
 *
 * Types for Bank of Canada interest rate decisions, Monetary Policy Reports (MPR),
 * Financial System Reviews (FSR), and VALA executive speeches.
 *
 * Sources:
 *   - Rate announcements:  https://www.bankofcanada.ca/rates/
 *   - Monetary Policy Rep.: https://www.bankofcanada.ca/publications/mpr/
 *   - Financial System Rev.: https://www.bankofcanada.ca/publications/fsr/
 *   - VALA executive speeches: https://www.vala.ca
 */

/* ------------------------------------------------------------------ */
/*  Decision / Publication Types                                       */
/* ------------------------------------------------------------------ */

/** Type of Bank of Canada publication or decision */
export type BocDecisionType =
  | 'rate'
  | 'mpr'
  | 'fsr'
  | 'speech';

/**
 * A Bank of Canada rate decision, publication, or executive speech.
 *
 * Rate decisions set the Bank's key policy interest rate (overnight rate),
 * which influences borrowing costs across the Canadian economy.
 *
 * Monetary Policy Reports (MPR) provide the Bank's outlook for inflation
 * and economic growth, published quarterly.
 *
 * Financial System Reviews (FSR) assess vulnerabilities in Canada's
 * financial system, published semi-annually.
 *
 * VALA executive speeches are public addresses by Bank of Canada
 * Governors, Senior Deputy Governors, and other executives covering
 * economic policy, financial stability, and monetary policy.
 */
export interface BocDecision {
  /** SHA-256 hash of the decision content (primary key) */
  id: string;

  /** Publication date (ISO-8601 YYYY-MM-DD) */
  date: string;

  /** Decision type */
  type: BocDecisionType;

  /** Full title of the decision/report/speech */
  title: string;

  /** Summary or abstract (from the HTML page or RSS description) */
  summary: string | null;

  /** URL to the decision/report/speech page */
  url: string;

  /**
   * The key policy interest rate (overnight rate) set by the decision.
   * Only present for 'rate' type decisions.
   * Example: '5.00' for a 5% rate
   */
  keyRate: string | null;

  /**
   * Effective date of the rate decision.
   * Usually the business day following the announcement date.
   * Only present for 'rate' type decisions (ISO-8601 YYYY-MM-DD).
   */
  effectiveDate: string | null;

  /** Speaker name — only present for 'speech' type (e.g., 'Tiff Macklem') */
  speaker: string | null;

  /** Speaker title/role — for speeches (e.g., 'Governor') */
  speakerTitle: string | null;

  /** Event or location for speeches (e.g., 'Canadian Club Toronto') */
  event: string | null;

  /** URL to the PDF version if available */
  pdfUrl: string | null;

  /** Language of the publication ('en' or 'fr') */
  language: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Source Configuration Types                                         */
/* ------------------------------------------------------------------ */

/** Configuration for a Bank of Canada data source */
export interface BocSourceConfig {
  /** Display label for the source */
  label: string;
  /** Base URL for fetching */
  url: string;
  /** RSS feed URL if available */
  rssUrl: string | null;
  /** Decision type produced by this source */
  type: BocDecisionType;
  /** Pagination support (year-based URL pattern) */
  yearPattern: string | null;
}

/* ------------------------------------------------------------------ */
/*  Raw Fetch Types                                                    */
/* ------------------------------------------------------------------ */

/** Raw item from a Bank of Canada RSS feed or listing page */
export interface RawBocItem {
  title: string;
  date: string;
  url: string;
  summary: string | null;
  /** Raw type string from the source */
  rawType: string;
  /** HTML body of the detail page (if fetched) */
  bodyHtml: string | null;
  /** Speaker name extracted (speeches only) */
  speaker: string | null;
}

/** Raw HTML page for parsing */
export interface RawBocPage {
  url: string;
  html: string;
}

/* ------------------------------------------------------------------ */
/*  Ingestion Result Type                                              */
/* ------------------------------------------------------------------ */

/** Result of the Bank of Canada ingestion pipeline */
export interface BocIngestionResult {
  decisionsFound: number;
  decisionsIngested: number;
  sourcesTried: string[];
  errors: string[];
  durationMs: number;
}

/* ------------------------------------------------------------------ */
/*  Rate Schedule Types                                                */
/* ------------------------------------------------------------------ */

/** A scheduled Bank of Canada rate decision date */
export interface BocRateScheduleEntry {
  /** The announcement date (ISO-8601 YYYY-MM-DD) */
  date: string;
  /** A label for the decision e.g., 'January 2024' */
  label: string;
}

/** Historical rate decision record for reference */
export interface BocRateHistoryEntry {
  /** Announcement date (ISO-8601 YYYY-MM-DD) */
  date: string;
  /** Effective date (ISO-8601 YYYY-MM-DD) */
  effectiveDate: string;
  /** The overnight rate target set (percentage) */
  rate: string;
  /** Label / description */
  label: string;
}
