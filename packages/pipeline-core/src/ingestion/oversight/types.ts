/**
 * Oversight Bodies Types — Quill
 *
 * Types for reports, investigations, and recommendations from Canada's
 * independent oversight bodies: OAG, PBO, Ethics Commissioner,
 * Lobbying Commissioner, Competition Bureau, CRTC, etc.
 *
 * Recommendation tracking is the key feature: did the government
 * implement oversight body recommendations?
 */


export type OversightBody =
  | 'OAG'         // Office of the Auditor General
  | 'PBO'         // Parliamentary Budget Officer
  | 'EthicsCommissioner'
  | 'LobbyingCommissioner'
  | 'CompetitionBureau'
  | 'CRTC'
  | 'PrivacyCommissioner'
  | 'InformationCommissioner'
  | 'OfficialLanguagesCommissioner'
  | 'CanadianHumanRightsCommission';


export type OversightReportType =
  | 'performance-audit'
  | 'special-examination'
  | 'environmental-audit'
  | 'cost-estimate'
  | 'research-report'
  | 'legislative-costing-note'
  | 'investigation'
  | 'annual-report'
  | 'corporate-report'
  | 'media-release'
  | 'opening-statement'
  | 'other';


export type RecommendationStatus =
  | 'implemented'
  | 'partially-implemented'
  | 'not-implemented'
  | 'in-progress'
  | 'no-longer-valid'
  | 'unknown';


export interface Recommendation {
  /** SHA-256 hash of recommendation text */
  id: string;

  /** Parent report ID */
  reportId: string;

  /** Recommendation text content */
  text: string;

  /** Sequential number within the report */
  number: number;

  /** Current implementation status */
  status: RecommendationStatus;

  /** The body or department responsible for implementation */
  responsibleEntity: string | null;

  /** Date the status was last assessed */
  statusDate: string | null;

  /** Target date for implementation (if any) */
  targetDate: string | null;

  /** Notes on implementation progress */
  implementationNotes: string | null;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}

export interface OversightReport {
  /** SHA-256 hash of the report content (primary key) */
  id: string;

  /** Oversight body that produced the report */
  body: OversightBody;

  /** Report title */
  title: string;

  /** Report publication date (ISO-8601) */
  date: string;

  /** Full report URL */
  url: string;

  /** PDF URL if available */
  pdfUrl: string | null;

  /** Report type classification */
  reportType: OversightReportType;

  /** Report summary / abstract */
  summary: string | null;

  /** Key findings (bullet points or paragraphs) */
  findings: string[];

  /** Associated recommendations */
  recommendations: Recommendation[];

  /** Department(s) or entity(ies) audited/investigated */
  auditedEntities: string[];

  /** Fiscal year the report pertains to */
  fiscalYear: string | null;

  /** Report number or identifier from the source body */
  reportNumber: string | null;

  /** Language of the report ('en', 'fr', 'bilingual') */
  language: string;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}


export interface Investigation {
  id: string;
  body: OversightBody;
  title: string;
  subject: string;
  dateOpened: string;
  dateClosed: string | null;
  summary: string;
  findings: string[];
  recommendations: Recommendation[];
  parties: string[];
  outcome: string | null;
  url: string;
  ingestedAt: string;
}


export interface OversightIngestionResult {
  body: OversightBody;
  reportsFound: number;
  reportsIngested: number;
  recommendationsFound: number;
  errors: string[];
  durationMs: number;
}


export interface RawPBOItem {
  title: string;
  date: string;
  url: string;
  type: string;       // 'Report', 'Note', 'Legislative Costing Note', etc.
  summary: string | null;
  pdfUrl: string | null;
  reportNumber: string | null;
}


export interface RawOAGItem {
  title: string;
  date: string;
  url: string;
  reportType: string;  // 'performance-audit', 'special-examination', etc.
  summary: string | null;
  pdfUrl: string | null;
  fiscalYear: string | null;
  auditedEntities: string[];
}


