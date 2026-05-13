/**
 * Municipal Council Data Parser — MapleSpike Pipeline
 *
 * Parses raw HTML and JSON from Canadian city council sources into structured
 * MunicipalMeeting objects.
 *
 * Each city has unique HTML structure — we provide city-specific parsers
 * for implemented cities (Toronto, Vancouver) and keyword-based generic
 * parsers as fallback for un-implemented cities.
 */

import { computeHash } from '../../verification/hashing.js';
import {
  MEETING_TYPE_KEYWORDS,
  DECISION_TYPE_KEYWORDS,
  getCityConfig,
} from './constants.js';
import type {
  MunicipalMeeting,
  MeetingDecision,
  MeetingType,
  MeetingStatus,
  DecisionType,
  CityCode,
  RawCouncilRecord,
} from './types.js';


/* ------------------------------------------------------------------ */
/*  Generic Helpers                                                    */
/* ------------------------------------------------------------------ */

function extractDateFromText(text: string): string | null {
  // Match common date formats: YYYY-MM-DD, "January 1, 2024", "2024-01-01"
  const patterns = [
    /\b(\d{4}-\d{2}-\d{2})\b/,
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d+),?\s+(\d{4})\b/i,
    /\b(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (pattern === patterns[0]) {
        return match[1];
      }
      if (pattern === patterns[1]) {
        const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
        const month = String(monthNames.indexOf(match[1].toLowerCase()) + 1).padStart(2, '0');
        const day = match[2].padStart(2, '0');
        return `${match[3]}-${month}-${day}`;
      }
      if (pattern === patterns[2]) {
        const monthNames = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
        const month = String(monthNames.indexOf(match[2].toLowerCase()) + 1).padStart(2, '0');
        const day = match[1].padStart(2, '0');
        return `${match[3]}-${month}-${day}`;
      }
    }
  }
  return null;
}

function classifyMeetingType(title: string, description?: string | null): MeetingType {
  const combined = `${title} ${description ?? ''}`.toLowerCase().trim();
  let bestMatch: { type: MeetingType; length: number } | null = null;

  for (const [keyword, meetingType] of Object.entries(MEETING_TYPE_KEYWORDS)) {
    if (combined.includes(keyword)) {
      // Prefer longer (more specific) keyword matches
      if (!bestMatch || keyword.length > bestMatch.length) {
        bestMatch = { type: meetingType as MeetingType, length: keyword.length };
      }
    }
  }

  return bestMatch?.type ?? 'council';
}

function classifyDecisionType(text: string): DecisionType {
  const lower = text.toLowerCase().trim();
  let bestMatch: { type: DecisionType; length: number } | null = null;

  for (const [keyword, decisionType] of Object.entries(DECISION_TYPE_KEYWORDS)) {
    if (lower.includes(keyword)) {
      if (!bestMatch || keyword.length > bestMatch.length) {
        bestMatch = { type: decisionType as DecisionType, length: keyword.length };
      }
    }
  }

  return bestMatch?.type ?? 'approved';
}

function extractAgendaItems(html: string): string[] {
  const items: string[] = [];

  // Try common HTML patterns for agenda items
  const patterns = [
    /<li[^>]*>Agenda\s+Item\s+(\d+)[^<]*<[^>]*>([^<]+)/gi,
    /<h\d[^>]*>(?:Item|Agenda)\s+#?(\d+)[.:]\s*([^<]+)/gi,
    /<td[^>]*>(?:Item|Agenda)\s+#?(\d+)<\/td>\s*<td[^>]*>([^<]+)/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const label = match[2]?.trim();
      if (label) {
        items.push(label);
      }
    }
    if (items.length > 0) break;
  }

  return items;
}

