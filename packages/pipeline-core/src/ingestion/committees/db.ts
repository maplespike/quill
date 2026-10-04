/**
 * Committee Database — Quill
 *
 * D1 SQLite persistence for committee meetings, interventions, and speakers.
 * Uses the same D1 API pattern as the existing MapleSpike-Gazette schema.
 */

import type { Chamber, CommitteeMeeting, Intervention, CommitteeSpeaker } from './types.js';


export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  exec(sql: string): Promise<{ success: boolean; error?: string }>;
  batch(stmts: D1PreparedStatement[]): Promise<{ results?: unknown[]; success: boolean }[]>;
}

export interface D1PreparedStatement {
  bind(...args: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[]; success: boolean }>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: { changes: number } }>;
}


export const COMMITTEE_DDL = `
CREATE TABLE IF NOT EXISTS committee_meetings (
  id TEXT PRIMARY KEY,
  committee_acronym TEXT NOT NULL,
  committee_name TEXT NOT NULL,
  chamber TEXT NOT NULL DEFAULT 'commons',
  parliament INTEGER NOT NULL,
  session INTEGER NOT NULL,
  meeting_number INTEGER NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  in_camera INTEGER DEFAULT 0,
  in_camera_note TEXT,
  evidence_url TEXT NOT NULL,
  xml_url TEXT NOT NULL,
  subject TEXT,
  ingested_at TEXT NOT NULL,
  UNIQUE(chamber, parliament, session, committee_acronym, meeting_number)
);

CREATE INDEX IF NOT EXISTS idx_cm_committee ON committee_meetings(committee_acronym);
CREATE INDEX IF NOT EXISTS idx_cm_date ON committee_meetings(date DESC);
CREATE INDEX IF NOT EXISTS idx_cm_in_camera ON committee_meetings(in_camera);
CREATE INDEX IF NOT EXISTS idx_cm_acronym_date ON committee_meetings(committee_acronym, date DESC);

CREATE TABLE IF NOT EXISTS committee_interventions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meeting_id TEXT NOT NULL REFERENCES committee_meetings(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL,
  speaker_name TEXT NOT NULL,
  speaker_affiliation TEXT,
  speaker_party TEXT,
  speaker_role TEXT,
  intervention_type TEXT,
  language TEXT DEFAULT 'EN',
  text TEXT NOT NULL,
  timestamp TEXT,
  UNIQUE(meeting_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_ci_meeting ON committee_interventions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_ci_speaker ON committee_interventions(speaker_name);
CREATE INDEX IF NOT EXISTS idx_ci_party ON committee_interventions(speaker_party);
CREATE INDEX IF NOT EXISTS idx_ci_search ON committee_interventions(speaker_name, speaker_party, language);

CREATE TABLE IF NOT EXISTS committee_speakers (
  name TEXT PRIMARY KEY,
  latest_affiliation TEXT,
  latest_party TEXT,
  total_appearances INTEGER DEFAULT 0,
  first_seen TEXT,
  last_seen TEXT
);

CREATE INDEX IF NOT EXISTS idx_cs_party ON committee_speakers(latest_party);
`;


export async function upsertMeeting(db: D1Database, meeting: CommitteeMeeting): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO committee_meetings
      (id, committee_acronym, committee_name, chamber, parliament, session, meeting_number,
       date, start_time, end_time, in_camera, in_camera_note,
       evidence_url, xml_url, subject, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    meeting.id,
    meeting.committeeAcronym,
    meeting.committeeName,
    meeting.chamber,
    meeting.parliament,
    meeting.session,
    meeting.meetingNumber,
    meeting.date,
    meeting.startTime,
    meeting.endTime,
    meeting.inCamera ? 1 : 0,
    meeting.inCameraNote,
    meeting.evidenceUrl,
    meeting.xmlUrl,
    meeting.subject,
    meeting.ingestedAt,
  );

  const result = await stmt.run();
  return result.success;
}