export interface RawEthicsItem {
  /** Investigation title */
  title: string;
  /** Publication date (ISO-8601) */
  date: string;
  /** Investigation URL */
  url: string;
  /** HTML of the investigation report detail page */
  bodyHtml: string;
  /** Subject of the investigation (e.g., minister name, MP name) */
  subject: string | null;
  /** Outcome classification if available */
  outcome: string | null;
  /** Parties involved (the investigated person, complainant, etc.) */
  parties: string[];
  /** Report number or file identifier */
  reportNumber: string | null;
}


export interface RawLobbyingItem {
  /** Investigation title */
  title: string;
  /** Publication date (ISO-8601) */
  date: string;
  /** Investigation URL */
  url: string;
  /** HTML of the investigation report detail page */
  bodyHtml: string;
  /** Person or entity under investigation */
  subject: string | null;
  /** Investigation outcome */
  outcome: string | null;
  /** Companies or individuals involved */
  parties: string[];
  /** The Lobbying Act provision cited */
  actProvision: string | null;
  /** Report number */
  reportNumber: string | null;
}


export interface RawCompetitionBureauItem {
  title: string;
  date: string;
  url: string;
  summary: string | null;
  body: OversightBody;
  /** 'merger-review' | 'enforcement-action' | 'consultation' | 'bulletin' | 'annual-report' */
  cbType: string;
  /** Companies involved (merging parties, respondent, etc.) */
  companies: string[];
  /** Industry/sector tags */
  sectors: string[];
}

/**
 * A Competition Bureau merger review.
 * These reviews assess whether proposed mergers would substantially
 * lessen/prevent competition. Key for tracking corporate consolidation.
 */
export interface MergerReview {
  /** SHA-256 hash of the merger review content */
  id: string;

  /** Oversight body (always CompetitionBureau) */
  body: OversightBody;

  /** Title of the review */
  title: string;

  /** Date of the review/decision */
  date: string;

  /** URL to the review page */
  url: string;

  /** Summary of the review */
  summary: string | null;

  /** The merging parties (companies involved) */
  parties: string[];

  /** Industry/sector */
  sector: string | null;

  /** Outcome: 'cleared' | 'challenged' | 'settled' | 'withdrawn' | 'ongoing' | 'unknown' */
  outcome: string;

  /** Any conditions imposed (e.g., asset divestiture requirements) */
  conditions: string[];

  /** If the review found anti-competitive effects */
  antiCompetitiveConcerns: boolean;

  /** Relevant market definition */
  marketDefinition: string | null;

  /** Narrative of key findings */
  findings: string[];

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}


export interface RawCRTCItem {
  title: string;
  date: string;
  url: string;
  summary: string | null;
  /** CRTC decision type: 'broadcasting-decision' | 'telecom-decision' | 'ownership-change' | 'policy' | 'notice-consultation' */
  crtcType: string;
  /** Companies/entities affected by the decision */
  affectedParties: string[];
  /** Decision number (e.g., 2024-123) */
  decisionNumber: string | null;
}

/**
 * A CRTC regulatory decision.
 * CRTC decisions govern broadcasting, telecommunications, and media
 * ownership changes — directly relevant to tracked media executives
 * like Péladeau (Quebecor), Entwistle (Bell), etc.
 */
export interface CRTCDecision {
  /** SHA-256 hash of the decision content */
  id: string;

  /** Oversight body (always CRTC) */
  body: OversightBody;

  /** Title of the decision */
  title: string;

  /** Date of the decision */
  date: string;

  /** URL to the decision page */
  url: string;

  /** Summary of the decision */
  summary: string | null;

  /** Decision type */
  decisionType: string;

  /** CRTC decision number (e.g., 2024-123) */
  decisionNumber: string | null;

  /** Companies/entities affected */
  affectedParties: string[];

  /** Key regulatory findings */
  findings: string[];

  /** Conditions imposed by the decision */
  conditions: string[];

  /** Whether the decision relates to a media ownership change */
  isOwnershipChange: boolean;

  /** Whether the decision relates to net neutrality */
  isNetNeutrality: boolean;

  /** Whether the decision relates to telecom pricing */
  isTelecomPricing: boolean;

  /** Whether the decision relates to broadcasting content */
  isBroadcastingContent: boolean;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}
