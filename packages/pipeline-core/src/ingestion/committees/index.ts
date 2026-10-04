/**
 * Committee Ingestion — Quill
 *
 * Orchestrates the full pipeline for a committee:
 *   1. Fetch meeting list from ourcommons.ca
 *   2. For each unseen meeting, fetch evidence XML
 *   3. Parse XML into structured interventions
 *   4. Persist to D1 database with SHA-256 citation hashes
 *   5. Index speakers for cross-referencing
 *
 * Designed to run as a cron job (daily) or ad-hoc via CLI.
 *
 * Architecture:
 *   - Single-committee: ingestCommittee()
 *   - All committees: ingestAllCommittees()
 *   - In-camera only: ingestInCameraMeetings()
 */

import { fetchEvidenceXml, fetchMeetingList, CommitteeFetchError } from './fetcher.js';
import { parseEvidenceXml } from './parser.js';
import { detectInCameraMeetings } from './alerts.js';
import {
  COMMITTEES,
  COMMITTEE_MAP,
  SENATE_COMMITTEES,
  evidenceHtmlUrl,
  getBaseUrl,
} from './constants.js';
import {
  type D1Database,
  upsertMeeting,
  insertIntervention,
  upsertSpeaker,
  meetingExists,
  getLatestMeetingNumber,
} from './db.js';
import { upsertPerson } from '../../shared-db.js';
import type { Chamber, CommitteeIngestionResult, CommitteeMeeting, InCameraAlert, Intervention } from './types.js';


interface ScrapedMeetingLink {
  meetingNumber: number;
  date: string;
  subject: string | null;
  /** true if the meeting was in-camera (based on icon indicator) */
  inCamera: boolean;
}

/**
 * Parse committee meeting list HTML to extract meeting numbers and topics.
 *
 * The meeting list uses expandable <a> elements with meeting numbers
 * embedded in the link text (e.g. "Meeting 37").
 */
function scrapeMeetingList(html: string, acronym: string): ScrapedMeetingLink[] {
  const meetings: ScrapedMeetingLink[] = [];

  // Match meeting entries: they contain "Meeting N" pattern in link text
  // The HTML structure: each past meeting is a link with text containing
  // weekday/month/day/year + meeting number
  const meetingPattern = /(?:Meeting|Réunion)\s*(\d+)/gi;
  const datePattern = /(\w+day,|\w+ \d{1,2},)\s+(\w+\s+\d{1,2},\s+\d{4})/gi;

  // Extract all meeting numbers from the page
  const numbers: number[] = [];
  let m;
  while ((m = meetingPattern.exec(html)) !== null) {
    numbers.push(parseInt(m[1], 10));
  }

  // Extract dates
  const dates: string[] = [];
  while ((m = datePattern.exec(html)) !== null) {
    dates.push(m[2]);
  }

  // Deduplicate (same meeting won't appear twice)
  const uniqueNumbers = Array.from(new Set(numbers)).sort((a, b) => b - a); // newest first

  for (let i = 0; i < uniqueNumbers.length; i++) {
    meetings.push({
      meetingNumber: uniqueNumbers[i],
      date: dates[i] || '',
      subject: null,
      inCamera: false,
    });
  }

  return meetings;
}


/**
 * Ingest all new evidence for a given committee into the database.
 *
 * Steps:
 *   1. Fetch the meeting list
 *   2. Get the latest known meeting number from DB
 *   3. Fetch evidence XML for all unseen meetings
 *   4. Parse and persist
 */
