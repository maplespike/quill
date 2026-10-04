/**
 * Provincial Legislatures Constants — Quill
 *
 * Province configurations, URLs, API endpoints, and metadata for
 * legislative data sources across all 10 Canadian provinces.
 *
 * Each province publishes its legislative data differently:
 *   - Ontario: ola.org (XML Hansard via API, committees API)
 *   - BC: leg.bc.ca (Hansard XML archives, committee pages)
 *   - Alberta: assembly.ab.ca (Hansard HTML, committee hearings)
 *   - Quebec: assnat.qc.ca (Hansard XML, bilingual)
 *   - Others: various formats — generic HTML-based fetchers provided
 */

import type { ProvinceLegislatureConfig } from './types.js';

/* ------------------------------------------------------------------ */
/*  Province Configurations                                            */
/* ------------------------------------------------------------------ */

/**
 * Ontario Legislative Assembly configuration.
 * Ontario has the best API — provides XML Hansard documents, committee
 * evidence, and bill status via the OLA website.
 *
 * Hansard XML: https://www.ola.org/en/legislative-business/hansard/parliament-43/session-1/YYYY-MM-DD
 * Committees:  https://www.ola.org/en/legislative-business/committees
 * Bills:       https://www.ola.org/en/legislative-business/bills
 */
export const ONTARIO_CONFIG: ProvinceLegislatureConfig = {
  province: 'ON',
  name: 'Ontario',
  assemblyName: 'Legislative Assembly of Ontario',
  baseUrl: 'https://www.ola.org',
  hansardUrl: 'https://www.ola.org/en/legislative-business/hansard-search',
  committeesUrl: 'https://www.ola.org/en/legislative-business/committees',
  billsUrl: 'https://www.ola.org/en/legislative-business/bills',
  apiEndpoints: {
    hansard: 'https://www.ola.org/en/legislative-business/hansard-search',
    committees: 'https://www.ola.org/api/committees',
    bills: 'https://www.ola.org/api/bills',
  },
  hasXmlHansard: true,
  hasCommitteeApi: true,
  hasBillsApi: true,
  notes: 'Best API among provinces. XML Hansard available per-sitting. Committee evidence via HTML pages.',
};

/**
 * British Columbia Legislative Assembly configuration.
 * BC publishes XML Hansard and has committee meeting pages.
 *
 * Hansard XML: https://www.leg.bc.ca/documents-data/hansard
 * Committees:  https://www.leg.bc.ca/parliamentary-business/committees
 * Bills:       https://www.leg.bc.ca/parliamentary-business/bills
 */
export const BC_CONFIG: ProvinceLegislatureConfig = {
  province: 'BC',
  name: 'British Columbia',
  assemblyName: 'Legislative Assembly of British Columbia',
  baseUrl: 'https://www.leg.bc.ca',
  hansardUrl: 'https://www.leg.bc.ca/parliamentary-business/overview/43rd-parliament/2nd-session/debate-transcripts',
  committeesUrl: 'https://www.leg.bc.ca/parliamentary-business/committees',
  billsUrl: 'https://www.leg.bc.ca/parliamentary-business/bills',
  apiEndpoints: {
    hansard: 'https://www.leg.bc.ca/document-search',
    committees: 'https://www.leg.bc.ca/parliamentary-business/committees/committee-meetings',
  },
  hasXmlHansard: true,
  hasCommitteeApi: false,
  hasBillsApi: false,
  notes: 'Hansard published at session-specific URL. Document search available at /document-search. Committees published as HTML pages. Bills published as PDF.',
};

/**
 * Alberta Legislative Assembly configuration.
 * Alberta publishes Hansard as HTML and committee hearings data.
 *
 * Hansard:  https://www.assembly.ab.ca/net/speech.aspx
 * Committees: https://www.assembly.ab.ca/committees
 * Bills:       https://www.assembly.ab.ca/bills
 */
