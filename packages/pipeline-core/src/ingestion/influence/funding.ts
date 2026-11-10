// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Government Funding Tracker — Quill
 *
 * Tracks financial flows from the Canadian government to:
 *   - International organizations (UN, WHO, OECD dues)
 *   - NGOs and think tanks (grants and contributions)
 *   - Consulting firms (procurement contracts)
 *   - International development projects
 *
 * Sources:
 *   - open.canada.ca Grants & Contributions datasets
 *   - Proactive disclosure of contracts over $10K
 *   - Federal budget expenditures
 *   - GAC international development project data
 */

import { httpGet } from '../../utils/http.js';
import { hashString } from '../rss.js';
import { INFLUENCE_SOURCES, TRACKED_INFLUENCE_ACTORS } from './constants.js';
import type { GovernmentFunding, InfluenceConnection, InfluenceActorCategory } from './types.js';


/**
 * Search the federal Grants & Contributions dataset via CKAN.
 * Returns metadata about available grants datasets.
 */
export async function fetchGrantsCkanMetadata(): Promise<{
  total: number;
  datasets: { title: string; url: string; org: string }[];
}> {
  try {
    const resp = await httpGet(INFLUENCE_SOURCES.GRANTS.CKAN_SEARCH, {
      headers: { Accept: 'application/json' },
    });

    const body: any = resp.body ? JSON.parse(resp.body) : {};
    // CKAN package_search: { success, result: { count, results: [...] } }.
    const docs = body?.result?.results ?? body?.response?.docs ?? [];

    return {
      total: body?.result?.count ?? body?.response?.numFound ?? 0,
      datasets: docs.map((d: any) => ({
        title: d.title ?? '',
        url: d.url ?? '',
        org: d.org_title_at_publication ?? d.organization?.title ?? d.owner_org ?? '',
      })),
    };
  } catch {
    return { total: 0, datasets: [] };
  }
}


/**
 * Keywords that indicate an organization receiving government
 * funding might be a tracked influence actor.
 */
const TRACKED_ORG_KEYWORDS = TRACKED_INFLUENCE_ACTORS.map(a =>
  [a.name, ...a.aliases].map(n => n.toLowerCase()),
).flat();

/**
 * Check if a recipient name matches any tracked influence actor.
 */
export function matchTrackedActor(recipientName: string): string | null {
  const nameLower = recipientName.toLowerCase();
  for (const actor of TRACKED_INFLUENCE_ACTORS) {
    if (nameLower.includes(actor.name.toLowerCase())) return actor.id;
    for (const alias of actor.aliases) {
      if (nameLower.includes(alias.toLowerCase())) return actor.id;
    }
  }
  return null;
}

/** Max grant rows pulled per actor per run. */
export const GRANTS_PAGE_LIMIT = 100;

/**
 * Build a search URL for finding federal grants to a specific organization.
 *
 * Points at the CKAN datastore over the "Proactive Disclosure - Grants and
 * Contributions" resource. The previous Solr endpoint
 * (`https://search.open.canada.ca/api/select`) returns 404, which is why
 * government_funding stayed empty. The datastore exposes exact-match filters
 * on `recipient_legal_name`, so the recipient name goes in a JSON filter.
 */
export function buildGrantSearchUrl(organizationName: string): string {
  const filters = encodeURIComponent(JSON.stringify({ recipient_legal_name: organizationName }));
  return `${INFLUENCE_SOURCES.GRANTS.DATASTORE_SEARCH}` +
    `?resource_id=${INFLUENCE_SOURCES.GRANTS.RESOURCE_ID}` +
    `&limit=${GRANTS_PAGE_LIMIT}&filters=${filters}`;
}

/** Resolvable human URL for a grant row (dataset resource page). */
function grantSourceUrl(): string {
  return `https://open.canada.ca/data/dataset/${INFLUENCE_SOURCES.GRANTS.PACKAGE_ID}` +
    `/resource/${INFLUENCE_SOURCES.GRANTS.RESOURCE_ID}`;
}

/**
 * Derive a fiscal year from the reference number ("199-2019-2020-Q4-…") or
 * fall back to the agreement start date. Returns null when neither is usable.
 */
