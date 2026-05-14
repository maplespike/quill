/**
 * A2AJ Open Legal Corpus Client
 *
 * Access to Algorithmic Justice (a2aj.ca) — 116,000+ court/tribunal decisions
 * and 5,000+ statutes/regulations. Fully open, no API key required.
 *
 * API: https://api.a2aj.ca/
 * Docs: https://api.a2aj.ca/docs
 * GitHub: https://github.com/a2aj-ca/canadian-legal-data
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface A2ajCourtDecision {
  id: string;
  caseName: string;
  court: string;
  decisionDate: string;
  citation: string | null;
  url: string;
  summary: string | null;
}

export interface A2ajStatute {
  id: string;
  title: string;
  jurisdiction: string;
  year: number | null;
  url: string;
}

export interface A2ajSearchResult<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface A2ajSearchOptions {
  query?: string;
  court?: string;
  jurisdiction?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

/* ------------------------------------------------------------------ */
/*  Client                                                             */
/* ------------------------------------------------------------------ */

const API_BASE = 'https://api.a2aj.ca';

export class A2ajClient {
  private baseUrl: string;

  constructor(config?: { baseUrl?: string }) {
    this.baseUrl = config?.baseUrl || API_BASE;
  }

  private async fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: signal || AbortSignal.timeout(10_000),
    });
    if (!resp.ok) throw new Error(`A2AJ API ${resp.status}: ${resp.statusText}`);
    return resp.json() as Promise<T>;
  }

  /** Search court/tribunal decisions */
  async searchDecisions(opts: A2ajSearchOptions = {}): Promise<A2ajSearchResult<A2ajCourtDecision>> {
    const params = new URLSearchParams();
    if (opts.query) params.set('q', opts.query);
    if (opts.court) params.set('court', opts.court);
    if (opts.jurisdiction) params.set('jurisdiction', opts.jurisdiction);
    if (opts.dateFrom) params.set('date_from', opts.dateFrom);
    if (opts.dateTo) params.set('date_to', opts.dateTo);
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.offset) params.set('offset', String(opts.offset));
    const qs = params.toString();
    return this.fetchJson(`/decisions/${qs ? `?${qs}` : ''}`);
  }

  /** Browse statutes/regulations */
  async browseStatutes(opts: A2ajSearchOptions = {}): Promise<A2ajSearchResult<A2ajStatute>> {
    const params = new URLSearchParams();
    if (opts.jurisdiction) params.set('jurisdiction', opts.jurisdiction);
    if (opts.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    return this.fetchJson(`/statutes/${qs ? `?${qs}` : ''}`);
  }

  /** Get a single decision by ID */
  async getDecision(id: string): Promise<A2ajCourtDecision> {
    return this.fetchJson(`/decisions/${id}/`);
  }

  /** Get a single statute by ID */
  async getStatute(id: string): Promise<A2ajStatute> {
    return this.fetchJson(`/statutes/${id}/`);
  }

  /** Check API health */
  async ping(): Promise<{ status: string }> {
    return this.fetchJson('/health/');
  }
}
