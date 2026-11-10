// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Oversight Bodies Parser — Quill
 *
 * Parses raw HTML report listings from Canada's independent oversight bodies
 * into structured OversightReport and Recommendation records.
 *
 * Each body has a dedicated parse function to handle its unique HTML/API
 * structure, but all produce the same output types.
 */

import { computeHash } from '../../verification/hashing.js';
import {
  OAG_REPORT_TYPE_MAP,
  PBO_REPORT_TYPE_MAP,
} from './constants.js';
import type {
  OversightBody,
  OversightReport,
  OversightReportType,
  RawOAGItem,
  RawPBOItem,
  RawCompetitionBureauItem,
  RawCRTCItem,
  Recommendation,
  MergerReview,
  CRTCDecision,
} from './types.js';


/**
 * Extract text content from an HTML string, stripping all tags.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m: string, n: string) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse a date string into ISO-8601 format (YYYY-MM-DD).
 * Handles multiple common formats.
 */
function parseDate(dateStr: string): string {
  if (!dateStr) return '';

  // Already ISO-8601
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.substring(0, 10);
  }

  // "Month Day, Year" e.g., "May 12, 2026"
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
 * Parse a PBO publication detail page HTML to extract recommendations.
 * PBO reports often contain sections with findings and recommendations.
 *
 * @param html - The HTML content of a PBO publication detail page
 * @returns Array of extracted recommendations
 */
export function parsePBORecommendations(html: string): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const text = stripHtml(html);

  // Look for recommendation-like sections in the content
  // PBO reports typically use "Recommendation" or "Finding" headings
  const recPatterns = [
    /(?:Recommendation|Recommend|Finding)\s*(?:#|No\.|Nº)?\s*(\d+)[:.)]\s*([^.]*\.)/gi,
    /(?:recommend|should|ought|need to)\s+([^.]*\.)/gi,
  ];

  let match: RegExpExecArray | null;
  let seq = 0;

  for (const pattern of recPatterns) {
    while ((match = pattern.exec(text)) !== null) {
      seq++;
      const recText = match[2] || match[1] || '';
      recommendations.push({
        id: '', // filled after hash
        reportId: '',
        text: recText.trim(),
        number: seq,
        status: 'unknown',
        responsibleEntity: null,
        statusDate: null,
        targetDate: null,
        implementationNotes: null,
        ingestedAt: '',
      });
    }
  }

  return recommendations;
}


/**
 * Map a PBO publication type string to our canonical type enum.
 */
function mapPBOType(pboType: string): OversightReportType {
  const lower = pboType.toLowerCase();
  if (lower.includes('legislative costing')) return 'legislative-costing-note';
  if (lower.includes('cost estimate')) return 'cost-estimate';
  if (lower.includes('research')) return 'research-report';
  if (lower.includes('media')) return 'media-release';
  if (lower.includes('opening')) return 'opening-statement';
  if (lower.includes('report')) return 'cost-estimate';
  return 'research-report';
}

/**
 * Parse a list of RawPBOItem entries into OversightReport records.
 *
 * @param items - Raw PBO publication items from the fetcher
 * @param body - The oversight body identifier
 * @returns Array of parsed OversightReport
 */
export async function parsePBOReportList(
  items: RawPBOItem[],
  body: OversightBody = 'PBO',
): Promise<OversightReport[]> {
  const reports: OversightReport[] = [];

  for (const item of items) {
    const now = new Date().toISOString();
    const reportType = mapPBOType(item.type);

    // Create the content string for hashing
    const contentForHash = `${body}|${item.title}|${item.date}|${item.url}`;
    const id = await computeHash(contentForHash, 'sha256');

    const report: OversightReport = {
      id,
      body,
      title: item.title,
      date: parseDate(item.date),
      url: item.url,
      pdfUrl: item.pdfUrl,
      reportType,
      summary: item.summary || null,
      findings: [],      // populated from detail page parsing
      recommendations: [], // populated from detail page parsing
      auditedEntities: [],
      fiscalYear: null,
      reportNumber: item.reportNumber,
      language: 'en',
      ingestedAt: now,
    };

    reports.push(report);
  }

  return reports;
}


/**
 * Map OAG report type keywords to canonical enum.
 */
function mapOAGType(oagType: string): OversightReportType {
  return (OAG_REPORT_TYPE_MAP[oagType.toLowerCase()] as OversightReportType) || 'performance-audit';
}

