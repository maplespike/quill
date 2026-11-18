// SPDX-License-Identifier: AGPL-3.0-only
/**
 * MapleSpike SDK — typed client for Canadian civic data
 *
 * ```ts
 * import { MapleSpike } from '@maplespike/sdk';
 *
 * const ms = new MapleSpike({ apiKey: 'ms_live_...' });
 *
 * // Domain-specific methods (typed)
 * const pr = await ms.immigration.permanentResidents({ province: 'ON', year: 2025 });
 * const committees = await ms.committees.meetings({ parliament: 44 });
 * const lobbying = await ms.corporate.lobbying({ subject: 'healthcare' });
 *
 * // Generic query (any endpoint)
 * const data = await ms.query('regulations', 'regulatory-proposals', { status: 'open' });
 * ```
 *
 * @module @maplespike/sdk
 */

import type { SdkConfig, QuillResponse, QueryOptions } from './types.js';
import { resolveBaseUrl, buildUrl, buildHeaders, parseResponse, getBilingualError } from './query.js';
import { setApiKey, setJwtToken, clearAuth } from './auth.js';
import { SearchClient, type SearchQuery, type SearchResult } from './search.js';
import { IngestionClient, type IngestionRequest, type IngestionJob, type IngestionJobStatus, type IngestionResult } from './ingestion.js';
import { EntityResolutionClient, type Entity, type EntityGraph, type EntityResolutionQuery, type EntityResolutionResult, type EntityType, type MatchConfidence } from './entity-resolution.js';

// Re-export types
export type {
  QuillResponse,
  QueryOptions,
  ResponseMeta,
  ResponseQuality,
  Citation,
  AuthConfig,
  SdkConfig,
  QuillApiError,
  AgentDefinition,
  ActionDefinition,
} from './types.js';
export { QuillError } from './types.js';
export { getAgent, listAgents, listActions, AGENTS } from './agents.js';
export { getApiKey, setApiKey, getJwtToken, setJwtToken, isAuthenticated, clearAuth } from './auth.js';

// Export search types and client
export type { SearchQuery, SearchResult };
export { SearchClient } from './search.js';

// Export ingestion types and client
export type { IngestionRequest, IngestionJob, IngestionJobStatus, IngestionResult };
export { IngestionClient } from './ingestion.js';

// Export entity resolution types and client
export type { Entity, EntityGraph, EntityResolutionQuery, EntityResolutionResult, EntityType, MatchConfidence };
export { EntityResolutionClient } from './entity-resolution.js';
export {
  SCHEMAS,
  validateParams,
  committeeMembershipSchema,
  committeeMeetingsSchema,
  committeeReportsSchema,
  committeeWitnessesSchema,
  corporationProfileSchema,
  corporationFilingsSchema,
  directorRegistrySchema,
  lobbyingActivitiesSchema,
  politicalContributionsSchema,
  fundraisingEventsSchema,
  mediaOwnershipSchema,
  regulatoryProposalsSchema,
  regulatoryDecisionsSchema,
  consultationCommentsSchema,
  courtDecisionsSchema,
  caseTrackingSchema,
  tribunalRulingsSchema,
  auditorReportsSchema,
  watchdogReportsSchema,
  accessToInformationSchema,
  conflictOfInterestSchema,
  governmentSpendingSchema,
  electionResultsSchema,
  populationStatisticsSchema,
  publicSalaryDisclosureSchema,
  permanentResidentsSchema,
  studyPermitsSchema,
  workPermitsSchema,
  refugeeDecisionsSchema,
  cbsaEnforcementSchema,
  landClaimsSchema,
  iscSpendingSchema,
  fnTransparencySchema,
  trcProgressSchema,
  correctionsPopulationSchema,
  paroleDecisionsSchema,
  rcmpCrimeStatsSchema,
  prosecutionsSchema,
  personnelSchema,
  procurementSchema,
  municipalMeetingsSchema,
  municipalBudgetsSchema,
  municipalOpenDataSchema,
  tsbOccurrencesSchema,
  tcRecallsSchema,
  ctaRulingsSchema,
  weatherAlertsSchema,
  borderWaitsSchema,
  paroleRegistrySchema,
  crtcMarketReportsSchema,
  ownershipChartsSchema,
  cmfDataSchema,
  triCouncilGrantsSchema,
  researchChairsSchema,
  studentLoansSchema,
  cudoDataSchema,
  ccbDataSchema,
  cppOasSchema,
  eiStatisticsSchema,
  povertyDataSchema,
  rateDecisionsSchema,
  monetaryPolicySchema,
  unionReportsSchema,
  universityDataSchema,
  crtcDecisionsSchema,
  crtcOwnershipSchema,
  charitySearchSchema,
  politicalSpendingSchema,
  regulatorSearchSchema,
  regulatorCoverageSchema,
  legalSearchSchema,
  legalFetchSchema,
  legalCoverageSchema,
  federalActsSchema,
  federalRegulationsSchema,
  provincialLegislationSchema,
  contractsSchema,
  spendingSummarySchema,
} from './schemas.js';