function extractDecisionsFromText(text: string): MeetingDecision[] {
  const decisions: MeetingDecision[] = [];
  const lines = text.split(/\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect decision-like patterns
    const decisionPattern = /\b(?:moved|approved|defeated|carried|adopted|rejected)\b/i;
    if (decisionPattern.test(trimmed)) {
      const decisionType = classifyDecisionType(trimmed);
      decisions.push({
        itemNumber: null,
        title: trimmed.length > 100 ? trimmed.substring(0, 100) + '...' : trimmed,
        decisionType,
        description: trimmed,
        voteResult: null,
        motionText: null,
        movedBy: null,
        secondedBy: null,
      });
    }
  }

  return decisions;
}


/* ------------------------------------------------------------------ */
/*  Toronto Parser                                                     */
/* ------------------------------------------------------------------ */

/**
 * Parse Toronto council meeting page HTML.
 *
 * Toronto uses a custom CMS at toronto.ca.  Meeting list pages contain
 * structured meeting entries with dates, titles, and links to agenda/minutes.
 */
export function parseTorontoPage(html: string, sourceUrl: string): RawCouncilRecord[] {
  const records: RawCouncilRecord[] = [];

  // Try to extract meeting entries from Toronto's HTML structure.
  // Toronto meeting list uses a specific HTML pattern with <article> or <li> entries.

  // Pattern 1: Meeting entries in <article> tags with date + title
  const articlePattern = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let articleMatch: RegExpExecArray | null;

  while ((articleMatch = articlePattern.exec(html)) !== null) {
    const articleContent = articleMatch[1];

    // Extract date
    const dateMatch = articleContent.match(
      /(\d{4}-\d{2}-\d{2})|(\w+\s+\d+,?\s+\d{4})/,
    );
    if (!dateMatch) continue;

    // Extract title (typically in an <h2>, <h3>, or <a> tag)
    const titleMatch = articleContent.match(
      /<(?:h[2-4]|a)\b[^>]*>([^<]+)<\/(?:h[2-4]|a)>/i,
    );
    const title = titleMatch ? titleMatch[1].trim() : 'Toronto Council Meeting';

    // Extract agenda link
    const agendaMatch = articleContent.match(
      /<a[^>]*href=["']([^"']*agenda[^"']*)["'][^>]*>/i,
    );
    const agendaUrl = agendaMatch?.[1] ?? null;

    // Extract minutes link
    const minutesMatch = articleContent.match(
      /<a[^>]*href=["']([^"']*minutes[^"']*)["'][^>]*>/i,
    );
    const minutesUrl = minutesMatch?.[1] ?? null;

    records.push({
      city: 'toronto',
      rawHtml: articleContent,
      sourceUrl,
      date: dateMatch[1] || dateMatch[0],
      title,
      meetingType: classifyMeetingType(title),
      meetingId: title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
    });

    // Store agenda/minutes URLs as extra fields
    if (agendaUrl) records[records.length - 1].agenda_url = agendaUrl;
    if (minutesUrl) records[records.length - 1].minutes_url = minutesUrl;
  }

  // Pattern 2: Fallback — look for meeting tables
  if (records.length === 0) {
    const tableRows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];

    for (const row of tableRows) {
      const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi);
      if (!cells || cells.length < 2) continue;

      const cellTexts = cells.map(c =>
        c.replace(/<[^>]+>/g, '').trim(),
      );

      const date = extractDateFromText(cellTexts.join(' '));
      const title = cellTexts.find(t => t.length > 5 && t.length < 200) ?? 'Toronto Council Meeting';

      if (date) {
        records.push({
          city: 'toronto',
          rawHtml: row,
          sourceUrl,
          date,
          title,
          meetingType: classifyMeetingType(title),
          meetingId: title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
        });
      }
    }
  }

  return records;
}


/* ------------------------------------------------------------------ */
/*  Vancouver Parser                                                   */
/* ------------------------------------------------------------------ */

/**
 * Parse Vancouver council meeting page HTML.
 *
 * Vancouver uses a custom listing at vancouver.ca/your-government/
 * with meeting dates, titles, and links to agendas/minutes.
 */
