/**
 * CRTC Parser — Quill
 *
 * Parses raw CRTC data (RSS items, HTML pages, decision detail pages)
 * into structured CrtcDecision and CrtcOwnershipRecord records.
 *
 * Parsing strategies:
 *   - RSS items: classify by feed source + title patterns
 *   - Archive HTML: extract decision links from listing pages
 *   - Decision detail pages: extract full metadata from decision HTML
 *   - Ownership pages: extract undertaking-to-owner relationships
 */

import { computeHash } from '../../verification/hashing.js';
import {
  CRTC_DECISION_TYPE_PATTERNS,
  CRTC_SUBJECT_KEYWORDS,
} from './constants.js';
import type {
  CrtcDecision,
  CrtcDecisionType,
  CrtcDecisionOutcome,
  CrtcSubjectMatter,
  CrtcOwnershipRecord,
  OwnershipRecordType,
  RawCrtcDecisionItem,
  RawCrtcOwnershipItem,
  CrtcIngestionResult,
} from './types.js';


/* ------------------------------------------------------------------ */
/*  Text Processing Helpers                                            */
/* ------------------------------------------------------------------ */

/**
 * Strip HTML tags from a string and decode common entities.
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m: string, n: string) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse a date string into ISO-8601 format (YYYY-MM-DD).
 */
export function parseDate(dateStr: string): string {
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

  // "DD/MM/YYYY" (common in French format)
  const frenchDate = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (frenchDate) {
    return `${frenchDate[3]}-${frenchDate[2]}-${frenchDate[1]}`;
  }

  return dateStr;
}

/**
 * Detect the language of a decision from its content.
 */
export function detectLanguage(html: string, title: string): string {
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
 * Classify a CRTC decision type from the raw type string and title.
 */
export function classifyDecisionType(rawType: string, title: string): CrtcDecisionType {
  // Check against known patterns
  const lowerRawType = rawType.toLowerCase();
  const lowerTitle = title.toLowerCase();

  for (const [pattern, type] of Object.entries(CRTC_DECISION_TYPE_PATTERNS)) {
    if (
      lowerRawType.includes(pattern.toLowerCase()) ||
      lowerTitle.includes(pattern.toLowerCase())
    ) {
      return type as CrtcDecisionType;
    }
  }

  // Fallback: check for keywords in title
  if (lowerTitle.includes('broadcasting')) return 'broadcasting-decision';
  if (lowerTitle.includes('telecom') || lowerTitle.includes('télécom')) return 'telecom-decision';
  if (lowerTitle.includes('ownership') || lowerTitle.includes('transfer of control')) {
    return 'ownership-change';
  }

  return 'broadcasting-decision';
}

/**
 * Classify decision outcome from text content.
 */
export function classifyOutcome(text: string): CrtcDecisionOutcome {
  const lower = text.toLowerCase();

  if (/\b(?:denied|refused|rejected|refuse|rejeter|not approved)\b/.test(lower)) {
    return 'denied';
  }
  if (/\b(?:condition|subject to|subject|subject to the following)\b/.test(lower)) {
    return 'conditionally-approved';
  }
  if (/\b(?:partially approved|partially grant)\b|\bpartiellement/.test(lower)) {
    return 'partially-approved';
  }
  if (/\b(?:withdrawn|abandoned|withdraw)\b|\bretiré/.test(lower)) {
    return 'withdrawn';
  }
  if (/\b(?:deferred|postponed|defer)\b|\breporté/.test(lower)) {
    return 'deferred';
  }
  if (/\b(?:approved|granted|grant|approve)\b|\bapprouvé|\baccordé/.test(lower)) {
    return 'approved';
  }

  return 'unknown';
}

/**
 * Extract subject matter categories from decision text.
 */
export function classifySubjectMatters(title: string, _summary: string | null, findings: string[]): CrtcSubjectMatter[] {
  const text = [title, ...findings].join(' ').toLowerCase();
  const subjects: Set<CrtcSubjectMatter> = new Set();

  for (const [subject, keywords] of Object.entries(CRTC_SUBJECT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        subjects.add(subject as CrtcSubjectMatter);
        break;
      }
    }
  }

  if (subjects.size === 0) {
    subjects.add('other');
  }

  return Array.from(subjects);
}


