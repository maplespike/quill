/**
 * Elections Canada Third-Party Advertiser Registry — Quill
 *
 * Source metadata, URL patterns, and known data export endpoints for
 * Elections Canada third-party advertising data.
 *
 * Sources:
 *   - Third Party Registry Search (HTML):
 *     https://www.elections.ca/content2.aspx?section=pol&dir=thi&document=index&lang=e
 *   - open.canada.ca CKAN datasets for election advertising financial reports
 *   - Elections Canada CSV exports (when available)
 *
 * The third-party advertising regime under the Canada Elections Act
 * covers anyone (individual, corporation, union, or group) who spends
 * $500+ on election advertising in a calendar year.
 */


export const ELECTIONS_SOURCES = {
  /** Elections Canada — Third Party Registry Search */
  THIRD_PARTY_REGISTRY: {
    /** Base URL for the Elections Canada content system */
    BASE: 'https://www.elections.ca',
    /** Third party registry index page */
    REGISTRY_INDEX: 'https://www.elections.ca/content2.aspx?section=pol&dir=thi&document=index&lang=e',
    /** Registry search results page */
    REGISTRY_SEARCH: 'https://www.elections.ca/content2.aspx?section=pol&dir=thi&document=search&lang=e',
    /** Financial report listing page */
    FINANCIAL_REPORTS: 'https://www.elections.ca/content2.aspx?section=pol&dir=thi&document=financial&lang=e',
    /** CSV export base (if available) */
    CSV_EXPORT: 'https://www.elections.ca/content2.aspx?section=pol&dir=thi&document=csv&lang=e',
  },

  /** open.canada.ca CKAN datasets */
  CKAN: {
    /** CKAN API base */
    BASE: 'https://open.canada.ca/data',
    /** CKAN API search endpoint */
    SEARCH: 'https://open.canada.ca/data/api/3/action/package_search',
    /** CKAN package show endpoint */
    PACKAGE_SHOW: 'https://open.canada.ca/data/api/3/action/package_show',
    /** Query for third-party advertising datasets */
    THIRD_PARTY_QUERY: 'third+party+election+advertising',
    /** Query for Elections Canada financial reports */
    FINANCIAL_QUERY: 'elections+canada+financial+returns',
    /** Query for political financing datasets */
    POLITICAL_FINANCING_QUERY: 'political+financing+third+party',
  },

  /** open.canada.ca CKAN known package IDs for third-party data */
  KNOWN_PACKAGES: {
    /** Third Party Advertising — Election Advertising Reports */
    THIRD_PARTY_ADVERTISING: 'ef1e3528-b570-4a42-92ef-18a9749af8f2',
    /** Political Financing data — may contain third-party spending */
    POLITICAL_FINANCING: 'c6a5d285-7c8a-4c33-a56b-a4adb360d6fd',
    /** Elections Canada financial returns — broader dataset */
    FINANCIAL_RETURNS: '6495ea57-3824-48f0-a2b2-88477122a286',
  },
} as const;


/**
 * Maps raw type strings from Elections Canada to canonical types.
 * These strings appear in the registry HTML and CSV exports.
 */
export const TYPE_STRING_MAP: Record<string, string> = {
  'union': 'union',
  'trade union': 'union',
  'labour union': 'union',
  'labour organization': 'union',
  'syndicat': 'union',

  'corporation': 'corporation',
  'corp.': 'corporation',
  'inc.': 'corporation',
  'ltd.': 'corporation',
  'company': 'corporation',
  'business': 'corporation',
  'commercial': 'corporation',
  'société': 'corporation',

  'group': 'issue-group',
  'issue group': 'issue-group',
  'advocacy group': 'issue-group',
  'interest group': 'issue-group',
  'non-profit': 'issue-group',
  'ngo': 'issue-group',
  'organization': 'issue-group',
  'association': 'issue-group',
  'society': 'issue-group',
  'groupe': 'issue-group',

  'individual': 'individual',
  'person': 'individual',
  'resident': 'individual',
  'particulier': 'individual',

  'other': 'other',
  'unknown': 'other',
};


/**
 * Maps platform keywords found in Elections Canada data to canonical
 * AdvertisingPlatform types.
 */
export const PLATFORM_KEYWORDS: Record<string, string> = {
  'digital': 'digital',
  'internet': 'digital',
  'online': 'digital',
  'social media': 'digital',
  'website': 'digital',
  'web': 'digital',
  'email': 'digital',
  'search engine': 'digital',
  'display': 'digital',

  'print': 'print',
  'newspaper': 'print',
  'magazine': 'print',
  'flyer': 'print',
  'brochure': 'print',
  'pamphlet': 'print',
  'billboard': 'print',
  'sign': 'print',

  'broadcast': 'broadcast',
  'television': 'broadcast',
  'tv': 'broadcast',
  'cable': 'broadcast',

  'radio': 'radio',
  'am': 'radio',
  'fm': 'radio',

  'outdoor': 'outdoor',
  'signage': 'outdoor',
  'transit': 'outdoor',

  'telephone': 'telephone',
  'phone': 'telephone',
  'call': 'telephone',
  'sms': 'telephone',
  'text': 'telephone',
};


/**
 * Build a CKAN package_show URL for a given package ID.
 */
export function ckanPackageUrl(packageId: string): string {
  return `${ELECTIONS_SOURCES.CKAN.PACKAGE_SHOW}?id=${packageId}`;
}

/**
 * Build a CKAN package_search URL for third-party advertising data.
 */
export function ckanSearchUrl(
  query: string = ELECTIONS_SOURCES.CKAN.THIRD_PARTY_QUERY,
  rows: number = 20,
): string {
  return `${ELECTIONS_SOURCES.CKAN.SEARCH}?q=${query}&rows=${rows}`;
}

/**
 * Build the Elections Canada registry detail URL for a registrant.
 * The specific ID format depends on Elections Canada's content system.
 */
export function registryDetailUrl(registrantId: string): string {
  return `${ELECTIONS_SOURCES.THIRD_PARTY_REGISTRY.BASE}/content2.aspx?section=pol&dir=thi&document=detail&lang=e&id=${encodeURIComponent(registrantId)}`;
}