/**
 * Parse a list of RawOAGItem entries into OversightReport records.
 *
 * OAG reports often list:
 *   - Performance audits (6-12 major per year)
 *   - Special examinations of Crown corporations
 *   - Reports of the Commissioner of the Environment and Sustainable Development
 *   - Annual/corporate reports
 *
 * @param items - Raw OAG report items from the fetcher
 * @param body - The oversight body identifier
 * @returns Array of parsed OversightReport
 */
export async function parseOAGReportList(
  items: RawOAGItem[],
  body: OversightBody = 'OAG',
): Promise<OversightReport[]> {
  const reports: OversightReport[] = [];

  for (const item of items) {
    const now = new Date().toISOString();
    const reportType = mapOAGType(item.reportType);

    // Create content for SHA-256 hash
    const contentForHash = `${body}|${item.title}|${item.date}|${item.url}`;
    const id = await computeHash(contentForHash, 'sha256');

    const report: OversightReport = {
      id,
      body,
      title: item.title,
      date: parseDate(item.date),
      url: item.url,
      pdfUrl: item.pdfUrl,
      reportType,
      summary: item.summary || null,
      findings: [],
      recommendations: [],
      auditedEntities: item.auditedEntities || [],
      fiscalYear: item.fiscalYear,
      reportNumber: null,
      language: 'en',
      ingestedAt: now,
    };

    reports.push(report);
  }

  return reports;
}


/**
 * Parse a report detail page HTML to extract structured findings.
 * Many oversight body reports follow a pattern of listing findings
 * with numbered points or bullet sections.
 */
export function parseFindingsFromHtml(html: string): string[] {
  const findings: string[] = [];
  const text = stripHtml(html);

  // Common finding patterns in oversight reports
  const patterns = [
    /(?:Finding|Key Finding|What We Found)\s*(?:#|No\.|Nº)?\s*(\d+)[:.)]\s*([^.]+\.)/gi,
    /(?:found that|determined that|observed that|identified that)\s+([^.]+\.)/gi,
    /[•●■]\s*([^;.]+[.])/g,
  ];

  let match: RegExpExecArray | null;
  for (const pattern of patterns) {
    while ((match = pattern.exec(text)) !== null) {
      const finding = (match[2] || match[1] || '').trim();
      if (finding && finding.length > 10 && !findings.includes(finding)) {
        findings.push(finding);
      }
    }
  }

  return findings;
}

/**
 * Extract the language from an HTML page.
 */
export function extractLanguage(html: string, defaultLang: string = 'en'): string {
  if (html.includes('lang="fr"') || html.includes("lang='fr'") || html.includes('lang=fr')) {
    return 'fr';
  }
  if (html.includes('/fr/') || html.includes('/francais/')) {
    return 'fr';
  }
  // Check for bilingual indicator
  if (html.includes('bilingual') || html.includes('bilingue')) {
    return 'bilingual';
  }
  return defaultLang;
}


/**
 * Map a Competition Bureau item type string to our canonical report type.
 */
function mapCBType(cbType: string): OversightReportType {
  switch (cbType) {
    case 'merger-review':
      return 'investigation';
    case 'enforcement-action':
      return 'investigation';
    case 'consultation':
      return 'other';
    case 'bulletin':
      return 'corporate-report';
    case 'annual-report':
      return 'annual-report';
    case 'market-study':
      return 'research-report';
    default:
      return 'other';
  }
}

/**
 * Parse a raw Competition Bureau item into an OversightReport.
 *
 * Competition Bureau decisions are mapped into the unified oversight report
 * schema, with companies extracted into auditedEntities and CB-specific
 * details stored in findings.
 */
export async function parseCompetitionDecision(
  item: RawCompetitionBureauItem,
  body: OversightBody = 'CompetitionBureau',
): Promise<OversightReport> {
  const now = new Date().toISOString();
  const reportType = mapCBType(item.cbType);

  const contentForHash = `${body}|${item.title}|${item.date}|${item.url}`;
  const id = await computeHash(contentForHash, 'sha256');

  const findings: string[] = [];
  if (item.sectors.length > 0) {
    findings.push(`Sector(s): ${item.sectors.join(', ')}`);
  }
  if (item.companies.length > 0) {
    findings.push(`Company(ies): ${item.companies.join(', ')}`);
  }
  if (item.summary) {
    findings.push(item.summary);
  }

  return {
    id,
    body,
    title: item.title,
    date: parseDate(item.date),
    url: item.url,
    pdfUrl: null,
    reportType,
    summary: item.summary || null,
    findings,
    recommendations: [],
    auditedEntities: item.companies,
    fiscalYear: null,
    reportNumber: item.cbType,
    language: 'en',
    ingestedAt: now,
  };
}

/**
 * Parse a list of raw Competition Bureau items into OversightReport records.
 */
export async function parseCompetitionBureauList(
  items: RawCompetitionBureauItem[],
  body: OversightBody = 'CompetitionBureau',
): Promise<OversightReport[]> {
  const reports: OversightReport[] = [];
  for (const item of items) {
    reports.push(await parseCompetitionDecision(item, body));
  }
  return reports;
}

/**
 * Extract merger conditions from Competition Bureau decision text.
 *
 * Competition Bureau merger reviews often include conditions such as:
 * - "Bureau concluded that the merger is not likely to substantially lessen competition"
 * - "The parties agreed to divest XYZ assets"
 * - "The transaction was approved subject to the following terms"
 */
export function extractMergerConditions(html: string): string[] {
  const conditions: string[] = [];
  const text = stripHtml(html);

  // Patterns commonly found in Competition Bureau merger decision documents
  const conditionPatterns = [
    /(?:condition|term|requirement|undertaking)s?\s*[:;]\s*([^.]+\..{0,200}(?:divest|sell|transfer|separate|maintain|provide|ensure|restrict|limit))(?:\s|\.)/gi,
    /(?:agreed to|committed to|required to|undertook to)\s+([^.]+\..{0,100})/gi,
    /(?:divestiture|divest|sell|transfer)\s+(?:of\s+)?([^.]+\..{0,200})/gi,
    /(?:subject to|pursuant to|in accordance with)\s+([^.]*(?:condition|term|undertaking|remedy)[^.]*\.)/gi,
    /(?:Bureau|Commissioner|Tribunal)\s+(?:ordered|directed|required|approved subject to)\s+([^.]+\..{0,200})/gi,
  ];

  for (const pattern of conditionPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const condition = (match[1] || match[0]).trim();
      if (condition && condition.length > 10 && !conditions.includes(condition)) {
        conditions.push(condition);
      }
    }
  }

  return conditions;
}

