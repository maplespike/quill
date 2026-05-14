import type { ProvincialOrgConfig } from './types.js';

/**
 * Provincial/Territorial oversight bodies across all 13 provinces and territories.
 * Each entry defines base URLs, body type, and CKAN dataset IDs where available.
 */
export const PROVINCIAL_ORGS: ProvincialOrgConfig[] = [
  // ── Ontario ───────────────────────────────────────────
  { code: 'on-ag', name: 'Office of the Auditor General of Ontario', province: 'ON', bodyType: 'auditor-general', baseUrl: 'https://www.auditor.on.ca/', feedUrl: 'https://www.auditor.on.ca/en/content/news/news_rss.xml', description: 'Ontario AG value-for-money audits', enabled: true },
  { code: 'on-ombudsman', name: 'Ombudsman Ontario', province: 'ON', bodyType: 'ombudsman', baseUrl: 'https://www.ombudsman.on.ca/', description: 'Ontario Ombudsman investigations and reports', enabled: true },
  { code: 'on-hr-tribunal', name: 'Human Rights Tribunal of Ontario', province: 'ON', bodyType: 'human-rights-tribunal', baseUrl: 'https://hrto.ca/', description: 'HRTO decisions and applications', enabled: true },
  { code: 'on-elections', name: 'Elections Ontario', province: 'ON', bodyType: 'campaign-finance', baseUrl: 'https://www.elections.on.ca/', description: 'Ontario campaign finance and political party contributions', enabled: true, ckanPackageId: 'ontario-election-finance', ckanBaseUrl: 'https://data.ontario.ca/api/3/action' },
  { code: 'on-ethics', name: 'Office of the Integrity Commissioner of Ontario', province: 'ON', bodyType: 'ethics-commissioner', baseUrl: 'https://www.oico.on.ca/', description: 'Ontario ethics commissioner — MPP compliance, lobbying oversight', enabled: true },
  { code: 'on-sunshine', name: 'Ontario Sunshine List', province: 'ON', bodyType: 'sunshine-list', baseUrl: 'https://www.ontario.ca/page/public-sector-salary-disclosure', feedUrl: 'https://www.ontario.ca/page/public-sector-salary-disclosure', description: 'Ontario public sector salary disclosure ($100K+)', enabled: true },
  { code: 'on-energy', name: 'Ontario Energy Board', province: 'ON', bodyType: 'energy-utilities-regulator', baseUrl: 'https://www.oeb.ca/', feedUrl: 'https://www.oeb.ca/rss.xml', description: 'OEB electricity and natural gas rate decisions', enabled: true },

  // ── British Columbia ────────────────────────────────
  { code: 'bc-ag', name: 'Office of the Auditor General of BC', province: 'BC', bodyType: 'auditor-general', baseUrl: 'https://www.bcauditor.com/', feedUrl: 'https://www.bcauditor.com/rss.xml', description: 'BC AG audits and reports', enabled: true },
  { code: 'bc-ombudsman', name: 'Ombudsperson of BC', province: 'BC', bodyType: 'ombudsman', baseUrl: 'https://bcombudsperson.ca/', description: 'BC Ombudsperson investigations', enabled: true },
  { code: 'bc-hr-tribunal', name: 'BC Human Rights Tribunal', province: 'BC', bodyType: 'human-rights-tribunal', baseUrl: 'https://www.bchrt.bc.ca/', description: 'BCHRT decisions and policies', enabled: true },
  { code: 'bc-elections', name: 'Elections BC', province: 'BC', bodyType: 'campaign-finance', baseUrl: 'https://elections.bc.ca/', description: 'BC campaign finance and political contributions', enabled: true },
  { code: 'bc-ethics', name: 'Office of the Conflict of Interest Commissioner of BC', province: 'BC', bodyType: 'ethics-commissioner', baseUrl: 'https://www.coinbccommissioner.ca/', description: 'BC ethics commissioner — MLA compliance', enabled: true },
  { code: 'bc-sunshine', name: 'BC Public Sector Compensation (Sunshine List)', province: 'BC', bodyType: 'sunshine-list', baseUrl: 'https://www2.gov.bc.ca/gov/content/governments/organizational-structure/open-information/public-sector-compensation', description: 'BC public sector salary disclosure', enabled: true },
  { code: 'bc-energy', name: 'BC Utilities Commission', province: 'BC', bodyType: 'energy-utilities-regulator', baseUrl: 'https://www.bcuc.com/', feedUrl: 'https://www.bcuc.com/rss.xml', description: 'BCUC electricity, gas, and pipelines regulation', enabled: true },

  // ── Alberta ──────────────────────────────────────────
  { code: 'ab-ag', name: 'Office of the Auditor General of Alberta', province: 'AB', bodyType: 'auditor-general', baseUrl: 'https://www.oag.ab.ca/', description: 'Alberta AG performance audits', enabled: true },
  { code: 'ab-ombudsman', name: 'Alberta Ombudsman', province: 'AB', bodyType: 'ombudsman', baseUrl: 'https://www.ombudsman.ab.ca/', description: 'Alberta Ombudsman investigations', enabled: true },
  { code: 'ab-hr-tribunal', name: 'Alberta Human Rights Commission', province: 'AB', bodyType: 'human-rights-tribunal', baseUrl: 'https://www.albertahumanrights.ab.ca/', description: 'Alberta human rights decisions', enabled: true },
  { code: 'ab-elections', name: 'Elections Alberta', province: 'AB', bodyType: 'campaign-finance', baseUrl: 'https://www.elections.ab.ca/', description: 'Alberta campaign finance and party contributions', enabled: true },
  { code: 'ab-ethics', name: 'Office of the Ethics Commissioner of Alberta', province: 'AB', bodyType: 'ethics-commissioner', baseUrl: 'https://www.albertaethicscommissioner.ca/', description: 'Alberta ethics commissioner — MLA compliance', enabled: true },
  { code: 'ab-sunshine', name: 'Alberta Sunshine List', province: 'AB', bodyType: 'sunshine-list', baseUrl: 'https://www.alberta.ca/public-sector-salary-disclosure.aspx', description: 'Alberta public sector salary disclosure', enabled: true },
  { code: 'ab-energy', name: 'Alberta Utilities Commission', province: 'AB', bodyType: 'energy-utilities-regulator', baseUrl: 'https://www.auc.ab.ca/', description: 'AUC electricity and utilities regulation', enabled: true },

  // ── Quebec ───────────────────────────────────────────
  { code: 'qc-ag', name: 'Verificateur general du Quebec', province: 'QC', bodyType: 'auditor-general', baseUrl: 'https://www.vgq.qc.ca/', description: 'Quebec AG audits and reports', enabled: true },
  { code: 'qc-ombudsman', name: 'Protecteur du citoyen', province: 'QC', bodyType: 'ombudsman', baseUrl: 'https://protecteurducitoyen.qc.ca/', description: 'Quebec Ombudsman investigations', enabled: true },
  { code: 'qc-hr-tribunal', name: 'Tribunal des droits de la personne', province: 'QC', bodyType: 'human-rights-tribunal', baseUrl: 'https://www.tribunaldesdroitsdelapersonne.qc.ca/', description: 'Quebec human rights tribunal decisions', enabled: true },
  { code: 'qc-elections', name: 'Elections Quebec', province: 'QC', bodyType: 'campaign-finance', baseUrl: 'https://www.electionsquebec.qc.ca/', description: 'Quebec campaign finance and political party funding', enabled: true },
  { code: 'qc-ethics', name: 'Commissaire a l\'ethique et a la deontologie', province: 'QC', bodyType: 'ethics-commissioner', baseUrl: 'https://www.ced.qc.ca/', description: 'Quebec ethics commissioner — MNA compliance', enabled: true },
  { code: 'qc-energy', name: 'Regie de l\'energie du Quebec', province: 'QC', bodyType: 'energy-utilities-regulator', baseUrl: 'https://www.regie-energie.qc.ca/', description: 'Quebec energy regulation', enabled: true },

  // ── Manitoba ─────────────────────────────────────────
  { code: 'mb-ag', name: 'Office of the Auditor General of Manitoba', province: 'MB', bodyType: 'auditor-general', baseUrl: 'https://www.oag.mb.ca/', description: 'Manitoba AG audits and reports', enabled: true },
  { code: 'mb-ombudsman', name: 'Ombudsman Manitoba', province: 'MB', bodyType: 'ombudsman', baseUrl: 'https://www.ombudsman.mb.ca/', description: 'Manitoba Ombudsman investigations', enabled: true },
  { code: 'mb-hr-tribunal', name: 'Manitoba Human Rights Commission', province: 'MB', bodyType: 'human-rights-tribunal', baseUrl: 'https://www.manitobahumanrights.ca/', description: 'Manitoba human rights decisions', enabled: true },
  { code: 'mb-elections', name: 'Elections Manitoba', province: 'MB', bodyType: 'campaign-finance', baseUrl: 'https://www.electionsmanitoba.ca/', description: 'Manitoba campaign finance records', enabled: true },

  // ── Saskatchewan ─────────────────────────────────────
  { code: 'sk-ag', name: 'Office of the Provincial Auditor of Saskatchewan', province: 'SK', bodyType: 'auditor-general', baseUrl: 'https://auditor.sk.ca/', description: 'Saskatchewan AG audits and reports', enabled: true },
  { code: 'sk-ombudsman', name: 'Ombudsman Saskatchewan', province: 'SK', bodyType: 'ombudsman', baseUrl: 'https://www.ombudsman.sk.ca/', description: 'Saskatchewan Ombudsman investigations', enabled: true },
  { code: 'sk-hr-tribunal', name: 'Saskatchewan Human Rights Commission', province: 'SK', bodyType: 'human-rights-tribunal', baseUrl: 'https://saskatchewanhumanrights.ca/', description: 'Saskatchewan human rights decisions', enabled: true },
  { code: 'sk-elections', name: 'Elections Saskatchewan', province: 'SK', bodyType: 'campaign-finance', baseUrl: 'https://www.elections.sk.ca/', description: 'Saskatchewan campaign finance records', enabled: true },

  // ── Nova Scotia ──────────────────────────────────────
  { code: 'ns-ag', name: 'Office of the Auditor General of Nova Scotia', province: 'NS', bodyType: 'auditor-general', baseUrl: 'https://oag-ns.ca/', description: 'Nova Scotia AG audits and reports', enabled: true },
  { code: 'ns-ombudsman', name: 'Nova Scotia Office of the Ombudsman', province: 'NS', bodyType: 'ombudsman', baseUrl: 'https://www.novascotiaombudsman.ca/', description: 'Nova Scotia Ombudsman investigations', enabled: true },
  { code: 'ns-hr-tribunal', name: 'Nova Scotia Human Rights Commission', province: 'NS', bodyType: 'human-rights-tribunal', baseUrl: 'https://humanrights.novascotia.ca/', description: 'Nova Scotia human rights decisions', enabled: true },
  { code: 'ns-elections', name: 'Elections Nova Scotia', province: 'NS', bodyType: 'campaign-finance', baseUrl: 'https://electionsnovascotia.ca/', description: 'Nova Scotia campaign finance records', enabled: true },

  // ── New Brunswick ────────────────────────────────────
  { code: 'nb-ag', name: 'Office of the Auditor General of New Brunswick', province: 'NB', bodyType: 'auditor-general', baseUrl: 'https://www.agnb-vgnb.ca/', description: 'New Brunswick AG audits and reports', enabled: true },
  { code: 'nb-ombudsman', name: 'Ombudsman New Brunswick', province: 'NB', bodyType: 'ombudsman', baseUrl: 'https://www.ombudnbed-bmpnb.ca/', description: 'New Brunswick Ombudsman investigations', enabled: true },
  { code: 'nb-hr-tribunal', name: 'New Brunswick Human Rights Commission', province: 'NB', bodyType: 'human-rights-tribunal', baseUrl: 'https://www.gnb.ca/humanrights', description: 'New Brunswick human rights decisions', enabled: true },

  // ── Newfoundland and Labrador ───────────────────────
  { code: 'nl-ag', name: 'Office of the Auditor General of Newfoundland and Labrador', province: 'NL', bodyType: 'auditor-general', baseUrl: 'https://www.ag.gov.nl.ca/', description: 'NL AG audits and reports', enabled: true },
  { code: 'nl-ombudsman', name: 'Citizens\' Representative of NL', province: 'NL', bodyType: 'ombudsman', baseUrl: 'https://www.citizensrepresentative.ca/', description: 'NL Ombudsman investigations', enabled: true },
  { code: 'nl-hr-tribunal', name: 'Newfoundland and Labrador Human Rights Commission', province: 'NL', bodyType: 'human-rights-tribunal', baseUrl: 'https://www.thinkhumanrights.ca/', description: 'NL human rights decisions', enabled: true },

  // ── Prince Edward Island ────────────────────────────
  { code: 'pe-ag', name: 'Office of the Auditor General of PEI', province: 'PE', bodyType: 'auditor-general', baseUrl: 'https://www.auditorpei.ca/', description: 'PEI AG audits and reports', enabled: true },
  { code: 'pe-ombudsman', name: 'PEI Ombudsman', province: 'PE', bodyType: 'ombudsman', baseUrl: 'https://www.ombudsman.pe.ca/', description: 'PEI Ombudsman investigations', enabled: true },
  { code: 'pe-elections', name: 'Elections PEI', province: 'PE', bodyType: 'campaign-finance', baseUrl: 'https://www.electionspei.ca/', description: 'PEI campaign finance records', enabled: true },

  // ── Northwest Territories ─────────────────────────
  { code: 'nt-ag', name: 'Office of the Auditor General of Canada (NT)', province: 'NT', bodyType: 'auditor-general', baseUrl: 'https://www.oag-bvg.gc.ca/', description: 'NWT AG audits (via OAG Canada)', enabled: true },
  { code: 'nt-ombudsman', name: 'NWT Ombudsman', province: 'NT', bodyType: 'ombudsman', baseUrl: 'https://www.ombudsman.gov.nt.ca/', description: 'NWT Ombudsman investigations', enabled: true },

  // ── Nunavut ──────────────────────────────────────────
  { code: 'nu-ag', name: 'Office of the Auditor General of Canada (NU)', province: 'NU', bodyType: 'auditor-general', baseUrl: 'https://www.oag-bvg.gc.ca/', description: 'Nunavut AG audits (via OAG Canada)', enabled: true },
  { code: 'nu-ombudsman', name: 'Nunavut Ombudsman', province: 'NU', bodyType: 'ombudsman', baseUrl: 'https://ombudsman.nu.ca/', description: 'Nunavut Ombudsman investigations', enabled: true },

  // ── Yukon ────────────────────────────────────────────
  { code: 'yt-ag', name: 'Office of the Auditor General of Canada (YT)', province: 'YT', bodyType: 'auditor-general', baseUrl: 'https://www.oag-bvg.gc.ca/', description: 'Yukon AG audits (via OAG Canada)', enabled: true },
  { code: 'yt-ombudsman', name: 'Yukon Ombudsman', province: 'YT', bodyType: 'ombudsman', baseUrl: 'https://www.ombudsman.yk.ca/', description: 'Yukon Ombudsman investigations', enabled: true },
];

/** Map code -> config for quick lookup */
export const PROVINCIAL_ORG_MAP: Record<string, ProvincialOrgConfig> = {};
for (const org of PROVINCIAL_ORGS) {
  PROVINCIAL_ORG_MAP[org.code] = org;
}

/** All province codes with at least one configured body */
export const ALL_PROVINCES: string[] = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];

/** Default fetch timeout per source */
export const PROVINCIAL_FETCH_TIMEOUT_MS = 20_000;

/** Max records per body per fetch */
export const MAX_RECORDS_PER_BODY = 30;

/** User agent */
export const PROVINCIAL_USER_AGENT = 'MapleSpike-ProvincialOrgs/1.0 (+https://github.com/reverb256/maplespike)';