/* ------------------------------------------------------------------ */
/*  Decision Detail Parsing                                            */
/* ------------------------------------------------------------------ */

/**
 * Extract the decision summary from the decision detail page HTML.
 * CRTC decision pages typically have a summary section at the top.
 */
function extractDecisionSummary(html: string): string | null {
  const text = stripHtml(html);

  // Look for the summary between "Summary" heading and "Decision" section
  const summaryMatch = text.match(
    /(?:Summary|Résumé)\s*:?\s*([^.]*\.[^.]*\.[^.]*\.)/i,
  );
  if (summaryMatch && summaryMatch[1].length > 20) {
    return summaryMatch[1].trim();
  }

  // Try the first paragraph after the title as summary
  const paraMatch = text.match(
    /^\s*(?:The Commission|Le Conseil|In this|In the|CRTC)\s*([^.]*\.[^.]*\.)/i,
  );
  if (paraMatch) {
    return paraMatch[1].trim();
  }

  return null;
}

/**
 * Extract findings from a decision detail page.
 * Looks for regulatory findings, determinations, and conclusions.
 */
function extractFindings(html: string): string[] {
  const findings: string[] = [];
  const text = stripHtml(html);

  // Pattern: numbered findings or determinations
  const findingPatterns = [
    /(?:The Commission finds|The Commission determines|The Commission concludes|Le Conseil conclut)\s+that\s+([^.]*\.)/gi,
    /(?:finds|determines|concludes)\s+that\s+([^.]*\.)/gi,
    /\b(?:the Commission is satisfied that|the Commission considers that)\s+([^.]*\.)/gi,
    /(?:Accordingly|Therefore|Consequently|Par conséquent|En conséquence)\s*,?\s+([^.]*\.)/gi,
  ];

  for (const pattern of findingPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const finding = match[1].trim();
      if (finding && finding.length > 15 && !findings.includes(finding)) {
        findings.push(finding);
      }
    }
  }

  return findings;
}

/**
 * Extract conditions imposed by a CRTC decision.
 * Conditions are typically listed as required actions the applicant must take.
 */
function extractConditions(html: string): string[] {
  const conditions: string[] = [];
  const text = stripHtml(html);

  const conditionPatterns = [
    /(?:Commission|Conseil)\s+(?:imposes|orders|requires|directs|exige|ordonne)\s+([^.]*\.)/gi,
    /(?:subject to the following|subject to|condition|term|requirement)\s*:?\s*([^.]*\.)/gi,
    /(?:must|shall)\s+(?:file|submit|provide|report|comply|ensure|implement)\s+([^.]*\.)/gi,
  ];

  for (const pattern of conditionPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const condition = match[1].trim();
      if (condition && condition.length > 10 && !conditions.includes(condition)) {
        conditions.push(condition);
      }
    }
  }

  return conditions;
}

/**
 * Extract related companies from a CRTC decision text.
 * Looks for company names that are often mentioned in the decision.
 */
