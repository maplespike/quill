// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Source licence policy — runtime enforcement of the per-source flags recorded
 * in data-source-licenses.json.
 *
 * This module records conservative product decisions taken after the
 * 2026-10-14 licence audit; it is not a legal determination. Sources whose
 * publisher terms exclude commercial use or restrict reproduction are served
 * as discovery metadata only, and sources with personal-information exposure
 * are minimized. The `policy` blocks in the source-family inventory and the
 * table below are kept in sync — scripts/gates/check-source-compliance.mjs
 * fails on drift. This module carries no statement of law: verify each
 * publisher's terms per dataset and per use.
 *
 * Format note: the compliance gate parses SOURCE_POLICIES textually; keep one
 * `'family-id': { ... },` entry per line.
 */

export interface SourcePolicy {
  /** false = the source must not be used in paid/commercial contexts. */
  commercialUse: boolean;
  /** Serve metadata, short factual summaries and links only; never full content. */
  discoveryOnly: boolean;
  /** Citations, metadata, headline + link + short excerpt only; no content bodies. */
  linkOnly: boolean;
  /** Never merge or link these records to identify individuals or businesses. */
  aggregateOnly: boolean;
  /** Strip personal contact fields; never build cross-source person profiles. */
  minimizePersonalInformation: boolean;
  /** Reproductions carry a "not an official version" notice. */
  notOfficialVersion: boolean;
}

export const DEFAULT_SOURCE_POLICY: SourcePolicy = {
  commercialUse: true,
  discoveryOnly: false,
  linkOnly: false,
  aggregateOnly: false,
  minimizePersonalInformation: false,
  notOfficialVersion: false,
};

export const SOURCE_POLICIES: Record<string, Partial<SourcePolicy>> = {
  // House of Commons + Senate proceedings. The Speaker's Permission and the
  // Senate's reproduction permission allow accurate, non-official reproduction
  // only — and do NOT extend to commercial purposes or financial gain.
  committees: { commercialUse: false, discoveryOnly: true },
  'parliamentary-voting': { commercialUse: false, discoveryOnly: true },
  // Lobbying, charity, and political-finance records can carry individuals’
  // names. The licences do not grant personal-information rights (Privacy Act
  // s. 3 exemption), so output is minimized and no cross-source person
  // profiles are built from these sources.
  'federal-lobbying-monthly': { minimizePersonalInformation: true },
  'provincial-lobbying': { minimizePersonalInformation: true },
  'quebec-lobbying': { minimizePersonalInformation: true },
  'ontario-lobbying': { minimizePersonalInformation: true },
  'cra-charity': { minimizePersonalInformation: true },
  'political-donations': { minimizePersonalInformation: true },
  // Statistics Canada Open Licence: data must not be merged or linked to
  // attempt to identify an individual, business, or organization — records
  // stay aggregate and never enter the entity graph.
  statcan: { aggregateOnly: true },
  'nu-statcan': { aggregateOnly: true },
  // CanLII / SEDAR+ / SEDI: publisher terms restrict automated and bulk
  // reuse — serve citations, metadata, and links only.
  canlii: { linkOnly: true },
  'sedar-plus': { linkOnly: true },
  sedi: { linkOnly: true },
  // RSS/news feeds: headline + link + short excerpt only; no full-text
  // republication without a licence.
  'media-broadcasting': { linkOnly: true },
  'ngo-influence-rss': { linkOnly: true },
  // Canada Gazette / federal legislation: reproduce accurately, never as an
  // official version (Reproduction of Federal Law Order SI/97-5).
  gazette: { notOfficialVersion: true },
  legislation: { notOfficialVersion: true },
};

