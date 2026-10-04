/**
 * Gazette Data Types — Quill
 *
 * Strongly-typed interfaces for Canada Gazette (Parts I, II, III)
 * regulation data ingestion.
 *
 * Sources:
 *   - Part I (proposed):   https://gazette.gc.ca/rp-pr/p1/index.rss
 *   - Part II (enacted):   https://gazette.gc.ca/rp-pr/p2/index.rss
 *   - Part III (acts):     https://gazette.gc.ca/rp-pr/p3/index.rss (deferred)
 */


export enum GazettePart {
  /** Proposed regulations — published for 60-day public comment */
  I = 'I',
  /** Enacted regulations — SOR/* registration numbers, in force */
  II = 'II',
  /** Acts of Parliament — coming into force (deferred for v1) */
  III = 'III',
}


export interface GazetteRecord {
  /** SHA-256 hash of the RSS item content (primary key) */
  id: string;

  /** Title of the regulation */
  title: string;

  /** Link to the HTML version on gazette.gc.ca */
  htmlUrl: string;

  /** Gazette part: I (proposed), II (enacted), III (acts) */
  part: GazettePart;

  /** Publication date (ISO-8601) */
  publishedAt: string;

  /** Description / summary from the RSS feed */
  description: string | null;

  /** SOR registration number (e.g. SOR/2026-123), null for Part I proposed */
  registrationNumber: string | null;

  /** URL to the Regulatory Impact Analysis Statement (RIAS) */
  riasUrl: string | null;

  /** Full RIAS text extracted from the HTML page */
  riasText: string | null;

  /** For Part I: deadline for public comment (60 days from publication) */
  commentDeadline: string | null;

  /** Department or agency responsible */
  department: string | null;

  /** Regulation identifier (regulatory identifier number) */
  regulationId: string | null;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}


export interface GazetteIngestionResult {
  part: GazettePart;
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}