/* ------------------------------------------------------------------ */
/*  Domain-specific query parameters                                   */
/* ------------------------------------------------------------------ */

export interface CommitteeQuery {
  committee?: string; chamber?: 'commons' | 'senate'; parliament?: number;
  dateFrom?: string; dateTo?: string; keyword?: string; limit?: number;
}

export interface CorporateQuery {
  businessNumber?: string; directorName?: string; subject?: string;
  dateFrom?: string; jurisdiction?: string; limit?: number;
}

export interface ImmigrationQuery {
  province?: string; year?: number; category?: string;
  countryOfCitizenship?: string; limit?: number;
}

export interface ElectionQuery {
  year?: number; riding?: string; party?: string;
  type?: 'federal' | 'provincial'; limit?: number;
}

export interface OversightQuery {
  body?: string; year?: number; keyword?: string; limit?: number;
}

export interface GazetteQuery {
  part?: 1 | 2 | 3; department?: string; keyword?: string;
  dateFrom?: string; limit?: number;
}

export interface LmiaQuery {
  employer?: string; occupation?: string; province?: string;
  year?: number; outcome?: 'approved' | 'denied'; limit?: number;
}

export interface CanliiQuery {
  court?: string; keyword?: string; dateFrom?: string;
  citation?: string; limit?: number;
}

export interface ProvincialQuery {
  province?: string; subject?: string; year?: number; limit?: number;
}

export interface GicQuery {
  department?: string; organization?: string; year?: number;
  minSalary?: number; limit?: number;
}

/* ------------------------------------------------------------------ */
/*  MapleSpike Client Class                                            */
/* ------------------------------------------------------------------ */

export class MapleSpike {
  private _apiKey?: string;
  private _jwtToken?: string;
  private _baseUrl: string;
  private _lang: 'en' | 'fr';

  constructor(config: SdkConfig = {}) {
    this._apiKey = config.apiKey;
    this._jwtToken = config.jwtToken;
    this._baseUrl = resolveBaseUrl(config.baseUrl);
    this._lang = config.lang ?? 'en';
    if (config.apiKey) setApiKey(config.apiKey);
    if (config.jwtToken) setJwtToken(config.jwtToken);

    // Initialize advanced clients
    this.search = new SearchClient({
      apiKey: this._apiKey,
      jwtToken: this._jwtToken,
      baseUrl: this._baseUrl,
    });
    this.ingestion = new IngestionClient({
      apiKey: this._apiKey,
      jwtToken: this._jwtToken,
      baseUrl: this._baseUrl,
    });
    this.entityResolution = new EntityResolutionClient({
      apiKey: this._apiKey,
      jwtToken: this._jwtToken,
      baseUrl: this._baseUrl,
    });
  }

  get apiKey(): string | undefined { return this._apiKey; }
  set apiKey(key: string | undefined) { this._apiKey = key; setApiKey(key); }

  get jwtToken(): string | undefined { return this._jwtToken; }
  set jwtToken(token: string | undefined) { this._jwtToken = token; setJwtToken(token); }

  get baseUrl(): string { return this._baseUrl; }
  set baseUrl(url: string) { this._baseUrl = resolveBaseUrl(url); }

  get lang(): 'en' | 'fr' { return this._lang; }
  set lang(l: 'en' | 'fr') { this._lang = l; }

  clearAuth(): void { this._apiKey = undefined; this._jwtToken = undefined; clearAuth(); }
  isAuthenticated(): boolean { return !!(this._apiKey || this._jwtToken); }

  // ─── Core Query ──────────────────────────────────────────────────

