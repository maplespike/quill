/**
 * Oversight Bodies Constants — Quill
 *
 * URLs and configuration for Canada's independent oversight bodies.
 *
 * Sources:
 *   OAG: https://www.oag-bvg.gc.ca (RSS feed redirects to Canada.ca Drupal listing)
 *   PBO: https://www.pbo-dpb.ca (headless CMS with publication list API)
 *
 * The OAG migrated its web presence to Canada.ca. The legacy RSS feed at
 * /internet/English/ir-rss_e_923.html now returns 404; reports are listed
 * via Canada.ca's Drupal JSON:API. We fall back to scraping the listing page.
 *
 * PBO uses a Strapi-based headless CMS with a Nuxt frontend. Publications
 * are rendered client-side; we scrape the rendered HTML for publication data.
 */

import type { OversightBody } from './types.js';


/** Legacy OAG domain (redirects to Canada.ca for most pages) */
export const OAG_LEGACY_BASE = 'https://www.oag-bvg.gc.ca';

/** Canada.ca OAG landing page */
export const OAG_CANADA_CA_BASE = 'https://www.canada.ca/en/auditor-general.html';

/** OAG report listing on Canada.ca (Drupal JSON:API listing) */
export const OAG_REPORTS_URL = 'https://www.canada.ca/en/auditor-general/our-work/audit-reports.html';

/** Update on Past Audits — recommendation tracking dashboard */
export const OAG_UPDATE_ON_PAST_AUDITS_URL = 'https://www.canada.ca/en/auditor-general/our-work/update-on-past-audits.html';

/**
 * OAG legacy RSS feed URL.
 * Known pattern from the pre-migration site:
 *   https://www.oag-bvg.gc.ca/internet/English/ir-rss_e_923.html
 * This may redirect or 404 — we try it first, then fall back to scraping.
 */
export const OAG_RSS_URL = 'https://www.oag-bvg.gc.ca/internet/English/ir-rss_e_923.html';

/**
 * Canada.ca Drupal JSON:API endpoint for OAG reports.
 * If available, this provides structured data without scraping HTML.
 */
export const OAG_JSON_API_URL = 'https://www.canada.ca/api/drupal/auditor-general/reports.json';

/**
 * Canada.ca Drupal JSON:API update-on-past-audits endpoint.
 * Structured recommendation tracking data.
 */
export const OAG_RECOMMENDATIONS_API_URL = 'https://www.canada.ca/api/drupal/auditor-general/recommendations.json';

/*  PBO — Parliamentary Budget Officer / Directrice parlementaire du budget */

/** PBO base URL */
export const PBO_BASE_URL = 'https://www.pbo-dpb.ca';

/** PBO publications listing page (JS-rendered) */
export const PBO_PUBLICATIONS_URL = 'https://www.pbo-dpb.ca/en/publications';

/**
 * PBO publications JSON API.
 *
 * `cms.pbo-dpb.ca/api/publications` now 301s to `www.pbo-dpb.ca/api/publications`,
 * which 404s with HTML. The publications page publishes `data-apiroot` pointing
 * at this host. Pagination links in the payload use a separate distribution
 * host; page 1 of this URL is the stable entry.
 */
export const PBO_API_URL = 'https://rest-393962616e6b.pbo-dpb.ca/publications';

/** Single publication detail page pattern: /en/publications/{slug} */
export function pboPublicationUrl(slug: string): string {
  return `${PBO_BASE_URL}/en/publications/${slug}`;
}


/**
 * Ethics Commissioner base URL.
 * The old SharePoint host `ciec-ccie.parl.gc.ca` now redirects to a welcome
 * stub. Investigation reports are listed on ethicscanada.ca.
 */
export const CIEC_BASE_URL = 'https://www.ethicscanada.ca';

/** Ethics Commissioner investigation-report listing (titles and links only). */
export const CIEC_INVESTIGATIONS_URL = 'https://www.ethicscanada.ca/en/investigation-reports';

/** Ethics Commissioner publications (annual reports, etc.) */
export const CIEC_PUBLICATIONS_URL = 'https://www.ethicscanada.ca/en/publications';

/**
 * Construct a CIEC investigation detail URL from a relative path.
 */