export function parseVancouverPage(html: string, sourceUrl: string): RawCouncilRecord[] {
  const records: RawCouncilRecord[] = [];

  // Pattern 1: Meeting entries in Vancouver's list structure
  // Vancouver typically uses a list of meeting items with dates and links
  const meetingPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;

  while ((match = meetingPattern.exec(html)) !== null) {
    const content = match[1];

    const titleMatch = content.match(
      /<(?:h[2-4]|strong|a)\b[^>]*>([^<]+)<\/(?:h[2-4]|strong|a)>/i,
    );
    const date = extractDateFromText(content);
    const textContent = content.replace(/<[^>]+>/g, ' ').trim();

    if (date || titleMatch) {
      const title = titleMatch?.[1]?.trim() ?? 'Vancouver Council Meeting';

      // Extract links
      const links: string[] = [];
      const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>/gi;
      let linkMatch: RegExpExecArray | null;
      while ((linkMatch = linkPattern.exec(content)) !== null) {
        links.push(linkMatch[1]);
      }

      const agendaLink = links.find(l =>
        /agenda/i.test(l) || /pdf/i.test(l) && !/minutes/i.test(l),
      );
      const minutesLink = links.find(l =>
        /minutes/i.test(l) || /min\.pdf/i.test(l),
      );

      const meetingIdMatch = content.match(/Meeting(\d+)/);
      const meetingId = meetingIdMatch?.[1] ?? title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

      records.push({
        city: 'vancouver',
        rawHtml: content,
        sourceUrl,
        date: date ?? undefined,
        title,
        meetingType: classifyMeetingType(title, textContent),
        meetingId,
      });

      if (agendaLink) records[records.length - 1].agenda_url = agendaLink;
      if (minutesLink) records[records.length - 1].minutes_url = minutesLink;
    }
  }

  // Pattern 2: Try extracting from meeting section blocks
  if (records.length === 0) {
    const sectionPattern = /<section[^>]*>([\s\S]*?)<\/section>/gi;
    while ((match = sectionPattern.exec(html)) !== null) {
      const content = match[1];
      const titleMatch = content.match(
        /<(?:h[2-4])\b[^>]*>([^<]+)<\/(?:h[2-4])>/i,
      );
      const date = extractDateFromText(content);

      if (titleMatch && date) {
        records.push({
          city: 'vancouver',
          rawHtml: content,
          sourceUrl,
          date,
          title: titleMatch[1].trim(),
          meetingType: classifyMeetingType(titleMatch[1]),
          meetingId: titleMatch[1].replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
        });
      }
    }
  }

  return records;
}


/* ------------------------------------------------------------------ */
/*  Generic Parser (Fallback)                                          */
/* ------------------------------------------------------------------ */

/**
 * Parse a meeting page using generic HTML pattern matching.
 * This is the fallback for un-implemented cities.
 */
export function parseGenericPage(html: string, city: CityCode, sourceUrl: string): RawCouncilRecord[] {
  const records: RawCouncilRecord[] = [];
  const config = getCityConfig(city);

  // Try extracting from <article> tags
  const articlePattern = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let match: RegExpExecArray | null;

  while ((match = articlePattern.exec(html)) !== null) {
    const content = match[1];
    const textContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const date = extractDateFromText(textContent);
    const titleMatch = textContent.match(/^(.{10,100}?)(?:\.|$)/);

    if (date) {
      records.push({
        city,
        rawHtml: content,
        sourceUrl,
        date,
        title: titleMatch?.[1]?.trim() ?? `Meeting on ${date}`,
        meetingType: config.isFrench ? 'council' : classifyMeetingType(textContent),
        meetingId: date.replace(/-/g, ''),
      });
    }
  }

  return records;
}


/* ------------------------------------------------------------------ */
/*  Main Parse Entry Point                                             */
/* ------------------------------------------------------------------ */

/**
 * Parse raw council records into structured MunicipalMeeting objects.
 *
 * Dispatches to city-specific parsers for implemented cities (Toronto,
 * Vancouver), and uses the generic parser for everything else.
 */