export const ALBERTA_CONFIG: ProvinceLegislatureConfig = {
  province: 'AB',
  name: 'Alberta',
  assemblyName: 'Legislative Assembly of Alberta',
  baseUrl: 'https://www.assembly.ab.ca',
  hansardUrl: 'https://www.assembly.ab.ca/net/speech.aspx',
  committeesUrl: 'https://www.assembly.ab.ca/committees',
  billsUrl: 'https://www.assembly.ab.ca/bills',
  apiEndpoints: {
    hansard: 'https://www.assembly.ab.ca/api/hansard',
  },
  hasXmlHansard: false,
  hasCommitteeApi: false,
  hasBillsApi: false,
  notes: 'Hansard published as HTML web pages. Committee schedules available. Bills as HTML/PDF.',
};

/**
 * Quebec National Assembly configuration.
 * Bilingual (French/English) — publishes XML Hansard.
 *
 * Hansard:  https://www.assnat.qc.ca/fr/travaux-parlementaires/derniers-journaux.html
 * Committees: https://www.assnat.qc.ca/fr/travaux-parlementaires/commissions/index.html
 * Bills:       https://www.assnat.qc.ca/fr/travaux-parlementaires/projets-loi/index.html
 */
export const QUEBEC_CONFIG: ProvinceLegislatureConfig = {
  province: 'QC',
  name: 'Quebec',
  assemblyName: 'Assemblée nationale du Québec',
  baseUrl: 'https://www.assnat.qc.ca',
  hansardUrl: 'https://www.assnat.qc.ca/fr/travaux-parlementaires/derniers-journaux.html',
  committeesUrl: 'https://www.assnat.qc.ca/fr/travaux-parlementaires/commissions/index.html',
  billsUrl: 'https://www.assnat.qc.ca/fr/travaux-parlementaires/projets-loi/index.html',
  hasXmlHansard: true,
  hasCommitteeApi: false,
  hasBillsApi: false,
  notes: 'Bilingual (FR/EN). XML Hansard available. Committees published as HTML. Bills published as HTML.',
};

/**
 * Saskatchewan Legislative Assembly configuration.
 *
 * Hansard:  https://www.legassembly.sk.ca/hansard/
 * Committees: https://www.legassembly.sk.ca/committees/
 * Bills:       https://publications.saskatchewan.ca/#/products?q=bills
 */
export const SASKATCHEWAN_CONFIG: ProvinceLegislatureConfig = {
  province: 'SK',
  name: 'Saskatchewan',
  assemblyName: 'Legislative Assembly of Saskatchewan',
  baseUrl: 'https://www.legassembly.sk.ca',
  hansardUrl: 'https://www.legassembly.sk.ca/hansard/',
  committeesUrl: 'https://www.legassembly.sk.ca/committees/',
  billsUrl: 'https://publications.saskatchewan.ca/#/products?q=bills',
  hasXmlHansard: false,
  hasCommitteeApi: false,
  hasBillsApi: false,
  notes: 'Hansard published as PDF. Committee pages have HTML schedules.',
};

/**
 * Manitoba Legislative Assembly configuration.
 *
 * Hansard:  https://www.gov.mb.ca/legislature/hansard/
 * Committees: https://www.gov.mb.ca/legislature/committees/
 * Bills:       https://web2.gov.mb.ca/bills/
 */
export const MANITOBA_CONFIG: ProvinceLegislatureConfig = {
  province: 'MB',
  name: 'Manitoba',
  assemblyName: 'Legislative Assembly of Manitoba',
  baseUrl: 'https://www.gov.mb.ca/legislature',
  hansardUrl: 'https://www.gov.mb.ca/legislature/hansard/',
  committeesUrl: 'https://www.gov.mb.ca/legislature/committees/',
  billsUrl: 'https://web2.gov.mb.ca/bills/',
  hasXmlHansard: false,
  hasCommitteeApi: false,
  hasBillsApi: false,
  notes: 'Hansard as HTML/PDF. Committees as HTML pages. Bills via MB legislative website.',
};

/**
 * Nova Scotia House of Assembly configuration.
 *
 * Hansard:  https://nslegislature.ca/legislative-business/hansard-debates
 * Committees: https://nslegislature.ca/legislative-business/committees
 * Bills:       https://nslegislature.ca/legislative-business/bills
 */