/** Module name -> source-family id, where the two differ. */
export const MODULE_SOURCE_ALIASES: Record<string, string> = {
  // The entity graph and its backfills use the umbrella name 'lobbying' for
  // every lobbying registry; the inventory records the specific families.
  lobbying: 'federal-lobbying-monthly',
  // Module names that differ from their inventory family id. The compliance
  // gate fails when a registry module resolves to no licence family.
  'canlii-fr': 'canlii',
  'gov-api': 'federal',
  indigenous: 'indigenous-relations',
  'ircc-citizenship': 'ircc',
  'ircc-entry-exit': 'ircc',
  'ircc-express-entry': 'ircc',
  'ircc-pr-admissions': 'ircc',
  'ircc-processing-times': 'ircc',
  'ircc-study-permits': 'ircc',
  'ircc-work-permits': 'ircc',
  'isc-communities': 'isc',
  'isc-education': 'isc',
  'isc-health-funding': 'isc',
  'isc-housing': 'isc',
  'isc-jordan-principle': 'isc',
  'isc-land-claims': 'isc',
  'isc-water': 'isc',
  'nrcan-energy': 'nrcan',
  'nrcan-fires': 'nrcan',
  'nrcan-forests': 'nrcan',
  'nrcan-minerals': 'nrcan',
  'nrcan-renewable': 'nrcan',
  'provincial-ckan': 'provincial',
  rss: 'media-broadcasting',
  'un-data': 'un',
};

export function policyForSource(familyId: string): SourcePolicy {
  return { ...DEFAULT_SOURCE_POLICY, ...(SOURCE_POLICIES[familyId] ?? {}) };
}

export function policyForModule(moduleName: string): SourcePolicy {
  return policyForSource(MODULE_SOURCE_ALIASES[moduleName] ?? moduleName);
}

/** True when the source must not be used in a paid/commercial context. */
export function isCommercialUseBlocked(sourceOrModule: string): boolean {
  return !policyForModule(sourceOrModule).commercialUse;
}

/**
 * True when person-level profiles must not be built from this source’s
 * records (no cross-source aggregation of individuals). Record output is
 * still minimized by `minimizePersonalInfo`; this flag governs the entity
 * graph and other derived-profile surfaces.
 */
export function restrictsPersonProfiles(sourceOrModule: string): boolean {
  return policyForModule(sourceOrModule).minimizePersonalInformation;
}

/** Source families whose records must never be entity-linked. */
export function aggregateOnlySources(): string[] {
  return Object.entries(SOURCE_POLICIES)
    .filter(([, policy]) => policy.aggregateOnly === true)
    .map(([id]) => id);
}

/* ------------------------------------------------------------------ */
/*  Required notices                                                   */
/* ------------------------------------------------------------------ */

export const COMMONS_REPRODUCTION_NOTICE =
  "Source: House of Commons proceedings, reproduced under the Speaker's Permission " +
  '(https://www.ourcommons.ca/en/important-notices). Reproduction is accurate and ' +
  'not presented as official; the permission does not extend to commercial purposes.';

export const SENATE_REPRODUCTION_NOTICE =
  "Source: Senate of Canada proceedings, reproduced under the Senate's Permission " +
  'Regarding Reproduction (https://sencanada.ca/en/intellectual-property). Reproduction ' +
  'is accurate and not presented as official; it does not extend to any use for ' +
  'purposes of financial gain.';

/**
 * Statistics Canada Open Licence notice. The licence requires the product
 * and reference date when they are known; the generic form is used when the
 * fields are unavailable ("as is" reproduction notice).
 */
export function statcanAttributionNotice(
  options: { product?: string; referenceDate?: string; adapted?: boolean } = {},
): string {
  const product = options.product?.trim();
  const date = options.referenceDate?.trim();
  const subject = product && date ? `${product}, ${date}` : product ?? date ?? "";
  const suffix = subject ? `, ${subject}` : "";
  if (options.adapted) {
    return `Adapted from Statistics Canada${suffix}. This does not constitute an endorsement by Statistics Canada of this product.`;
  }
  return `Source: Statistics Canada${suffix}. Reproduced and distributed on an "as is" basis with the permission of Statistics Canada.`;
}

