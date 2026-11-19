/**
 * Gazette Parser — Quill
 *
 * Parses Canada Gazette RSS XML into structured GazetteRecord objects
 * and extracts Regulatory Impact Analysis Statement (RIAS) URLs from
 * regulation HTML pages.
 *
 * RSS Format:
 *   <item>
 *     <title>Regulations Amending the Food and Drug Regulations...</title>
 *     <link>https://gazette.gc.ca/rp-pr/p1/2026/.../reg1-eng.html</link>
 *     <description>Regulatory impact analysis statement...</description>
 *     <category>Part I</category>
 *     <pubDate>Sat, 09 May 2026 00:00:00 EDT</pubDate>
 *   </item>
 */

import { GazettePart, type GazetteRecord } from './types.js';
import { capRiasExcerpt } from './rias.js';
import { computeHash } from '../../verification/hashing.js';


/**
 * Parse Canada Gazette RSS XML into GazetteRecord objects.
 *
 * Uses regex-based extraction (same pattern as the existing RSS module)
 * to avoid external XML parser dependencies.
 */
export async function parseGazetteRSS(
  xml: string,
  part: GazettePart,
): Promise<GazetteRecord[]> {
  const records: GazetteRecord[] = [];
  const itemMatches = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];
  const now = new Date().toISOString();

  for (const itemBlock of itemMatches) {
    try {
      const record = await parseRSSItem(itemBlock, part, now);
      if (record) {
        records.push(record);
      }
    } catch (err) {
      // Skip malformed items — individual item parsing errors
      // are non-fatal (the caller can count discrepancies)
    }
  }

  return records;
}

/**
 * Parse a single RSS <item> block into a GazetteRecord.
 */
async function parseRSSItem(
  itemBlock: string,
  part: GazettePart,
  ingestedAt: string,
): Promise<GazetteRecord | null> {
  // Extract fields using regex
  const title = extractField(itemBlock, 'title');
  const link = extractField(itemBlock, 'link');
  const description = extractField(itemBlock, 'description');
  const pubDateRaw = extractField(itemBlock, 'pubDate');

  if (!title || !link) {
    return null;
  }

  // Parse publication date
  const publishedAt = parseGazetteDate(pubDateRaw);

  // Compute SHA-256 hash for record ID (hash of the full item XML)
  const id = await computeHash(itemBlock, 'sha256');

  // Extract registration number (SOR/YYYY-NNN) from title or description
  const registrationNumber = extractRegistrationNumber(title, description);

  // For Part I: comment deadline is 60 days from publication
  let commentDeadline: string | null = null;
  if (part === GazettePart.I && publishedAt) {
    const pubDate = new Date(publishedAt);
    if (!isNaN(pubDate.getTime())) {
      const deadline = new Date(pubDate);
      deadline.setDate(deadline.getDate() + 60);
      commentDeadline = deadline.toISOString().split('T')[0];
    }
  }

  return {
    id,
    title,
    htmlUrl: link,
    part,
    publishedAt: publishedAt || '',
    description: description || null,
    registrationNumber,
    riasUrl: null,  // populated by caller after fetching detail
    riasText: null,  // populated by caller after fetching detail
    commentDeadline,
    department: null,  // populated by caller after fetching detail
    regulationId: null,  // populated by caller after fetching detail
    ingestedAt,
  };
}


/**
 * Extract a field from an RSS item XML block.
 * Handles CDATA sections.
 */
function extractField(itemBlock: string, fieldName: string): string | null {
  // Try with CDATA first
  const cdataPattern = new RegExp(
    `<${fieldName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${fieldName}>`,
    'i',
  );
  const cdataMatch = itemBlock.match(cdataPattern);
  if (cdataMatch) {
    return cdataMatch[1].trim();
  }

  // Try without CDATA
  const plainPattern = new RegExp(
    `<${fieldName}[^>]*>([\\s\\S]*?)<\\/${fieldName}>`,
    'i',
  );
  const plainMatch = itemBlock.match(plainPattern);
  if (plainMatch) {
    return plainMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
  }

  return null;
}


/**
 * Parse a Canada Gazette RSS pubDate string into ISO-8601.
 *
 * Examples:
 *   "Sat, 09 May 2026 00:00:00 EDT"
 *   "Fri, 22 May 2026 14:30:00 EST"
 */