export function extractRelatedCompanies(title: string, html: string): string[] {
  const text = [title, stripHtml(html)].join(' ');
  const companies: string[] = [];

  // Known major Canadian media/telecom companies
  const knownCompanies = [
    'Bell Canada', 'BCE Inc', 'Bell Media', 'Rogers Communications', 'Rogers',
    'Quebecor Media', 'Quebecor', 'Videotron', 'Telus Communications', 'Telus',
    'Shaw Communications', 'Shaw', 'Cogeco', 'Cogeco Communications',
    'Eastlink', 'Bragg Communications', 'SaskTel', 'Manitoba Telecom Services',
    'MTS', 'Allstream', 'Globalive', 'Wind Mobile', 'Freedom Mobile',
    'Corus Entertainment', 'Corus', 'CTVglobemedia', 'CTV',
    'Canadian Broadcasting Corporation', 'CBC', 'Radio-Canada',
    'La Presse', 'Le Devoir', 'Toronto Star', 'Torstar', 'Postmedia',
    'Globe and Mail', 'National Post', 'Canadian Press', 'CP',
    'Astral Media', 'Stingray Digital', 'Blue Ant Media',
    'Thunderbird Entertainment', 'DHX Media', 'WildBrain',
    'Access Communications', 'Northwestel', 'Télébec',
  ];

  for (const company of knownCompanies) {
    if (text.includes(company)) {
      companies.push(company);
    }
  }

  return companies;
}


/* ------------------------------------------------------------------ */
/*  Main Decision Parser                                               */
/* ------------------------------------------------------------------ */

/**
 * Parse a raw CRTC decision item into a structured CrtcDecision.
 *
 * @param item - Raw decision item from the fetcher
 * @param bodyHtml - Optional HTML body from fetched detail page
 * @returns Parsed CrtcDecision
 */
export async function parseCrtcDecision(
  item: RawCrtcDecisionItem,
  bodyHtml: string | null = null,
): Promise<CrtcDecision> {
  const now = new Date().toISOString();
  const html = bodyHtml || item.bodyHtml || '';

  // Classify decision type
  const decisionType = classifyDecisionType(item.rawType, item.title);

  // Parse decision number
  const decisionNumber = item.decisionNumber || '';

  // Extract summary from detail HTML or use RSS description
  const summary = bodyHtml
    ? extractDecisionSummary(html) || item.summary
    : item.summary;

  // Extract findings from detail HTML
  const findings = bodyHtml ? extractFindings(html) : [];

  // Extract conditions from detail HTML
  const conditions = bodyHtml ? extractConditions(html) : [];

  // Extract related companies
  const relatedCompanies = extractRelatedCompanies(item.title, html);

  // Classify subject matters
  const subjectMatters = classifySubjectMatters(item.title, summary, findings);

  // Classify outcome
  const outcomeText = [item.title, summary || '', ...findings].join(' ');
  const outcome = classifyOutcome(outcomeText);

  // Extract applicant (first company mentioned or from title)
  const applicant = extractApplicant(item.title, html);

  // Set flags
  const lowerTitle = item.title.toLowerCase();
  const isOwnershipChange =
    decisionType === 'ownership-change' ||
    subjectMatters.includes('ownership-change') ||
    /\b(?:ownership|transfer of control|acquisition|merger)\b/i.test(lowerTitle);
  const isNetNeutrality = subjectMatters.includes('net-neutrality');
  const isTelecomPricing = subjectMatters.includes('telecom-pricing');
  const isCanadianContent = subjectMatters.includes('canadian-content');
  const isLicenceRenewal =
    /\b(?:renew|renewal|renouvellement|licence)\b/i.test(lowerTitle);

  // Detect language
  const language = detectLanguage(html, item.title);

  // Compute SHA-256 hash
  const contentForHash = [
    'crtc',
    decisionNumber,
    item.title,
    item.date,
    item.url,
  ].join('|');
  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    decisionNumber,
    title: item.title,
    date: parseDate(item.date),
    type: decisionType,
    applicant,
    outcome,
    subjectMatter: subjectMatters,
    relatedCompanies,
    conditions,
    findings,
    isOwnershipChange,
    isNetNeutrality,
    isTelecomPricing,
    isCanadianContent,
    isLicenceRenewal,
    summary,
    sourceUrl: item.url,
    pdfUrl: guessPdfUrl(item.url),
    language,
    ingestedAt: now,
  };
}

/**
 * Extract the applicant name from decision title/body.
 */