export const NOVA_SCOTIA_CONFIG: ProvinceLegislatureConfig = {
  province: 'NS',
  name: 'Nova Scotia',
  assemblyName: 'Nova Scotia House of Assembly',
  baseUrl: 'https://nslegislature.ca',
  hansardUrl: 'https://nslegislature.ca/legislative-business/hansard-debates',
  committeesUrl: 'https://nslegislature.ca/legislative-business/committees',
  billsUrl: 'https://nslegislature.ca/legislative-business/bills',
  hasXmlHansard: false,
  hasCommitteeApi: false,
  hasBillsApi: false,
  notes: 'Hansard as HTML. Committee evidence as HTML. Bills as HTML/PDF.',
};

/**
 * New Brunswick Legislative Assembly configuration.
 *
 * Hansard:  https://www.legnb.ca/en/hansard
 * Committees: https://www.legnb.ca/en/committees
 * Bills:       https://www.legnb.ca/en/bills
 */
export const NEW_BRUNSWICK_CONFIG: ProvinceLegislatureConfig = {
  province: 'NB',
  name: 'New Brunswick',
  assemblyName: 'Legislative Assembly of New Brunswick',
  baseUrl: 'https://www.legnb.ca',
  hansardUrl: 'https://www.legnb.ca/en/hansard',
  committeesUrl: 'https://www.legnb.ca/en/committees',
  billsUrl: 'https://www.legnb.ca/en/bills',
  hasXmlHansard: false,
  hasCommitteeApi: false,
  hasBillsApi: false,
  notes: 'Bilingual (EN/FR). Hansard as HTML/PDF. Committees as HTML. Bills as HTML.',
};

/**
 * Newfoundland and Labrador House of Assembly configuration.
 *
 * Hansard:  https://www.assembly.nl.ca/HouseBusiness/Hansard/
 * Committees: https://www.assembly.nl.ca/HouseBusiness/Committees/
 * Bills:       https://www.assembly.nl.ca/HouseBusiness/Bills/
 */
export const NFLD_CONFIG: ProvinceLegislatureConfig = {
  province: 'NL',
  name: 'Newfoundland and Labrador',
  assemblyName: 'Newfoundland and Labrador House of Assembly',
  baseUrl: 'https://www.assembly.nl.ca',
  hansardUrl: 'https://www.assembly.nl.ca/HouseBusiness/Hansard/',
  committeesUrl: 'https://www.assembly.nl.ca/HouseBusiness/Committees/',
  billsUrl: 'https://www.assembly.nl.ca/HouseBusiness/Bills/',
  hasXmlHansard: false,
  hasCommitteeApi: false,
  hasBillsApi: false,
  notes: 'Hansard as HTML/PDF. Committee information as HTML. Bills published as HTML/PDF.',
};

/**
 * Prince Edward Island Legislative Assembly configuration.
 *
 * Hansard:  https://www.assembly.pe.ca/hansard
 * Committees: https://www.assembly.pe.ca/committees
 * Bills:       https://www.assembly.pe.ca/bills
 */
export const PEI_CONFIG: ProvinceLegislatureConfig = {
  province: 'PE',
  name: 'Prince Edward Island',
  assemblyName: 'Legislative Assembly of Prince Edward Island',
  baseUrl: 'https://www.assembly.pe.ca',
  hansardUrl: 'https://www.assembly.pe.ca/hansard',
  committeesUrl: 'https://www.assembly.pe.ca/committees',
  billsUrl: 'https://www.assembly.pe.ca/bills',
  hasXmlHansard: false,
  hasCommitteeApi: false,
  hasBillsApi: false,
  notes: 'Hansard as HTML. Committees as HTML. Bills as HTML/PDF. Small dataset.',
};

/* ------------------------------------------------------------------ */
/*  Territory Configurations                                           */
/* ------------------------------------------------------------------ */

/**
 * Yukon Legislative Assembly configuration.
 *
 * Hansard:  https://yukonassembly.ca/hansard
 * Committees: https://yukonassembly.ca/committees
 */
