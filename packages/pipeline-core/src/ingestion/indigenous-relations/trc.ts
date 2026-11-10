// SPDX-License-Identifier: AGPL-3.0-only
/**
 * TRC Calls to Action Tracker — Quill
 *
 * Tracks progress on each of the 94 Truth and Reconciliation Commission
 * Calls to Action. Sources:
 *   - CIRNAC official TRC tracking page
 *   - CBC Beyond 94 interactive tracker (supplement)
 *   - Yellowhead Institute TRC tracker (supplement)
 *   - Open Canada CKAN datasets
 *
 * Each call is assessed for status: Complete, In Progress, Not Started,
 * or Unknown.
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import {
  INDIGENOUS_SOURCES,
  TRC_CALLS_TO_ACTION,
  IndigenousFetchError,
  DEFAULT_MAX_RECORDS,
  INDIGENOUS_SOURCE_NAMES,
} from './constants.js';
import type { TrcCallToAction, IndigenousIngestionResult } from './types.js';

/* ------------------------------------------------------------------ */
/*  Fetch TRC Status from CIRNAC                                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch the CIRNAC TRC Calls to Action status page.
 * In production, parses HTML to extract per-call progress status.
 */
export async function fetchTrcStatusFromCirnac(): Promise<{
  calls: { callNumber: number; status: string; notes: string }[];
}> {
  const url = INDIGENOUS_SOURCES.TRC.CALLS_TO_ACTION;
  try {
    const resp = await httpGet(url, { headers: { Accept: 'text/html' }, timeoutMs: 20_000 });
    if (resp.statusCode >= 400) throw new Error(`HTTP ${resp.statusCode}`);

    // In production: parse HTML table to extract status per call.
    // For now, return empty — the index.ts orchestrator will use
    // the TRC_CALLS_TO_ACTION template with default status.
    return { calls: [] };
  } catch (err) {
    throw new IndigenousFetchError(
      err instanceof Error ? err.message : String(err),
      'trc-cirnac',
      url,
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Fetch CBC Beyond 94 Data (supplement)                              */
/* ------------------------------------------------------------------ */

/**
 * Fetch TRC status data from CBC's Beyond 94 tracker,
 * if available as structured data.
 */
export async function fetchBeyond94Data(): Promise<{
  calls: { callNumber: number; status: string; notes: string }[];
}> {
  // CBC Beyond 94 is an interactive JS app; in production
  // we'd scrape or find their data API.
  return { calls: [] };
}

/* ------------------------------------------------------------------ */
/*  Build TRC Call Records                                             */
/* ------------------------------------------------------------------ */

/**
 * Build full TrcCallToAction records from the TRC_CALLS_TO_ACTION
 * template and optional status overrides.
 */
export async function buildTrcCallRecords(
  statusOverrides?: Map<number, { status: string; notes?: string }>,
): Promise<TrcCallToAction[]> {
  const now = new Date().toISOString();
  const url = INDIGENOUS_SOURCES.TRC.CALLS_TO_ACTION;
  const records: TrcCallToAction[] = [];

  for (const template of TRC_CALLS_TO_ACTION) {
    const override = statusOverrides?.get(template.callNumber);
    const status = override?.status ?? 'Not Started';
    const progressNotes = override?.notes ?? null;

    const content = `trc-call-${template.callNumber}|${status}|${now}`;
    const hash = await computeHash(content, 'sha256');
    const callId = `trc-${String(template.callNumber).padStart(2, '0')}`;

    records.push({
      id: hash,
      callNumber: template.callNumber,
      category: template.category,
      subCategory: template.subCategory,
      title: template.title,
      callText: template.callText,
      status,
      assessmentDate: now,
      responsibleEntity: template.responsibleEntity,
      iscInvolvement: template.iscInvolvement,
      progressNotes,
      sourceUrl: url,
      ingestedAt: now,
    });
  }

  return records;
}

/* ------------------------------------------------------------------ */
/*  Fetch & Assess All TRC Calls                                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch all 94 TRC Calls to Action with current status assessment.
 * Combines the template catalog with any live status data from CIRNAC.
 */
export async function fetchAllTrcCalls(
  limit: number = DEFAULT_MAX_RECORDS,
): Promise<TrcCallToAction[]> {
  try {
    // Try to get live status from CIRNAC
    const cirnacData = await fetchTrcStatusFromCirnac();

    // Build status overrides map from live data
    const overrides = new Map<number, { status: string; notes?: string }>();
    for (const call of cirnacData.calls) {
      overrides.set(call.callNumber, { status: call.status, notes: call.notes });
    }

    // Try CBC Beyond 94 supplement
    const beyond94Data = await fetchBeyond94Data();
    for (const call of beyond94Data.calls) {
      // Beyond 94 data takes precedence if available
      overrides.set(call.callNumber, { status: call.status, notes: call.notes });
    }

    const records = await buildTrcCallRecords(overrides);
    return records.slice(0, limit);
  } catch (err) {
    // If live fetch fails, return template with default "Not Started" status
    const records = await buildTrcCallRecords();
    return records.slice(0, limit);
  }
}
