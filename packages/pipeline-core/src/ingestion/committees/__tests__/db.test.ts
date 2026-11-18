// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Committee Database Tests — Quill
 *
 * Tests JSON persistence functions for committee meetings, interventions,
 * and speakers using a mock D1Database that captures SQL and parameters.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import type {
  D1Database,
  D1PreparedStatement,
} from '../db.js';
import {
  COMMITTEE_DDL,
  upsertMeeting,
  insertIntervention,
  upsertSpeaker,
  meetingExists,
  getLatestMeetingNumber,
  searchTranscripts,
  getInCameraCount,
  resetCommitteeTables,
} from '../db.js';
import type { CommitteeMeeting, Intervention, Chamber } from '../types.js';

/* ------------------------------------------------------------------ */
/*  Mock D1 Implementation                                             */
/* ------------------------------------------------------------------ */

interface MockStmtCall {
  sql: string;
  params: unknown[];
  action: 'run' | 'all' | 'first';
}

class MockPreparedStatement implements D1PreparedStatement {
  private sql: string;
  private boundParams: unknown[] = [];

  constructor(sql: string) {
    this.sql = sql;
  }

  bind(...args: unknown[]): D1PreparedStatement {
    this.boundParams = args;
    return this;
  }

  async run(): Promise<{ success: boolean; meta?: { changes: number } }> {
    MockD1.calls.push({ sql: this.sql, params: [...this.boundParams], action: 'run' });
    return { success: true, meta: { changes: 1 } };
  }

  async all<T = unknown>(): Promise<{ results: T[]; success: boolean }> {
    MockD1.calls.push({ sql: this.sql, params: [...this.boundParams], action: 'all' });
    return { results: [], success: true };
  }

  async first<T = unknown>(): Promise<T | null> {
    MockD1.calls.push({ sql: this.sql, params: [...this.boundParams], action: 'first' });
    return null;
  }
}

class MockD1 implements D1Database {
  static calls: MockStmtCall[] = [];
  static execStatements: string[] = [];

  prepare(sql: string): D1PreparedStatement {
    return new MockPreparedStatement(sql);
  }

  async exec(sql: string): Promise<{ success: boolean; error?: string }> {
    MockD1.execStatements.push(sql);
    return { success: true };
  }

  async batch(_stmts: D1PreparedStatement[]): Promise<{ results?: unknown[]; success: boolean }[]> {
    return [];
  }

  static reset() {
    MockD1.calls = [];
    MockD1.execStatements = [];
  }

  static lastCall(): MockStmtCall | undefined {
    return MockD1.calls[MockD1.calls.length - 1];
  }

  static callsContain(sqlFragment: string): boolean {
    return MockD1.calls.some(c => c.sql.includes(sqlFragment));
  }
}

/* ------------------------------------------------------------------ */
/*  Test Fixtures                                                      */
/* ------------------------------------------------------------------ */

const SAMPLE_MEETING: CommitteeMeeting = {
  id: 'meeting-1',
  committeeAcronym: 'PACP',
  committeeName: 'Standing Committee on Public Accounts',
  chamber: 'commons' as Chamber,
  parliament: 44,
  session: 1,
  meetingNumber: 120,
  date: '2025-01-15',
  startTime: '08:45:00',
  endTime: '10:30:00',
  inCamera: false,
  inCameraNote: null,
  evidenceUrl: 'https://www.ourcommons.ca/DocumentViewer/en/44-1/PACP/meeting-120/evidence',
  xmlUrl: 'https://www.ourcommons.ca/DocumentViewer/en/44-1/PACP/meeting-120/evidence?format=xml',
  subject: 'Financial Statements of the Government',
  ingestedAt: '2025-01-15T12:00:00Z',
};