export const YUKON_CONFIG: ProvinceLegislatureConfig = {
  province: 'YT',
  name: 'Yukon',
  assemblyName: 'Yukon Legislative Assembly',
  baseUrl: 'https://yukonassembly.ca',
  hansardUrl: 'https://yukonassembly.ca/hansard',
  committeesUrl: 'https://yukonassembly.ca/committees',
  billsUrl: 'https://yukonassembly.ca/bills',
  hasXmlHansard: false,
  hasCommitteeApi: false,
  hasBillsApi: false,
  notes: 'Hansard as HTML/PDF. Cloudflare-protected site.',
};

/**
 * Northwest Territories Legislative Assembly configuration.
 *
 * Hansard:  https://www.ntlegislativeassembly.ca/documents-proceedings/hansard
 * Committees: https://www.ntlegislativeassembly.ca/committees
 */
export const NWT_CONFIG: ProvinceLegislatureConfig = {
  province: 'NT',
  name: 'Northwest Territories',
  assemblyName: 'Legislative Assembly of the Northwest Territories',
  baseUrl: 'https://www.ntlegislativeassembly.ca',
  hansardUrl: 'https://www.ntlegislativeassembly.ca/documents-proceedings/hansard',
  committeesUrl: 'https://www.ntlegislativeassembly.ca/committees',
  billsUrl: 'https://www.ntlegislativeassembly.ca/documents-proceedings/bills',
  hasXmlHansard: false,
  hasCommitteeApi: false,
  hasBillsApi: false,
  notes: 'Hansard as HTML/PDF. Structured table with dates, Word, and PDF links.',
};

/**
 * Nunavut Legislative Assembly configuration.
 *
 * Hansard:  https://assembly.nu.ca/hansard
 * Committees: https://assembly.nu.ca/standing-and-special-committees
 */
export const NUNAVUT_CONFIG: ProvinceLegislatureConfig = {
  province: 'NU',
  name: 'Nunavut',
  assemblyName: 'Legislative Assembly of Nunavut',
  baseUrl: 'https://assembly.nu.ca',
  hansardUrl: 'https://assembly.nu.ca/hansard',
  committeesUrl: 'https://assembly.nu.ca/standing-and-special-committees',
  billsUrl: 'https://assembly.nu.ca/bills-and-legislation',
  hasXmlHansard: false,
  hasCommitteeApi: false,
  hasBillsApi: false,
  notes: 'Hansard as PDF. "The Blues" unedited transcripts available next day. Bilingual (EN/FR/IU).',
};

/* ------------------------------------------------------------------ */
/*  Province Registry                                                  */
/* ------------------------------------------------------------------ */

/**
 * All province legislature configurations keyed by province code.
/**
 * All province legislature configurations keyed by province code.
 */
export const PROVINCE_CONFIGS: Record<string, ProvinceLegislatureConfig> = {
  ON: ONTARIO_CONFIG,
  BC: BC_CONFIG,
  AB: ALBERTA_CONFIG,
  QC: QUEBEC_CONFIG,
  SK: SASKATCHEWAN_CONFIG,
  MB: MANITOBA_CONFIG,
  NS: NOVA_SCOTIA_CONFIG,
  NB: NEW_BRUNSWICK_CONFIG,
  NL: NFLD_CONFIG,
  PE: PEI_CONFIG,
  YT: YUKON_CONFIG,
  NT: NWT_CONFIG,
  NU: NUNAVUT_CONFIG,
};

/**
 * Ordered list of all province configurations.
 */
export const ALL_PROVINCES: ProvinceLegislatureConfig[] = Object.values(PROVINCE_CONFIGS);

/**
 * Verified-working jurisdictions with custom fetchers.
 * ON, BC: Custom XML + HTML parsers.
 * AB, QC: Custom HTML parsers.
 * Remaining 9 provinces/territories use a generic HTML link extractor (best-effort, may be broken if site structure changed).
 */
