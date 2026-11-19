// SPDX-License-Identifier: AGPL-3.0-only
/**
 * SDK example — verify a claim hash against the public Quill REST surface.
 *
 * The claim store is exposed without an MCP client:
 *
 *   POST /v1/claims/verify        recompute the SHA-256 of canonical JSON of
 *                                 a payload and compare it to a claimed hash
 *   GET  /v1/claims/verify/{hash} look a claim hash up in the claim store
 *
 * Both routes are public (no API key required), which makes them the trust
 * primitive for non-MCP callers. This example shows the first route plus the
 * offline `sha256sum` recipe the API returns.
 *
 * Run it:
 *   pnpm --filter @maplespike/sdk exec tsx examples/verify-claim.ts
 *
 * Environment:
 *   QUILL_API_URL  base URL of the API server (default http://127.0.0.1:8085)
 *
 * The helpers accept an injectable `fetchImpl` so the same code can be run
 * against a mock in tests — see packages/sdk/src/examples.test.ts.
 */

import { createHash } from 'node:crypto';
import type { QuillResponse } from '@maplespike/sdk';

/** Response of `POST /v1/claims/verify`. */
export interface ClaimHashVerification {
  /** True only when a claimed hash was supplied and it matches. */
  verified: boolean;
  /** SHA-256 recomputed from the canonical JSON of `data`. */
  recomputed_sha256: string;
  /** null when no claimed hash was supplied. */
  matches_claimed: boolean | null;
  /** Shell command that reproduces the hash locally. */
  verify_command: string;
}

/** Response of `GET /v1/claims/verify/{hash}`. */
export interface ClaimLookupResult {
  verified: boolean;
  found: boolean;
  sha256: string;
  source: string;
  source_name: string;
  source_url: string;
  retrieved_at: string | null;
  license: string | null;
  provenance_evidence?: unknown;
}

/** Structural subset of `fetch` so the example is mockable. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const DEFAULT_BASE_URL = 'http://127.0.0.1:8085';

/**
 * Canonical JSON: object keys sorted at every depth, arrays preserved.
 * Mirrors `canonicalJson` in packages/pipeline-core/src/claims/index.ts — the
 * representation the API hashes, so a local hash can be compared to it.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(record).sort()) sorted[key] = sortValue(record[key]);
    return sorted;
  }
  return value;
}

/** SHA-256 (hex) of a string, matching the API's `computeHash(…, 'sha256')`. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export interface VerifyClaimOptions {
  /** Payload to hash — any JSON value. */
  data: unknown;
  /** Optional claimed hash, with or without the `sha256:` / `sha256-` prefix. */
  sha256?: string;
  baseUrl?: string;
  apiKey?: string;
  fetchImpl?: FetchLike;
}

function baseUrlOf(value?: string): string {
  return (value ?? process.env.QUILL_API_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
}

async function readError(response: Response): Promise<string> {
  const text = await response.text();
  return `HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`;
}

/**
 * Recompute a payload hash with the API and optionally compare it to a claim.
 * Public route — no key required.
 */
export async function verifyClaim(
  options: VerifyClaimOptions,
): Promise<QuillResponse<ClaimHashVerification>> {
  const { data, sha256, apiKey, fetchImpl = fetch } = options;
  const body: { data: unknown; sha256?: string } = { data };
  if (sha256) body.sha256 = sha256;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (apiKey) headers['X-API-Key'] = apiKey;

  const response = await fetchImpl(`${baseUrlOf(options.baseUrl)}/v1/claims/verify`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Claim verification failed — ${await readError(response)}`);
  return (await response.json()) as QuillResponse<ClaimHashVerification>;
}

/** Look up a claim hash in the Quill claim store. Public route. */
export async function lookupClaim(options: {
  hash: string;
  baseUrl?: string;
  apiKey?: string;
  fetchImpl?: FetchLike;
}): Promise<QuillResponse<ClaimLookupResult>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.apiKey) headers['X-API-Key'] = options.apiKey;
  const fetchImpl = options.fetchImpl ?? fetch;

  const hash = options.hash.replace(/^sha256[:-]/, '');
  const response = await fetchImpl(
    `${baseUrlOf(options.baseUrl)}/v1/claims/verify/${encodeURIComponent(hash)}`,
    { headers },
  );
  if (!response.ok) throw new Error(`Claim lookup failed — ${await readError(response)}`);
  return (await response.json()) as QuillResponse<ClaimLookupResult>;
}

/** Demo payload — an aggregate public statistic, no personal data. */
export const SAMPLE_CLAIM = {
  claim: 'House of Commons seats after the 2021 federal election',
  value: 338,
  sourceName: 'Elections Canada',
  sourceUrl: 'https://www.elections.ca/',
};

export async function main(): Promise<void> {
  const canonical = canonicalJson(SAMPLE_CLAIM);
  const localHash = sha256Hex(canonical);
  console.log('canonical JSON:', canonical);
  console.log('local sha256: ', localHash);
  console.log("offline check: echo -n '<canonical json>' | sha256sum");

  const result = await verifyClaim({ data: SAMPLE_CLAIM, sha256: localHash });
  console.log('verified:      ', result.data.verified);
  console.log('recomputed:    ', result.data.recomputed_sha256);
  console.log('matches claim: ', result.data.matches_claimed);
  console.log('reproduce with:', result.data.verify_command);
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  !!process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('/verify-claim.ts');

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