  async query<T = unknown>(
    agent: string,
    action: string,
    params?: Record<string, unknown>,
    options?: QueryOptions,
  ): Promise<QuillResponse<T>> {
    const url = buildUrl(this._baseUrl, agent, action, params, options);
    const headers = buildHeaders(this._apiKey, this._jwtToken);
    const response = await fetch(url, { headers });
    return parseResponse<T>(response, this._lang);
  }

  /** Begin a chained query: `ms.agent('committees').action('membership', {...})` */
  agent(name: string) {
    const self = this;
    return {
      _agent: name,
      agent: (n: string) => self.agent(n),
      action: async (action: string, params?: Record<string, unknown>, options?: QueryOptions) =>
        self.query(name, action, params, options),
    };
  }

  // ─── Domain: Committees ─────────────────────────────────────────

  committees = {
    membership: (p: CommitteeQuery = {}) =>
      this.query('committees', 'committee-membership', p as any),
    meetings: (p: CommitteeQuery = {}) =>
      this.query('committees', 'committee-meetings', p as any),
    reports: (p: CommitteeQuery = {}) =>
      this.query('committees', 'committee-reports', p as any),
    witnesses: (p: CommitteeQuery = {}) =>
      this.query('committees', 'committee-witnesses', p as any),
  };

  // ─── Domain: Corporate ──────────────────────────────────────────

  corporate = {
    profile: (p: CorporateQuery) =>
      this.query('corporate', 'corporation-profile', p as any),
    filings: (p: CorporateQuery) =>
      this.query('corporate', 'corporation-filings', p as any),
    directors: (p: CorporateQuery = {}) =>
      this.query('corporate', 'director-registry', p as any),
    lobbying: (p: CorporateQuery = {}) =>
      this.query('corporate', 'lobbying-activities', p as any),
  };

  // ─── Domain: Immigration ────────────────────────────────────────

  immigration = {
    permanentResidents: (p: ImmigrationQuery = {}) =>
      this.query('immigration', 'permanent-residents', p as any),
    studyPermits: (p: ImmigrationQuery = {}) =>
      this.query('immigration', 'study-permits', p as any),
    workPermits: (p: ImmigrationQuery = {}) =>
      this.query('immigration', 'work-permits', p as any),
    refugeeDecisions: (p: ImmigrationQuery = {}) =>
      this.query('immigration', 'refugee-decisions', p as any),
  };

  // ─── Domain: Elections ──────────────────────────────────────────

  elections = {
    results: (p: ElectionQuery = {}) =>
      this.query('elections', 'election-results', p as any),
    contributions: (p: ElectionQuery = {}) =>
      this.query('influence', 'political-contributions', p as any),
    thirdParty: (p: ElectionQuery = {}) =>
      this.query('elections', 'third-party-advertisers', p as any),
  };

  // ─── Domain: Oversight ──────────────────────────────────────────

  oversight = {
    auditorReports: (p: OversightQuery = {}) =>
      this.query('oversight', 'auditor-reports', p as any),
    watchdog: (p: OversightQuery = {}) =>
      this.query('oversight', 'watchdog-reports', p as any),
    atip: (p: OversightQuery = {}) =>
      this.query('oversight', 'access-to-information', p as any),
    conflictOfInterest: (p: OversightQuery = {}) =>
      this.query('oversight', 'conflict-of-interest', p as any),
  };

  // ─── Domain: Canada Gazette ────────────────────────────────────

  gazette = {
    notices: (p: GazetteQuery = {}) =>
      this.query('gazette', 'gazette-notices', p as any),
    regulations: (p: GazetteQuery = {}) =>
      this.query('gazette', 'regulatory-impact-analyses', p as any),
  };

  // ─── Domain: LMIA ─────────────────────────────────────────────

  lmia = {
    search: (p: LmiaQuery = {}) =>
      this.query('lmia', 'lmia-records', p as any),
    stats: (p: LmiaQuery = {}) =>
      this.query('lmia', 'lmia-statistics', p as any),
  };

  // ─── Domain: Courts (CanLII) ──────────────────────────────────

  courts = {
    decisions: (p: CanliiQuery = {}) =>
      this.query('courts', 'court-decisions', p as any),
    tribunalRulings: (p: CanliiQuery = {}) =>
      this.query('courts', 'tribunal-rulings', p as any),
  };

  // ─── Domain: Provincial ───────────────────────────────────────

  provincial = {
    lobbying: (p: ProvincialQuery = {}) =>
      this.query('provincial-lobbying', 'provincial-lobbying', p as any),
  };