/**
 * Parse a Competition Bureau detail page into a MergerReview structure.
 *
 * This extracts the structured data specific to merger reviews: parties,
 * outcome, conditions, market definition, and anti-competitive concerns.
 */
export function parseMergerReviewDetail(html: string): Partial<MergerReview> {
  const text = stripHtml(html);
  const result: Partial<MergerReview> = {
    conditions: [],
    findings: [],
  };

  // Outcome classification
  if (/\b(?:not\s+likely|no\s+(?:material|significant)\s+lessening|cleared|approved|allowed)\b/i.test(text)) {
    result.outcome = 'cleared';
    result.antiCompetitiveConcerns = false;
  } else if (/\b(?:challenge|oppose|block|prevent|prohibit|stop)\b/i.test(text)) {
    result.outcome = 'challenged';
    result.antiCompetitiveConcerns = true;
  } else if (/\b(?:settle|consent|agreement|undertaking|negotiated)\b/i.test(text)) {
    result.outcome = 'settled';
    result.antiCompetitiveConcerns = true;
  } else if (/\b(?:withdrawn|abandoned|terminated|cancelled|called off)\b/i.test(text)) {
    result.outcome = 'withdrawn';
    result.antiCompetitiveConcerns = false;
  } else if (/\b(?:under\s+review|ongoing|pending|investigat(?:ion|ing))\b/i.test(text)) {
    result.outcome = 'ongoing';
    result.antiCompetitiveConcerns = false;
  } else {
    result.outcome = 'unknown';
    result.antiCompetitiveConcerns = false;
  }

  // Extract conditions
  result.conditions = extractMergerConditions(html);

  // Extract market definition
  const marketMatch = text.match(/(?:market|relevant market)\s+(?:for|is|defined as)\s+([^.]+\..{0,200})/i);
  if (marketMatch) {
    result.marketDefinition = marketMatch[1].trim();
  }

  // Extract key findings
  const findingPatterns = [
    /(?:found|determined|concluded)\s+that\s+([^.]*\.)/gi,
    /(?:the\s+(?:merger|transaction|acquisition|arrangement))\s+(?:would|will|could|may)\s+(?:not\s+)?(?:likely\s+)?(?:result|lead|give rise)\s+to\s+([^.]*\.)/gi,
    /(?:Bureau|Commissioner)\s+(?:is|was)\s+(?:of\s+the\s+view|satisfied|concerned)\s+that\s+([^.]*\.)/gi,
  ];

  for (const pattern of findingPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const finding = (match[1] || match[0]).trim();
      if (finding && finding.length > 20 && !result.findings!.includes(finding)) {
        result.findings!.push(finding);
      }
    }
  }

  return result;
}


