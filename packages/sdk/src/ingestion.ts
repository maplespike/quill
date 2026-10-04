// ---------------------------------------------------------------------------
// MapleSpike SDK — Ingestion functionality
// ---------------------------------------------------------------------------
import type { QuillResponse, QueryOptions } from './types.js';
import { resolveBaseUrl, buildUrl, buildHeaders, parseResponse } from './query.js';

/** Ingestion job status */
export type IngestionJobStatus = 'pending' | 'running' | 'completed' | 'failed';

/** Ingestion job details */
export interface IngestionJob {
  id: string;
  status: IngestionJobStatus;
  sourceType: string;
  sourceUrl?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  recordsProcessed: number;
  totalRecords?: number;
  metadata?: Record<string, unknown>;
}

/** Ingestion request parameters */
export interface IngestionRequest {
  /** Source type (e.g., 'url', 'file', 'stream') */
  sourceType: string;
  /** Source URL or identifier */
  sourceUrl?: string;
  /** File data for direct upload */
  fileData?: string | ArrayBuffer;
  /** File MIME type */
  mimeType?: string;
  /** Domain to ingest into */
  domain: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Validation options */
  validate?: boolean;
  /** Deduplication enabled */
  deduplicate?: boolean;
}

/** Ingestion result */
export interface IngestionResult {
  jobId: string;
  status: IngestionJobStatus;
  message: string;
  recordsProcessed: number;
}

/**
 * Ingestion client for uploading data to MapleSpike
 */
export class IngestionClient {
  private _apiKey?: string;
  private _jwtToken?: string;
  private _baseUrl: string;

  constructor(config: { apiKey?: string; jwtToken?: string; baseUrl?: string } = {}) {
    this._apiKey = config.apiKey;
    this._jwtToken = config.jwtToken;
    this._baseUrl = resolveBaseUrl(config.baseUrl);
  }

  /**
   * Submit a new ingestion job
   */
  async ingest(request: IngestionRequest): Promise<QuillResponse<IngestionResult>> {
    const url = buildUrl(this._baseUrl, 'ingestion', 'submit', {}, {});
    const headers = buildHeaders(this._apiKey, this._jwtToken);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    return parseResponse<IngestionResult>(response);
  }

  /**
   * Get ingestion job status
   */
  async getJob(jobId: string): Promise<QuillResponse<IngestionJob>> {
    const url = buildUrl(this._baseUrl, 'ingestion', 'status', { jobId }, {});
    const headers = buildHeaders(this._apiKey, this._jwtToken);
    const response = await fetch(url, { headers, method: 'GET' });
    return parseResponse<IngestionJob>(response);
  }

  /**
   * List recent ingestion jobs
   */
  async listJobs(options: { limit?: number; status?: IngestionJobStatus; domain?: string } = {}): Promise<QuillResponse<IngestionJob[]>> {
    const url = buildUrl(this._baseUrl, 'ingestion', 'list', options, {});
    const headers = buildHeaders(this._apiKey, this._jwtToken);
    const response = await fetch(url, { headers, method: 'GET' });
    return parseResponse<IngestionJob[]>(response);
  }

  /**
   * Cancel a running ingestion job
   */
  async cancelJob(jobId: string): Promise<QuillResponse<{ success: boolean; message: string }>> {
    const url = buildUrl(this._baseUrl, 'ingestion', 'cancel', { jobId }, {});
    const headers = buildHeaders(this._apiKey, this._jwtToken);
    const response = await fetch(url, {
      method: 'POST',
      headers,
    });
    return parseResponse<{ success: boolean; message: string }>(response);
  }

  /**
   * Delete an ingestion job and its data
   */
  async deleteJob(jobId: string): Promise<QuillResponse<{ success: boolean; message: string }>> {
    const url = buildUrl(this._baseUrl, 'ingestion', 'delete', { jobId }, {});
    const headers = buildHeaders(this._apiKey, this._jwtToken);
    const response = await fetch(url, {
      method: 'DELETE',
      headers,
    });
    return parseResponse<{ success: boolean; message: string }>(response);
  }

  /**
   * Get ingestion statistics
   */
  async stats(): Promise<QuillResponse<{ totalJobs: number; activeJobs: number; recordsIngested: number }>> {
    const url = buildUrl(this._baseUrl, 'ingestion', 'stats', {}, {});
    const headers = buildHeaders(this._apiKey, this._jwtToken);
    const response = await fetch(url, { headers, method: 'GET' });
    return parseResponse<{ totalJobs: number; activeJobs: number; recordsIngested: number }>(response);
  }

  /**
   * Validate data before ingestion
   */
  async validate(request: IngestionRequest): Promise<QuillResponse<{ valid: boolean; errors: string[]; warnings: string[] }>> {
    const url = buildUrl(this._baseUrl, 'ingestion', 'validate', {}, {});
    const headers = buildHeaders(this._apiKey, this._jwtToken);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...request, dryRun: true }),
    });
    return parseResponse<{ valid: boolean; errors: string[]; warnings: string[] }>(response);
  }
}