export async function insertIntervention(
  db: D1Database,
  intervention: Intervention,
): Promise<boolean> {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO committee_interventions
      (meeting_id, sequence, speaker_name, speaker_affiliation, speaker_party,
       speaker_role, intervention_type, language, text, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    intervention.meetingId,
    intervention.sequence,
    intervention.speakerName,
    intervention.speakerAffiliation,
    intervention.speakerParty,
    intervention.speakerRole,
    intervention.interventionType,
    intervention.language,
    intervention.text,
    intervention.timestamp,
  );

  const result = await stmt.run();
  return result.success;
}

export async function upsertSpeaker(
  db: D1Database,
  speakerName: string,
  affiliation: string | null,
  party: string | null,
  meetingDate: string,
): Promise<boolean> {
  const existing = await db.prepare(
    'SELECT * FROM committee_speakers WHERE name = ?',
  ).bind(speakerName).first<CommitteeSpeaker>();

  if (existing) {
    const stmt = db.prepare(`
      UPDATE committee_speakers
      SET latest_affiliation = COALESCE(?, latest_affiliation),
          latest_party = COALESCE(?, latest_party),
          total_appearances = total_appearances + 1,
          last_seen = MAX(last_seen, ?)
      WHERE name = ?
    `).bind(affiliation, party, meetingDate, speakerName);
    await stmt.run();
  } else {
    const stmt = db.prepare(`
      INSERT INTO committee_speakers
        (name, latest_affiliation, latest_party, total_appearances, first_seen, last_seen)
      VALUES (?, ?, ?, 1, ?, ?)
    `).bind(speakerName, affiliation, party, meetingDate, meetingDate);
    await stmt.run();
  }

  return true;
}

export async function meetingExists(
  db: D1Database,
  acronym: string,
  meetingNumber: number,
  chamber: Chamber = 'commons',
): Promise<boolean> {
  const row = await db.prepare(
    'SELECT 1 FROM committee_meetings WHERE committee_acronym = ? AND meeting_number = ? AND chamber = ? LIMIT 1',
  ).bind(acronym, meetingNumber, chamber).first();
  return row !== null;
}

export async function getLatestMeetingNumber(
  db: D1Database,
  acronym: string,
): Promise<number | null> {
  const row = await db.prepare(
    'SELECT meeting_number FROM committee_meetings WHERE committee_acronym = ? ORDER BY meeting_number DESC LIMIT 1',
  ).bind(acronym).first<{ meeting_number: number }>();
  return row?.meeting_number ?? null;
}

export async function searchTranscripts(
  db: D1Database,
  query: string,
  options: {
    limit?: number;
    committee?: string;
    party?: string;
    speaker?: string;
    inCameraOnly?: boolean;
  } = {},
): Promise<Intervention[]> {
  let sql = `
    SELECT ci.*, cm.committee_acronym, cm.meeting_number, cm.date, cm.in_camera, cm.evidence_url, cm.subject
    FROM committee_interventions ci
    JOIN committee_meetings cm ON ci.meeting_id = cm.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (query) {
    sql += ' AND ci.text LIKE ?';
    params.push(`%${query}%`);
  }
  if (options.committee) {
    sql += ' AND cm.committee_acronym = ?';
    params.push(options.committee);
  }
  if (options.party) {
    sql += ' AND ci.speaker_party = ?';
    params.push(options.party);
  }
  if (options.speaker) {
    sql += ' AND ci.speaker_name LIKE ?';
    params.push(`%${options.speaker}%`);
  }
  if (options.inCameraOnly) {
    sql += ' AND cm.in_camera = 1';
  }

  sql += ` ORDER BY cm.date DESC, ci.sequence ASC LIMIT ?`;
  params.push(options.limit ?? 50);

  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<Intervention>();
  return result.results ?? [];
}

export async function getInCameraCount(db: D1Database): Promise<number> {
  const row = await db.prepare(
    'SELECT COUNT(*) as cnt FROM committee_meetings WHERE in_camera = 1',
  ).first<{ cnt: number }>();
  return row?.cnt ?? 0;
}

export async function resetCommitteeTables(db: D1Database): Promise<void> {
  await db.exec('DROP TABLE IF EXISTS committee_interventions');
  await db.exec('DROP TABLE IF EXISTS committee_meetings');
  await db.exec('DROP TABLE IF EXISTS committee_speakers');
  await db.exec(COMMITTEE_DDL);
}