export async function ingestCommittee(
  db: D1Database,
  acronym: string,
  options: {
    /** Override parliament number (default: 45) */
    parliament?: number;
    /** Override session number (default: 1) */
    session?: number;
    /** Chamber (default: 'commons') */
    chamber?: Chamber;
    /** Only fetch the most recent N meetings */
    limit?: number;
    /** Include already-ingested meetings (re-parse) */
    force?: boolean;
    /** Include meetings that mention in-camera indicators */
    includeInCamera?: boolean;
    /** Only fetch in-camera meetings */
    inCameraOnly?: boolean;
    /** Progress callback */
    onProgress?: (msg: string) => void;
  } = {},
): Promise<CommitteeIngestionResult> {
  const startTime = Date.now();
  const result: CommitteeIngestionResult = {
    committee: acronym,
    meetingsFound: 0,
    meetingsIngested: 0,
    interventionsIngested: 0,
    speakersFound: 0,
    inCameraCount: 0,
    errors: [],
    durationMs: 0,
  };

  const chamber = options.chamber ?? 'commons';
  const p = options.parliament ?? 45;
  const s = options.session ?? 1;
  const baseUrl = getBaseUrl(chamber);
  const log = options.onProgress ?? (() => {});

  try {
    // Phase 1: Fetch meeting list
    log(`[${acronym}] Fetching meeting list...`);
    const html = await fetchMeetingList(acronym, { baseUrl });
    const allMeetings = scrapeMeetingList(html, acronym)
      .filter(m => m.meetingNumber > 0);

    // Sort ascending (oldest first for ingestion order)
    const sorted = allMeetings.sort((a, b) => a.meetingNumber - b.meetingNumber);
    result.meetingsFound = sorted.length;
    log(`[${acronym}] Found ${sorted.length} meetings`);

    // Phase 2: Filter to new meetings
    let toIngest = sorted;
    if (!options.force) {
      const latestKnown = await getLatestMeetingNumber(db, acronym);
      if (latestKnown !== null) {
        toIngest = sorted.filter(m => m.meetingNumber > latestKnown);
        log(`[${acronym}] ${toIngest.length} new since meeting #${latestKnown}`);
      }
    }

    if (options.limit && toIngest.length > options.limit) {
      toIngest = toIngest.slice(-options.limit);
    }

    if (toIngest.length === 0) {
      log(`[${acronym}] No new meetings to ingest`);
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Phase 3: Fetch and parse each meeting
    for (const meeting of toIngest) {
      try {
        const xmlUrl = evidenceHtmlUrl(p, s, acronym, meeting.meetingNumber, baseUrl);
        log(`[${acronym}] Fetching meeting #${meeting.meetingNumber}...`);

        const xml = await fetchEvidenceXml(xmlUrl);
        const parsed = await parseEvidenceXml(xml, p, s, chamber);

        const cm = parsed.meeting;

        // Skip non-in-camera if inCameraOnly
        if (options.inCameraOnly && !cm.inCamera) {
          log(`[${acronym}] Skipping public meeting #${meeting.meetingNumber}`);
          continue;
        }

        if (cm.inCamera) {
          result.inCameraCount++;
        }

        // Skip if already exists (unless force)
        if (!options.force) {
          const exists = await meetingExists(db, acronym, cm.meetingNumber, chamber);
          if (exists) {
            log(`[${acronym}] Meeting #${meeting.meetingNumber} already ingested, skipping`);
            continue;
          }
        }

        await upsertMeeting(db, cm);
        result.meetingsIngested++;

        const seenSpeakers = new Set<string>();
        for (const inv of parsed.interventions) {
          await insertIntervention(db, inv);
          result.interventionsIngested++;

          // Track speakers
          if (!seenSpeakers.has(inv.speakerName)) {
            seenSpeakers.add(inv.speakerName);
            await upsertSpeaker(db, inv.speakerName, inv.speakerAffiliation, inv.speakerParty, cm.date);
            // Also upsert to shared persons table (engine consumption)
            try {
              upsertPerson(inv.speakerName, {
                firstName: inv.speakerName.split(" ")[0],
                lastName: inv.speakerName.split(" ").slice(1).join(" "),
                province: cm.committeeAcronym ? undefined : undefined,
                source: "committees",
                rawData: { affiliation: inv.speakerAffiliation, party: inv.speakerParty, committee: cm.committeeAcronym },
              });
            } catch (e) {
              // Non-fatal: shared table may not exist yet
            }
          }
        }
        result.speakersFound += seenSpeakers.size;

        log(`[${acronym}] Meeting #${meeting.meetingNumber}: ${parsed.interventions.length} interventions` +
          (cm.inCamera ? ' [IN-CAMERA]' : '') +
          (cm.inCameraNote ? ` — ${cm.inCameraNote}` : ''));

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Meeting #${meeting.meetingNumber}: ${msg}`);
        log(`[${acronym}] ERROR meeting #${meeting.meetingNumber}: ${msg}`);
      }
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Committee ${acronym}: ${msg}`);
    log(`[${acronym}] FATAL: ${msg}`);
  }

  result.durationMs = Date.now() - startTime;
  log(`[${acronym}] Done in ${result.durationMs}ms: ${result.meetingsIngested}` +
    ` meetings, ${result.interventionsIngested} interventions, ${result.inCameraCount} in-camera` +
    (result.errors.length > 0 ? `, ${result.errors.length} errors` : ''));

  return result;
}


/**
 * Ingest committees for a specific chamber.
 * Returns results keyed by committee acronym.
 */
async function ingestChamberCommittees(
  db: D1Database,
  chamber: Chamber,
  options: {
    parliament?: number;
    session?: number;
    limit?: number;
    force?: boolean;
    includeInCamera?: boolean;
    inCameraOnly?: boolean;
    /** Only these committees (default: all for the chamber) */
    committees?: string[];
    /** Concurrency limit (default: 3) */
    concurrency?: number;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<Record<string, CommitteeIngestionResult>> {
  const committeeList = chamber === 'senate' ? SENATE_COMMITTEES : COMMITTEES;
  const targets = options.committees
    ? committeeList.filter(c => options.committees!.includes(c.acronym))
    : committeeList;

  const results: Record<string, CommitteeIngestionResult> = {};
  const concurrency = options.concurrency ?? 3;
  const log = options.onProgress ?? (() => {});

  log(`[${chamber}] Ingesting ${targets.length} committees (concurrency: ${concurrency})...`);

  // Process in batches
  for (let i = 0; i < targets.length; i += concurrency) {
    const batch = targets.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(c => ingestCommittee(db, c.acronym, { ...options, chamber })),
    );

    for (let j = 0; j < batch.length; j++) {
      results[batch[j].acronym] = batchResults[j];
    }
  }

  // Summary
  const totalMeetings = Object.values(results).reduce((s, r) => s + r.meetingsIngested, 0);
  const totalInterventions = Object.values(results).reduce((s, r) => s + r.interventionsIngested, 0);
  const totalInCamera = Object.values(results).reduce((s, r) => s + r.inCameraCount, 0);
  const totalErrors = Object.values(results).reduce((s, r) => s + r.errors.length, 0);
  log(`[${chamber}] Summary: ${targets.length} committees, ${totalMeetings} meetings, ${totalInterventions} interventions, ${totalInCamera} in-camera, ${totalErrors} errors`);

  return results;
}

export async function ingestAllCommittees(
  db: D1Database,
  options: {
    parliament?: number;
    session?: number;
    limit?: number;
    force?: boolean;
    includeInCamera?: boolean;
    inCameraOnly?: boolean;
    /** Only these committees (default: all) */
    committees?: string[];
    /** Concurrency limit (default: 3) */
    concurrency?: number;
    /** Also include Senate committees (default: false) */
    includeSenate?: boolean;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<Record<string, CommitteeIngestionResult>> {
  const log = options.onProgress ?? (() => {});

  const results: Record<string, CommitteeIngestionResult> = {};

  // House of Commons
  const commonsResults = await ingestChamberCommittees(db, 'commons', options);
  Object.assign(results, commonsResults);

  // Senate (if requested)
  if (options.includeSenate) {
    const senateResults = await ingestChamberCommittees(db, 'senate', options);
    Object.assign(results, senateResults);
  }

  // Overall summary
  const totalMeetings = Object.values(results).reduce((s, r) => s + r.meetingsIngested, 0);
  const totalInterventions = Object.values(results).reduce((s, r) => s + r.interventionsIngested, 0);
  const totalInCamera = Object.values(results).reduce((s, r) => s + r.inCameraCount, 0);
  const totalErrors = Object.values(results).reduce((s, r) => s + r.errors.length, 0);
  const chamberCount = options.includeSenate ? 2 : 1;
  log(`\n=== Overall Summary ===`);
  log(`Chambers: ${chamberCount}, Committees: ${Object.keys(results).length}, Meetings: ${totalMeetings}, Interventions: ${totalInterventions}, In-Camera: ${totalInCamera}, Errors: ${totalErrors}`);

  return results;
}

export async function ingestSenateCommittees(
  db: D1Database,
  options: {
    parliament?: number;
    session?: number;
    limit?: number;
    force?: boolean;
    includeInCamera?: boolean;
    inCameraOnly?: boolean;
    /** Only these committees (default: all Senate) */
    committees?: string[];
    /** Concurrency limit (default: 3) */
    concurrency?: number;
    onProgress?: (msg: string) => void;
  } = {},
): Promise<Record<string, CommitteeIngestionResult>> {
  return ingestChamberCommittees(db, 'senate', options);
}

/**
 * Convenience: ingest ALL in-camera meetings across all committees.
 * This is the primary entry point for the "in-camera tracking" feature.
 */
export async function ingestInCameraMeetings(
  db: D1Database,
): Promise<Record<string, CommitteeIngestionResult>> {
  return ingestAllCommittees(db, {
    inCameraOnly: true,
    onProgress: () => {},
  });
}

export { detectInCameraMeetings } from './alerts.js';
export type { InCameraAlert } from './types.js';
export { type EvidenceStory, buildEvidenceStories, searchCommitteeEvidence } from './pipeline.js';
export { COMMITTEE_DDL } from './db.js';