export async function parseMeetingRecords(
  rawRecords: RawCouncilRecord[],
  options: {
    /** Override the source system identifier */
    sourceSystem?: string;
  } = {},
): Promise<MunicipalMeeting[]> {
  const results: MunicipalMeeting[] = [];
  const sourceSystem = options.sourceSystem ?? 'municipal-council';

  for (const raw of rawRecords) {
    const parsed = await parseSingleRecord(raw, { sourceSystem });
    if (parsed) {
      results.push(parsed);
    }
  }

  return results;
}

/**
 * Parse a single raw council record into a MunicipalMeeting.
 */
export async function parseSingleRecord(
  raw: RawCouncilRecord,
  options: {
    sourceSystem?: string;
  } = {},
): Promise<MunicipalMeeting | null> {
  const city = raw.city;
  if (!city) return null;

  const config = getCityConfig(city);
  const sourceSystem = options.sourceSystem ?? 'municipal-council';

  // Extract base fields
  const title = raw.title?.trim() || 'City Council Meeting';
  const date = raw.date || new Date().toISOString().split('T')[0];
  const meetingType = raw.meetingType
    ? (classifyMeetingType(raw.meetingType) ?? 'council')
    : classifyMeetingType(title);
  const meetingId = raw.meetingId ?? title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

  // Extract agenda/minutes URLs from raw fields (set by city-specific parsers)
  const agendaUrl = (raw.agenda_url as string | undefined) ?? null;
  const minutesUrl = (raw.minutes_url as string | undefined) ?? null;

  // Extract decisions
  let decisions: MeetingDecision[] = [];
  if (raw.decisionTexts && raw.decisionTexts.length > 0) {
    decisions = raw.decisionTexts.map(text => ({
      itemNumber: null,
      title: text.length > 100 ? text.substring(0, 100) + '...' : text,
      decisionType: classifyDecisionType(text),
      description: text,
      voteResult: null,
      motionText: null,
      movedBy: null,
      secondedBy: null,
    }));
  } else if (raw.rawHtml) {
    decisions = extractDecisionsFromText(raw.rawHtml);
  }

  // Extract agenda items
  const agendaItems: string[] = raw.rawHtml ? extractAgendaItems(raw.rawHtml) : [];

  // Build the record string for hashing
  const recordForHash = JSON.stringify({
    city,
    date,
    meetingType,
    title,
    meetingId,
    agendaUrl,
    minutesUrl,
    decisions: decisions.map(d => `${d.decisionType}:${d.description}`),
    sourceSystem,
  });

  const meeting: MunicipalMeeting = {
    id: await computeHash(recordForHash, 'sha256'),
    city,
    province: config.province,
    date,
    meetingType,
    status: 'completed',
    title,
    description: null,
    department: null,
    meetingUrl: raw.sourceUrl ?? null,
    agendaUrl,
    minutesUrl,
    videoUrl: null,
    decisions,
    agendaItems,
    budgetReference: raw.budgetReference ?? null,
    budgetAmount: null,
    vendorPlatform: config.vendorPlatform,
    sourceUrl: raw.sourceUrl ?? '',
    sourceSystem,
    sourceMeetingId: meetingId,
    ingestedAt: new Date().toISOString(),
  };

  return meeting;
}

/**
 * Parse a page of HTML for a specific city into raw records.
 * This is the main entry point for city-specific HTML parsing.
 */
export function parseMeetingPage(html: string, city: CityCode, sourceUrl: string): RawCouncilRecord[] {
  switch (city) {
    case 'toronto':
      return parseTorontoPage(html, sourceUrl);
    case 'vancouver':
      return parseVancouverPage(html, sourceUrl);
    default:
      return parseGenericPage(html, city, sourceUrl);
  }
}

/**
 * Detect which meeting type keywords are present in a string.
 */
export function detectMeetingTypes(text: string): MeetingType[] {
  const types = new Set<MeetingType>();
  const lower = text.toLowerCase();

  for (const [keyword, meetingType] of Object.entries(MEETING_TYPE_KEYWORDS)) {
    if (lower.includes(keyword)) {
      types.add(meetingType as MeetingType);
    }
  }

  return Array.from(types);
}
