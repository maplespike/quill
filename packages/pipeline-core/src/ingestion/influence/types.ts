// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Influence Tracking Types — Quill
 *
 * Types for tracking organizations that influence Canadian government
 * policy: international organizations, NGOs, think tanks, consultancies,
 * and their interconnections with government.
 *
 * Maps the full network: who funds them, who they lobby,
 * who they advise, who testifies, who sits on whose board.
 */

/* ------------------------------------------------------------------ */
/*  Actor Taxonomy                                                     */
/* ------------------------------------------------------------------ */

export type InfluenceActorCategory =
  | 'international-organization'   // UN, OECD, WEF, NATO, WHO, IMF, World Bank
  | 'foreign-ngo'                  // International non-profits
  | 'canadian-ngo'                 // Canadian advocacy/non-profit
  | 'think-tank'                   // Policy research organizations
  | 'consultancy'                  // Management/strategy consulting
  | 'academic-institution'         // Universities, research centers
  | 'trade-association'            // Industry associations
  | 'union'                        // Labour organizations
  | 'professional-body'           // Law societies, medical associations
  | 'foundation'                   // Philanthropic foundations
  | 'media-organization'           // News outlets, journalistic entities
  | 'other';

/** Level of influence / tracking priority */
export type InfluencePriority = 'critical' | 'high' | 'medium' | 'monitor';

/** An organization whose influence on Canada we track */
export interface InfluenceActor {
  /** Unique identifier */
  id: string;
  /** Full legal name */
  name: string;
  /** Alternative names / acronyms */
  aliases: string[];
  /** Category */
  category: InfluenceActorCategory;
  /** Priority */
  priority: InfluencePriority;
  /** Headquarters jurisdiction */
  headquarters: string | null;
  /** Year founded */
  founded: number | null;
  /** Annual budget (latest public, CAD) */
  annualBudgetCad: number | null;
  /** Website */
  website: string | null;
  /** Wikipedia entry */
  wikipediaUrl: string | null;
  /** Is a Canada-registered charity? */
  isCraCharity: boolean;
  /** CRA charity BN/registration number */
  craBn: string | null;
  /** Key people (executives, board members) */
  keyPeople: ActorPerson[];
  /** Policy focus areas */
  policyAreas: string[];
  /** Notes */
  notes: string;
  ingestedAt: string;
}

/** A person associated with an influence actor */
export interface ActorPerson {
  name: string;
  title: string | null;
  role: 'executive' | 'board' | 'founder' | 'senior-fellow' | 'other';
  biography: string | null;
  /** Other actor IDs this person is also associated with (board interlocks) */
  alsoAt: string[];
}

/* ------------------------------------------------------------------ */
/*  Influence Connections                                              */
/* ------------------------------------------------------------------ */

export type ConnectionType =
  | 'funding-received'              // Actor received funding
  | 'funding-provided'             // Actor provided funding
  | 'lobbying'                     // Actor lobbied Canadian government
  | 'committee-testimony'          // Actor testified before committee
  | 'government-contract'          // Actor received government contract
  | 'consulting-engagement'        // Actor contracted by government
  | 'board-interlock'              // Shared board/personnel
  | 'policy-citation'             // Government cited actor's work
  | 'public-event'                 // Actor participated in government event
  | 'international-agreement'     // Canada signed agreement with actor
  | 'delegation'                   // Actor was part of official delegation
  | 'other';

/** A documented connection between an InfluenceActor and Canadian government */
export interface InfluenceConnection {
  /** SHA-256 citation hash */
  id: string;
  /** Actor ID */
  actorId: string;
  /** Actor name (denormalized) */
  actorName: string;
  /** Government entity involved (department, agency, minister) */
  governmentEntity: string;
  /** Type of connection */
  connectionType: ConnectionType;
  /** Description */
  description: string;
  /** Date of connection */
  date: string;
  /** Financial value (if applicable) */
  valueCad: number | null;
  /** Source URL */
  sourceUrl: string;
  /** Source system (lobbying, procurement, committees, cra) */
  sourceSystem: string;
  /** Source ID in the origin system */
  sourceRecordId: string | null;
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Government Funding Flows                                           */
/* ------------------------------------------------------------------ */

/** A government grant or contribution to an organization */
export interface GovernmentFunding {
  /** SHA-256 citation hash */
  id: string;
  /** Recipient organization */
  recipientName: string;
  recipientType: InfluenceActorCategory | null;
  /** Granting department */
  department: string;
  departmentAcronym: string | null;
  /** Program name */
  programName: string;
  /** Agreement type (grant, contribution, loan guarantee, etc.) */
  agreementType: string;
  /** Amount */
  amount: number;
  currency: string;
  /** Fiscal year */
  fiscalYear: string;
  /** Start and end dates */
  startDate: string | null;
  endDate: string | null;
  /** Description */
  description: string | null;
  /** Source URL */
  sourceUrl: string;
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  CRA Charity Record                                                 */
/* ------------------------------------------------------------------ */

export interface CraCharityRecord {
  /** Business Number (BN) */
  bn: string;
  /** Legal name */
  legalName: string;
  /** Operating names */
  operatingNames: string[];
  /** Status (active, revoked, etc.) */
  status: string;
  /** Category (e.g. "Grant-making organization") */
  category: string | null;
  /** Designation (charitable org, public foundation, private foundation) */
  designation: string;
  /** Total revenue (latest, CAD) */
  totalRevenue: number | null;
  /** Total assets (latest, CAD) */
  totalAssets: number | null;
  /** Charitable programs description */
  programs: string | null;
  /** Directors */
  directors: string[];
  /** Fiscal year end */
  fiscalYearEnd: string | null;
  /** Source URL */
  sourceUrl: string;
  ingestedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Aggregate Result                                                   */
/* ------------------------------------------------------------------ */

export interface InfluenceIngestionResult {
  actorsFound: number;
  connectionsFound: number;
  fundingFlowsFound: number;
  errors: string[];
  durationMs: number;
  /** Enriched actor records (populated when db is not provided) */
  enrichedActors?: InfluenceActor[];
  /** Generated connections from real data (populated when db is not provided) */
  connections?: InfluenceConnection[];
  /** Detected government funding records (populated when db is not provided) */
  fundingFlows?: GovernmentFunding[];
}