/**
 * Map a CRTC item type string to our canonical report type.
 */
function mapCRTCType(crtcType: string): OversightReportType {
  switch (crtcType) {
    case 'broadcasting-decision':
      return 'investigation';
    case 'telecom-decision':
      return 'investigation';
    case 'ownership-change':
      return 'investigation';
    case 'policy':
      return 'other';
    case 'notice-consultation':
      return 'other';
    default:
      return 'other';
  }
}

/**
 * Parse a raw CRTC item into an OversightReport.
 *
 * CRTC decisions are mapped into the unified oversight report schema
 * with affected parties extracted into auditedEntities.
 */
export async function parseCRTCDecision(
  item: RawCRTCItem,
  body: OversightBody = 'CRTC',
): Promise<OversightReport> {
  const now = new Date().toISOString();
  const reportType = mapCRTCType(item.crtcType);

  const contentForHash = `${body}|${item.title}|${item.date}|${item.url}`;
  const id = await computeHash(contentForHash, 'sha256');

  const findings: string[] = [];
  if (item.affectedParties.length > 0) {
    findings.push(`Affected parties: ${item.affectedParties.join(', ')}`);
  }
  if (item.decisionNumber) {
    findings.push(`Decision number: ${item.decisionNumber}`);
  }
  if (item.summary) {
    findings.push(item.summary);
  }

  return {
    id,
    body,
    title: item.title,
    date: parseDate(item.date),
    url: item.url,
    pdfUrl: null,
    reportType,
    summary: item.summary || null,
    findings,
    recommendations: [],
    auditedEntities: item.affectedParties,
    fiscalYear: null,
    reportNumber: item.decisionNumber,
    language: 'en',
    ingestedAt: now,
  };
}

/**
 * Parse a list of raw CRTC items into OversightReport records.
 */
export async function parseCRTCList(
  items: RawCRTCItem[],
  body: OversightBody = 'CRTC',
): Promise<OversightReport[]> {
  const reports: OversightReport[] = [];
  for (const item of items) {
    reports.push(await parseCRTCDecision(item, body));
  }
  return reports;
}

/**
 * Parse CRTC decision detail page HTML into structured CRTCDecision fields.
 *
 * Extracts:
 * - Conditions imposed by the decision
 * - Regulatory findings
 * - Classification flags (ownership change, net neutrality, etc.)
 */
