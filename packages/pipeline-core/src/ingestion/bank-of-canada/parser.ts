// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Bank of Canada Parser — Quill
 *
 * Parses raw Bank of Canada data (RSS items, HTML pages, detail pages)
 * into structured BocDecision records.
 *
 * Parsing strategies:
 *   - Rate decisions: extract key rate from title/summary, determine
 *     effective date from schedule or known history
 *   - MPR/FSR publications: extract title, date, summary from listing
 *   - Speeches: extract speaker name, title, event from content
 */

import { computeHash } from '../../verification/hashing.js';
import {
  findRateByDate,
  BOC_RATE_HISTORY,
} from './constants.js';
import type {
  BocDecision,
  BocDecisionType,
  RawBocItem,
  BocIngestionResult,
} from './types.js';


/* ------------------------------------------------------------------ */
/*  Text Processing Helpers                                            */
/* ------------------------------------------------------------------ */

/**
 * Strip HTML tags from a string and decode common entities.
 */
function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m: string, n: string) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse a date string into ISO-8601 format (YYYY-MM-DD).
 */
function parseDate(dateStr: string): string {
  if (!dateStr) return '';

  // Already ISO-8601
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.substring(0, 10);
  }

  // "Month Day, Year" e.g., "May 12, 2024"
  const monthDayYear = dateStr.match(/(\w+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (monthDayYear) {
    const d = new Date(`${monthDayYear[1]} ${monthDayYear[2]}, ${monthDayYear[3]}`);
    return isNaN(d.getTime()) ? dateStr : d.toISOString().substring(0, 10);
  }

  // "YYYY/MM/DD"
  const slashDate = dateStr.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  if (slashDate) {
    return `${slashDate[1]}-${slashDate[2]}-${slashDate[3]}`;
  }

  return dateStr;
}

/**
 * Detect the language of a publication from its content.
 */
function detectLanguage(html: string, title: string): string {
  if (html?.includes('lang="fr"') || html?.includes("lang='fr'")) {
    return 'fr';
  }
  if (title.match(/[éèêëàâäùûüôöîïç]/i)) {
    return 'fr';
  }
  return 'en';
}


/* ------------------------------------------------------------------ */
/*  Decision Type Classification                                       */
/* ------------------------------------------------------------------ */

/**
 * Classify the Bank of Canada decision type from raw type and content.
 */
function classifyType(rawType: string, title: string, url: string): BocDecisionType {
  const lowerTitle = title.toLowerCase();
  const lowerUrl = url.toLowerCase();
  const lowerRaw = rawType.toLowerCase();

  // Check raw type first
  if (lowerRaw === 'rate') return 'rate';
  if (lowerRaw === 'mpr') return 'mpr';
  if (lowerRaw === 'fsr') return 'fsr';
  if (lowerRaw === 'speech') return 'speech';

  // Check URL patterns
  if (lowerUrl.includes('/mpr/') || lowerUrl.includes('monetary-policy-report')) return 'mpr';
  if (lowerUrl.includes('/fsr/') || lowerUrl.includes('financial-system-review')) return 'fsr';
  if (lowerUrl.includes('/speech') || lowerUrl.includes('/discours')) return 'speech';
  if (lowerUrl.includes('/rates/') || lowerUrl.includes('rate-announcement') || lowerUrl.includes('key-interest-rate')) return 'rate';

  // Check title patterns
  if (lowerTitle.includes('monetary policy report') || lowerTitle.includes('mpr')) return 'mpr';
  if (lowerTitle.includes('financial system review') || lowerTitle.includes('fsr')) return 'fsr';
  if (lowerTitle.includes('speech') || lowerTitle.includes('discours') || lowerTitle.includes('remarks')) return 'speech';
  if (lowerTitle.includes('overnight rate') || lowerTitle.includes('interest rate') || lowerTitle.includes('key interest')) return 'rate';

  // Check known rate announcement patterns
  if (lowerTitle.includes('bank of canada') && lowerTitle.includes('rate') && lowerTitle.includes('target')) return 'rate';

  return 'rate';
}


/* ------------------------------------------------------------------ */
/*  Key Rate Extraction                                                */
/* ------------------------------------------------------------------ */

/**
 * Extract the key policy interest rate from a title or summary.
 *
 * Bank of Canada rate announcements typically state the new rate
 * in the title or first paragraph, e.g.:
 *   "Bank of Canada lowers target for the overnight rate to 4.75%"
 *   "Bank of Canada maintains overnight rate target at 5%"
 */
function extractKeyRate(title: string, summary: string | null, html: string | null): string | null {
  const text = [title, summary || '', html ? stripHtml(html) : ''].join(' ');

  // Pattern: "rate to X%" or "rate at X%" or "rate to X per cent"
  const ratePatterns = [
    /(?:rate|target)\s+(?:to|at|of)\s+(\d+\.?\d*)\s*%/i,
    /(?:rate|target)\s+(?:to|at|of)\s+(\d+\.?\d*)\s*percent/i,
    /(?:rate|target)\s+(?:to|at|of)\s+(\d+\.?\d*)\s*per cent/i,
    /overnight\s+rate\s+(?:target\s+)?(?:of\s+)?(\d+\.?\d*)\s*%/i,
    /key\s+(?:policy\s+)?(?:interest\s+)?rate\s+(?:to|at|of)\s+(\d+\.?\d*)\s*%/i,
    /(\d+\.?\d*)\s*%\s*(?:overnight\s+)?rate/i,
    /(\d+\.?\d*)\s*%\s*key\s+(?:policy\s+)?(?:interest\s+)?rate/i,
  ];

  for (const pattern of ratePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1]; // e.g., "4.75", "5.00"
    }
  }

  return null;
}

