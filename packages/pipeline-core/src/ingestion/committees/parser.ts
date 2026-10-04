/**
 * Committee XML Parser — Quill
 *
 * Parses the House of Commons Hansard XML (evidence transcript) into
 * structured CommitteeMeeting and Intervention records.
 *
 * XML Format:
 *   <Hansard id="...">
 *     <ExtractedInformation>
 *       <ExtractedItem Name="Acronyme">PACP</ExtractedItem>
 *       <ExtractedItem Name="InCameraNote">[Committee proceedings in camera]</ExtractedItem>
 *       ...
 *     </ExtractedInformation>
 *     <HansardBody>
 *       <OrderOfBusiness>
 *         <SubjectOfBusiness>
 *           <SubjectOfBusinessContent>
 *             <Timestamp Hr="16" Mn="15">(1615)</Timestamp>
 *             <Intervention Type="Interjection" id="...">
 *               <PersonSpeaking>
 *                 <Affiliation>MP Name (Riding, Party)</Affiliation>
 *               </PersonSpeaking>
 *               <Content>
 *                 <ParaText id="...">Spoken text...</ParaText>
 *               </Content>
 *             </Intervention>
 *           </SubjectOfBusinessContent>
 *         </SubjectOfBusiness>
 *       </OrderOfBusiness>
 *     </HansardBody>
 *   </Hansard>
 */

import { XMLParser } from 'fast-xml-parser';
import { computeHash } from '../../verification/hashing.js';
import { getText } from '../../utils/http.js';
import {
  evidenceHtmlUrl,
  evidenceUrl,
} from './constants.js';
import type {
  Chamber,
  CommitteeMeeting,
  Intervention,
  RawHansard,
} from './types.js';



const XML_PARSER: XMLParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: () => false,
  cdataPropName: '#cdata',
  trimValues: true,
  maxNestedTags: 5000,
} as import('fast-xml-parser').X2jOptions);



interface ParsedMetadata {
  committeeAcronym: string;
  committeeName: string;
  parliament: number;
  session: number;
  meetingNumber: number;
  date: string;
  startTime: string | null;
  endTime: string | null;
  inCamera: boolean;
  inCameraNote: string | null;
  subject: string | null;
}

function extractMetadata(xml: RawHansard): ParsedMetadata | null {
  const info = xml.Hansard?.ExtractedInformation;
  if (!info) return null;

  const items = info.ExtractedItem;
  if (!items) return null;

  // Normalize to array
  const rawItems = Array.isArray(items) ? items : [items];

  const map = new Map<string, string>();
  for (const item of rawItems) {
    if (item['@_Name'] && item['#text'] !== undefined) {
      map.set(item['@_Name'], item['#text']);
    }
  }

  const acronyme = map.get('Acronyme') || '';
  const institution = map.get('InstitutionDebate') || '';
  const numberStr = map.get('Number') || '';
  const parliamentStr = map.get('Parliament') || '';
  const sessionStr = map.get('Session') || '';
  const dateStr = map.get('Date') || '';
  const inCameraNote = map.get('InCameraNote') || '';
  const headerTitle = map.get('HeaderTitle') || '';

  // Parse meeting number from "NUMBER 033" or "NUMÉRO 033"
  const meetingNum = parseInt(numberStr.replace(/^NUMBER\s*/i, '').replace(/^NUMÉRO\s*/i, ''), 10);

  // Parse parliament number from "45th PARLIAMENT"
  const parliament = parseInt(parliamentStr.match(/(\d+)/)?.[1] || '0', 10);

  // Parse session from "1st SESSION"
  const session = parseInt(sessionStr.match(/(\d+)/)?.[1] || '0', 10);

  // Determine if in-camera
  const inCamera = inCameraNote.trim().length > 0;

  // Try to extract subject from header title
  const subject = headerTitle || null;

  return {
    committeeAcronym: acronyme,
    committeeName: institution,
    parliament,
    session,
    meetingNumber: meetingNum,
    date: dateStr,
    startTime: null,  // Only in minutes XML
    endTime: null,
    inCamera,
    inCameraNote: inCameraNote || null,
    subject,
  };
}



/**
 * Parse the speaker role, party, and riding from an affiliation string.
 *
 * Examples:
 *   "The Chair (John Williamson (Saint John—St. Croix, CPC))"
 *   "Karen Hogan (Auditor General of Canada, Office of the Auditor General)"
 *   "Gérard Deltell (Louis-Saint-Laurent—Akiawenhrahk, CPC)"
 */