export function parseCRTCDecisionDetail(html: string): Partial<CRTCDecision> {
  const text = stripHtml(html);
  const result: Partial<CRTCDecision> = {
    conditions: [],
    findings: [],
    isOwnershipChange: false,
    isNetNeutrality: false,
    isTelecomPricing: false,
    isBroadcastingContent: false,
  };

  // Classification flags
  if (/\b(?:ownership|transfer of (?:control|ownership)|acquisition|takeover|buying|selling)\b/i.test(text)) {
    result.isOwnershipChange = true;
  }
  if (/\b(?:net neutrality|net neutrality|traffic management|throttling|zero-rating|differential pricing|internet traffic)\b/i.test(text)) {
    result.isNetNeutrality = true;
  }
  if (/\b(?:pricing|rate|tariff|wholesale (?:rate|access)|price cap|cost)\b/i.test(text)) {
    result.isTelecomPricing = true;
  }
  if (/\b(?:broadcasting|cancon|Canadian content|programming|licence|licensee|broadcast)\b/i.test(text)) {
    result.isBroadcastingContent = true;
  }

  // Extract conditions
  const conditionPatterns = [
    /(?:condition|term|requirement)s?\s+(?:of|imposed|attached|included)\s+([^.]*\..{0,200})/gi,
    /(?:licensee|applicant|company|party)\s+(?:must|shall|is required to|will)\s+([^.]*\..{0,200})/gi,
    /(?:approv(?:e|ed))\s+(?:subject to|conditional on|with the following)\s+([^.]*\..{0,200})/gi,
    /(?:the\s+Commission)\s+(?:directs|requires|orders|imposes)\s+([^.]*\..{0,200})/gi,
  ];

  for (const pattern of conditionPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const condition = (match[1] || match[0]).trim();
      if (condition && condition.length > 10 && !result.conditions!.includes(condition)) {
        result.conditions!.push(condition);
      }
    }
  }

  // Extract regulatory findings
  const findingPatterns = [
    /(?:Commission|CRTC)\s+(?:finds|determines|concludes|decides)\s+that\s+([^.]*\..{0,200})/gi,
    /(?:after\s+(?:consideration|review|hearing))\s*,\s*the\s+(?:Commission|CRTC)\s+([^.]*\..{0,200})/gi,
    /(?:the\s+(?:application|request|proposal))\s+(?:is|was)\s+(?:approved|denied|granted|refused)\s+(?:in\s+part\s+)?(?:because|on\s+the\s+grounds?)\s+([^.]*\..{0,200})/gi,
  ];

  for (const pattern of findingPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const finding = (match[1] || match[0]).trim();
      if (finding && finding.length > 20 && !result.findings!.includes(finding)) {
        result.findings!.push(finding);
      }
    }
  }

  return result;
}


/**
 * Parse an Ethics Commissioner investigation report HTML page into
 * a structured Investigation record.
 *
 * CIEC investigation reports typically include:
 *   - The public office holder being investigated (subject)
 *   - The specific Conflict of Interest Act provisions cited
 *   - A summary of the contravention
 *   - The Commissioner's findings
 *   - The outcome (no violation, contravention, remedial measures)
 *
 * @param html - The HTML content of the CIEC investigation report page
 * @param source - The raw item metadata (url, title, date)
 * @returns A parsed Investigation record
 */
