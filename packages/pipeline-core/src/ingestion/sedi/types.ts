/**
 * SEDI Insider Trading Types — Quill
 *
 * Types for insider transaction data from the Canadian SEDI
 * (System for Electronic Disclosure by Insiders) and SEDAR+.
 *
 * Automated access is retired. SEDI terms of use prohibit robots, spiders,
 * and other automatic devices. These types describe stored rows only.
 *
 * The canonical InsiderTransaction interface is defined in
 * ../corporate/types.ts and reused here. This module adds
 * SEDI-specific types for raw fetch results and search params.
 */

import type { InsiderTransaction } from '../corporate/types.js';

export type { InsiderTransaction };

/* ------------------------------------------------------------------ */
/*  SEDI-specific search/fetch types                                   */
/* ------------------------------------------------------------------ */

/** Search parameters for querying SEDI insider transactions. */
export interface SediSearchParams {
  /** Issuer name or ticker symbol to search for */
  issuer?: string;
  /** Insider name (officer, director, 10% holder) */
  insider?: string;
  /** Date range: start date (ISO-8601 YYYY-MM-DD) */
  fromDate?: string;
  /** Date range: end date (ISO-8601 YYYY-MM-DD) */
  toDate?: string;
}

/** Raw HTML row extracted from a SEDI results table. */
export interface RawSediRow {
  issuerName: string;
  issuerTicker: string | null;
  insiderName: string;
  relationship: string;
  transactionTypeRaw: string;
  securityType: string;
  volumeRaw: string;
  priceRaw: string;
  totalValueRaw: string;
  transactionDate: string;
  filingDate: string | null;
  closingDate: string | null;
  ownershipAfterRaw: string;
  natureOfOwnership: string | null;
}

/** Result of a single SEDI fetch-and-parse cycle. */
export interface SediIngestionResult {
  /** Number of raw rows found on the page */
  rowsFound: number;
  /** Number successfully parsed into InsiderTransaction */
  rowsParsed: number;
  /** Number persisted to DB (when db provided) */
  rowsIngested: number;
  /** Any errors encountered during the cycle */
  errors: string[];
  /** Duration of the fetch+parse+persist cycle in ms */
  durationMs: number;
  /** Parsed records (returned in dry-run mode) */
  records?: InsiderTransaction[];
  /** Issuer searched (if applicable) */
  issuer?: string;
}

/** Supported datasource for insider reports */
export type InsiderDataSource = 'sedi' | 'sedarplus';