/**
 * Reproduction of Federal Law Order (SI/97-5): reproductions must be
 * accurate and must never be presented as an official version.
 */
export const NOT_OFFICIAL_VERSION_NOTICE =
  'Not an official version. Reproduced under the Reproduction of Federal Law Order (SI/97-5); ' +
  'consult the official publication for authoritative text.';

const NOTICES_BY_SOURCE: Record<string, string[]> = {
  committees: [COMMONS_REPRODUCTION_NOTICE, SENATE_REPRODUCTION_NOTICE],
  'parliamentary-voting': [COMMONS_REPRODUCTION_NOTICE, SENATE_REPRODUCTION_NOTICE],
  gazette: [NOT_OFFICIAL_VERSION_NOTICE],
  legislation: [NOT_OFFICIAL_VERSION_NOTICE],
};

/** Required notices for a source family (empty for sources with none). */
export function noticesForSource(sourceId: string): string[] {
  return [...(NOTICES_BY_SOURCE[sourceId] ?? [])];
}

export const DISCOVERY_ONLY_BULK_EXPORT_REASON =
  'Licence policy: bulk record export is not offered for this source. Publisher terms ' +
  'exclude commercial use; the source is served as discovery metadata (titles, short ' +
  'summaries, links) with the required notices. See /data-sources.';

/* ------------------------------------------------------------------ */
/*  Record projection                                                  */
/* ------------------------------------------------------------------ */

/** Content-body keys — stripped whenever a source is discovery-only or link-only. */
const CONTENT_BODY_KEYS = new Set([
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
]);

/** Summary keys — truncated to a short excerpt rather than stripped. */
const SUMMARY_KEYS = new Set(['summary', 'description', 'contentsnippet', 'excerpt', 'abstract', 'notes']);

/** Max length of a served excerpt for restricted sources. */
export const SHORT_EXCERPT_MAX = 300;

/** Personal-contact keys always removed by minimization. */
const PERSONAL_ALWAYS_STRIP_KEYS = new Set([
  'homeaddress',
  'residentialaddress',
  'personalemail',
  'personalphone',
  'dateofbirth',
  'dob',
  'sin',
  'socialinsurancenumber',
]);

/** Personal-contact keys removed inside person-like objects. */
const PERSONAL_PERSON_STRIP_KEYS = new Set([
  'email',
  'phone',
  'telephone',
  'fax',
  'mobile',
  'cell',
  'cellphone',
  'homephone',
  'workphone',
  'address',
  'addresses',
  'postalcode',
  'postal',
]);

/** Keys that mark an object as person-like (individuals in records). */
const PERSON_MARKER_KEYS = new Set([
  'name',
  'fullname',
  'firstname',
  'lastname',
  'personname',
  'individual',
  'person',
]);

/** Keys that mark an object as organizational — exempt from person stripping. */
const ORG_MARKER_KEYS = new Set([
  'bn',
  'businessnumber',
  'registrationnumber',
  'organization',
  'organisation',
  'org',
  'institution',
  'company',
  'corporation',
  'employer',
  'foundation',
  'charity',
  'department',
  'agency',
]);

function normalizedKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function looksPersonLike(obj: Record<string, unknown>): boolean {
  const keys = Object.keys(obj).map(normalizedKey);
  const person = keys.some((k) => PERSON_MARKER_KEYS.has(k));
  const org = keys.some((k) => ORG_MARKER_KEYS.has(k));
  return person && !org;
}

function truncateExcerpt(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/**
 * Drop content-body fields (full text, speeches, transcripts) and, when a
 * maximum is given, truncate summary fields to a short excerpt. Used for
 * discovery-only and link-only sources so records carry metadata and short
 * factual summaries, never reproduced content.
 */
export function stripContentBodies<T>(value: T, options: { maxSummaryLength?: number } = {}): T {
  const max = options.maxSummaryLength;
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
        const nk = normalizedKey(key);
        if (CONTENT_BODY_KEYS.has(nk)) continue;
        const walked = walk(child);
        out[key] =
          SUMMARY_KEYS.has(nk) && typeof walked === 'string' && max !== undefined
            ? truncateExcerpt(walked, max)
            : walked;
      }
      return out;
    }
    return node;
  };
  return walk(value) as T;
}