export function parseEthicsReport(
  html: string,
  source: { title: string; date: string; url: string; subject?: string | null; parties?: string[] },
): import('./types.js').Investigation {
  const text = stripHtml(html);
  const now = new Date().toISOString();

  // Extract findings from the report body
  const findings = parseFindingsFromHtml(html);

  // Extract recommendations from the report body
  const recommendations: import('./types.js').Recommendation[] = [];

  // Parse numbered findings that may contain recommendations
  const recPattern = /(?:Recommendation|Recommend|should|ought)\s*(?:#|No\.|Nº)?\s*(\d+)[:.)]\s*([^.]*\.[^.]*\.)/gi;
  let recMatch: RegExpExecArray | null;
  let seq = 0;

  while ((recMatch = recPattern.exec(text)) !== null) {
    seq++;
    const recText = recMatch[2].trim();
    recommendations.push({
      id: '',  // filled after hash
      reportId: '',
      text: recText,
      number: seq,
      status: 'unknown',
      responsibleEntity: source.subject || null,
      statusDate: null,
      targetDate: null,
      implementationNotes: null,
      ingestedAt: now,
    });
  }

  // Determine outcome from text keywords
  let outcome: string | null = null;
  if (/\bno contravention\b|\bnot contravened\b|\bdismissed\b/i.test(text)) {
    outcome = 'no-contravention';
  } else if (/\bcontravened\b|\bviolation\b|\bfound to have contravened\b|\bin contravention\b/i.test(text)) {
    outcome = 'contravention';
  } else if (/\bsettled\b|\bresolution\b|\bagreement\b/i.test(text)) {
    outcome = 'settled';
  } else if (/\bongoing\b|\bunder investigation\b|\bpending\b/i.test(text)) {
    outcome = 'ongoing';
  }

  // Extract parties from the report content
  const parties = source.parties ? [...source.parties] : [];
  if (source.subject && !parties.includes(source.subject)) {
    parties.push(source.subject);
  }

  // Look for additional named individuals in the report
  const namePattern = /\b(Mr\.|Ms\.|Mrs\.|Dr\.|Honourable|Hon\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  let nameMatch: RegExpExecArray | null;
  while ((nameMatch = namePattern.exec(text)) !== null) {
    const fullName = nameMatch[0].trim();
    if (fullName.length > 10 && fullName.length < 80 && !parties.includes(fullName)) {
      parties.push(fullName);
    }
  }

  // Try to extract a specific subject from the text if not provided
  let subject = source.subject || null;
  if (!subject) {
    const subjMatch = text.match(/(?:Investigation into|Report on|In the matter of|Regarding)\s+(.+?)(?:$|[.])/i);
    if (subjMatch) subject = subjMatch[1].trim();
  }

  return {
    id: '',  // filled with hash after creation
    body: 'EthicsCommissioner',
    title: source.title,
    subject: subject || '',
    dateOpened: source.date,
    dateClosed: null,
    summary: text.substring(0, 500),
    findings,
    recommendations,
    parties,
    outcome,
    url: source.url,
    ingestedAt: now,
  };
}


/**
 * Parse a Lobbying Commissioner investigation report HTML page into
 * a structured Investigation record.
 *
 * OCL investigation reports typically include:
 *   - The registrant/lobbyist being investigated
 *   - The client/company involved
 *   - The specific Lobbying Act provisions or Code rules cited
 *   - A summary of the contravention
 *   - The Commissioner's findings
 *   - The outcome (penalty, reprimand, no violation)
 *
 * @param html - The HTML content of the OCL investigation report page
 * @param source - The raw item metadata
 * @returns A parsed Investigation record
 */
export function parseLobbyingInvestigation(
  html: string,
  source: { title: string; date: string; url: string; subject?: string | null; parties?: string[] },
): import('./types.js').Investigation {
  const text = stripHtml(html);
  const now = new Date().toISOString();

  // Extract findings
  const findings = parseFindingsFromHtml(html);

  // Extract recommendations
  const recommendations: import('./types.js').Recommendation[] = [];
  const recPattern = /(?:Recommendation|Recommend|should|ought)\s*(?:#|No\.|Nº)?\s*(\d+)[:.)]\s*([^.]*\.[^.]*\.)/gi;
  let recMatch: RegExpExecArray | null;
  let seq = 0;

  while ((recMatch = recPattern.exec(text)) !== null) {
    seq++;
    const recText = recMatch[2].trim();
    recommendations.push({
      id: '',
      reportId: '',
      text: recText,
      number: seq,
      status: 'unknown',
      responsibleEntity: source.subject || null,
      statusDate: null,
      targetDate: null,
      implementationNotes: null,
      ingestedAt: now,
    });
  }

  // Determine outcome
  let outcome: string | null = null;
  if (/\bno contravention\b|\bnot contravened\b|\bdismissed\b|\bno violation\b/i.test(text)) {
    outcome = 'no-contravention';
  } else if (/\bcontravened\b|\bviolation\b|\bfound to have contravened\b|\bcontravention\b/i.test(text)) {
    outcome = 'contravention';
  } else if (/\bpenalty\b|\bfine\b|\bsanction\b|\b reprimand\b/i.test(text)) {
    outcome = 'penalty';
  } else if (/\bsettled\b|\bresolution\b|\bagreement\b|\bundertaking\b/i.test(text)) {
    outcome = 'settled';
  } else if (/\bongoing\b|\bunder investigation\b|\bpending\b/i.test(text)) {
    outcome = 'ongoing';
  }

  // Extract parties
  const parties = source.parties ? [...source.parties] : [];
  if (source.subject && !parties.includes(source.subject)) {
    parties.push(source.subject);
  }

  // Extract company/organization names from the report
  const companyPattern = /\b(?:Corporation|Inc\.|Ltd\.|Limited|Company|Group|Associates|Consulting|Services)\b[^.]*/gi;
  let companyMatch: RegExpExecArray | null;
  while ((companyMatch = companyPattern.exec(text)) !== null) {
    const company = companyMatch[0].trim();
    if (company.length > 5 && company.length < 100 && !parties.includes(company)) {
      parties.push(company);
    }
  }

  // Try to extract subject from text if not provided
  let subject = source.subject || null;
  if (!subject) {
    const subjMatch = text.match(/(?:Investigation into|Report on|In the matter of|Regarding)\s+(.+?)(?:$|[.])/i);
    if (subjMatch) subject = subjMatch[1].trim();
  }

  return {
    id: '',
    body: 'LobbyingCommissioner',
    title: source.title,
    subject: subject || '',
    dateOpened: source.date,
    dateClosed: null,
    summary: text.substring(0, 500),
    findings,
    recommendations,
    parties,
    outcome,
    url: source.url,
    ingestedAt: now,
  };
}
