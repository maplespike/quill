// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Provincial Regulators — Constants & Known Regulators
 *
 * Maps each province/territory to its regulatory bodies and CKAN portals.
 * Sources: open.canada.ca, provincial CKAN portals, regulator websites.
 */

export const REGULATOR_UA = 'MapleSpike-ProvRegulators/1.0';
export const REGULATOR_TIMEOUT_MS = 15_000;
export const MAX_REGULATOR_RECORDS = 5_000;
export const MAX_SCRAPE_TARGETS = 20; // Max regulators to scrape per run (prevents timeouts)

/** CKAN portals for provinces with open data */
export const PROVINCIAL_CKAN: Record<string, string> = {
  ON: 'https://data.ontario.ca/api/3/action',
  BC: 'https://catalogue.data.gov.bc.ca/api/3/action',
  AB: 'https://open.alberta.ca/api/3/action',
  SK: 'https://catalogue.saskatchewan.ca/api/3/action',
  MB: 'https://web2.gov.mb.ca/api/3/action',
  QC: 'https://www.donneesquebec.ca/recherche/api/3/action',
  NB: 'https://www.snb.ca/api/3/action',
  NS: 'https://data.novascotia.ca',
  PE: 'https://data.princeedwardisland.ca',
  NL: 'https://opendata.gov.nl.ca/api/3/action',
  YT: 'https://open.yukon.ca/api/3/action',
};

/** Key regulatory categories to search for in CKAN portals */
export const REGULATORY_KEYWORDS = [
  'securities', 'financial services', 'insurance', 'pension',
  'law society', 'legal', 'policing', 'police',
  'engineering', 'accountancy', 'real estate',
  'health regulator', 'college of physicians', 'nursing',
  'labour board', 'workers compensation', 'employment standards',
  'human rights', 'privacy', 'information commissioner',
  'ombudsman', 'ethics commissioner', 'conflict of interest',
  'liquor', 'gaming', 'alcohol',
  'energy regulator', 'utilities', 'public utilities',
  'municipal affairs', 'assessment', 'property valuation',
  'environmental assessment', 'conservation authority',
  'child welfare', 'childrens aid', 'youth justice',
  'public accounts', 'auditor general',
];

/** Known provincial regulator categories mapped to each province */
export interface RegulatorCategory {
  code: string;
  name: string;
  searchTerms: string[];
  ckanPackages?: string[];
}

export const REGULATOR_CATEGORIES: RegulatorCategory[] = [
  { code: 'securities', name: 'Securities & Financial Markets', searchTerms: ['securities commission', 'capital markets', 'securities'], ckanPackages: ['securities-law', 'capital-markets'] },
  { code: 'financial', name: 'Financial Services Regulation', searchTerms: ['financial services', 'credit union', 'insurance'] },
  { code: 'pension', name: 'Pension & Benefits', searchTerms: ['pension', 'benefits', 'retirement'] },
  { code: 'legal', name: 'Legal & Law Society', searchTerms: ['law society', 'bar association', 'legal profession'] },
  { code: 'policing', name: 'Policing Oversight', searchTerms: ['police commission', 'policing', 'police oversight'] },
  { code: 'health', name: 'Health Professional Regulation', searchTerms: ['college of physicians', 'nursing college', 'health regulator', 'medical'] },
  { code: 'labour', name: 'Labour & Employment', searchTerms: ['labour board', 'workers compensation', 'employment standards'] },
  { code: 'human-rights', name: 'Human Rights & Privacy', searchTerms: ['human rights commission', 'privacy commissioner', 'information commissioner'] },
  { code: 'energy', name: 'Energy & Utilities', searchTerms: ['energy regulator', 'public utilities', 'electricity'] },
  { code: 'municipal', name: 'Municipal Affairs', searchTerms: ['municipal affairs', 'assessment', 'property valuation', 'assessment appeal'] },
  { code: 'environment', name: 'Environmental Regulation', searchTerms: ['environmental assessment', 'conservation authority'] },
  { code: 'ethics', name: 'Ethics & Lobbying', searchTerms: ['ethics commissioner', 'conflict of interest', 'lobbying commissioner'] },
  { code: 'children', name: 'Child & Youth Welfare', searchTerms: ['child welfare', 'childrens aid', 'youth justice'] },
  { code: 'auditor', name: 'Auditor General & Public Accounts', searchTerms: ['auditor general', 'public accounts'] },
];