export function extractApplicant(title: string, html: string): string | null {
  const text = [title, stripHtml(html)].join(' ');

  // Look for "Application by X" pattern
  const appByMatch = text.match(/application\s+(?:by|from|de)\s+([^-–—.,]+)/i);
  if (appByMatch) return appByMatch[1].trim();

  // Look for company names at the start of the title
  // Titles often start with the applicant name
  const knownCompanies = [
    'Bell Canada', 'Bell Media', 'Rogers Communications', 'Rogers',
    'Quebecor Media', 'Quebecor', 'Videotron', 'Telus',
    'Shaw Communications', 'Shaw', 'Cogeco', 'Eastlink',
    'SaskTel', 'Globalive', 'Corus Entertainment', 'Corus',
    'Canadian Broadcasting Corporation', 'CBC', 'Radio-Canada',
    'Torstar', 'Postmedia', 'Astral Media',
  ];

  for (const company of knownCompanies) {
    if (title.startsWith(company)) {
      return company;
    }
  }

  return null;
}

/**
 * Guess the PDF URL from a decision page URL.
 * CRTC decisions often have corresponding PDFs at the same path with .pdf extension.
 */
export function guessPdfUrl(pageUrl: string): string | null {
  if (!pageUrl) return null;
  // Replace .htm or .html with .pdf
  return pageUrl.replace(/\.html?$/, '.pdf');
}

/**
 * Parse a list of raw CRTC decision items into CrtcDecision records.
 *
 * @param items - Raw decision items from the fetcher
 * @param htmlBodies - Optional map of URL -> HTML body for detail pages
 * @returns Array of parsed CrtcDecision records
 */