export const IMPLEMENTED_PROVINCES: ProvinceLegislatureConfig[] = [
  ONTARIO_CONFIG,
  BC_CONFIG,
  ALBERTA_CONFIG,
  QUEBEC_CONFIG,
  SASKATCHEWAN_CONFIG,
  MANITOBA_CONFIG,
  NOVA_SCOTIA_CONFIG,
  NEW_BRUNSWICK_CONFIG,
  NFLD_CONFIG,
  PEI_CONFIG,
  YUKON_CONFIG,
  NWT_CONFIG,
  NUNAVUT_CONFIG,
];

/**
 * Provinces with XML Hansard support.
 */
export const XML_HANSARD_PROVINCES: ProvinceLegislatureConfig[] = [
  ONTARIO_CONFIG,
  BC_CONFIG,
  QUEBEC_CONFIG,
];

/* ------------------------------------------------------------------ */
/*  Province-specific URLs                                             */
/* ------------------------------------------------------------------ */

/**
 * Ontario specific API endpoints and paths.
 */
export const ONTARIO = {
  HANSARD_LIST_URL: 'https://www.ola.org/en/legislative-business/hansard-search',
  HANSARD_XML_PATTERN: 'https://www.ola.org/sites/default/files/hansard/transcripts/parliament-{parliament}/session-{session}/{date}.xml',
  COMMITTEE_EVIDENCE_XML_PATTERN: 'https://www.ola.org/sites/default/files/committee/transcripts/{committee}/{date}.xml',
  COMMITTEES_URL: 'https://www.ola.org/en/legislative-business/committees',
  BILLS_LIST_URL: 'https://www.ola.org/en/legislative-business/bills/current-parliament',
  USER_AGENT: 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
};

/**
 * British Columbia specific API endpoints and paths.
 */
export const BC = {
  HANSARD_BASE_URL: 'https://www.leg.bc.ca/parliamentary-business/overview/43rd-parliament/2nd-session/debate-transcripts',
  HANSARD_XML_PATTERN: 'https://www.leg.bc.ca/documents-data/hansard/parliament-{parliament}/session-{session}/{date}.xml',
  COMMITTEES_URL: 'https://www.leg.bc.ca/parliamentary-business/committees',
  BILLS_URL: 'https://www.leg.bc.ca/parliamentary-business/bills',
  USER_AGENT: 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
};

/**
 * Alberta specific API endpoints and paths.
 */
export const ALBERTA = {
  HANSARD_URL: 'https://www.assembly.ab.ca/net/speech.aspx',
  HANSARD_SEARCH_URL: 'https://www.assembly.ab.ca/search?type=hansard',
  COMMITTEES_URL: 'https://www.assembly.ab.ca/committees',
  BILLS_URL: 'https://www.assembly.ab.ca/bills',
  USER_AGENT: 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
};

/**
 * Quebec specific endpoints and paths.
 */
export const QUEBEC = {
  HANSARD_LIST_URL: 'https://www.assnat.qc.ca/fr/travaux-parlementaires/derniers-journaux.html',
  HANSARD_XML_PATTERN: 'https://www.assnat.qc.ca/fr/travaux-parlementaires/derniers-journaux/{date}.html',
  COMMITTEES_URL: 'https://www.assnat.qc.ca/fr/travaux-parlementaires/commissions/index.html',
  BILLS_URL: 'https://www.assnat.qc.ca/fr/travaux-parlementaires/projets-loi/index.html',
  CKAN_URL: 'https://www.donneesquebec.ca/api/3/action/package_search',
  USER_AGENT: 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
};

/**
 * Manitoba specific endpoints and paths.
 */
export const MANITOBA = {
  HANSARD_URL: 'https://www.gov.mb.ca/legislature/hansard/',
  COMMITTEES_URL: 'https://www.gov.mb.ca/legislature/committees/',
  BILLS_URL: 'https://web2.gov.mb.ca/bills/',
  USER_AGENT: 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
};

/**
 * Saskatchewan specific endpoints and paths.
 */
