// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Public shape for House of Commons and Senate responses.
 *
 * Owner decision (2026-11-09): parliamentary content is free, and full text
 * stays in storage. What leaves the service is an excerpt of at most
 * {@link PARLIAMENTARY_EXCERPT_MAX} characters, with the official source link
 * and the non-commercial reuse line.
 *
 * Tools and routes call {@link presentParliamentary} or
 * {@link presentParliamentaryToolResult}. Do not copy the line into each
 * handler. `applySourcePolicy` calls the same helper for the `committees` and
 * `parliamentary-voting` families so a later source-policy wrap stays aligned.
 */

export const PARLIAMENTARY_EXCERPT_MAX = 300;

export const PARLIAMENTARY_REUSE_LINE =
  'Reproduced for non-commercial use. This is not an official version and does not imply endorsement.';

export const COMMONS_PUBLIC_URL = 'https://www.ourcommons.ca';
export const SENATE_PUBLIC_URL = 'https://sencanada.ca';

export type ParliamentaryChamber = 'commons' | 'senate' | 'both';

/**
 * MCP tools whose payload is House of Commons or Senate committee, debate,
 * Hansard, or vote data, including the openparliament.ca tools. Names are
 * the registry spellings (underscores). Hyphen spellings match too.
 */
export const PARLIAMENTARY_TOOL_NAMES = [
  'search_committees',
  'search_committees_op',
  'search_debates',
  'search_votes',
  'search_bills',
  'get_member_info',
  'get_politician_influence',
  'track_bill',
  'get_voting_record',
  'get_mp_voting_pattern',
  'compare_party_voting',
] as const;

export type ParliamentaryToolName = (typeof PARLIAMENTARY_TOOL_NAMES)[number];

/** Export modules that serve the same parliamentary families. */
export const PARLIAMENTARY_EXPORT_MODULES = ['committees', 'parliamentary-voting'] as const;

const TOOL_NAME_SET = new Set<string>(PARLIAMENTARY_TOOL_NAMES);
const EXPORT_MODULE_SET = new Set<string>(PARLIAMENTARY_EXPORT_MODULES);

/** Record lists that carry parliamentary rows inside a tool or route envelope. */
const RECORD_LIST_KEYS = new Set([
  'results',
  'records',
  'committees',
  'members',
  'bills',
  'relatedDebates',
  'relateddebates',
  'votes',
  'data',
]);

/**
 * Prose fields trimmed on the way out. Storage is not touched. Keys match
 * the source-policy excerpt and body names so a policy wrap and this helper
 * agree on what is public text.
 */
const EXCERPT_KEYS = new Set([
  'text',
  'content',
  'contentbody',
  'rawcontent',
  'speech',
  'speechtext',
  'transcript',
  'evidence',
  'body',
  'html',
  'rawtext',
  'fulltext',
  'summary',
  'description',
  'contentsnippet',
  'excerpt',
  'abstract',
  'notes',
]);

function canonicalToolName(name: string): string {
  return name.trim().toLowerCase().replace(/-/g, '_');
}

function normalizedKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** True for a House of Commons or Senate tool, in either name spelling. */
export function isParliamentaryTool(toolName: string): boolean {
  return TOOL_NAME_SET.has(canonicalToolName(toolName));
}

/**
 * Parliamentary tool calls do not consume the hosted free-call quota or the
 * paid-plan meter. Other free tools still count.
 */
export function parliamentaryToolMetersQuota(toolName: string): boolean {
  return !isParliamentaryTool(toolName);
}

/**
 * True for `/v1/export/committees` and `/v1/export/parliamentary-voting`,
 * including a single-record id. Other export modules stay on their own gate.
 */
export function isParliamentaryApiPath(path: string): boolean {
  const pathOnly = path.split('?')[0] ?? path;
  const match = /^\/v1\/export\/([^/]+)(?:\/[^/]+)?\/?$/.exec(pathOnly);
  if (!match) return false;
  return EXPORT_MODULE_SET.has(decodeURIComponent(match[1]));
}

/** Paid-plan usage meters skip these paths. Burst limits still apply. */
export function parliamentaryPathMetersQuota(path: string): boolean {
  return !isParliamentaryApiPath(path);
}

/**
 * Cut `value` to at most {@link PARLIAMENTARY_EXCERPT_MAX} characters.
 * Prefer a word boundary. The ellipsis counts toward the limit.
 */
export function truncateParliamentaryExcerpt(
  value: string,
  max: number = PARLIAMENTARY_EXCERPT_MAX,
): string {
  if (value.length <= max) return value;
  const ellipsis = '…';
  const room = Math.max(1, max - ellipsis.length);
  let cut = value.slice(0, room);
  const space = cut.lastIndexOf(' ');
  if (space >= Math.floor(room * 0.6)) cut = cut.slice(0, space);
  cut = cut.replace(/[\s,;:–—-]+$/u, '');
  if (cut.length === 0) cut = value.slice(0, room);
  const out = `${cut}${ellipsis}`;
  return out.length <= max ? out : `${value.slice(0, room)}${ellipsis}`;
}