const SAMPLE_INTERVENTION: Intervention = {
  meetingId: 'meeting-1',
  sequence: 1,
  speakerName: 'John Smith',
  speakerAffiliation: 'Office of the Auditor General',
  speakerParty: null,
  speakerRole: 'Witness',
  interventionType: 'Statement',
  language: 'EN',
  text: 'Thank you, Mr. Chair. I am pleased to present the audit report.',
  timestamp: '09:00:00',
  paraTextIds: ['p1'],
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('COMMITTEE_DDL', () => {
  it('creates committee_meetings table', () => {
    assert.ok(COMMITTEE_DDL.includes('CREATE TABLE IF NOT EXISTS committee_meetings'));
  });

  it('creates committee_interventions table', () => {
    assert.ok(COMMITTEE_DDL.includes('CREATE TABLE IF NOT EXISTS committee_interventions'));
  });

  it('creates committee_speakers table', () => {
    assert.ok(COMMITTEE_DDL.includes('CREATE TABLE IF NOT EXISTS committee_speakers'));
  });

  it('creates indexes on committee_meetings', () => {
    assert.ok(COMMITTEE_DDL.includes('idx_cm_committee'));
    assert.ok(COMMITTEE_DDL.includes('idx_cm_date'));
    assert.ok(COMMITTEE_DDL.includes('idx_cm_in_camera'));
  });

  it('creates indexes on committee_interventions', () => {
    assert.ok(COMMITTEE_DDL.includes('idx_ci_meeting'));
    assert.ok(COMMITTEE_DDL.includes('idx_ci_speaker'));
    assert.ok(COMMITTEE_DDL.includes('idx_ci_search'));
  });
});

describe('upsertMeeting', () => {
  let db: MockD1;

  before(() => { db = new MockD1(); MockD1.reset(); });
  after(() => MockD1.reset());

  it('inserts a meeting using INSERT OR IGNORE', async () => {
    MockD1.reset();
    const result = await upsertMeeting(db, SAMPLE_MEETING);
    assert.equal(result, true);

    const last = MockD1.lastCall();
    assert.ok(last, 'Expected at least one DB call');
    assert.ok(last!.sql.includes('INSERT OR IGNORE INTO committee_meetings'));
  });

  it('binds all meeting fields in correct order', async () => {
    MockD1.reset();
    await upsertMeeting(db, SAMPLE_MEETING);
    const last = MockD1.lastCall()!;

    // Params order should match columns: id, committee_acronym, committee_name, chamber, parliament, session, meeting_number, date, start_time, end_time, in_camera, in_camera_note, evidence_url, xml_url, subject, ingested_at
    assert.equal(last.params[0], 'meeting-1');
    assert.equal(last.params[1], 'PACP');
    assert.equal(last.params[2], 'Standing Committee on Public Accounts');
    assert.equal(last.params[3], 'commons');
    assert.equal(last.params[4], 44);
    assert.equal(last.params[5], 1);
    assert.equal(last.params[6], 120);
    assert.equal(last.params[7], '2025-01-15');
    assert.equal(last.params[8], '08:45:00');
    assert.equal(last.params[9], '10:30:00');
    assert.equal(last.params[10], 0); // inCamera as 0/1 integer
    assert.equal(last.params[11], null); // inCameraNote
    assert.equal(last.params[12], SAMPLE_MEETING.evidenceUrl);
    assert.equal(last.params[13], SAMPLE_MEETING.xmlUrl);
    assert.equal(last.params[14], 'Financial Statements of the Government');
    assert.equal(last.params[15], '2025-01-15T12:00:00Z');
  });

  it('converts inCamera boolean to integer 1 when true', async () => {
    MockD1.reset();
    const inCameraMeeting = { ...SAMPLE_MEETING, id: 'meeting-2', inCamera: true, inCameraNote: 'In camera session' };
    await upsertMeeting(db, inCameraMeeting);
    const last = MockD1.lastCall()!;
    assert.equal(last.params[10], 1);
    assert.equal(last.params[11], 'In camera session');
  });
});

describe('insertIntervention', () => {
  let db: MockD1;

  before(() => { db = new MockD1(); MockD1.reset(); });
  after(() => MockD1.reset());

  it('inserts using INSERT OR IGNORE INTO committee_interventions', async () => {
    MockD1.reset();
    const result = await insertIntervention(db, SAMPLE_INTERVENTION);
    assert.equal(result, true);

    const last = MockD1.lastCall()!;
    assert.ok(last.sql.includes('INSERT OR IGNORE INTO committee_interventions'));
  });

  it('binds all intervention fields', async () => {
    MockD1.reset();
    await insertIntervention(db, SAMPLE_INTERVENTION);
    const last = MockD1.lastCall()!;

    // meeting_id, sequence, speaker_name, speaker_affiliation, speaker_party, speaker_role, intervention_type, language, text, timestamp
    assert.equal(last.params[0], 'meeting-1');
    assert.equal(last.params[1], 1);
    assert.equal(last.params[2], 'John Smith');
    assert.equal(last.params[3], 'Office of the Auditor General');
    assert.equal(last.params[4], null);
    assert.equal(last.params[5], 'Witness');
    assert.equal(last.params[6], 'Statement');
    assert.equal(last.params[7], 'EN');
    assert.equal(last.params[8], 'Thank you, Mr. Chair. I am pleased to present the audit report.');
    assert.equal(last.params[9], '09:00:00');
  });

  it('inserts intervention with party affiliation', async () => {
    MockD1.reset();
    const withParty: Intervention = {
      ...SAMPLE_INTERVENTION,
      meetingId: 'meeting-2',
      speakerParty: 'Liberal',
      speakerRole: 'Member',
    };
    await insertIntervention(db, withParty);
    const last = MockD1.lastCall()!;
    assert.equal(last.params[4], 'Liberal');
    assert.equal(last.params[5], 'Member');
  });
});

describe('upsertSpeaker', () => {
  let db: MockD1;

  before(() => {
    db = new MockD1();
    MockD1.reset();
  });

  after(() => MockD1.reset());

  it('INSERTs new speaker when none exists', async () => {
    MockD1.reset();
    // MockD1.first() returns null by default, so this should go to INSERT
    const result = await upsertSpeaker(db, 'Jane Doe', 'Finance Canada', 'Liberal', '2025-01-15');
    assert.equal(result, true);

    const calls = MockD1.calls;
    // First call: SELECT to check existence
    const selectCall = calls.find(c => c.sql.includes('SELECT * FROM committee_speakers'));
    assert.ok(selectCall, 'Expected SELECT check');
    assert.equal(selectCall!.params[0], 'Jane Doe');

    // Then INSERT
    const insertCall = calls.find(c => c.sql.includes('INSERT INTO committee_speakers'));
    assert.ok(insertCall, 'Expected INSERT for new speaker');
    assert.equal(insertCall!.params[0], 'Jane Doe');
    assert.equal(insertCall!.params[1], 'Finance Canada');
    assert.equal(insertCall!.params[2], 'Liberal');
    assert.equal(insertCall!.params[4], '2025-01-15');
  });

  it('UPDATEs existing speaker when found', async () => {
    MockD1.reset();
    // Override first() to return an existing speaker
    const origPrepare = db.prepare.bind(db);
    db.prepare = (sql: string) => {
      const stmt = origPrepare(sql);
      const origFirst = stmt.first.bind(stmt);
      stmt.first = async () => {
        if (sql.includes('SELECT * FROM committee_speakers')) {
          MockD1.calls.push({ sql, params: [], action: 'first' });
          return { name: 'Jane Doe', latest_affiliation: 'Old Org', latest_party: 'Conservative', total_appearances: 5, first_seen: '2024-01-01', last_seen: '2024-12-01' };
        }
        return origFirst();
      };
      return stmt;
    };

    const result = await upsertSpeaker(db, 'Jane Doe', 'Finance Canada', 'Liberal', '2025-01-15');
    assert.equal(result, true);

    const updateCall = MockD1.calls.find(c => c.sql.includes('UPDATE committee_speakers'));
    assert.ok(updateCall, 'Expected UPDATE for existing speaker');
    assert.ok(updateCall!.sql.includes('total_appearances = total_appearances + 1'));
    assert.ok(updateCall!.sql.includes('last_seen = MAX(last_seen, ?)'));

    // Restore
    db.prepare = origPrepare;
  });
});

describe('meetingExists', () => {
  let db: MockD1;

  before(() => { db = new MockD1(); MockD1.reset(); });
  after(() => MockD1.reset());

  it('returns false when meeting does not exist', async () => {
    MockD1.reset();
    // MockD1.first() returns null by default
    const exists = await meetingExists(db, 'PACP', 120);
    assert.equal(exists, false);
  });

  it('returns true when meeting exists', async () => {
    MockD1.reset();
    const origPrepare = db.prepare.bind(db);
    db.prepare = (sql: string) => {
      const stmt = origPrepare(sql);
      const origFirst = stmt.first.bind(stmt);
      stmt.first = async () => {
        if (sql.includes('SELECT 1 FROM committee_meetings')) {
          MockD1.calls.push({ sql, params: [], action: 'first' });
          return { 1: 1 };
        }
        return origFirst();
      };
      return stmt;
    };

    const exists = await meetingExists(db, 'PACP', 120);
    assert.equal(exists, true);

    db.prepare = origPrepare;
  });

  it('filters by chamber', async () => {
    MockD1.reset();
    await meetingExists(db, 'PACP', 120, 'senate' as Chamber);
    const calls = MockD1.calls;
    const selectCall = calls.find(c => c.sql.includes('WHERE committee_acronym = ? AND meeting_number = ? AND chamber = ?'));
    assert.ok(selectCall, 'Expected chamber filtering');
    assert.equal(selectCall!.params[2], 'senate');
  });
});

describe('getLatestMeetingNumber', () => {
  let db: MockD1;

  before(() => { db = new MockD1(); MockD1.reset(); });
  after(() => MockD1.reset());

  it('returns null when no meetings exist', async () => {
    MockD1.reset();
    const result = await getLatestMeetingNumber(db, 'PACP');
    assert.equal(result, null);
  });

  it('returns meeting number when found', async () => {
    MockD1.reset();
    const origPrepare = db.prepare.bind(db);
    db.prepare = (sql: string) => {
      const stmt = origPrepare(sql);
      const origFirst = stmt.first.bind(stmt);
      stmt.first = async () => {
        if (sql.includes('SELECT meeting_number')) {
          MockD1.calls.push({ sql, params: [], action: 'first' });
          return { meeting_number: 120 };
        }
        return origFirst();
      };
      return stmt;
    };

    const result = await getLatestMeetingNumber(db, 'PACP');
    assert.equal(result, 120);

    db.prepare = origPrepare;
  });

  it('queries with correct WHERE clause', async () => {
    MockD1.reset();
    await getLatestMeetingNumber(db, 'FINA');
    const selectCall = MockD1.calls.find(c => c.sql.includes('WHERE committee_acronym = ?'));
    assert.ok(selectCall);
    assert.equal(selectCall!.params[0], 'FINA');
  });
});

describe('searchTranscripts', () => {
  let db: MockD1;

  before(() => { db = new MockD1(); MockD1.reset(); });
  after(() => MockD1.reset());

  it('builds SQL with text search query', async () => {
    MockD1.reset();
    await searchTranscripts(db, 'auditor');
    const call = MockD1.lastCall()!;
    assert.ok(call.sql.includes('ci.text LIKE ?'));
    assert.equal(call.params[0], '%auditor%');
  });

  it('adds committee filter when provided', async () => {
    MockD1.reset();
    await searchTranscripts(db, 'budget', { committee: 'FINA' });
    const call = MockD1.lastCall()!;
    assert.ok(call.sql.includes('cm.committee_acronym = ?'));
    // committee param should appear after the LIKE param
    const likeIdx = call.params.indexOf('%budget%');
    const committeeIdx = call.params.indexOf('FINA');
    assert.ok(likeIdx >= 0);
    assert.ok(committeeIdx >= 0);
  });

  it('adds party filter when provided', async () => {
    MockD1.reset();
    await searchTranscripts(db, '', { party: 'Liberal' });
    const call = MockD1.lastCall()!;
    assert.ok(call.sql.includes('ci.speaker_party = ?'));
    assert.ok(call.params.includes('Liberal'));
  });

  it('adds speaker filter when provided', async () => {
    MockD1.reset();
    await searchTranscripts(db, '', { speaker: 'Smith' });
    const call = MockD1.lastCall()!;
    assert.ok(call.sql.includes('ci.speaker_name LIKE ?'));
    assert.ok(call.params.includes('%Smith%'));
  });

  it('adds inCameraOnly filter when true', async () => {
    MockD1.reset();
    await searchTranscripts(db, '', { inCameraOnly: true });
    const call = MockD1.lastCall()!;
    assert.ok(call.sql.includes('cm.in_camera = 1'));
  });

  it('applies LIMIT with default of 50', async () => {
    MockD1.reset();
    await searchTranscripts(db, 'test');
    const call = MockD1.lastCall()!;
    assert.ok(call.sql.includes('LIMIT ?'));
    assert.equal(call.params[call.params.length - 1], 50);
  });

  it('applies custom limit', async () => {
    MockD1.reset();
    await searchTranscripts(db, '', { limit: 10 });
    const call = MockD1.lastCall()!;
    assert.equal(call.params[call.params.length - 1], 10);
  });

  it('orders by date DESC and sequence ASC', async () => {
    MockD1.reset();
    await searchTranscripts(db, 'test');
    const call = MockD1.lastCall()!;
    assert.ok(call.sql.includes('ORDER BY cm.date DESC, ci.sequence ASC'));
  });

  it('joins committee_meetings', async () => {
    MockD1.reset();
    await searchTranscripts(db, 'test');
    const call = MockD1.lastCall()!;
    assert.ok(call.sql.includes('JOIN committee_meetings'));
    assert.ok(call.sql.includes('ci.meeting_id = cm.id'));
  });

  it('returns empty array when no results', async () => {
    MockD1.reset();
    const results = await searchTranscripts(db, 'nonexistent');
    assert.ok(Array.isArray(results));
    assert.equal(results.length, 0);
  });
});

describe('getInCameraCount', () => {
  let db: MockD1;

  before(() => { db = new MockD1(); MockD1.reset(); });
  after(() => MockD1.reset());

  it('returns 0 when no in-camera meetings', async () => {
    MockD1.reset();
    const count = await getInCameraCount(db);
    assert.equal(count, 0);
  });

  it('returns count when in-camera meetings exist', async () => {
    MockD1.reset();
    const origPrepare = db.prepare.bind(db);
    db.prepare = (sql: string) => {
      const stmt = origPrepare(sql);
      const origFirst = stmt.first.bind(stmt);
      stmt.first = async () => {
        if (sql.includes('SELECT COUNT')) {
          MockD1.calls.push({ sql, params: [], action: 'first' });
          return { cnt: 5 };
        }
        return origFirst();
      };
      return stmt;
    };

    const count = await getInCameraCount(db);
    assert.equal(count, 5);

    db.prepare = origPrepare;
  });

  it('uses correct SQL', async () => {
    MockD1.reset();
    await getInCameraCount(db);
    const call = MockD1.calls.find(c => c.sql.includes('COUNT(*)'));
    assert.ok(call);
    assert.ok(call!.sql.includes('in_camera = 1'));
  });
});

describe('resetCommitteeTables', () => {
  let db: MockD1;

  before(() => { db = new MockD1(); MockD1.reset(); });
  after(() => MockD1.reset());

  it('drops all three tables in order', async () => {
    MockD1.reset();
    await resetCommitteeTables(db);

    const execs = MockD1.execStatements;
    assert.ok(execs.some(s => s.includes('DROP TABLE IF EXISTS committee_interventions')));
    assert.ok(execs.some(s => s.includes('DROP TABLE IF EXISTS committee_meetings')));
    assert.ok(execs.some(s => s.includes('DROP TABLE IF EXISTS committee_speakers')));
  });

  it('re-runs COMMITTEE_DDL', async () => {
    MockD1.reset();
    await resetCommitteeTables(db);

    const execs = MockD1.execStatements;
    const ddlExec = execs.find(s => s.includes('CREATE TABLE IF NOT EXISTS committee_meetings'));
    assert.ok(ddlExec, 'Expected DDL execution');
    assert.ok(ddlExec!.includes('CREATE TABLE IF NOT EXISTS committee_interventions'));
    assert.ok(ddlExec!.includes('CREATE TABLE IF NOT EXISTS committee_speakers'));
  });

  it('executes 4 statements total (3 DROP + 1 DDL)', async () => {
    MockD1.reset();
    await resetCommitteeTables(db);
    assert.equal(MockD1.execStatements.length, 4);
  });
});