/**
 * Strip personal contact fields (home addresses, personal email/phone, etc.).
 * Removed inside person-like objects; organization contact details are kept
 * unless they are unconditionally personal (home address, SIN, date of birth).
 */
export function minimizePersonalInfo<T>(value: T): T {
  const walk = (node: unknown, insidePerson: boolean): unknown => {
    if (Array.isArray(node)) return node.map((child) => walk(child, insidePerson));
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      const personLike = insidePerson || looksPersonLike(obj);
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(obj)) {
        const nk = normalizedKey(key);
        if (PERSONAL_ALWAYS_STRIP_KEYS.has(nk)) continue;
        if (personLike && PERSONAL_PERSON_STRIP_KEYS.has(nk)) continue;
        out[key] = walk(child, personLike);
      }
      return out;
    }
    return node;
  };
  return walk(value, false) as T;
}

/* ------------------------------------------------------------------ */
/*  Application                                                        */
/* ------------------------------------------------------------------ */

export interface AppliedSourcePolicy {
  records: unknown[];
  policy: {
    source: string;
    commercial_use: boolean;
    discovery_only: boolean;
    link_only: boolean;
    aggregate_only: boolean;
    minimize_personal_information: boolean;
    not_official_version: boolean;
    notices: string[];
  };
}

/**
 * Apply a source's licence policy to records before they leave the service.
 * Discovery-only and link-only sources lose content bodies (summaries are cut
 * to a short excerpt); personal-information sources are minimized. The
 * returned `policy` block documents what was applied and the required notices.
 */
export function applySourcePolicy(sourceId: string, records: unknown[]): AppliedSourcePolicy {
  const policy = policyForModule(sourceId);
  let out: unknown[] = records;
  if (policy.discoveryOnly || policy.linkOnly) {
    out = stripContentBodies(out, { maxSummaryLength: SHORT_EXCERPT_MAX });
  }
  if (policy.minimizePersonalInformation) {
    out = minimizePersonalInfo(out);
  }
  const familyId = MODULE_SOURCE_ALIASES[sourceId] ?? sourceId;
  if (policy.aggregateOnly && (familyId === "statcan" || familyId === "nu-statcan")) {
    // Statistics Canada Open Licence: carry the required source notice with
    // every record; publisher-supplied attribution text still wins.
    out = out.map((record) => {
      if (!record || typeof record !== "object") return record;
      const r = record as Record<string, unknown>;
      const existing = typeof r.attribution_text === "string" && r.attribution_text.trim();
      if (existing) return r;
      return {
        ...r,
        attribution_text: statcanAttributionNotice({
          product: typeof r.productId === "string" ? r.productId : undefined,
          referenceDate:
            typeof r.period === "string" ? r.period : typeof r.date === "string" ? r.date : undefined,
        }),
      };
    });
  }
  if (policy.notOfficialVersion) {
    // Reproduction of Federal Law Order: never present reproductions as an
    // official version; the notice rides with every record.
    out = out.map((record) => {
      if (!record || typeof record !== "object") return record;
      const r = record as Record<string, unknown>;
      const existing = typeof r.notice === "string" && r.notice.trim();
      if (existing) return r;
      return { ...r, notice: NOT_OFFICIAL_VERSION_NOTICE };
    });
  }
  return {
    records: out,
    policy: {
      source: sourceId,
      commercial_use: policy.commercialUse,
      discovery_only: policy.discoveryOnly,
      link_only: policy.linkOnly,
      aggregate_only: policy.aggregateOnly,
      minimize_personal_information: policy.minimizePersonalInformation,
      not_official_version: policy.notOfficialVersion,
      notices: noticesForSource(familyId),
    },
  };
}
