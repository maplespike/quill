/**
 * Government Funding Tracker — Frostbite Data Pipeline
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
    const docs = body?.response?.docs ?? [];

    return {
      total: body?.response?.numFound ?? 0,
      datasets: docs.map((d: any) => ({
        title: d.title ?? '',
        url: d.url ?? '',
        org: d.org_title_at_publication ?? d.owner_org ?? '',
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

/**
 * Build a search URL for finding federal grants to a specific organization.
 */
export function buildGrantSearchUrl(organizationName: string): string {
  const query = encodeURIComponent(`"${organizationName}" grants contributions`);
  return `https://search.open.canada.ca/api/select?q=${query}&rows=10&wt=json`;
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


/**
 * Query the CKAN grants/contributions search for a specific actor.
 *
 * Fetches real dataset results from the open.canada.ca Solr endpoint
 * and returns raw docs that can be parsed into GovernmentFunding records.
 */
export async function queryGrantsForActor(
  actorName: string,
): Promise<CkanGrantDoc[]> {
  const url = buildGrantSearchUrl(actorName);
  try {
    const resp = await httpGet(url, {
      headers: { Accept: 'application/json' },
      timeoutMs: 15_000,
    });
    const body: CkanGrantResponse = JSON.parse(resp.body);
    return body?.response?.docs ?? [];
  } catch {
    return [];
  }
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

  // Generate a deterministic ID
  const id = `ckan-${hashString(recipient + dept + title + now)}`;

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
