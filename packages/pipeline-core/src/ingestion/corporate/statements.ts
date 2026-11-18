// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Executive Statements Collector — Quill
 *
 * Collects public statements by high-impact Canadian executives:
 *   - Committee testimony (already captured by committees module)
 *   - Earnings call transcripts / press releases
 *   - Regulatory filings with executive certifications
 *   - Public speeches available as text
 *
 * For now, this focuses on:
 *   1. Cross-referencing tracked executives against committee appearances
 *   2. Parsing executive statements from RSS-triggered press releases
 *   3. Flagging notable statements for review
 *
 * Sources:
 *   - Company investor relations pages (RSS feeds)
 *   - SEDAR+ regulatory filings (HTML search)
 *   - Newswire / GlobeNewswire / CNW press releases
 *   - Committee evidence (already indexed)
 */

import { httpGet } from '../../utils/http.js';
import { computeHash } from '../../verification/hashing.js';
import { TRACKED_EXECUTIVES, CORPORATE_SOURCES } from './constants.js';
import type { ExecutiveStatement } from './types.js';


/**
 * Find a tracked executive by name (fuzzy match).
 */
export function findTrackedExecutive(name: string): typeof TRACKED_EXECUTIVES[number] | null {
  const nameLower = name.toLowerCase();
  for (const exec of TRACKED_EXECUTIVES) {
    if (nameLower.includes(exec.name.toLowerCase())) {
      return exec;
    }
  }
  return null;
}

/**
 * Get all tracked organization names (for filtering).
 */
export function getTrackedOrganizations(): string[] {
  return Array.from(new Set(TRACKED_EXECUTIVES.map(e => e.organization)));
}


export interface PressRelease {
  id: string;
  title: string;
  body: string;
  date: string;
  organization: string;
  url: string;
  source: 'newswire' | 'globenewswire' | 'cnw' | 'company-ir' | 'sedar';
}

/**
 * Fetch press releases from a company's investor relations RSS feed.
 * This covers CEO/CFO statements, earnings calls, and announcements.
 *
 * No generic URL is synthesized any more: the GlobeNewswire
 * `RssFeed/{org}/en` pattern answers 400 for every organization (its
 * organization variants do not connect), and the BusinessWire /
 * newswire.ca patterns 404. A synthesized URL was therefore one guaranteed
 * failure per tracked org per run. Only feeds known to work are fetched;
 * everything else is skipped and recorded in corporate/constants.ts.
 */
export async function fetchCompanyPressReleases(
  organization: string,
  rssUrl?: string,
): Promise<PressRelease[]> {
  // Media-company-specific RSS feeds (overrides auto-discovery for known orgs).
  // Only feeds verified reachable are mapped; the rest were 404/DNS-dead and
  // are recorded in corporate/constants.ts so they are not re-added blind.
  const mediaRssMap: Record<string, string> = {
    'Postmedia Network': CORPORATE_SOURCES.MEDIA.POSTMEDIA_CORP,
  };

  // For known media orgs, also try their own feed in addition to a supplied one
  const feedsToTry = [
    ...(mediaRssMap[organization] ? [mediaRssMap[organization]] : []),
    ...(rssUrl ? [rssUrl] : []),
  ];

  if (feedsToTry.length === 0) return [];

  for (const feedUrl of feedsToTry) {
    let releases: PressRelease[] = [];

    try {
      const resp = await httpGet(feedUrl, {
        headers: { Accept: 'application/rss+xml,application/xml' },
        timeoutMs: 10_000,
      });

      if (resp.statusCode >= 400) continue;

      const xml = resp.body;

      const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
      let m: RegExpExecArray | null;

      let sourceType: PressRelease['source'] = 'globenewswire';
      if (feedUrl.includes('cbc.ca')) sourceType = 'company-ir';
      else if (feedUrl.includes('postmedia')) sourceType = 'company-ir';
      else if (feedUrl.includes('quebecor')) sourceType = 'company-ir';
      else if (feedUrl.includes('corusent')) sourceType = 'company-ir';
      else if (feedUrl.includes('rogersmedia')) sourceType = 'company-ir';
      else if (feedUrl.includes('bce.ca')) sourceType = 'company-ir';

      while ((m = itemPattern.exec(xml)) !== null) {
        const item = m[1];
        const extract = (tag: string): string => {
          const match = new RegExp(`<${tag}[^>]*>([\s\S]*?)<\/${tag}>`, 'i').exec(item);
          return match ? match[1].trim() : '';
        };

        const title = extract('title');
        const link = extract('link');
        const pubDate = extract('pubDate');
        const body = extract('description');

        if (!title) continue;

        releases.push({
          id: await computeHash(link || title, 'sha256'),
          title,
          body: body || '',
          date: pubDate || new Date().toISOString(),
          organization,
          url: link,
          source: sourceType,
        });
      }
    } catch {
      continue; // try next feed
    }

    if (releases.length > 0) return releases;
  }

  return [];
}

/**
 * Extract executive statements from press releases by matching
 * against the tracked executives list.
 */
export function extractExecutiveStatements(
  releases: PressRelease[],
): ExecutiveStatement[] {
  const statements: ExecutiveStatement[] = [];

  for (const release of releases) {
    // Check if press release mentions a tracked executive
    for (const exec of TRACKED_EXECUTIVES) {
      if (
        exec.organization === release.organization &&
        (release.title.includes(exec.name) || release.body.includes(exec.name))
      ) {
        statements.push({
          id: release.id,
          executiveName: exec.name,
          executiveTitle: exec.title,
          organization: exec.organization,
          organizationTicker: exec.organizationTicker,
          statementType: 'press-release',
          date: release.date,
          title: release.title,
          text: release.body,
          excerpt: release.body.substring(0, 500),
          sourceUrl: release.url,
          topics: extractTopics(release.title + ' ' + release.body),
          isCommitteeAppearance: false,
          committeeMeetingId: null,
          ingestedAt: new Date().toISOString(),
        });
        break;
      }
    }
  }

  return statements;
}


/**
 * Check if a tracked executive has appeared before a parliamentary
 * committee. Returns search URL stub and known committee acronyms.
 */
export function getCommitteeAppearanceUrl(
  executiveName: string,
): string {
  const encoded = encodeURIComponent(executiveName.replace(/\s+/g, '+'));
  return `https://www.ourcommons.ca/search?sr=${encoded}&cat=publications&type=evidence`;
}

/**
 * Simple topic extraction from statement text.
 */
const TOPIC_KEYWORDS: Record<string, string[]> = {
  revenue: ['revenue', 'earnings', 'profit', 'income', 'financial result'],
  regulation: ['regulatory', 'compliance', 'regulation', 'licensed', 'approved'],
  layoffs: ['layoff', 'reduction in force', 'restructuring', 'downsize'],
  expansion: ['expansion', 'growth', 'new market', 'investment', 'acquisition'],
  dividends: ['dividend', 'buyback', 'shareholder return'],
  technology: ['AI', 'digital', 'technology', 'innovation', 'automation'],
  canada: ['Canada', 'Canadian', 'domestic'],
  competition: ['competition', 'competitor', 'market share', 'pricing'],
  labour: ['union', 'workforce', 'employee', 'wage', 'salary'],
  environment: ['climate', 'ESG', 'sustainable', 'net-zero', 'emissions'],
};

function extractTopics(text: string): string[] {
  const topics: string[] = [];
  const textLower = text.toLowerCase();

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some(kw => textLower.includes(kw))) {
      topics.push(topic);
    }
  }

  return topics;
}
