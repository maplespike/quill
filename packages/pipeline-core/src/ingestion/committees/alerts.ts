// SPDX-License-Identifier: AGPL-3.0-only
import { XMLParser } from 'fast-xml-parser';
import { computeHash } from '../../verification/hashing.js';
import { SENATE_COMMITTEE_MAP } from './constants.js';
import type { Chamber, InCameraAlert, RawHansard } from './types.js';

const PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: () => false,
  trimValues: true,
});

export async function detectInCameraMeetings(xml: string): Promise<InCameraAlert[]> {
  const parsed = PARSER.parse(xml) as RawHansard;
  const hansard = parsed.Hansard;
  if (!hansard) return [];

  const info = hansard.ExtractedInformation;
  if (!info) return [];

  const items = info.ExtractedItem;
  if (!items) return [];

  const rawItems = Array.isArray(items) ? items : [items];
  const meta = new Map<string, string>();
  for (const item of rawItems) {
    if (item['@_Name'] && item['#text'] !== undefined) {
      meta.set(item['@_Name'], item['#text']);
    }
  }

  const inCameraNote = meta.get('InCameraNote');
  if (!inCameraNote || inCameraNote.trim().length === 0) return [];

  const committee = meta.get('Acronyme') || '';
  const committeeName = meta.get('InstitutionDebate') || '';
  const numberRaw = meta.get('Number') || '';
  const parliamentStr = meta.get('Parliament') || '';
  const sessionStr = meta.get('Session') || '';
  const date = meta.get('Date') || '';

  const meetingNumber = parseInt(
    numberRaw.replace(/^NUMBER\s*/i, '').replace(/^NUMÉRO\s*/i, ''), 10,
  );
  const parliament = parseInt(parliamentStr.match(/(\d+)/)?.[1] || '0', 10);
  const session = parseInt(sessionStr.match(/(\d+)/)?.[1] || '0', 10);

  const chamber: Chamber = SENATE_COMMITTEE_MAP.has(committee) ? 'senate' : 'commons';

  const meetingId = await computeHash(xml, 'sha256');

  let startTime: string | null = null;
  let endTime: string | null = null;

  const body = hansard.HansardBody;
  if (body?.OrderOfBusiness?.SubjectOfBusiness) {
    const subjects = Array.isArray(body.OrderOfBusiness.SubjectOfBusiness)
      ? body.OrderOfBusiness.SubjectOfBusiness
      : [body.OrderOfBusiness.SubjectOfBusiness];

    for (const subject of subjects) {
      const content = subject.SubjectOfBusinessContent;
      if (!content) continue;

      if (content.Timestamp) {
        const timestamps = Array.isArray(content.Timestamp)
          ? content.Timestamp
          : [content.Timestamp];
        for (const ts of timestamps) {
          const hr = ts['@_Hr']?.padStart(2, '0');
          const mn = ts['@_Mn']?.padStart(2, '0');
          if (hr && mn) {
            const tsStr = `${hr}:${mn}`;
            if (!startTime) startTime = tsStr;
            endTime = tsStr;
          }
        }
      }
    }
  }

  return [{
    meetingId,
    committee,
    committeeName,
    chamber,
    parliament,
    session,
    meetingNumber,
    date,
    startTime: startTime ? `1970-01-01T${startTime}:00` : null,
    endTime: endTime ? `1970-01-01T${endTime}:00` : null,
    note: inCameraNote,
  }];
}