/**
 * Extract the effective date for a rate decision.
 *
 * Bank of Canada rate decisions take effect the business day
 * following the announcement. Known dates are in our history table.
 */
function extractEffectiveDate(date: string): string | null {
  if (!date) return null;

  // Check known history first
  const known = findRateByDate(date);
  if (known?.effectiveDate) return known.effectiveDate;

  // Default: next business day (approximate — add 1 day)
  const d = new Date(date + 'T12:00:00Z');
  if (isNaN(d.getTime())) return null;

  d.setDate(d.getDate() + 1);

  // Skip weekends
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }

  return d.toISOString().substring(0, 10);
}


/* ------------------------------------------------------------------ */
/*  Speech Metadata Extraction                                         */
/* ------------------------------------------------------------------ */

/**
 * Extract speaker name from speech content.
 * Looks for patterns like "Governor Tiff Macklem" or "Speech by ..."
 */
function extractSpeaker(title: string, summary: string | null, html: string | null, rawSpeaker: string | null): string | null {
  if (rawSpeaker) return rawSpeaker;

  const text = [title, summary || '', html ? stripHtml(html) : ''].join(' ');

  // Known Bank of Canada executives
  const knownSpeakers: { name: string; patterns: string[] }[] = [
    { name: 'Tiff Macklem', patterns: ['tiff macklem', 'governor macklem', 'gouverneur macklem'] },
    { name: 'Carolyn Rogers', patterns: ['carolyn rogers', 'senior deputy governor rogers', 'première sous-gouverneure rogers'] },
    { name: 'Sharon Kozicki', patterns: ['sharon kozicki', 'deputy governor kozicki', 'sous-gouverneur kozicki'] },
    { name: 'Toni Gravelle', patterns: ['toni gravelle', 'deputy governor gravelle', 'sous-gouverneur gravelle'] },
    { name: 'Nicolas Vincent', patterns: ['nicolas vincent', 'deputy governor vincent', 'sous-gouverneur vincent'] },
    { name: 'Michelle Alexopoulos', patterns: ['michelle alexopoulos', 'deputy governor alexopoulos', 'sous-gouverneur alexopoulos'] },
    { name: 'Rhys Mendes', patterns: ['rhys mendes', 'deputy governor mendes', 'sous-gouverneur mendes'] },
    { name: 'Paul Beaudry', patterns: ['paul beaudry', 'deputy governor beaudry', 'sous-gouverneur beaudry'] },
    { name: 'Lawrence Schembri', patterns: ['lawrence schembri', 'deputy governor schembri', 'sous-gouverneur schembri'] },
    { name: 'Timothy Lane', patterns: ['timothy lane', 'deputy governor lane', 'sous-gouverneur lane'] },
    { name: 'Carolyn Wilkins', patterns: ['carolyn wilkins', 'senior deputy governor wilkins', 'première sous-gouverneure wilkins'] },
    { name: 'Stephen Poloz', patterns: ['stephen poloz', 'governor poloz', 'gouverneur poloz'] },
  ];

  const lower = text.toLowerCase();
  for (const speaker of knownSpeakers) {
    for (const pattern of speaker.patterns) {
      if (lower.includes(pattern)) {
        return speaker.name;
      }
    }
  }

  // Generic pattern: "Speech by X" or "Remarks by X"
  const byMatch = text.match(/(?:speech|remarks|discours)\s+(?:by|de|from|par)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/i);
  if (byMatch) return byMatch[1].trim();

  return null;
}