function officialUrl(record: Record<string, unknown>): string | undefined {
  for (const key of ['url', 'source_url', 'sourceUrl', 'xmlUrl', 'evidenceUrl', 'legisinfoUrl']) {
    const value = record[key];
    if (typeof value === 'string' && /ourcommons\.ca|sencanada\.ca/i.test(value)) return value;
  }
  return undefined;
}

export function chamberForParliamentaryRecord(
  record: Record<string, unknown>,
  fallback: ParliamentaryChamber,
): ParliamentaryChamber {
  const url = officialUrl(record) ?? '';
  const chamberField = String(record.chamber ?? record.house ?? '').toLowerCase();
  const senate = /senate|sénat|sencanada/.test(chamberField) || /sencanada\.ca/i.test(url);
  const commons = /house|commons|chambre|hoc/.test(chamberField) || /ourcommons\.ca/i.test(url);
  if (senate && !commons) return 'senate';
  if (commons && !senate) return 'commons';
  return fallback;
}

function defaultSourceUrl(chamber: ParliamentaryChamber): string {
  if (chamber === 'senate') return SENATE_PUBLIC_URL;
  return COMMONS_PUBLIC_URL;
}

/** Source name, official link, and the non-commercial reuse line. */
export function parliamentaryAttribution(
  chamber: ParliamentaryChamber,
  specificUrl?: string,
): string {
  if (chamber === 'senate') {
    const url = specificUrl ?? SENATE_PUBLIC_URL;
    return `Source: Senate of Canada (${url}). ${PARLIAMENTARY_REUSE_LINE}`;
  }
  if (chamber === 'commons') {
    const url = specificUrl ?? COMMONS_PUBLIC_URL;
    return `Source: House of Commons (${url}). ${PARLIAMENTARY_REUSE_LINE}`;
  }
  const commons = specificUrl && /ourcommons\.ca/i.test(specificUrl) ? specificUrl : COMMONS_PUBLIC_URL;
  const senate = specificUrl && /sencanada\.ca/i.test(specificUrl) ? specificUrl : SENATE_PUBLIC_URL;
  return `Source: House of Commons (${commons}) and Senate of Canada (${senate}). ${PARLIAMENTARY_REUSE_LINE}`;
}

function truncateExcerpts(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(truncateExcerpts);
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
    if (typeof child === 'string' && EXCERPT_KEYS.has(normalizedKey(key))) {
      out[key] = truncateParliamentaryExcerpt(child);
    } else {
      out[key] = truncateExcerpts(child);
    }
  }
  return out;
}

function withRecordAttribution(
  record: Record<string, unknown>,
  chamber: ParliamentaryChamber,
): Record<string, unknown> {
  const detected = chamberForParliamentaryRecord(record, chamber);
  const specific = officialUrl(record);
  const next: Record<string, unknown> = {
    ...record,
    attribution: parliamentaryAttribution(detected, specific),
  };
  if (!record.source_url && !record.sourceUrl && !record.url) {
    next.source_url = defaultSourceUrl(detected);
  }
  return next;
}

/** Add the attribution line on parliamentary row lists at any depth. */
function annotateRecordLists(node: unknown, chamber: ParliamentaryChamber): unknown {
  if (Array.isArray(node)) return node.map((item) => annotateRecordLists(item, chamber));
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
    if (Array.isArray(child) && RECORD_LIST_KEYS.has(key)) {
      out[key] = child.map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return annotateRecordLists(item, chamber);
        return withRecordAttribution(
          annotateRecordLists(item, chamber) as Record<string, unknown>,
          chamber,
        );
      });
    } else {
      out[key] = annotateRecordLists(child, chamber);
    }
  }
  return out;
}

/**
 * Attach the parliamentary attribution line and cap public excerpts.
 * Idempotent: a second call does not grow text that is already within the cap.
 */
export function presentParliamentary<T extends Record<string, unknown>>(
  value: T,
  options?: { chamber?: ParliamentaryChamber },
): T {
  const chamber = options?.chamber ?? 'both';
  const truncated = annotateRecordLists(truncateExcerpts(value), chamber) as Record<string, unknown>;
  const specific = officialUrl(truncated);
  const next: Record<string, unknown> = {
    ...truncated,
    attribution: parliamentaryAttribution(chamber, specific),
  };
  if (!truncated.source_url && !truncated.sourceUrl && !truncated.url) {
    next.source_url = defaultSourceUrl(chamber);
  }
  return next as T;
}

/** Apply {@link presentParliamentary} to a tool result's object content. */
export function presentParliamentaryToolResult<
  T extends { content: string | Record<string, unknown> | Record<string, unknown>[] },
>(result: T, options?: { chamber?: ParliamentaryChamber }): T {
  if (!result.content || typeof result.content !== 'object' || Array.isArray(result.content)) {
    return result;
  }
  return {
    ...result,
    content: presentParliamentary(result.content, options),
  };
}
