/**
 * Committee Data Types — Quill
 *
 * Strongly-typed interfaces for Canadian House of Commons committee
 * data, meeting evidence, interventions, and speaker tracking.
 *
 * Sources:
 *   - Meeting list:   https://www.ourcommons.ca/Committees/en/{ACRONYM}/Meetings
 *   - Evidence XML:   https://www.ourcommons.ca/DocumentViewer/en/{Parl}-{Session}/{ACRONYM}/meeting-{N}/evidence?format=xml
 *   - Minutes XML:    https://www.ourcommons.ca/DocumentViewer/en/{Parl}-{Session}/{ACRONYM}/meeting-{N}/minutes?format=xml
 */


export type Chamber = 'commons' | 'senate';

export type CommitteeCategory =
  | 'standing'
  | 'legislative'
  | 'special'
  | 'joint'
  | 'subcommittee';

export interface CommitteeInfo {
  /** e.g. 'PACP', 'FINA', 'SECU' */
  acronym: string;
  /** English name */
  nameEn: string;
  /** French name */
  nameFr: string | null;
  category: CommitteeCategory;
}

export const COMMITTEE_CATEGORIES: Record<string, CommitteeCategory> = {
  // Joint committees
  AMAD: 'joint', BCAN: 'joint', BILI: 'joint', REGS: 'joint',
};


export interface CommitteeMeeting {
  /** SHA-256 citation hash of the full evidence XML (primary key) */
  id: string;

  committeeAcronym: string;
  committeeName: string;
  chamber: Chamber;
  parliament: number;
  session: number;
  meetingNumber: number;

  /** ISO-8601 date of the meeting */
  date: string;
  startTime: string | null;
  endTime: string | null;

  /** TRUE if the meeting was wholly or partially in-camera (closed) */
  inCamera: boolean;
  /** The in-camera note from the XML (e.g. "[Committee proceedings in camera]") */
  inCameraNote: string | null;

  evidenceUrl: string;
  xmlUrl: string;
  subject: string | null;

  /** ISO-8601 ingestion timestamp */
  ingestedAt: string;
}


export interface Intervention {
  meetingId: string;
  sequence: number;
  speakerName: string;
  speakerAffiliation: string | null;
  speakerParty: string | null;
  speakerRole: string | null;
  interventionType: string;
  language: string;
  text: string;
  timestamp: string | null;
  paraTextIds: string[];
}


export interface CommitteeSpeaker {
  name: string;
  latestAffiliation: string | null;
  latestParty: string | null;
  totalAppearances: number;
  firstSeen: string;
  lastSeen: string;
}


export interface CommitteeIngestionResult {
  committee: string;
  meetingsFound: number;
  meetingsIngested: number;
  interventionsIngested: number;
  speakersFound: number;
  inCameraCount: number;
  errors: string[];
  durationMs: number;
}


/**
 * Shape of the raw Hansard XML after JSON conversion via fast-xml-parser.
 * Only the fields we care about are typed; everything else is ignored.
 */
export interface RawHansard {
  Hansard: {
    '?xml': unknown;
    'StartPageNumber'?: string;
    DocumentTitle?: { DocumentName?: string };
    ExtractedInformation?: {
      ExtractedItem?: RawExtractedItem | RawExtractedItem[];
    };
    HansardBody?: {
      OrderOfBusiness?: {
        SubjectOfBusiness?: RawSubjectOfBusiness | RawSubjectOfBusiness[];
      };
    };
  };
}

export interface RawExtractedItem {
  '@_Name': string;
  '#text': string;
}

export interface InCameraAlert {
  meetingId: string;
  committee: string;
  committeeName: string;
  chamber: Chamber;
  parliament: number;
  session: number;
  meetingNumber: number;
  date: string;
  startTime: string | null;
  endTime: string | null;
  note: string;
}

export interface RawSubjectOfBusiness {
  SubjectOfBusinessContent?: RawBusinessContent;
}

export interface RawBusinessContent {
  Timestamp?: RawTimestamp | RawTimestamp[];
  FloorLanguage?: RawFloorLanguage | RawFloorLanguage[];
  Intervention?: RawIntervention | RawIntervention[];
}

export interface RawTimestamp {
  '@_Hr'?: string;
  '@_Mn'?: string;
  '#text'?: string;
}

export interface RawFloorLanguage {
  '@_language': string;
  '#text'?: string;
}

export interface RawIntervention {
  '@_Type'?: string;
  '@_ToC'?: string;
  '@_ToCText'?: string;
  '@_id'?: string;
  PersonSpeaking?: {
    Affiliation?: string;
  };
  Content?: {
    ParaText?: string | string[];
    FloorLanguage?: RawFloorLanguage | RawFloorLanguage[];
  };
}