  // ─── Domain: GIC Appointments ─────────────────────────────────

  gic = {
    appointments: (p: GicQuery = {}) =>
      this.query('gic', 'gic-appointments', p as any),
  };

  // ─── Domain: Influence ────────────────────────────────────────

  influence = {
    actors: (p: any = {}) => this.query('influence', 'influence-actors', p),
    funding: (p: any = {}) => this.query('influence', 'funding-flows', p),
  };

  // ─── Domain: Regulations ──────────────────────────────────────

  regulations = {
    proposals: (p: any = {}) => this.query('regulations', 'regulatory-proposals', p),
    decisions: (p: any = {}) => this.query('regulations', 'regulatory-decisions', p),
    consultations: (p: any = {}) => this.query('regulations', 'consultation-comments', p),
  };

  // ─── Domain: Science & Research ───────────────────────────────

  science = {
    search: (p: any = {}) => this.query('science', 'science-data', p),
  };

  // ─── Domain: Health ───────────────────────────────────────────

  health = {
    search: (p: any = {}) => this.query('health', 'health-data', p),
  };

  // ─── Domain: Indigenous ─────────────────────────────────────

  indigenous = {
    landClaims: (p: any = {}) => this.query('indigenous', 'land-claims', p),
    iscSpending: (p: any = {}) => this.query('indigenous', 'isc-spending', p),
    fnTransparency: (p: any = {}) => this.query('indigenous', 'fn-transparency', p),
    trcProgress: (p: any = {}) => this.query('indigenous', 'trc-progress', p),
  };

  // ─── Domain: Criminal Justice ────────────────────────────────

  criminalJustice = {
    corrections: (p: any = {}) => this.query('criminal-justice', 'corrections-population', p),
    parole: (p: any = {}) => this.query('criminal-justice', 'parole-decisions', p),
    rcmpCrimeStats: (p: any = {}) => this.query('criminal-justice', 'rcmp-crime-stats', p),
    prosecutions: (p: any = {}) => this.query('criminal-justice', 'prosecutions', p),
  };

  // ─── Domain: Defence ────────────────────────────────────────

  defence = {
    personnel: (p: any = {}) => this.query('defence', 'personnel', p),
    procurement: (p: any = {}) => this.query('defence', 'procurement', p),
  };

  // ─── Domain: Municipal ──────────────────────────────────────

  municipal = {
    meetings: (p: any = {}) => this.query('municipal', 'meetings', p),
    budgets: (p: any = {}) => this.query('municipal', 'budgets', p),
    openData: (p: any = {}) => this.query('municipal', 'open-data', p),
  };

  // ─── Domain: Transport ──────────────────────────────────────

  transport = {
    tsbOccurrences: (p: any = {}) => this.query('transport', 'tsb-occurrences', p),
    tcRecalls: (p: any = {}) => this.query('transport', 'tc-recalls', p),
    ctaRulings: (p: any = {}) => this.query('transport', 'cta-rulings', p),
  };

  // ─── Domain: Real-Time ──────────────────────────────────────

  realtime = {
    weatherAlerts: (p: any = {}) => this.query('realtime', 'weather-alerts', p),
    borderWaits: (p: any = {}) => this.query('realtime', 'border-waits', p),
    paroleRegistry: (p: any = {}) => this.query('realtime', 'parole-registry', p),
  };

  // ─── Domain: Media ─────────────────────────────────────────

  media = {
    crtcMarketReports: (p: any = {}) => this.query('media', 'crtc-market-reports', p),
    ownershipCharts: (p: any = {}) => this.query('media', 'ownership-charts', p),
    cmfData: (p: any = {}) => this.query('media', 'cmf-data', p),
  };

  // ─── Domain: Education ──────────────────────────────────────

  education = {
    triCouncilGrants: (p: any = {}) => this.query('education', 'tri-council-grants', p),
    researchChairs: (p: any = {}) => this.query('education', 'research-chairs', p),
    studentLoans: (p: any = {}) => this.query('education', 'student-loans', p),
    cudoData: (p: any = {}) => this.query('education', 'cudo-data', p),
  };

  // ─── Domain: Social Programs ────────────────────────────────

