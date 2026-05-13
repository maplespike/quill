/**
 * Municipal Council Data — MapleSpike Pipeline
 *
 * Strongly-typed interfaces for tracking municipal council meetings, agendas,
 * decisions, and budgets across major Canadian cities.
 *
 * This is the most fragmented data source in Canadian civic transparency —
 * each city uses different vendors (eScribe, iCompass, CivicWeb) or their
 * own bespoke publishing systems.  This module provides a unified schema
 * over that fragmentation.
 *
 * Target cities: Toronto, Vancouver, Montreal, Calgary, Edmonton, Ottawa,
 * Winnipeg, Quebec City, Hamilton, Halifax.
 */

/** Known municipal council meeting types */
export type MeetingType =
  | 'council'
  | 'committee'
  | 'board'
  | 'standing-committee'
  | 'sub-committee'
  | 'task-force'
  | 'advisory'
  | 'public-hearing'
  | 'budget';

/** Known vendor platforms that Canadian cities use for council management */
export type VendorPlatform =
  | 'escribe'        // eScribe (escribeonline.com) — many Ontario cities
  | 'icompass'       // iCompass (icompass.ca) — many BC cities
  | 'civicweb'       // CivicWeb (civicweb.net) — various
  | 'opencouncil'    // Open Council (opengovernment.org) — various
  | 'toronto-custom' // City of Toronto bespoke CMS
  | 'vancouver-custom' // City of Vancouver bespoke system
  | 'montreal-custom' // City of Montreal bespoke (French)
  | 'html-scrape';   // Generic HTML scraping fallback

/** A Canadian city supported by this module */
export type CityCode =
  | 'toronto'
  | 'vancouver'
  | 'montreal'
  | 'calgary'
  | 'edmonton'
  | 'ottawa'
  | 'winnipeg'
  | 'quebec-city'
  | 'hamilton'
  | 'halifax';

/** Status of a municipal meeting */
export type MeetingStatus =
  | 'scheduled'
  | 'in-progress'
  | 'completed'
  | 'cancelled'
  | 'postponed';

/** Decision/vote type */
export type DecisionType =
  | 'approved'
  | 'defeated'
  | 'deferred'
  | 'amended'
  | 'referred'
  | 'withdrawn'
  | 'tabled'
  | 'ruled-out-of-order';

export interface CityConfig {
  /** Canonical city code */
  city: CityCode;
  /** Display name */
  name: string;
  /** Province / territory */
  province: string;
  /** Known vendor platform (null if custom/bespoke) */
  vendorPlatform: VendorPlatform | null;
  /** Primary base URL for council info */
  baseUrl: string;
  /** URL template for meeting list (use {year} placeholder) */
  meetingsUrl: string;
  /** URL template for meeting detail (use {meetingId} placeholder) */
  meetingDetailUrl: string | null;
  /** URL for agenda documents */
  agendaUrlPattern: string | null;
  /** URL for minutes documents */
  minutesUrlPattern: string | null;
  /** URL for budget documents */
  budgetUrlPattern: string | null;
  /** Known API endpoints for this city (if vendor API exists) */
  apiEndpoints: Record<string, string>;
  /** HTTP headers needed for scraping (e.g., Accept-Language for Montreal) */
  customHeaders: Record<string, string>;
  /** Meetings URL patterns match this regex for extracting meeting IDs */
  meetingIdPattern: string;
  /** Default timezone for the city */
  timezone: string;
  /** Whether this city publishes in French */
  isFrench: boolean;
}

/**
 * A unified municipal council meeting record.
 *
 * Fields are intentionally nullable — availability varies wildly by city.
 */
export interface MunicipalMeeting {
  /** SHA-256 citation hash (primary key) */
  id: string;

  /** City code */
  city: CityCode;
  /** Province */
  province: string;

  /** Date of the meeting (ISO-8601 date or datetime) */
  date: string;

  /** Type of meeting */
  meetingType: MeetingType;

  /** Meeting status */
  status: MeetingStatus;

  /** Title/short description of the meeting */
  title: string;

  /** Full description / purpose of the meeting */
  description: string | null;

  /** Council department or committee name */
  department: string | null;

  /** URL to the meeting page / detail page */
  meetingUrl: string | null;

  /** URL to the agenda document (PDF or HTML) */
  agendaUrl: string | null;

  /** URL to the minutes document (PDF or HTML) */
  minutesUrl: string | null;

  /** URL to the video recording */
  videoUrl: string | null;

  /** List of decisions made at the meeting */
  decisions: MeetingDecision[];

  /** Agenda item titles (as available) */
  agendaItems: string[];

  /** Budget reference — link to budget document or fiscal year */
  budgetReference: string | null;

  /** Budget amount discussed/approved (CAD, if applicable) */
  budgetAmount: number | null;

  /** Vendor platform used (for provenance) */
  vendorPlatform: VendorPlatform | null;

  /** Source URL where this record was found */
  sourceUrl: string;

  /** Source system identifier */
  sourceSystem: string;

  /** Raw meeting ID from the source system */
  sourceMeetingId: string | null;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

/** A single decision or vote recorded in a meeting */
export interface MeetingDecision {
  /** Agenda item number or reference */
  itemNumber: string | null;
  /** Item title */
  title: string | null;
  /** Type of decision */
  decisionType: DecisionType;
  /** Description of the decision */
  description: string | null;
  /** Vote tally (e.g. "9-2") */
  voteResult: string | null;
  /** Motion details if available */
  motionText: string | null;
  /** Councillor who moved the motion */
  movedBy: string | null;
  /** Councillor who seconded */
  secondedBy: string | null;
}

/** Aggregate result of a municipal ingestion run */
export interface MunicipalIngestionResult {
  /** City ingested */
  city: CityCode;
  /** Year ingested */
  year: number;
  /** Total meetings found in source */
  meetingsFound: number;
  /** Meetings successfully ingested */
  meetingsIngested: number;
  /** Total decisions recorded */
  decisionsRecorded: number;
  /** Total budget amount tracked (CAD) */
  totalBudgetAmount: number;
  /** Sources attempted */
  sourcesTried: string[];
  /** Error messages */
  errors: string[];
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Raw record from a city's council data source (HTML page, API response, etc.)
 */
export interface RawCouncilRecord {
  /** City code */
  city?: CityCode;
  /** Raw HTML from scraping */
  rawHtml?: string;
  /** Raw JSON from vendor API */
  rawJson?: string;
  /** Raw CSV data */
  rawCsvData?: string;
  /** Source URL */
  sourceUrl?: string;
  /** Meeting date string as found in source */
  date?: string;
  /** Meeting title as found in source */
  title?: string;
  /** Meeting type string as found in source */
  meetingType?: string;
  /** Meeting ID in the source system */
  meetingId?: string;
  /** List of decision stubs found in source */
  decisionTexts?: string[];
  /** Budget reference found in source */
  budgetReference?: string;

  /** Catch-all for city-specific fields */
  [key: string]: unknown;
}

/**
 * Per-city setup: describes which vendor platform a city uses, its base URLs,
 * and any custom parsing rules needed.
 */
export interface CityInfo {
  code: CityCode;
  name: string;
  province: string;
  vendorPlatform: VendorPlatform | null;
  isImplemented: boolean;
  isFrench: boolean;
}