/**
 * Extract speaker title/role from content.
 */
function extractSpeakerTitle(title: string, html: string | null): string | null {
  const text = [title, html ? stripHtml(html) : ''].join(' ');

  const roleMatch = text.match(/\b(Governor|Senior Deputy Governor|Deputy Governor|Gouverneur|Première sous-gouverneure|Sous-gouverneur|sous-gouverneure)\b/i);
  if (roleMatch) {
    // Normalize to English
    const role = roleMatch[1];
    const roleMap: Record<string, string> = {
      'Governor': 'Governor',
      'Senior Deputy Governor': 'Senior Deputy Governor',
      'Deputy Governor': 'Deputy Governor',
      'Gouverneur': 'Governor',
      'Première sous-gouverneure': 'Senior Deputy Governor',
      'Sous-gouverneur': 'Deputy Governor',
      'sous-gouverneure': 'Deputy Governor',
    };
    return roleMap[role] || role;
  }

  return null;
}

/**
 * Extract event name from speech content.
 */
function extractEvent(title: string, summary: string | null, html: string | null): string | null {
  const text = [title, summary || '', html ? stripHtml(html) : ''].join(' ');

  // Pattern: "to the X" or "at the X" or "before the X"
  const eventPatterns = [
    /(?:to|before|before the|to the|at the)\s+([A-Z][A-Za-z\s&,\-]+?)(?:on|in|\.|$)/i,
    /(?:Canadian|speech|remarks)\s+(?:to|at|before)\s+(?:the\s+)?([A-Z][A-Za-z\s&,\-]+?)(?:on|in|\.|$)/i,
  ];

  for (const pattern of eventPatterns) {
    const match = text.match(pattern);
    if (match) {
      const event = match[1].trim();
      if (event.length > 5 && event.length < 100) {
        return event;
      }
    }
  }

  return null;
}

/**
 * Extract a PDF URL from the detail page HTML.
 * Bank of Canada publications typically have PDF links.
 */
function extractPdfUrl(html: string | null, pageUrl: string): string | null {
  if (!html) return null;

  // Look for PDF links in the page
  const pdfMatch = html.match(/<a[^>]*href="([^"]*\.pdf)"[^>]*>/i);
  if (pdfMatch) {
    const href = pdfMatch[1].trim();
    if (href.startsWith('http')) return href;
    if (href.startsWith('/')) return `${pages_base_url(pageUrl)}${href}`;
    return `${pageUrl.substring(0, pageUrl.lastIndexOf('/') + 1)}${href}`;
  }

  return null;
}

/**
 * Get the base URL for resolving relative paths.
 */
function pages_base_url(pageUrl: string): string {
  const match = pageUrl.match(/^(https?:\/\/[^/]+)/);
  return match ? match[1] : 'https://www.bankofcanada.ca';
}

/**
 * Extract a summary from the detail page HTML.
 */