export const SASKATCHEWAN = {
  HANSARD_URL: 'https://www.legassembly.sk.ca/hansard/',
  COMMITTEES_URL: 'https://www.legassembly.sk.ca/committees/',
  BILLS_URL: 'https://publications.saskatchewan.ca/#/products?q=bills',
  CKAN_URL: 'https://dashboard.saskatchewan.ca',
  USER_AGENT: 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
};

/**
 * Nova Scotia specific endpoints and paths.
 */
export const NOVA_SCOTIA = {
  HANSARD_URL: 'https://nslegislature.ca/legislative-business/hansard-debates',
  COMMITTEES_URL: 'https://nslegislature.ca/legislative-business/committees',
  BILLS_URL: 'https://nslegislature.ca/legislative-business/bills',
  CKAN_URL: 'https://data.novascotia.ca',
  USER_AGENT: 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
};

/**
 * New Brunswick specific endpoints and paths.
 */
export const NEW_BRUNSWICK = {
  HANSARD_URL: 'https://www.legnb.ca/en/hansard',
  COMMITTEES_URL: 'https://www.legnb.ca/en/committees',
  BILLS_URL: 'https://www.legnb.ca/en/bills',
  CKAN_URL: 'https://www.snb.ca/api/3/action/package_search',
  USER_AGENT: 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
};

/**
 * Newfoundland and Labrador specific endpoints and paths.
 */
export const NFLD = {
  HANSARD_URL: 'https://www.assembly.nl.ca/HouseBusiness/Hansard/',
  COMMITTEES_URL: 'https://www.assembly.nl.ca/HouseBusiness/Committees/',
  BILLS_URL: 'https://www.assembly.nl.ca/HouseBusiness/Bills/',
  CKAN_URL: 'https://opendata.gov.nl.ca/api/3/action/package_search',
  USER_AGENT: 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
};

/**
 * Prince Edward Island specific endpoints and paths.
 */
export const PEI = {
  HANSARD_URL: 'https://www.assembly.pe.ca/hansard',
  COMMITTEES_URL: 'https://www.assembly.pe.ca/committees',
  BILLS_URL: 'https://www.assembly.pe.ca/bills',
  USER_AGENT: 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
};

/**
 * Yukon specific endpoints and paths.
 */
export const YUKON = {
  HANSARD_URL: 'https://yukonassembly.ca/hansard',
  COMMITTEES_URL: 'https://yukonassembly.ca/committees',
  BILLS_URL: 'https://yukonassembly.ca/bills',
  USER_AGENT: 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
};

/**
 * Northwest Territories specific endpoints and paths.
 */
export const NWT = {
  HANSARD_URL: 'https://www.ntlegislativeassembly.ca/documents-proceedings/hansard',
  COMMITTEES_URL: 'https://www.ntlegislativeassembly.ca/committees',
  BILLS_URL: 'https://www.ntlegislativeassembly.ca/documents-proceedings/bills',
  USER_AGENT: 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
};

/**
 * Nunavut specific endpoints and paths.
 */
export const NUNAVUT = {
  HANSARD_URL: 'https://assembly.nu.ca/hansard',
  COMMITTEES_URL: 'https://assembly.nu.ca/standing-and-special-committees',
  BILLS_URL: 'https://assembly.nu.ca/bills-and-legislation',
  USER_AGENT: 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
};

/* ------------------------------------------------------------------ */
/*  Default Options                                                    */
/* ------------------------------------------------------------------ */

/** Default max records per province when fetching */
export const DEFAULT_MAX_RECORDS = 500;

/** Default User-Agent for HTTP requests */
export const DEFAULT_USER_AGENT = 'Quill/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)';

/** Default request timeout in milliseconds */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Default request headers */
export const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': DEFAULT_USER_AGENT,
  Accept: 'application/xml,application/json,text/html,*/*',
};

/* ------------------------------------------------------------------ */
/*  Error Types                                                        */
/* ------------------------------------------------------------------ */

export class ProvincialLegislatureError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'PROV_LEG_ERROR',
    public readonly province?: string,
    public readonly url?: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ProvincialLegislatureError';
  }
}