  socialPrograms = {
    ccbData: (p: any = {}) => this.query('social-programs', 'ccb-data', p),
    cppOas: (p: any = {}) => this.query('social-programs', 'cpp-oas', p),
    eiStatistics: (p: any = {}) => this.query('social-programs', 'ei-statistics', p),
    povertyData: (p: any = {}) => this.query('social-programs', 'poverty-data', p),
  };

  // ─── Domain: Bank of Canada ────────────────────────────────

  bankOfCanada = {
    rateDecisions: (p: any = {}) => this.query('bank-of-canada', 'rate-decisions', p),
    monetaryPolicy: (p: any = {}) => this.query('bank-of-canada', 'monetary-policy', p),
  };

  // ─── Domain: Unions ────────────────────────────────────────

  unions = {
    reports: (p: any = {}) => this.query('unions', 'union-reports', p),
  };

  // ─── Domain: Universities ──────────────────────────────────

  universities = {
    data: (p: any = {}) => this.query('universities', 'university-data', p),
  };

  // ─── Domain: CRTC ─────────────────────────────────────────

  crtc = {
    decisions: (p: any = {}) => this.query('crtc', 'decisions', p),
    ownership: (p: any = {}) => this.query('crtc', 'ownership', p),
  };

  // ─── Domain: CRA Charity ───────────────────────────────────

  craCharity = {
    search: (p: any = {}) => this.query('cra-charity', 'charity-search', p),
    politicalSpending: (p: any = {}) => this.query('cra-charity', 'political-spending', p),
  };

  // ─── Domain: Provincial Regulators ─────────────────────────

  provincialRegulators = {
    search: (p: any = {}) => this.query('provincial-regulators', 'regulator-search', p),
    coverage: (p: any = {}) => this.query('provincial-regulators', 'regulator-coverage', p),
  };

  // ─── Domain: A2AJ Legal API ──────────────────────────

  a2aj = {
    search: (p: any = {}) => this.query('a2aj', 'legal-search', p),
    fetchByCitation: (p: any = {}) => this.query('a2aj', 'legal-fetch', p),
    coverage: (p: any = {}) => this.query('a2aj', 'legal-coverage', p),
  };

  // ─── Domain: Legislation ────────────────────────────

  legislation = {
    federalActs: (p: any = {}) => this.query('legislation', 'federal-acts', p),
    federalRegulations: (p: any = {}) => this.query('legislation', 'federal-regulations', p),
    provincialLegislation: (p: any = {}) => this.query('legislation', 'provincial-legislation', p),
  };

  // ─── Domain: GoC Spending ──────────────────────────

  gocSpending = {
    contracts: (p: any = {}) => this.query('goc-spending', 'contracts', p),
    spendingSummary: (p: any = {}) => this.query('goc-spending', 'spending-summary', p),
  };

  // ─── Domain: Financial Regulation ─────────────────
  financialRegulation = {
    data: (p: any = {}) => this.query('financial-regulation', 'data', p),
    crossReference: (p: any = {}) => this.query('financial-regulation', 'cross-reference', p),
  };

  // ─── Domain: Energy ───────────────────────────────
  energy = {
    data: (p: any = {}) => this.query('energy', 'data', p),
  };

  // ─── Domain: Real Estate ──────────────────────────
  realEstate = {
    data: (p: any = {}) => this.query('real-estate', 'data', p),
  };

  // ─── Domain: Watcher / Monitoring ─────────────────
  watcher = {
    status: (p: any = {}) => this.query('watcher', 'status', p),
    events: (p: any = {}) => this.query('watcher', 'events', p),
  };

  // ─── Advanced Clients ───────────────────────────────────────────────────────

  /**
   * Search across all domains
   */
  search!: SearchClient;
  /**
   * Ingest data into MapleSpike
   */
  ingestion!: IngestionClient;
  /**
   * Resolve entities across datasets
   */
  entityResolution!: EntityResolutionClient;

  // ─── MCP Integration ──────────────────────────────────────────

  /**
   * Get the MCP server URL for direct AI agent integration.
   * Set via QUILL_MCP_URL or defaults to production.
   */
  getMcpUrl(): string {
    return process?.env?.QUILL_MCP_URL ?? 'https://mcp.maplespike.ca';
  }

  /**
   * Get an MCP-ready configuration snippet for AI agents.
   */
  getMcpConfig(): { serverUrl: string; apiKey?: string } {
    return {
      serverUrl: this.getMcpUrl(),
      apiKey: this._apiKey,
    };
  }
}

export default MapleSpike;
