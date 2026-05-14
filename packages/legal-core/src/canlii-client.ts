/**
 * CanLII REST API Client
 *
 * Official CanLII API v1 — browse case law, legislation, and citations.
 * Free API key required: https://www.canlii.org/en/feedback/feedback.html
 * API docs: https://github.com/canlii/API_documentation
 *
 * Base URL: https://api.canlii.org/v1
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CanliiCaseBrowseResult {
  caseId: Record<string, string>;
  caseName: Record<string, string>;
  court: Record<string, string>;
  docketNumber: string;
  decisionDate: string;
  url: string;
}

export interface CanliiSearchOptions {
  /** Court-level filter: scc, fed, ont, bc, ab, etc. */
  court?: string;
  /** Free-text query */
  query?: string;
  /** Page number (default 0) */
  offset?: number;
  /** Results per page (max 50) */
  maxResults?: number;
  /** Language: en or fr (default en) */
  lang?: string;
  /** Date range start YYYY-MM-DD */
  dateFrom?: string;
  /** Date range end YYYY-MM-DD */
  dateTo?: string;
}

export interface CanliiLegislationResult {
  legislationId: Record<string, string>;
  title: Record<string, string>;
  jurisdiction: Record<string, string>;
  url: string;
}

/* ------------------------------------------------------------------ */
/*  Client                                                             */
/* ------------------------------------------------------------------ */

const DEFAULT_BASE = 'https://api.canlii.org/v1';
const DEFAULT_LANG = 'en';

export class CanliiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: { apiKey: string; baseUrl?: string }) {
    if (!config.apiKey) throw new Error('CanLII API key required — get one at https://www.canlii.org/en/feedback/feedback.html');
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || DEFAULT_BASE;
  }

  private async fetch<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}${path.includes('?') ? '&' : '?'}api_key=${this.apiKey}`;
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) throw new Error(`CanLII API ${resp.status}: ${resp.statusText}`);
    return resp.json() as Promise<T>;
  }

  /** Browse recent case law with optional filters */
  async browseCases(opts: CanliiSearchOptions = {}): Promise<CanliiCaseBrowseResult[]> {
    const lang = opts.lang || DEFAULT_LANG;
    const court = opts.court || '';
    const path = `/caseBrowse/${lang}/${court}?offset=${opts.offset || 0}&maxResults=${opts.maxResults || 20}`;
    const data = await this.fetch<{ cases: CanliiCaseBrowseResult[] }>(path);
    return data.cases || [];
  }

  /** Full-text search across case law */
  async searchCases(opts: CanliiSearchOptions = {}): Promise<CanliiCaseBrowseResult[]> {
    const lang = opts.lang || DEFAULT_LANG;
    const q = opts.query ? `&q=${encodeURIComponent(opts.query)}` : '';
    const dateFrom = opts.dateFrom ? `&dateFrom=${opts.dateFrom}` : '';
    const dateTo = opts.dateTo ? `&dateTo=${opts.dateTo}` : '';
    const path = `/caseBrowse/${lang}/?offset=${opts.offset || 0}&maxResults=${opts.maxResults || 20}${q}${dateFrom}${dateTo}`;
    const data = await this.fetch<{ cases: CanliiCaseBrowseResult[] }>(path);
    return data.cases || [];
  }

  /** Browse legislation */
  async browseLegislation(lang: string = DEFAULT_LANG): Promise<CanliiLegislationResult[]> {
    const path = `/legislationBrowse/${lang}/`;
    const data = await this.fetch<{ legislation: CanliiLegislationResult[] }>(path);
    return data.legislation || [];
  }

  /** Get case citation graph (cited/citing cases) */
  async getCitationGraph(caseId: string, lang: string = DEFAULT_LANG): Promise<Record<string, unknown>> {
    const path = `/case/${lang}/${caseId}/citations`;
    return this.fetch(path);
  }
}
