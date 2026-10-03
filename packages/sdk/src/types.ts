// ---------------------------------------------------------------------------
// MapleSpike SDK — Core type definitions
// ---------------------------------------------------------------------------

/** Structured query payload returned by the API */
export interface MapleSpikeResponse<T = unknown> {
  data: T;
  meta: ResponseMeta;
  quality: ResponseQuality;
  citation: Citation;
}

/** Request metadata */
export interface ResponseMeta {
  requestId: string;
  agent: string;
  action: string;
  authMethod: 'apiKey' | 'jwt' | 'none';
  creditsCharged: number;
  cacheStatus: 'hit' | 'miss' | 'mock';
  durationMs: number;
}

/** Data-quality signals */
export interface ResponseQuality {
  /** How fresh the data is, in seconds */
  freshness_seconds: number;
  /** Upstream source uptime over the last 7 days (0.0 – 1.0) */
  source_uptime_7d: number;
  /** Confidence score (0.0 – 1.0) */
  confidence: number;
  /** Certainty score derived from source reliability (0.0 – 1.0) */
  certainty_score: number;
}

/** Source attribution — matches pipeline-core attestation.Citation */
export interface Citation {
  source_name: string;
  source_url: string;
  license: string;
  data_hash: string;
  retrieved_at: string | null;
  update_frequency?: string;
  original_format?: string;
  citation_text?: string;
  citation_footnote?: string;
  merkle_root?: string;
  signature?: string;
  signer_key_id?: string;
}

// ─── Query options ──────────────────────────────────────────────────────────

/** Options that modify how a query is sent or transformed */
export interface QueryOptions {
  /** Use mock data instead of hitting the live API */
  _mock?: boolean;
  /** Comma-separated field projection */
  _fields?: string;
  /** Output format hint: normal, compact, full */
  _format?: 'normal' | 'compact' | 'full';
  /** Max records to return */
  _limit?: number;
 /** Page number for paginated results */
  _page?: number;
 /** Normalize response structure */
  _normalize?: boolean;
 /** Unit system for measurements */
  _units?: string;
 /** Request a summary instead of raw data */
  _summary?: boolean;
}

// ─── Authentication ─────────────────────────────────────────────────────────

export interface AuthConfig {
  apiKey?: string;
  jwtToken?: string;
}

// ─── SDK configuration ──────────────────────────────────────────────────────

export interface SdkConfig extends AuthConfig {
  baseUrl?: string;
  /** Language for error messages: 'en' (default) or 'fr' */
  lang?: 'en' | 'fr';
}

// ─── Error types ────────────────────────────────────────────────────────────

export interface MapleSpikeApiError {
  status: number;
  code: string;
  message: string;
  requestId?: string;
  /** Bilingual messages: English and French */
  messageFr?: string;
}

export class MapleSpikeError extends Error {
  public status: number;
  public code: string;
  public requestId?: string;

  constructor(err: MapleSpikeApiError) {
    super(err.message);
    this.name = 'MapleSpikeError';
    this.status = err.status;
    this.code = err.code;
    this.requestId = err.requestId;
  }
}

// ─── Agent / Action listings ────────────────────────────────────────────────

export interface ActionDefinition {
  id: string;
  description: string;
  requiredParams: string[];
  optionalParams: string[];
  sampleCurl: string;
}

export interface AgentDefinition {
  name: string;
  description: string;
  actions: ActionDefinition[];
}

// ─── Agent proxy (chained API) ──────────────────────────────────────────────

export interface AgentProxy {
  agent(name: string): AgentProxy;
  action(action: string, params?: Record<string, unknown>, options?: QueryOptions): Promise<MapleSpikeResponse<unknown>>;
  readonly _agent: string;
}