export function ciecInvestigationUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${CIEC_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/*  OCL — Office of the Commissioner of Lobbying / Lobbying Commissioner */

/** Lobbying Commissioner (OCL) base URL */
export const OCL_BASE_URL = 'https://lobbycanada.gc.ca';

/** Lobbying Commissioner investigations listing page */
export const OCL_INVESTIGATIONS_URL = 'https://lobbycanada.gc.ca/en/reports-and-publications/investigations/';

/** Lobbying Commissioner annual reports listing */
export const OCL_ANNUAL_REPORTS_URL = 'https://lobbycanada.gc.ca/en/reports-and-publications/annual-reports/';

/**
 * Construct an OCL investigation detail URL from a relative path.
 */
export function oclInvestigationUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${OCL_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}


export interface OversightBodyConfig {
  body: OversightBody;
  nameEn: string;
  nameFr: string;
  baseUrl: string;
  reportsUrl: string;
  rssUrl: string | null;
  apiUrl: string | null;
}

export const OVERSIGHT_BODIES: Record<OversightBody, OversightBodyConfig> = {
  OAG: {
    body: 'OAG',
    nameEn: 'Office of the Auditor General of Canada',
    nameFr: 'Bureau du vérificateur général du Canada',
    baseUrl: OAG_CANADA_CA_BASE,
    reportsUrl: OAG_REPORTS_URL,
    rssUrl: OAG_RSS_URL,
    apiUrl: OAG_JSON_API_URL,
  },
  PBO: {
    body: 'PBO',
    nameEn: 'Parliamentary Budget Officer',
    nameFr: 'Directrice parlementaire du budget',
    baseUrl: PBO_BASE_URL,
    reportsUrl: PBO_PUBLICATIONS_URL,
    rssUrl: null,
    apiUrl: PBO_API_URL,
  },
  EthicsCommissioner: {
    body: 'EthicsCommissioner',
    nameEn: 'Office of the Conflict of Interest and Ethics Commissioner',
    nameFr: "Commissariat aux conflits d'intérêts et à l'éthique",
    baseUrl: CIEC_BASE_URL,
    reportsUrl: CIEC_INVESTIGATIONS_URL,
    rssUrl: null,
    apiUrl: null,
  },
  LobbyingCommissioner: {
    body: 'LobbyingCommissioner',
    nameEn: 'Office of the Commissioner of Lobbying',
    nameFr: "Commissariat au lobbying",
    baseUrl: 'https://lobbycanada.gc.ca',
    reportsUrl: 'https://lobbycanada.gc.ca/en/reports-and-publications/',
    rssUrl: null,
    apiUrl: null,
  },
  CompetitionBureau: {
    body: 'CompetitionBureau',
    nameEn: 'Competition Bureau Canada',
    nameFr: 'Bureau de la concurrence Canada',
    baseUrl: 'https://www.competitionbureau.gc.ca',
    reportsUrl: 'https://www.competitionbureau.gc.ca/eic/site/cb-bc.nsf/eng/h_00005.html',
    rssUrl: null,
    apiUrl: null,
  },
  CRTC: {
    body: 'CRTC',
    nameEn: 'Canadian Radio-television and Telecommunications Commission',
    nameFr: 'Conseil de la radiodiffusion et des télécommunications canadiennes',
    baseUrl: 'https://crtc.gc.ca',
    reportsUrl: 'https://crtc.gc.ca/eng/archive/',
    rssUrl: null,
    apiUrl: null,
  },
  PrivacyCommissioner: {
    body: 'PrivacyCommissioner',
    nameEn: 'Office of the Privacy Commissioner of Canada',
    nameFr: 'Commissariat à la protection de la vie privée du Canada',
    baseUrl: 'https://www.priv.gc.ca',
    reportsUrl: 'https://www.priv.gc.ca/en/about-the-opc/what-we-do/audits-and-investigations/',
    rssUrl: null,
    apiUrl: null,
  },
  InformationCommissioner: {
    body: 'InformationCommissioner',
    nameEn: 'Office of the Information Commissioner of Canada',
    nameFr: "Commissariat à l'information du Canada",
    baseUrl: 'https://www.oic-ci.gc.ca',
    reportsUrl: 'https://www.oic-ci.gc.ca/en/resources/investigation-reports',
    rssUrl: null,
    apiUrl: null,
  },
  OfficialLanguagesCommissioner: {
    body: 'OfficialLanguagesCommissioner',
    nameEn: 'Office of the Commissioner of Official Languages',
    nameFr: "Commissariat aux langues officielles",
    baseUrl: 'https://www.clo-ocol.gc.ca',
    reportsUrl: 'https://www.clo-ocol.gc.ca/en/publications',
    rssUrl: null,
    apiUrl: null,
  },
  CanadianHumanRightsCommission: {
    body: 'CanadianHumanRightsCommission',
    nameEn: 'Canadian Human Rights Commission',
    nameFr: 'Commission canadienne des droits de la personne',
    baseUrl: 'https://www.chrc-ccdp.gc.ca',
    reportsUrl: 'https://www.chrc-ccdp.gc.ca/en/publications',
    rssUrl: null,
    apiUrl: null,
  },
} as const;

/** Report type keyword mappings for body-specific type labels */
export const OAG_REPORT_TYPE_MAP: Record<string, string> = {
  'performance-audit': 'performance-audit',
  'special-examination': 'special-examination',
  'environmental': 'environmental-audit',
  'commissioner': 'environmental-audit',
  'annual': 'annual-report',
  'corporate': 'corporate-report',
  'media': 'media-release',
  'news': 'media-release',
  'opening': 'opening-statement',
};

export const PBO_REPORT_TYPE_MAP: Record<string, string> = {
  'Report': 'cost-estimate',
  'Note': 'research-report',
  'Legislative Costing Note': 'legislative-costing-note',
  'Legislative Costing Note - Re-cost': 'legislative-costing-note',
  'Cost Estimate': 'cost-estimate',
  'Research Report': 'research-report',
  'Media Release': 'media-release',
  'Opening Statement': 'opening-statement',
};


/** Competition Bureau Canada base URL */
export const CB_BASE_URL = 'https://competitionbureau.gc.ca';

/**
 * Competition Bureau mergers URL.
 * Key source: listing of merger reviews with outcomes, conditions,
 * and analysis of anti-competitive effects.
 */
export const CB_MERGERS_URL = 'https://competitionbureau.gc.ca/eic/site/cb-bc.nsf/eng/h_00005.html';

/**
 * Competition Bureau enforcement actions URL.
 * Cases where the Bureau has taken action against anti-competitive conduct.
 */
export const CB_ENFORCEMENT_URL = 'https://competitionbureau.gc.ca/eic/site/cb-bc.nsf/eng/h_00037.html';

/**
 * Competition Bureau consultation and policy updates URL.
 */
export const CB_CONSULTATIONS_URL = 'https://competitionbureau.gc.ca/eic/site/cb-bc.nsf/eng/h_00024.html';

/**
 * Competition Bureau RSS feed for news releases.
 * The Bureau publishes news releases about merger decisions,
 * enforcement actions, and market studies via RSS.
 */
export const CB_RSS_URL = 'https://competitionbureau.gc.ca/eic/site/cb-bc.nsf/rss/eng';

/**
 * Competition Bureau bulletins page URL.
 * Guidance documents, interpretation bulletins, and technical papers.
 */
export const CB_BULLETINS_URL = 'https://competitionbureau.gc.ca/eic/site/cb-bc.nsf/eng/h_00044.html';

/*  CRTC — Conseil de la radiodiffusion et des télécommunications     */
/*     canadiennes                                                     */

/** CRTC base URL */
export const CRTC_BASE_URL = 'https://crtc.gc.ca';

/**
 * CRTC decisions and publications archive.
 * Searchable by year, type (broadcasting/telecom), and keywords.
 */
export const CRTC_DECISIONS_URL = 'https://crtc.gc.ca/eng/archive/';

/**
 * CRTC broadcasting decisions archive page.
 * Key source for media ownership change approvals, Canadian content
 * requirements, and diversity of voices regulations.
 */
export const CRTC_BROADCASTING_DECISIONS_URL = 'https://crtc.gc.ca/eng/archive/decision-broadcasting.htm';

/**
 * CRTC telecom decisions archive page.
 * Key source for internet pricing, net neutrality enforcement, and
 * wholesale access decisions.
 */
export const CRTC_TELECOM_DECISIONS_URL = 'https://crtc.gc.ca/eng/archive/decision-telecom.htm';

/**
 * CRTC RSS feed for broadcasting decisions.
 */
export const CRTC_BROADCASTING_RSS_URL = 'https://crtc.gc.ca/rss/eng/decision-broadcasting.xml';

/**
 * CRTC RSS feed for telecom decisions.
 */
export const CRTC_TELECOM_RSS_URL = 'https://crtc.gc.ca/rss/eng/decision-telecom.xml';

/**
 * CRTC — notices of consultation RSS feed.
 * Proposed regulatory changes open for public comment.
 */
export const CRTC_CONSULTATION_RSS_URL = 'https://crtc.gc.ca/rss/eng/notice-consultation.xml';

/**
 * CRTC ownership changes page.
 * Tracks transfers of ownership and control of broadcasting undertakings.
 */
export const CRTC_OWNERSHIP_URL = 'https://crtc.gc.ca/eng/ownership/';

/**
 * Build a CRTC decision page URL from a decision number.
 * Pattern: https://crtc.gc.ca/eng/archive/2024/2024-123.htm
 */
export function crtcDecisionUrl(year: string, number: string): string {
  return `${CRTC_BASE_URL}/eng/archive/${year}/${number}.htm`;
}