/** Quick reference: major regulators by province (known bodies) */
export const KNOWN_REGULATORS: Record<string, Array<{ name: string; category: string; url: string }>> = {
  ON: [
    { name: 'Ontario Securities Commission', category: 'securities', url: 'https://www.osc.ca' },
    { name: 'Financial Services Regulatory Authority', category: 'financial', url: 'https://www.fsrao.ca' },
    { name: 'Law Society of Ontario', category: 'legal', url: 'https://lso.ca' },
    { name: 'Ontario Labour Relations Board', category: 'labour', url: 'https://www.olrb.gov.on.ca' },
    { name: 'Workplace Safety and Insurance Board', category: 'labour', url: 'https://www.wsib.ca' },
    { name: 'Ontario Human Rights Commission', category: 'human-rights', url: 'https://www.ohrc.on.ca' },
    { name: 'Information and Privacy Commissioner', category: 'human-rights', url: 'https://www.ipc.on.ca' },
    { name: 'Ontario Energy Board', category: 'energy', url: 'https://www.oeb.ca' },
    { name: 'Ontario Municipal Board / LPAT', category: 'municipal', url: 'https://olt.gov.on.ca' },
    { name: 'Office of the Integrity Commissioner', category: 'ethics', url: 'https://www.oico.on.ca' },
    { name: 'Office of the Auditor General of Ontario', category: 'auditor', url: 'https://www.auditor.on.ca' },
    { name: 'College of Physicians and Surgeons of Ontario', category: 'health', url: 'https://www.cpso.on.ca' },
  ],
  BC: [
    { name: 'British Columbia Securities Commission', category: 'securities', url: 'https://www.bcsc.bc.ca' },
    { name: 'Law Society of British Columbia', category: 'legal', url: 'https://www.lawsociety.bc.ca' },
    { name: 'BC Labour Relations Board', category: 'labour', url: 'https://www.lrb.bc.ca' },
    { name: 'Workers Compensation Board of BC', category: 'labour', url: 'https://www.worksafebc.com' },
    { name: 'BC Human Rights Tribunal', category: 'human-rights', url: 'https://www.bchrt.bc.ca' },
    { name: 'Office of the Information and Privacy Commissioner', category: 'human-rights', url: 'https://www.oipc.bc.ca' },
    { name: 'BC Utilities Commission', category: 'energy', url: 'https://www.bcuc.com' },
    { name: 'Office of the Auditor General of BC', category: 'auditor', url: 'https://www.bcauditor.com' },
    { name: 'College of Physicians and Surgeons of BC', category: 'health', url: 'https://www.cpsbc.ca' },
  ],
  AB: [
    { name: 'Alberta Securities Commission', category: 'securities', url: 'https://www.albertasecurities.com' },
    { name: 'Law Society of Alberta', category: 'legal', url: 'https://www.lawsociety.ab.ca' },
    { name: 'Alberta Labour Relations Board', category: 'labour', url: 'https://www.alrb.gov.ab.ca' },
    { name: 'Workers Compensation Board of Alberta', category: 'labour', url: 'https://www.wcb.ab.ca' },
    { name: 'Alberta Human Rights Commission', category: 'human-rights', url: 'https://www.albertahumanrights.ab.ca' },
    { name: 'Office of the Information and Privacy Commissioner', category: 'human-rights', url: 'https://www.oipc.ab.ca' },
    { name: 'Alberta Utilities Commission', category: 'energy', url: 'https://www.auc.ab.ca' },
    { name: 'Alberta Energy Regulator', category: 'energy', url: 'https://www.aer.ca' },
    { name: 'Office of the Auditor General of Alberta', category: 'auditor', url: 'https://www.oag.ab.ca' },
  ],
  QC: [
    { name: 'Autorité des marchés financiers', category: 'securities', url: 'https://lautorite.qc.ca' },
    { name: 'Barreau du Québec', category: 'legal', url: 'https://www.barreau.qc.ca' },
    { name: 'Tribunal administratif du travail', category: 'labour', url: 'https://www.tat.gouv.qc.ca' },
    { name: 'Commission des normes, de l\'équité, de la santé et de la sécurité du travail', category: 'labour', url: 'https://www.cnesst.gouv.qc.ca' },
    { name: 'Commission des droits de la personne et des droits de la jeunesse', category: 'human-rights', url: 'https://www.cdpdj.qc.ca' },
    { name: 'Commission d\'accès à l\'information du Québec', category: 'human-rights', url: 'https://www.cai.gouv.qc.ca' },
    { name: 'Régie de l\'énergie du Québec', category: 'energy', url: 'https://www.regie-energie.qc.ca' },
    { name: 'Vérificateur général du Québec', category: 'auditor', url: 'https://www.vgq.gouv.qc.ca' },
    { name: 'Collège des médecins du Québec', category: 'health', url: 'https://www.cmq.org' },
  ],
  SK: [
    { name: 'Financial and Consumer Affairs Authority', category: 'securities', url: 'https://fcaa.gov.sk.ca' },
    { name: 'Law Society of Saskatchewan', category: 'legal', url: 'https://www.lawsociety.sk.ca' },
    { name: 'Saskatchewan Labour Relations Board', category: 'labour', url: 'https://www.sasklabourrelationsboard.ca' },
    { name: 'Workers Compensation Board of Saskatchewan', category: 'labour', url: 'https://www.wcbsask.com' },
    { name: 'Saskatchewan Human Rights Commission', category: 'human-rights', url: 'https://www.shrc.ca' },
    { name: 'Office of the Saskatchewan Information and Privacy Commissioner', category: 'human-rights', url: 'https://www.oipc.sk.ca' },
    { name: 'Office of the Provincial Auditor of Saskatchewan', category: 'auditor', url: 'https://www.auditor.sk.ca' },
  ],
  MB: [
    { name: 'Manitoba Securities Commission', category: 'securities', url: 'https://www.msc.gov.mb.ca' },
    { name: 'Law Society of Manitoba', category: 'legal', url: 'https://www.lawsociety.mb.ca' },
    { name: 'Manitoba Labour Board', category: 'labour', url: 'https://www.gov.mb.ca/labour/labbrd' },
    { name: 'Workers Compensation Board of Manitoba', category: 'labour', url: 'https://www.wcb.mb.ca' },
    { name: 'Manitoba Human Rights Commission', category: 'human-rights', url: 'https://www.manitobahumanrights.ca' },
    { name: 'Office of the Auditor General of Manitoba', category: 'auditor', url: 'https://www.oag.mb.ca' },
  ],
  NS: [
    { name: 'Nova Scotia Securities Commission', category: 'securities', url: 'https://nssc.gov.ns.ca' },
    { name: 'Nova Scotia Barristers Society', category: 'legal', url: 'https://nsbs.org' },
    { name: 'Nova Scotia Labour Board', category: 'labour', url: 'https://nslabourboard.novascotia.ca' },
    { name: 'Workers Compensation Board of Nova Scotia', category: 'labour', url: 'https://www.wcb.ns.ca' },
    { name: 'Nova Scotia Human Rights Commission', category: 'human-rights', url: 'https://humanrights.novascotia.ca' },
    { name: 'Office of the Auditor General of Nova Scotia', category: 'auditor', url: 'https://oag-ns.ca' },
  ],
  NB: [
    { name: 'Financial and Consumer Services Commission', category: 'securities', url: 'https://www.fcnb.ca' },
    { name: 'Law Society of New Brunswick', category: 'legal', url: 'https://www.lawsociety-barreau.nb.ca' },
    { name: 'WorkSafe New Brunswick', category: 'labour', url: 'https://www.worksafenb.ca' },
    { name: 'New Brunswick Human Rights Commission', category: 'human-rights', url: 'https://www.gnb.ca/hrc-cdp' },
    { name: 'Office of the Auditor General of New Brunswick', category: 'auditor', url: 'https://www.ag-vg.nb.ca' },
  ],
  NL: [
    { name: 'Securities Commission of Newfoundland and Labrador', category: 'securities', url: 'https://www.gov.nl.ca/snl' },
    { name: 'Law Society of Newfoundland and Labrador', category: 'legal', url: 'https://www.lsnl.ca' },
    { name: 'Workplace Health and Safety Compensation Commission', category: 'labour', url: 'https://www.whscc.nl.ca' },
    { name: 'Newfoundland and Labrador Human Rights Commission', category: 'human-rights', url: 'https://www.thinkhumanrights.ca' },
    { name: 'Office of the Auditor General of Newfoundland and Labrador', category: 'auditor', url: 'https://www.ag.gov.nl.ca' },
  ],
  PE: [
    { name: 'Office of the Superintendent of Securities', category: 'securities', url: 'https://www.princeedwardisland.ca/securities' },
    { name: 'Law Society of Prince Edward Island', category: 'legal', url: 'https://www.lspei.ca' },
    { name: 'Workers Compensation Board of PEI', category: 'labour', url: 'https://www.wcb.pe.ca' },
    { name: 'PEI Human Rights Commission', category: 'human-rights', url: 'https://www.peihumanrights.ca' },
    { name: 'Office of the Auditor General of PEI', category: 'auditor', url: 'https://www.auditorpei.ca' },
  ],
  YT: [
    { name: 'Office of the Yukon Superintendent of Securities', category: 'securities', url: 'https://yukon.ca/securities' },
    { name: 'Law Society of Yukon', category: 'legal', url: 'https://www.lawsocietyyukon.com' },
    { name: 'Yukon Workers Compensation Health and Safety Board', category: 'labour', url: 'https://www.wcb.yk.ca' },
    { name: 'Yukon Human Rights Commission', category: 'human-rights', url: 'https://yukonhumanrights.ca' },
    { name: 'Office of the Auditor General of Canada (Yukon)', category: 'auditor', url: 'https://www.oag-bvg.gc.ca' },
  ],
  NT: [
    { name: 'Law Society of the Northwest Territories', category: 'legal', url: 'https://www.lawsociety.nt.ca' },
    { name: 'Workers Safety and Compensation Commission', category: 'labour', url: 'https://www.wscc.nt.ca' },
    { name: 'NWT Human Rights Commission', category: 'human-rights', url: 'https://www.nwthumanrights.ca' },
  ],
  NU: [
    { name: 'Law Society of Nunavut', category: 'legal', url: 'https://www.lawsociety.nu.ca' },
    { name: 'Workers Safety and Compensation Commission (Nunavut)', category: 'labour', url: 'https://www.wscc.nu.ca' },
    { name: 'Nunavut Human Rights Tribunal', category: 'human-rights', url: 'https://www.nuhrc.ca' },
  ],
};

/** All provinces with regulator data */
export const ALL_REGULATOR_PROVINCES = Object.keys(KNOWN_REGULATORS);

/** Count of known regulators across all provinces */
export const TOTAL_KNOWN_REGULATORS = Object.values(KNOWN_REGULATORS).reduce((sum, arr) => sum + arr.length, 0);