export function parseGazetteDate(dateStr: string | null): string | null {
  if (!dateStr) return null;

  try {
    // Remove timezone abbreviation (EDT, EST, etc.) since JS Date
    // doesn't reliably parse them. The timezone offset is implied
    // (Eastern Time = UTC-4/UTC-5), but we store as-is for reference.
    const cleaned = dateStr.replace(/\s+(EDT|EST|CST|CDT|MST|MDT|PST|PDT)\s*$/, '');
    const date = new Date(cleaned);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}


/**
 * Extract SOR registration number from text.
 *
 * Formats matched:
 *   - SOR/2026-123
 *   - SOR/2026-0123
 *   - SI/2026-123 (statutory instruments)
 */
export function extractRegistrationNumber(
  ...texts: (string | null)[]
): string | null {
  const pattern = /\b(S[OI]R?\/\d{4}-\d+)\b/;
  for (const text of texts) {
    if (!text) continue;
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}


/**
 * Extract the Regulatory Impact Analysis Statement URL from a regulation
 * HTML page.
 *
 * The RIAS is typically linked via an anchor with text containing
 * "Regulatory Impact Analysis Statement" or "RIA" in the HTML.
 */
export function extractRIALink(html: string): string | null {
  // Look for links with "Regulatory Impact Analysis Statement" or "RIAS" in text
  const patterns = [
    // <a href="..." ...>Regulatory Impact Analysis Statement</a>
    /<a[^>]*href="([^"]+)"[^>]*>[^<]*Regulatory\s+Impact\s+Analysis\s+Statement[^<]*<\/a>/i,
    // <a href="..." ...>RIAS</a>
    /<a[^>]*href="([^"]+)"[^>]*>\s*RIAS\s*<\/a>/i,
    // <a ... href="..." ... aria-label="...Regulatory Impact Analysis Statement...">
    /<a[^>]*aria-label="[^"]*Regulatory\s+Impact\s+Analysis\s+Statement[^"]*"[^>]*href="([^"]+)"/i,
    // PDF link to RIAS
    /<a[^>]*href="([^"]+rias[^"]*)"[^>]*>/i,
    /<a[^>]*href="([^"]+ria[^"]*\.pdf)"[^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const href = match[1];
      // Handle relative URLs
      if (href.startsWith('/')) {
        return `https://gazette.gc.ca${href}`;
      }
      if (href.startsWith('http')) {
        return href;
      }
      // Might be relative to current page
      return `https://gazette.gc.ca${href.startsWith('/') ? '' : '/'}${href}`;
    }
  }

  return null;
}

/**
 * Extract the department name from a regulation HTML page.
 * Typically found in metadata or header sections.
 */
export function extractDepartment(html: string): string | null {
  const patterns = [
    /<meta[^>]*name="[Dd]epartment"[^>]*content="([^"]+)"/i,
    /<dt[^>]*>[Dd]epartment\s*:?\s*<\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/i,
    /<th[^>]*>[Dd]epartment\s*:?\s*<\/th>\s*<td[^>]*>([^<]+)<\/td>/i,
    /(?:Department|Ministère)\s*[:\u2013]\s*([^<.]+)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Extract the Regulatory Impact Analysis Statement text from the HTML.
 * The RIAS content is usually in a well-defined section of the page.
 */
export function extractRIASText(html: string): string | null {
  // Look for the RIAS section — typically following a heading like
  // "Regulatory Impact Analysis Statement" or "RIAS"
  const riasHeadingPattern = /<h[1-6][^>]*>(?:Regulatory\s+Impact\s+Analysis\s+Statement|RIAS)\s*<\/h[1-6]>\s*(<p[^>]*>[\s\S]*?)(?=<h[1-6]|<footer|<div\s+class="[^"]*footer)/i;
  const match = html.match(riasHeadingPattern);
  if (match && match[1]) {
    // Strip HTML tags and cap at 300 characters. The full RIAS is not stored.
    return capRiasExcerpt(
      match[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );
  }

  return null;
}

/**
 * Extract regulation identifier from HTML page.
 * Look for regulatory identifier or internal tracking number.
 */
export function extractRegulationId(html: string): string | null {
  const patterns = [
    /<meta[^>]*name="[Rr]egulation[Ii][Dd]"[^>]*content="([^"]+)"/i,
    /(?:Regulation Identifier|Identificateur de la réglementation)[:\s]*([A-Z0-9-]+)/i,
    /RIN[:\s]*([A-Z0-9-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}