function fiscalYearFrom(refNumber: string | undefined, startDate: string | undefined): string | null {
  const fromRef = refNumber?.match(/(\d{4}-\d{4})/);
  if (fromRef) return fromRef[1];
  if (!startDate) return null;
  const year = parseInt(startDate.slice(0, 4), 10);
  const month = parseInt(startDate.slice(5, 7), 10);
  if (isNaN(year) || isNaN(month)) return null;
  // Canadian federal fiscal year starts 1 April.
  return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

/**
 * Normalize one CKAN datastore record into the doc shape the funding parser
 * reads. Field names come from the published grants data dictionary.
 */
export function normalizeGrantRecord(rec: Record<string, unknown>): CkanGrantDoc {
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined;
  const num = (v: unknown): number | undefined => {
    const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
    return isNaN(n) ? undefined : n;
  };

  const recipient =
    str(rec['recipient_legal_name']) ??
    str(rec['recipient_operating_name']) ??
    str(rec['research_organization_name']) ??
    'Unknown recipient';
  const agreementType = str(rec['agreement_type']);
  const startDate = str(rec['agreement_start_date']);
  const refNumber = str(rec['ref_number']);

  return {
    id: refNumber,
    title: str(rec['agreement_title_en']) ?? str(rec['prog_name_en']) ?? recipient,
    org_title_at_publication: str(rec['owner_org_title']) ?? str(rec['owner_org']),
    url: grantSourceUrl(),
    amount: num(rec['agreement_value']),
    program_name: str(rec['prog_name_en']),
    recipient_name: recipient,
    agreement_type:
      agreementType === 'G' ? 'grant' : agreementType === 'C' ? 'contribution' : (agreementType ?? 'grant'),
    start_date: startDate,
    end_date: str(rec['agreement_end_date']),
    description: str(rec['description_en']) ?? str(rec['agreement_title_en']),
    fiscal_year: fiscalYearFrom(refNumber, startDate) ?? undefined,
  };
}


/**
 * Raw grant record shape returned by the open.canada.ca Solr / CKAN API.
 */
interface CkanGrantDoc {
  id?: string;
  title?: string;
  org_title_at_publication?: string;
  owner_org?: string;
  url?: string;
  /** Fiscal year field if present */
  fiscal_year?: string;
  /** Amount if present */
  amount?: number;
  /** Program name if present */
  program_name?: string;
  /** Recipient name if present */
  recipient_name?: string;
  /** Agreement type */
  agreement_type?: string;
  /** Start/end dates */
  start_date?: string;
  end_date?: string;
  /** Description */
  description?: string;
  [key: string]: unknown;
}

interface CkanGrantResponse {
  response?: {
    numFound?: number;
    docs?: CkanGrantDoc[];
  };
}

/** CKAN `datastore_search` envelope — the live grants API shape. */
interface CkanDatastoreResponse {
  success?: boolean;
  error?: { message?: string };
  result?: {
    total?: number;
    records?: Record<string, unknown>[];
  };
}


/**
 * Query the grants/contributions datastore for a specific actor.
 *
 * Tries the actor's canonical name and each alias as an exact
 * `recipient_legal_name` filter and merges the hits. Errors are NOT swallowed:
 * if every lookup fails, the failure is thrown so the caller records it
 * instead of reporting "0 funding flows" for what is really a broken source.
 */
export async function queryGrantsForActor(
  actorName: string,
  aliases: string[] = [],
): Promise<CkanGrantDoc[]> {
  const candidates = [actorName, ...aliases].filter(n => n && n.trim().length > 0);
  const docs: CkanGrantDoc[] = [];
  const seen = new Set<string>();
  let anyLookupSucceeded = false;
  let lastError: unknown = null;

  for (const name of candidates) {
    const url = buildGrantSearchUrl(name);
    try {
      const resp = await httpGet(url, {
        headers: { Accept: 'application/json' },
        timeoutMs: 20_000,
      });
      if (resp.statusCode >= 400) {
        lastError = new Error(`HTTP ${resp.statusCode} from ${url}`);
        continue;
      }
      const body: CkanDatastoreResponse = JSON.parse(resp.body);
      if (body?.success === false) {
        lastError = new Error(`CKAN error: ${body.error?.message ?? 'unknown'}`);
        continue;
      }
      anyLookupSucceeded = true;

      for (const rec of body?.result?.records ?? []) {
        const doc = normalizeGrantRecord(rec);
        const key = doc.id ?? `${doc.recipient_name}|${doc.title}|${doc.start_date ?? ''}|${doc.amount ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        docs.push(doc);
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!anyLookupSucceeded && lastError) {
    const msg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`grants datastore unreachable for "${actorName}": ${msg}`);
  }

  return docs;
}


/**
 * Parse a raw CKAN grant doc into a partial GovernmentFunding record.
 */
export function parseCkanGrantDoc(
  doc: CkanGrantDoc,
  matchedActorId: string,
  matchedActorName: string,
): {
  id: string;
  recipientName: string;
  recipientType: InfluenceActorCategory | null;
  department: string;
  programName: string;
  agreementType: string;
  amount: number;
  currency: string;
  fiscalYear: string;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  sourceUrl: string;
  ingestedAt: string;
  departmentAcronym: string | null;
} {
  const now = new Date().toISOString();
  const recipient = doc.recipient_name ?? matchedActorName;
  const dept = doc.org_title_at_publication ?? doc.owner_org ?? 'Government of Canada';
  const title = doc.title ?? '';
  const sourceUrl = doc.url ?? buildGrantSearchUrl(matchedActorName);

  // Deterministic ID: the row must keep the same primary key across runs, or
  // every ingest inserts a fresh copy of the same grant and the table grows
  // without bound. Prefer the source reference number, else the content itself.
  const stableKey = doc.id ??
    `${recipient}|${dept}|${title}|${doc.start_date ?? ''}|${doc.amount ?? ''}`;
  const id = `ckan-${hashString(stableKey)}`;

  return {
    id,
    recipientName: recipient,
    recipientType: matchedActorId ? null : null, // resolved from tracked actor
    department: dept,
    departmentAcronym: null,
    programName: doc.program_name ?? (title.substring(0, 200) || 'Unknown Program'),
    agreementType: doc.agreement_type ?? 'grant',
    amount: doc.amount ?? 0,
    currency: 'CAD',
    fiscalYear: doc.fiscal_year ?? 'Unknown',
    startDate: doc.start_date ?? null,
    endDate: doc.end_date ?? null,
    description: doc.description ?? title ?? null,
    sourceUrl,
    ingestedAt: now,
  };
}


/**
 * Canada's assessed contributions to international organizations.
 * These are public through the federal budget and appropriation acts.
 *
 * This creates a catalog of known contribution streams for
 * tracked IOs, to be cross-referenced against budget documents.
 */
export const CANADA_INTL_ORG_CONTRIBUTIONS: {
  orgId: string;
  orgName: string;
  description: string;
  estimatedAnnualCad: string; // range, actual varies by year
  department: string;
}[] = [
  {
    orgId: 'un',
    orgName: 'United Nations',
    description: 'UN assessed contributions (regular budget, peacekeeping)',
    estimatedAnnualCad: '$400M-$600M',
    department: 'Global Affairs Canada',
  },
  {
    orgId: 'who',
    orgName: 'World Health Organization',
    description: 'WHO assessed contributions and voluntary funding',
    estimatedAnnualCad: '$100M-$200M',
    department: 'Global Affairs Canada',
  },
  {
    orgId: 'nato',
    orgName: 'NATO',
    description: 'NATO common funding (civil + military budgets)',
    estimatedAnnualCad: '$300M-$500M',
    department: 'National Defence',
  },
  {
    orgId: 'oecd',
    orgName: 'OECD',
    description: 'OECD assessed contributions',
    estimatedAnnualCad: '$15M-$25M',
    department: 'Global Affairs Canada',
  },
  {
    orgId: 'imf',
    orgName: 'IMF',
    description: 'IMF quota subscription',
    estimatedAnnualCad: 'Variable (quota based)',
    department: 'Finance Canada',
  },
  {
    orgId: 'world-bank',
    orgName: 'World Bank Group',
    description: 'IDA replenishment, IBRD subscriptions',
    estimatedAnnualCad: '$500M-$800M',
    department: 'Global Affairs Canada / Finance Canada',
  },
  {
    orgId: 'open-government-partnership',
    orgName: 'Open Government Partnership',
    description: 'OGP membership contribution',
    estimatedAnnualCad: '$100K-$500K',
    department: 'Treasury Board Secretariat',
  },
];


/**
 * Known high-value consulting contracts that have been scrutinized.
 * These serve as monitoring targets — we flag similar contracts.
 */
export const KNOWN_CONTROVERSIAL_CONTRACTS: {
  firm: string;
  year: string;
  department: string;
  value: string;
  description: string;
}[] = [
  {
    firm: 'McKinsey & Company',
    year: '2020-2024',
    department: 'Various',
    value: '$100M+',
    description: 'Federal consulting contracts for multiple departments',
  },
  {
    firm: 'Deloitte',
    year: '2023',
    department: 'PSPC / Various',
    value: '$200M+',
    description: 'GCdigital transformation contracts',
  },
  {
    firm: 'Accenture',
    year: '2018-2024',
    department: 'ESDC / Various',
    value: '$250M+',
    description: 'IT systems modernization, Employment and Social Development Canada',
  },
];

/**
 * Get the committee that would most likely question a specific
 * organization's relationship with government.
 */
export function getOversightCommittee(connection: InfluenceConnection): string {
  // Map government entities to likely oversight committees
  const committeeMap: Record<string, string> = {
    'Global Affairs Canada': 'FAAE',
    'National Defence': 'NDDN',
    'Finance Canada': 'FINA',
    'Health Canada': 'HESA',
    'Innovation': 'INDU',
    'Treasury Board': 'OGGO',
    'PSPC': 'OGGO',
    'ESDC': 'HUMA',
    'Justice': 'JUST',
    'Immigration': 'CIMM',
    'Environment': 'ENVI',
    'Natural Resources': 'RNNR',
    'Transport': 'TRRN',
    'Industry': 'INDU',
  };

  for (const [key, committee] of Object.entries(committeeMap)) {
    if (connection.governmentEntity.includes(key)) {
      return committee;
    }
  }

  return 'General';
}