export async function parseCrtcDecisionList(
  items: RawCrtcDecisionItem[],
  options: {
    /** Map of decision detail HTML bodies keyed by URL */
    detailPages?: Map<string, string>;
    /** Progress callback */
    onProgress?: (msg: string) => void;
  } = {},
): Promise<CrtcDecision[]> {
  const decisions: CrtcDecision[] = [];
  const log = options.onProgress ?? (() => {});

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const bodyHtml = options.detailPages?.get(item.url) ?? null;
      const decision = await parseCrtcDecision(item, bodyHtml);
      decisions.push(decision);

      if ((i + 1) % 25 === 0) {
        log(`[CRTC Parser] Parsed ${i + 1}/${items.length} decisions`);
      }
    } catch (err) {
      log(`[CRTC Parser] Error parsing ${item.url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return decisions;
}


/* ------------------------------------------------------------------ */
/*  Ownership Parser                                                   */
/* ------------------------------------------------------------------ */

/**
 * Parse a raw CRTC ownership item into a structured CrtcOwnershipRecord.
 *
 * @param item - Raw ownership item
 * @returns Parsed CrtcOwnershipRecord
 */
export async function parseCrtcOwnershipRecord(
  item: RawCrtcOwnershipItem,
): Promise<CrtcOwnershipRecord> {
  const now = new Date().toISOString();

  // Classify ownership record type
  const recordType = classifyOwnershipRecordType(item.undertakingType);

  // Parse ownership percentage
  const ownershipPercentage = item.ownershipPercentage
    ? parseFloat(item.ownershipPercentage.replace(/[^0-9.]/g, ''))
    : null;

  // Parse transaction value
  const transactionValue = item.transactionValue
    ? parseFloat(item.transactionValue.replace(/[^0-9.]/g, ''))
    : null;

  // Compute SHA-256 hash
  const contentForHash = [
    'crtc-ownership',
    item.undertakingName,
    item.ownerName,
    item.sourceUrl,
  ].join('|');
  const id = await computeHash(contentForHash, 'sha256');

  return {
    id,
    recordType,
    undertakingName: item.undertakingName,
    undertakingType: item.undertakingType,
    serviceArea: item.serviceArea,
    licenceNumber: item.licenceNumber,
    ownerName: item.ownerName,
    parentCompany: item.parentCompany,
    ownershipPercentage,
    effectiveDate: item.effectiveDate ? parseDate(item.effectiveDate) : null,
    publishedDate: item.publishedDate ? parseDate(item.publishedDate) : null,
    transactionValue,
    sourceUrl: item.sourceUrl,
    sourceSystem: 'crtc-ownership-page',
    ingestedAt: now,
  };
}

/**
 * Classify the ownership record type based on undertaking type.
 */
export function classifyOwnershipRecordType(undertakingType: string): OwnershipRecordType {
  const lower = undertakingType.toLowerCase();

  if (lower.includes('television') || lower.includes('tv') || lower.includes('radio')) {
    return 'broadcasting-undertaking';
  }
  if (lower.includes('telecom') || lower.includes('telephone') || lower.includes('phone')) {
    return 'telecom-undertaking';
  }
  if (lower.includes('group') || lower.includes('holding') || lower.includes('parent')) {
    return 'media-ownership-group';
  }
  if (lower.includes('transfer') || lower.includes('acquisition') || lower.includes('merger')) {
    return 'transfer-of-control';
  }

  return 'broadcasting-undertaking';
}

/**
 * Parse ownership data from CRTC ownership page HTML.
 * The CRTC ownership page lists broadcasting undertakings and their owners
 * in tables or structured lists.
 *
 * @param html - HTML of the ownership page
 * @returns Array of raw ownership items
 */
export function parseOwnershipPageHtml(html: string): RawCrtcOwnershipItem[] {
  const items: RawCrtcOwnershipItem[] = [];

  // Pattern 1: Parse tables on the ownership page
  // CRTC ownership pages typically use <table> with rows for each undertaking
  const tables = html.match(/<table[^>]*>([\s\S]*?)<\/table>/gi) || [];

  for (const table of tables) {
    const rows = table.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

    for (const row of rows) {
      const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
      const cellTexts = cells.map(c => stripHtml(c));

      if (cellTexts.length >= 2) {
        const linkMatch = cells[0]?.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
        const undertakingName = linkMatch
          ? stripHtml(linkMatch[2])
          : cellTexts[0] || '';

        if (!undertakingName || undertakingName.length < 2) continue;

        const sourceUrl = linkMatch
          ? (linkMatch[1].startsWith('http') ? linkMatch[1] : `https://crtc.gc.ca${linkMatch[1]}`)
          : '';

        items.push({
          undertakingName,
          undertakingType: cellTexts[1] || '',
          serviceArea: cellTexts[2] || null,
          licenceNumber: null,
          ownerName: '',  // Owner-specific parsing
          parentCompany: null,
          ownershipPercentage: null,
          effectiveDate: null,
          publishedDate: null,
          transactionValue: null,
          sourceUrl,
          bodyHtml: null,
        });
      }
    }
  }

  return items;
}


/* ------------------------------------------------------------------ */
/*  Ingestion Result Helper                                            */
/* ------------------------------------------------------------------ */

/**
 * Create a CRTC ingestion result.
 */
export function createIngestionResult(
  options: {
    decisionsFound?: number;
    decisionsIngested?: number;
    ownershipRecordsFound?: number;
    ownershipRecordsIngested?: number;
    sourcesTried?: string[];
    errors?: string[];
    startTime?: number;
  } = {},
): CrtcIngestionResult {
  const startTime = options.startTime ?? Date.now();
  return {
    decisionsFound: options.decisionsFound ?? 0,
    decisionsIngested: options.decisionsIngested ?? 0,
    ownershipRecordsFound: options.ownershipRecordsFound ?? 0,
    ownershipRecordsIngested: options.ownershipRecordsIngested ?? 0,
    sourcesTried: options.sourcesTried ?? [],
    errors: options.errors ?? [],
    durationMs: Date.now() - startTime,
  };
}