function parseSpeakerAffiliation(raw: string): {
  name: string;
  role: string | null;
  party: string | null;
  affiliation: string | null;
} {
  // Default
  const result = { name: raw, role: null as string | null, party: null as string | null, affiliation: null as string | null };

  // Try to match: "Name (Riding, Party)" for MPs
  // e.g. "John Williamson (Saint John—St. Croix, CPC)" or "Gérard Deltell (Louis-Saint-Laurent—Akiawenhrahk, CPC)"
  const mpMatch = raw.match(/^([^(]+)\(([^,]+),?\s*([^)]+)\)$/);
  if (mpMatch) {
    result.name = mpMatch[1].trim();
    result.affiliation = mpMatch[2].trim();
    result.party = mpMatch[3].trim();
    return result;
  }

  // Try to match: "The Chair (John Williamson (Riding, Party))"
  const chairMatch = raw.match(/^The\s+(Chair|Vice[-\s]Chair)\s+\((.+)\)$/i);
  if (chairMatch) {
    result.role = chairMatch[1].trim().toLowerCase();
    const inner = chairMatch[2].trim();
    // Inner could be "Name (Riding, Party)"
    const innerMatch = inner.match(/^([^(]+)\(([^,]+),?\s*([^)]+)\)$/);
    if (innerMatch) {
      result.name = innerMatch[1].trim();
      result.affiliation = innerMatch[2].trim();
      result.party = innerMatch[3].trim();
    } else {
      result.name = inner;
    }
    return result;
  }

  // Try: "Title (Department)" for officials
  // e.g. "Auditor General of Canada, Office of the Auditor General"
  const officialMatch = raw.match(/^([^(]+)\((.+)\)$/);
  if (officialMatch) {
    result.name = officialMatch[1].trim();
    result.affiliation = officialMatch[2].trim();
    return result;
  }

  return result;
}

function extractInterventions(xml: RawHansard): Intervention[] {
  const interventions: Intervention[] = [];
  const body = xml.Hansard?.HansardBody;
  if (!body) return interventions;

  const order = body.OrderOfBusiness;
  if (!order) return interventions;

  // SubjectOfBusiness can be array or single
  const subjects = order.SubjectOfBusiness;
  if (!subjects) return interventions;

  const subjectList = Array.isArray(subjects) ? subjects : [subjects];
  let currentLanguage = 'EN';
  let currentTime: string | null = null;

  for (const subject of subjectList) {
    const content = subject.SubjectOfBusinessContent;
    if (!content) continue;

    // Track language and timestamp changes
    if (content.Timestamp) {
      const timestamps = Array.isArray(content.Timestamp) ? content.Timestamp : [content.Timestamp];
      for (const ts of timestamps) {
        currentTime = `1970-01-01T${ts['@_Hr']?.padStart(2, '0')}:${ts['@_Mn']?.padStart(2, '0')}:00`;
      }
    }

    if (content.FloorLanguage) {
      const langs = Array.isArray(content.FloorLanguage) ? content.FloorLanguage : [content.FloorLanguage];
      for (const fl of langs) {
        if (fl['@_language']) {
          currentLanguage = fl['@_language'] === 'EN' ? 'EN' : fl['@_language'] === 'FR' ? 'FR' : currentLanguage;
        }
      }
    }

    // Parse interventions
    const raw = content.Intervention;
    if (!raw) continue;

    const rawList = Array.isArray(raw) ? raw : [raw];
    for (const intervention of rawList) {
      if (!intervention.Content?.ParaText) continue;

    // Parse speaker
    const affiliationRawRaw = intervention.PersonSpeaking?.Affiliation;
    // Affiliation can be a string or an object with #text (when it has attributes like DbId)
    const affiliationRaw = getText(affiliationRawRaw);
    const speaker = parseSpeakerAffiliation(affiliationRaw);

      // ParaText can be a string or object with #text (when it has id attribute)
      const paras = Array.isArray(intervention.Content.ParaText)
        ? intervention.Content.ParaText
        : [intervention.Content.ParaText];

      const textParas: string[] = [];
      for (const p of paras) {
        const pText = getText(p);
        if (pText.trim().length > 0) {
          textParas.push(pText);
        }
      }
      const text = textParas.join('\n\n');

      if (text.trim().length === 0) continue;

      // Track language changes within intervention
      if (intervention.Content.FloorLanguage) {
        const fl = Array.isArray(intervention.Content.FloorLanguage)
          ? intervention.Content.FloorLanguage
          : [intervention.Content.FloorLanguage];
        for (const f of fl) {
          if (f['@_language'] === 'EN' || f['@_language'] === 'FR') {
            currentLanguage = f['@_language'];
          }
        }
      }

      interventions.push({
        meetingId: '',  // filled in by caller
        sequence: interventions.length + 1,
        speakerName: speaker.name,
        speakerAffiliation: speaker.affiliation,
        speakerParty: speaker.party,
        speakerRole: speaker.role,
        interventionType: intervention['@_Type'] || '',
        language: currentLanguage,
        text,
        timestamp: currentTime,
        paraTextIds: [],
      });
    }
  }

  return interventions;
}



export interface ParsedEvidence {
  meeting: CommitteeMeeting;
  interventions: Intervention[];
}

export async function parseEvidenceXml(
  xml: string,
  parliament?: number,
  session?: number,
  chamber: Chamber = 'commons',
): Promise<ParsedEvidence> {
  const parsed: RawHansard = XML_PARSER.parse(xml) as unknown as RawHansard;
  const meta = extractMetadata(parsed);
  if (!meta) {
    throw new Error('Failed to parse committee metadata from XML');
  }

  const p = meta.parliament || parliament || 45;
  const s = meta.session || session || 1;
  const acronym = meta.committeeAcronym;

  const meeting: CommitteeMeeting = {
    id: await computeHash(xml, 'sha256'),
    committeeAcronym: acronym,
    committeeName: meta.committeeName,
    chamber,
    parliament: p,
    session: s,
    meetingNumber: meta.meetingNumber,
    date: meta.date,
    startTime: meta.startTime,
    endTime: meta.endTime,
    inCamera: meta.inCamera,
    inCameraNote: meta.inCameraNote,
    evidenceUrl: evidenceUrl(p, s, acronym, meta.meetingNumber),
    xmlUrl: evidenceHtmlUrl(p, s, acronym, meta.meetingNumber),
    subject: meta.subject,
    ingestedAt: new Date().toISOString(),
  };

  const interventions = extractInterventions(parsed);
  for (const inv of interventions) {
    inv.meetingId = meeting.id;
  }

  return { meeting, interventions };
}