function extractSummary(html: string, fallbackSummary: string | null): string | null {
  if (!html) return fallbackSummary;

  const text = stripHtml(html);

  // Look for the first meaningful paragraph (summary/abstract area)
  const summaryPatterns = [
    /(?:Summary|Abstract|Résumé|Synopsis)\s*:?\s*([^.]*\.[^.]*\.[^.]*\.)/i,
    // First paragraph after the title that's substantive
    /^\s*(?:The Bank|The Canadian economy|Inflation|The Bank of Canada|Canada's economy)[^.]*\.[^.]*\./im,
  ];

  for (const pattern of summaryPatterns) {
    const match = text.match(pattern);
    if (match && match[1].length > 20) {
      return match[1].trim();
    }
  }

  // Use the first 2-3 sentences as fallback
  const firstSentences = text.match(/^([^.]*\.[^.]*\.[^.]*\.)/);
  if (firstSentences && firstSentences[1].length > 30) {
    return firstSentences[1].trim();
  }

  return fallbackSummary;
}


/* ------------------------------------------------------------------ */
/*  Main Decision Parser                                               */
/* ------------------------------------------------------------------ */

/**
 * Parse a raw Bank of Canada item into a structured BocDecision.
 *
 * @param item - Raw item from the fetcher
 * @param bodyHtml - Optional HTML body from fetched detail page
 * @returns Parsed BocDecision
 */
export async function parseBocDecision(
  item: RawBocItem,
  bodyHtml: string | null = null,
): Promise<BocDecision> {
  const now = new Date().toISOString();
  const html = bodyHtml || item.bodyHtml || '';

  // Classify decision type
  const type = classifyType(item.rawType, item.title, item.url);

  // Parse date
  const date = parseDate(item.date);

  // Extract summary
  const summary = bodyHtml
    ? extractSummary(html, item.summary)
    : item.summary;

  // Type-specific extractions
  let keyRate: string | null = null;
  let effectiveDate: string | null = null;
  let speaker: string | null = null;
  let speakerTitle: string | null = null;
  let event: string | null = null;

  if (type === 'rate') {
    keyRate = extractKeyRate(item.title, summary, html);
    effectiveDate = extractEffectiveDate(date);
  }

  if (type === 'speech') {
    speaker = extractSpeaker(item.title, summary, html, item.speaker);
    speakerTitle = extractSpeakerTitle(item.title, html);
    event = extractEvent(item.title, summary, html);
  }

  // Extract PDF URL
  const pdfUrl = extractPdfUrl(html, item.url);

  // Detect language
  const language = detectLanguage(html, item.title);

  // Compute SHA-256 hash
  const contentForHash = [
    'bank-of-canada',
    type,
    item.title,
    date || item.date,
    item.url,
  ].join('|');
  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    date,
    type,
    title: item.title,
    summary,
    url: item.url,
    keyRate,
    effectiveDate,
    speaker,
    speakerTitle,
    event,
    pdfUrl,
    language,
    ingestedAt: now,
  };
}

/**
 * Parse a list of raw Bank of Canada items into BocDecision records.
 *
 * @param items - Raw items from the fetcher
 * @param options - Options including detail page HTML bodies
 * @returns Array of parsed BocDecision records
 */
export async function parseBocDecisionList(
  items: RawBocItem[],
  options: {
    /** Map of detail HTML bodies keyed by URL */
    detailPages?: Map<string, string>;
    /** Progress callback */
    onProgress?: (msg: string) => void;
  } = {},
): Promise<BocDecision[]> {
  const decisions: BocDecision[] = [];
  const log = options.onProgress ?? (() => {});

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const bodyHtml = options.detailPages?.get(item.url) ?? null;
      const decision = await parseBocDecision(item, bodyHtml);
      decisions.push(decision);

      if ((i + 1) % 25 === 0) {
        log(`[BoC Parser] Parsed ${i + 1}/${items.length} items`);
      }
    } catch (err) {
      log(`[BoC Parser] Error parsing ${item.url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return decisions;
}


/* ------------------------------------------------------------------ */
/*  Ingestion Result Builder                                          */
/* ------------------------------------------------------------------ */

/**
 * Create a BocIngestionResult from partial data and start time.
 */
export function createIngestionResult(params: {
  decisionsFound?: number;
  decisionsIngested?: number;
  sourcesTried?: string[];
  errors?: string[];
  startTime: number;
}): BocIngestionResult {
  return {
    decisionsFound: params.decisionsFound ?? 0,
    decisionsIngested: params.decisionsIngested ?? 0,
    sourcesTried: params.sourcesTried ?? [],
    errors: params.errors ?? [],
    durationMs: Date.now() - params.startTime,
  };
}
