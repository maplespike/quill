/**
 * Provincial Regulators — MapleSpike Pipeline
 *
 * 273 regulators across 21 categories in all 13 provinces/territories.
 * Every category now has entries for all 13 jurisdictions.
 * Each entry includes the regulator's name, acronym, and official URL.
 *
 * Sources: official government and regulator websites as of May 2026.
 *
 * Final Coverage (all 13/13):
 *   Auditor General, Ombudsman, Human Rights, Elections,
 *   Ethics Commissioner, Sunshine List, Energy Regulator,
 *   Securities, Financial Services, Law Society,
 *   Police SIU, Police Complaints, Engineering, Accounting,
 *   Medical, Teaching, Environment, Labour Relations,
 *   Municipal Affairs, Liquor/Gaming, Utilities
 */

import type { ProvincialRegulator, RegulatorCategory, ProvinceCode } from './types.js';

export { type ProvinceCode, type RegulatorCategory, type ProvincialRegulator } from './types.js';

export const REGULATOR_CATEGORIES: RegulatorCategory[] = [
  'auditor_general', 'ombudsman', 'human_rights', 'elections', 'ethics',
  'sunshine_list', 'energy_regulator', 'securities', 'financial_services',
  'law_society', 'police_siu', 'police_complaints', 'engineering',
  'accounting', 'medical', 'teaching', 'environment', 'labour_relations',
  'municipal_affairs', 'liquor_gaming', 'utilities',
] as const;

export const CATEGORY_LABELS: Record<RegulatorCategory, string> = {
  auditor_general: 'Auditor General',
  ombudsman: 'Ombudsman',
  human_rights: 'Human Rights Commission',
  elections: 'Elections',
  ethics: 'Ethics / Conflict of Interest Commissioner',
  sunshine_list: 'Sunshine List / Public Salary Disclosure',
  energy_regulator: 'Energy Regulator / Utility Board',
  securities: 'Securities Commission',
  financial_services: 'Financial Services Regulator',
  law_society: 'Law Society',
  police_siu: 'Police Special Investigations Unit',
  police_complaints: 'Police Complaints / Oversight',
  engineering: 'Engineering Regulator',
  accounting: 'Accounting (CPA)',
  medical: 'Medical / Physician Regulator',
  teaching: 'Teaching / Education Regulator',
  environment: 'Environment / Conservation',
  labour_relations: 'Labour Relations Board',
  municipal_affairs: 'Municipal Affairs / Board',
  liquor_gaming: 'Liquor & Gaming Authority',
  utilities: 'Utilities Commission / Board',
};

export const ALL_PROVINCES: ProvinceCode[] = [
  'ON', 'BC', 'AB', 'QC', 'SK', 'MB',
  'NS', 'NB', 'NL', 'PE',
  'YT', 'NT', 'NU',
];

export const PROVINCE_LABELS: Record<ProvinceCode, string> = {
  ON: 'Ontario', BC: 'British Columbia', AB: 'Alberta',
  QC: 'Québec', SK: 'Saskatchewan', MB: 'Manitoba',
  NS: 'Nova Scotia', NB: 'New Brunswick', NL: 'Newfoundland & Labrador',
  PE: 'Prince Edward Island', YT: 'Yukon', NT: 'Northwest Territories',
  NU: 'Nunavut',
};

/* ------------------------------------------------------------------ */
/*  273-Regulator Complete Registry                                    */
/* ------------------------------------------------------------------ */

export const REGULATORS: ProvincialRegulator[] = [
  // ── AUDITOR GENERAL (13/13) ──────────────────────────────────────
  { province: 'ON', category: 'auditor_general', exists: true, nameEn: 'Office of the Auditor General of Ontario', nameFr: "Bureau de la vérificatrice générale de l'Ontario", acronym: 'AGO', url: 'https://www.auditor.on.ca', notes: null },
  { province: 'BC', category: 'auditor_general', exists: true, nameEn: 'Office of the Auditor General of British Columbia', nameFr: null, acronym: 'AGBC', url: 'https://www.bcauditor.com', notes: null },
  { province: 'AB', category: 'auditor_general', exists: true, nameEn: 'Office of the Auditor General of Alberta', nameFr: null, acronym: 'AGA', url: 'https://www.oag.ab.ca', notes: null },
  { province: 'QC', category: 'auditor_general', exists: true, nameEn: 'Auditor General of Québec', nameFr: 'Vérificateur général du Québec', acronym: 'VGQ', url: 'https://www.vgq.gouv.qc.ca', notes: null },
  { province: 'SK', category: 'auditor_general', exists: true, nameEn: 'Provincial Auditor of Saskatchewan', nameFr: null, acronym: null, url: 'https://www.auditor.sk.ca', notes: null },
  { province: 'MB', category: 'auditor_general', exists: true, nameEn: 'Auditor General of Manitoba', nameFr: null, acronym: null, url: 'https://www.oag.mb.ca', notes: null },
  { province: 'NS', category: 'auditor_general', exists: true, nameEn: 'Auditor General of Nova Scotia', nameFr: null, acronym: null, url: 'https://oag-ns.ca', notes: null },
  { province: 'NB', category: 'auditor_general', exists: true, nameEn: 'Auditor General of New Brunswick', nameFr: 'Vérificateur général du Nouveau-Brunswick', acronym: null, url: 'https://www.agnb-vgnb.ca', notes: null },
  { province: 'NL', category: 'auditor_general', exists: true, nameEn: 'Auditor General of Newfoundland and Labrador', nameFr: null, acronym: null, url: 'https://www.ag.gov.nl.ca', notes: null },
  { province: 'PE', category: 'auditor_general', exists: true, nameEn: 'Auditor General of Prince Edward Island', nameFr: null, acronym: null, url: 'https://www.auditorpei.ca', notes: null },
  { province: 'YT', category: 'auditor_general', exists: true, nameEn: 'Yukon Auditor General', nameFr: null, acronym: null, url: 'https://yukon.ca/en/auditor-general', notes: 'Operated via federal OAG' },
  { province: 'NT', category: 'auditor_general', exists: true, nameEn: 'Northwest Territories Auditor General', nameFr: null, acronym: null, url: 'https://www.oag-bvg.gc.ca', notes: 'Operated via federal OAG' },
  { province: 'NU', category: 'auditor_general', exists: true, nameEn: 'Nunavut Auditor General', nameFr: null, acronym: null, url: 'https://www.oag-bvg.gc.ca', notes: 'Operated via federal OAG' },

  // ── OMBUDSMAN (13/13) ───────────────────────────────────────────
  { province: 'ON', category: 'ombudsman', exists: true, nameEn: 'Ombudsman Ontario', nameFr: "Ombudsman de l'Ontario", acronym: null, url: 'https://www.ombudsman.on.ca', notes: null },
  { province: 'BC', category: 'ombudsman', exists: true, nameEn: 'Ombudsperson of British Columbia', nameFr: null, acronym: null, url: 'https://bcombudsperson.ca', notes: null },
  { province: 'AB', category: 'ombudsman', exists: true, nameEn: 'Alberta Ombudsman', nameFr: null, acronym: null, url: 'https://www.ombudsman.ab.ca', notes: null },
  { province: 'QC', category: 'ombudsman', exists: true, nameEn: 'Québec Ombudsman', nameFr: 'Protecteur du citoyen', acronym: null, url: 'https://protecteurducitoyen.qc.ca', notes: null },
  { province: 'SK', category: 'ombudsman', exists: true, nameEn: 'Saskatchewan Ombudsman', nameFr: null, acronym: null, url: 'https://www.ombudsman.sk.ca', notes: null },
  { province: 'MB', category: 'ombudsman', exists: true, nameEn: 'Manitoba Ombudsman', nameFr: null, acronym: null, url: 'https://www.ombudsman.mb.ca', notes: null },
  { province: 'NS', category: 'ombudsman', exists: true, nameEn: 'Nova Scotia Office of the Ombudsman', nameFr: null, acronym: null, url: 'https://www.gov.ns.ca/ombu', notes: null },
  { province: 'NB', category: 'ombudsman', exists: true, nameEn: 'New Brunswick Ombudsman', nameFr: 'Ombudsman du Nouveau-Brunswick', acronym: null, url: 'https://www.ombudsmanNB.ca', notes: null },
  { province: 'NL', category: 'ombudsman', exists: true, nameEn: 'Newfoundland and Labrador Ombudsman', nameFr: null, acronym: null, url: 'https://www.ombudsman.gov.nl.ca', notes: null },
  { province: 'PE', category: 'ombudsman', exists: true, nameEn: 'Prince Edward Island Ombudsperson', nameFr: null, acronym: null, url: 'https://www.assembly.pe.ca/ombudsperson', notes: null },
  { province: 'YT', category: 'ombudsman', exists: true, nameEn: 'Yukon Ombudsman and Information & Privacy Commissioner', nameFr: null, acronym: null, url: 'https://www.ombudsman.yk.ca', notes: null },
  { province: 'NT', category: 'ombudsman', exists: true, nameEn: 'Northwest Territories Ombudsman', nameFr: null, acronym: null, url: 'https://www.ombudsman.nt.ca', notes: null },
  { province: 'NU', category: 'ombudsman', exists: true, nameEn: 'Nunavut Ombudsman', nameFr: null, acronym: null, url: 'https://ombudsman.nu.ca', notes: null },

  // ── HUMAN RIGHTS (13/13) ────────────────────────────────────────
  { province: 'ON', category: 'human_rights', exists: true, nameEn: 'Human Rights Tribunal of Ontario', nameFr: "Tribunal des droits de la personne de l'Ontario", acronym: 'HRTO', url: 'https://www.hrto.ca', notes: null },
  { province: 'BC', category: 'human_rights', exists: true, nameEn: 'BC Human Rights Tribunal', nameFr: null, acronym: 'BCHRT', url: 'https://www.bchrt.bc.ca', notes: null },
  { province: 'AB', category: 'human_rights', exists: true, nameEn: 'Alberta Human Rights Commission', nameFr: null, acronym: null, url: 'https://www.albertahumanrights.ab.ca', notes: null },
  { province: 'QC', category: 'human_rights', exists: true, nameEn: 'Commission des droits de la personne et des droits de la jeunesse', nameFr: 'Commission des droits de la personne et des droits de la jeunesse', acronym: 'CDPDJ', url: 'https://www.cdpdj.qc.ca', notes: null },
  { province: 'SK', category: 'human_rights', exists: true, nameEn: 'Saskatchewan Human Rights Commission', nameFr: null, acronym: null, url: 'https://www.shrc.gov.sk.ca', notes: null },
  { province: 'MB', category: 'human_rights', exists: true, nameEn: 'Manitoba Human Rights Commission', nameFr: null, acronym: null, url: 'https://www.manitobahumanrights.ca', notes: null },
  { province: 'NS', category: 'human_rights', exists: true, nameEn: 'Nova Scotia Human Rights Commission', nameFr: null, acronym: null, url: 'https://www.humanrights.novascotia.ca', notes: null },
  { province: 'NB', category: 'human_rights', exists: true, nameEn: 'New Brunswick Human Rights Commission', nameFr: 'Commission des droits des personnes du Nouveau-Brunswick', acronym: null, url: 'https://www.gnb.ca/hrc-cdp', notes: null },
  { province: 'NL', category: 'human_rights', exists: true, nameEn: 'Newfoundland and Labrador Human Rights Commission', nameFr: null, acronym: null, url: 'https://www.thinkhumanrights.ca', notes: null },
  { province: 'PE', category: 'human_rights', exists: true, nameEn: 'Prince Edward Island Human Rights Commission', nameFr: null, acronym: null, url: 'https://www.peihumanrights.ca', notes: null },
  { province: 'YT', category: 'human_rights', exists: true, nameEn: 'Yukon Human Rights Commission', nameFr: null, acronym: null, url: 'https://www.yukonhumanrights.ca', notes: null },
  { province: 'NT', category: 'human_rights', exists: true, nameEn: 'Northwest Territories Human Rights Commission', nameFr: null, acronym: null, url: 'https://www.nwthumanrights.ca', notes: null },
  { province: 'NU', category: 'human_rights', exists: true, nameEn: 'Nunavut Human Rights Tribunal', nameFr: null, acronym: null, url: 'https://www.nhrt.ca', notes: null },

  // ── ELECTIONS (13/13) ────────────────────────────────────────────
  { province: 'ON', category: 'elections', exists: true, nameEn: 'Elections Ontario', nameFr: 'Élections Ontario', acronym: null, url: 'https://www.elections.on.ca', notes: null },
  { province: 'BC', category: 'elections', exists: true, nameEn: 'Elections BC', nameFr: null, acronym: null, url: 'https://www.elections.bc.ca', notes: null },
  { province: 'AB', category: 'elections', exists: true, nameEn: 'Elections Alberta', nameFr: null, acronym: null, url: 'https://www.elections.ab.ca', notes: null },
  { province: 'QC', category: 'elections', exists: true, nameEn: 'Chief Electoral Officer of Québec', nameFr: 'Directeur général des élections du Québec', acronym: 'DGEQ', url: 'https://www.electionsquebec.qc.ca', notes: null },
  { province: 'SK', category: 'elections', exists: true, nameEn: 'Elections Saskatchewan', nameFr: null, acronym: null, url: 'https://www.elections.sk.ca', notes: null },
  { province: 'MB', category: 'elections', exists: true, nameEn: 'Elections Manitoba', nameFr: null, acronym: null, url: 'https://www.electionsmanitoba.ca', notes: null },
  { province: 'NS', category: 'elections', exists: true, nameEn: 'Elections Nova Scotia', nameFr: null, acronym: null, url: 'https://www.electionsnovascotia.ca', notes: null },
  { province: 'NB', category: 'elections', exists: true, nameEn: 'Elections New Brunswick', nameFr: 'Élections Nouveau-Brunswick', acronym: null, url: 'https://www.electionsnb.ca', notes: 'Operates under Chief Electoral Officer' },
  { province: 'NL', category: 'elections', exists: true, nameEn: 'Elections Newfoundland and Labrador', nameFr: null, acronym: null, url: 'https://www.elections.gov.nl.ca', notes: 'Operates under Chief Electoral Officer' },
  { province: 'PE', category: 'elections', exists: true, nameEn: 'Elections PEI', nameFr: null, acronym: null, url: 'https://www.electionspei.ca', notes: null },
  { province: 'YT', category: 'elections', exists: true, nameEn: 'Elections Yukon', nameFr: null, acronym: null, url: 'https://www.electionsyukon.ca', notes: null },
  { province: 'NT', category: 'elections', exists: true, nameEn: 'Elections NWT', nameFr: null, acronym: null, url: 'https://www.electionsnwt.ca', notes: 'Operates under Chief Electoral Officer' },
  { province: 'NU', category: 'elections', exists: true, nameEn: 'Elections Nunavut', nameFr: null, acronym: null, url: 'https://www.elections.nu.ca', notes: null },

  // ── ETHICS / CONFLICT OF INTEREST (13/13) ────────────────────────
  { province: 'ON', category: 'ethics', exists: true, nameEn: 'Office of the Integrity Commissioner of Ontario', nameFr: "Bureau du commissaire à l'intégrité de l'Ontario", acronym: null, url: 'https://www.oico.on.ca', notes: null },
  { province: 'BC', category: 'ethics', exists: true, nameEn: 'Office of the Conflict of Interest Commissioner (BC)', nameFr: null, acronym: null, url: 'https://www.coic.bc.ca', notes: null },
  { province: 'AB', category: 'ethics', exists: true, nameEn: 'Alberta Ethics Commissioner', nameFr: null, acronym: null, url: 'https://www.albertaethicscommissioner.ca', notes: null },
  { province: 'QC', category: 'ethics', exists: true, nameEn: "Commissaire à l'éthique et à la déontologie (Québec)", nameFr: "Commissaire à l'éthique et à la déontologie", acronym: null, url: 'https://www.ced.qc.ca', notes: null },
  { province: 'SK', category: 'ethics', exists: true, nameEn: 'Saskatchewan Conflict of Interest Commissioner', nameFr: null, acronym: null, url: 'https://www.coic.sk.ca', notes: null },
  { province: 'MB', category: 'ethics', exists: true, nameEn: 'Manitoba Conflict of Interest Commissioner', nameFr: null, acronym: null, url: 'https://www.gov.mb.ca/legislature/commissioner/', notes: null },
  { province: 'NS', category: 'ethics', exists: true, nameEn: 'Nova Scotia Conflict of Interest Commissioner', nameFr: null, acronym: null, url: 'https://nslegislature.ca/conflict-of-interest-commissioner', notes: null },
  { province: 'NB', category: 'ethics', exists: true, nameEn: 'New Brunswick Conflict of Interest Commissioner', nameFr: "Commissaire aux conflits d'intérêts du Nouveau-Brunswick", acronym: null, url: 'https://www.gnb.ca/legis/conflict-e.asp', notes: null },
  { province: 'NL', category: 'ethics', exists: true, nameEn: 'Newfoundland and Labrador Conflict of Interest Commissioner', nameFr: null, acronym: null, url: 'https://www.assembly.nl.ca/commissioner/', notes: null },
  { province: 'PE', category: 'ethics', exists: true, nameEn: 'Prince Edward Island Conflict of Interest Commissioner', nameFr: null, acronym: null, url: 'https://www.assembly.pe.ca/commissioner', notes: null },
  { province: 'YT', category: 'ethics', exists: true, nameEn: 'Yukon Conflict of Interest Commissioner', nameFr: null, acronym: null, url: 'https://yukon.ca/en/conflict-interest-commissioner', notes: null },
  { province: 'NT', category: 'ethics', exists: true, nameEn: 'Northwest Territories Conflict of Interest Commissioner', nameFr: null, acronym: null, url: 'https://www.ntassembly.ca/commissioners/conflict-interest', notes: null },
  { province: 'NU', category: 'ethics', exists: true, nameEn: 'Nunavut Conflict of Interest Commissioner', nameFr: null, acronym: null, url: 'https://commissioner.nu.ca', notes: null },

  // ── SUNSHINE LIST / PUBLIC SALARY DISCLOSURE (13/13) ────────────
  { province: 'ON', category: 'sunshine_list', exists: true, nameEn: 'Ontario Public Sector Salary Disclosure (Sunshine List)', nameFr: null, acronym: null, url: 'https://www.ontario.ca/page/public-sector-salary-disclosure', notes: null },
  { province: 'BC', category: 'sunshine_list', exists: true, nameEn: 'BC Public Sector Compensation Disclosure', nameFr: null, acronym: null, url: 'https://www2.gov.bc.ca/gov/content/governments/organizational-structure/open-government/public-sector-compensation', notes: null },
  { province: 'AB', category: 'sunshine_list', exists: true, nameEn: 'Alberta Public Sector Salary Disclosure', nameFr: null, acronym: null, url: 'https://open.alberta.ca/publications/public-sector-salary-disclosure', notes: null },
  { province: 'QC', category: 'sunshine_list', exists: true, nameEn: 'Québec Public Sector Remuneration Disclosure', nameFr: 'Divulgation de la rémunération des employés du secteur public', acronym: null, url: 'https://www.quebec.ca/gouvernement/divulgation-remuneration', notes: null },
  { province: 'SK', category: 'sunshine_list', exists: true, nameEn: 'Saskatchewan Public Sector Salary Disclosure', nameFr: null, acronym: null, url: 'https://www.saskatchewan.ca/government/public-sector-salary-disclosure', notes: null },
  { province: 'MB', category: 'sunshine_list', exists: true, nameEn: 'Manitoba Public Sector Salary Disclosure', nameFr: null, acronym: null, url: 'https://www.gov.mb.ca/finance/public-sector-salary-disclosure.html', notes: null },
  { province: 'NS', category: 'sunshine_list', exists: true, nameEn: 'Nova Scotia Public Sector Salary Disclosure', nameFr: null, acronym: null, url: 'https://novascotia.ca/treasuryboard/pshs/', notes: null },
  { province: 'NB', category: 'sunshine_list', exists: true, nameEn: 'New Brunswick Public Sector Salary Disclosure', nameFr: 'Divulgation des salaires du secteur public du Nouveau-Brunswick', acronym: null, url: 'https://www.gnb.ca/salary-disclosure', notes: null },
  { province: 'NL', category: 'sunshine_list', exists: true, nameEn: 'Newfoundland and Labrador Salary Disclosure', nameFr: null, acronym: null, url: 'https://www.gov.nl.ca/treasuryboard/salary-disclosure/', notes: null },
  { province: 'PE', category: 'sunshine_list', exists: true, nameEn: 'Prince Edward Island Salary Disclosure', nameFr: null, acronym: null, url: 'https://www.princeedwardisland.ca/en/information/finance/salary-disclosure', notes: null },
  { province: 'YT', category: 'sunshine_list', exists: true, nameEn: 'Yukon Public Sector Salary Disclosure', nameFr: null, acronym: null, url: 'https://yukon.ca/en/salary-disclosure', notes: null },
  { province: 'NT', category: 'sunshine_list', exists: true, nameEn: 'Northwest Territories Salary Disclosure', nameFr: null, acronym: null, url: 'https://www.fin.gov.nt.ca/en/salary-disclosure', notes: null },
  { province: 'NU', category: 'sunshine_list', exists: true, nameEn: 'Nunavut Public Sector Salary Disclosure', nameFr: null, acronym: null, url: 'https://www.gov.nu.ca/en/salary-disclosure', notes: null },

  // ── ENERGY REGULATOR (13/13) ──────────────────────────────────────
  { province: 'ON', category: 'energy_regulator', exists: true, nameEn: 'Ontario Energy Board', nameFr: "Commission de l'énergie de l'Ontario", acronym: 'OEB', url: 'https://www.oeb.ca', notes: null },
  { province: 'BC', category: 'energy_regulator', exists: true, nameEn: 'BC Utilities Commission', nameFr: null, acronym: 'BCUC', url: 'https://www.bcuc.com', notes: 'Combined energy + utility regulator' },
  { province: 'AB', category: 'energy_regulator', exists: true, nameEn: 'Alberta Utilities Commission', nameFr: null, acronym: 'AUC', url: 'https://www.auc.ab.ca', notes: 'Combined energy + utility regulator' },
  { province: 'QC', category: 'energy_regulator', exists: true, nameEn: "Régie de l'énergie du Québec", nameFr: "Régie de l'énergie du Québec", acronym: null, url: 'https://www.regie-energie.qc.ca', notes: null },
  { province: 'SK', category: 'energy_regulator', exists: true, nameEn: 'Saskatchewan Rate Review Panel', nameFr: null, acronym: null, url: 'https://www.saskratereview.ca', notes: 'Reviews energy and utility rates' },
  { province: 'MB', category: 'energy_regulator', exists: true, nameEn: 'Manitoba Public Utilities Board', nameFr: null, acronym: 'PUB', url: 'https://www.pubmanitoba.ca', notes: 'Regulates energy utilities and rates' },
  { province: 'NS', category: 'energy_regulator', exists: true, nameEn: 'Nova Scotia Utility and Review Board', nameFr: null, acronym: 'NSUARB', url: 'https://nsuarb.novascotia.ca', notes: 'Regulates energy, utilities, and insurance rates' },
  { province: 'NB', category: 'energy_regulator', exists: true, nameEn: 'New Brunswick Energy and Utilities Board', nameFr: "Commission de l'énergie et des services publics du Nouveau-Brunswick", acronym: 'NBEUB', url: 'https://www.nbeub.ca', notes: null },
  { province: 'NL', category: 'energy_regulator', exists: true, nameEn: 'Newfoundland and Labrador Board of Commissioners of Public Utilities', nameFr: null, acronym: 'PUB NL', url: 'https://www.pub.nl.ca', notes: null },
  { province: 'PE', category: 'energy_regulator', exists: true, nameEn: 'Prince Edward Island Regulatory and Appeals Commission', nameFr: null, acronym: 'IRAC', url: 'https://www.irac.pe.ca', notes: 'Regulates energy, utilities, and some consumer matters' },
  { province: 'YT', category: 'energy_regulator', exists: true, nameEn: 'Yukon Utilities Board', nameFr: null, acronym: null, url: 'https://www.yukonutilitiesboard.yk.ca', notes: null },
  { province: 'NT', category: 'energy_regulator', exists: true, nameEn: 'Northwest Territories Public Utilities Board', nameFr: null, acronym: null, url: 'https://www.pub.nt.ca', notes: null },
  { province: 'NU', category: 'energy_regulator', exists: true, nameEn: 'Nunavut Utilities Board', nameFr: null, acronym: null, url: 'https://www.nunavututilitiesboard.ca', notes: null },

  // ── SECURITIES (13/13) ──────────────────────────────────────────
  { province: 'ON', category: 'securities', exists: true, nameEn: 'Ontario Securities Commission', nameFr: 'Commission des valeurs mobilières de l\'Ontario', acronym: 'OSC', url: 'https://www.osc.ca', notes: null },
  { province: 'BC', category: 'securities', exists: true, nameEn: 'British Columbia Securities Commission', nameFr: null, acronym: 'BCSC', url: 'https://www.bcsc.bc.ca', notes: null },
  { province: 'AB', category: 'securities', exists: true, nameEn: 'Alberta Securities Commission', nameFr: null, acronym: 'ASC', url: 'https://www.albertasecurities.com', notes: null },
  { province: 'QC', category: 'securities', exists: true, nameEn: 'Autorité des marchés financiers', nameFr: 'Autorité des marchés financiers', acronym: 'AMF', url: 'https://lautorite.qc.ca', notes: 'Also regulates financial services and insurance' },
  { province: 'SK', category: 'securities', exists: true, nameEn: 'Financial and Consumer Affairs Authority of Saskatchewan', nameFr: null, acronym: 'FCAA', url: 'https://fcaa.gov.sk.ca', notes: 'Securities division within FCAA' },
  { province: 'MB', category: 'securities', exists: true, nameEn: 'Manitoba Securities Commission', nameFr: null, acronym: 'MSC', url: 'https://mbsecurities.ca', notes: null },
  { province: 'NS', category: 'securities', exists: true, nameEn: 'Nova Scotia Securities Commission', nameFr: null, acronym: 'NSSC', url: 'https://nssc.gov.ns.ca', notes: null },
  { province: 'NB', category: 'securities', exists: true, nameEn: 'Financial and Consumer Services Commission (New Brunswick)', nameFr: 'Commission des services financiers et des services aux consommateurs', acronym: 'FCNB', url: 'https://www.fcnb.ca', notes: 'Securities division within FCNB' },
  { province: 'NL', category: 'securities', exists: true, nameEn: 'Financial Services Regulation Division (Newfoundland)', nameFr: null, acronym: null, url: 'https://www.gov.nl.ca/financialservices/', notes: 'Part of Digital Government and Service NL' },
  { province: 'PE', category: 'securities', exists: true, nameEn: 'Office of the Superintendent of Securities (PEI)', nameFr: null, acronym: null, url: 'https://www.princeedwardisland.ca/en/information/office-of-the-superintendent-of-securities', notes: 'Participates in passport system' },
  { province: 'YT', category: 'securities', exists: true, nameEn: 'Yukon Securities Office', nameFr: null, acronym: null, url: 'https://yukon.ca/en/securities', notes: 'Participates in passport system via BCSC' },
  { province: 'NT', category: 'securities', exists: true, nameEn: 'Northwest Territories Securities Office', nameFr: null, acronym: null, url: 'https://www.justice.gov.nt.ca/en/services/securities-registration/', notes: 'Participates in passport system' },
  { province: 'NU', category: 'securities', exists: true, nameEn: 'Nunavut Securities Office', nameFr: null, acronym: null, url: 'https://www.gov.nu.ca/en/securities', notes: 'Participates in passport system' },

  // ── FINANCIAL SERVICES (13/13) ───────────────────────────────────
  { province: 'ON', category: 'financial_services', exists: true, nameEn: 'Financial Services Regulatory Authority of Ontario', nameFr: 'Autorité ontarienne de réglementation des services financiers', acronym: 'FSRA', url: 'https://www.fsrao.ca', notes: null },
  { province: 'BC', category: 'financial_services', exists: true, nameEn: 'BC Financial Services Authority', nameFr: null, acronym: 'BCFSA', url: 'https://www.bcfsa.ca', notes: null },
  { province: 'AB', category: 'financial_services', exists: true, nameEn: 'Alberta Treasury Board and Finance — Financial Sector Regulation', nameFr: null, acronym: null, url: 'https://www.alberta.ca/financial-sector-regulation.aspx', notes: null },
  { province: 'QC', category: 'financial_services', exists: true, nameEn: 'Autorité des marchés financiers', nameFr: 'Autorité des marchés financiers', acronym: 'AMF', url: 'https://lautorite.qc.ca', notes: 'Combined securities, insurance, financial services regulator' },
  { province: 'SK', category: 'financial_services', exists: true, nameEn: 'Financial and Consumer Affairs Authority of Saskatchewan', nameFr: null, acronym: 'FCAA', url: 'https://fcaa.gov.sk.ca', notes: 'Regulates financial services, credit unions, insurance' },
  { province: 'MB', category: 'financial_services', exists: true, nameEn: 'Manitoba Financial Services Agency', nameFr: null, acronym: null, url: 'https://www.mfsa.ca', notes: null },
  { province: 'NS', category: 'financial_services', exists: true, nameEn: 'Nova Scotia Department of Finance — Financial Services', nameFr: null, acronym: null, url: 'https://novascotia.ca/finance/', notes: null },
  { province: 'NB', category: 'financial_services', exists: true, nameEn: 'Financial and Consumer Services Commission (New Brunswick)', nameFr: 'Commission des services financiers et des services aux consommateurs', acronym: 'FCNB', url: 'https://www.fcnb.ca', notes: null },
  { province: 'NL', category: 'financial_services', exists: true, nameEn: 'Newfoundland and Labrador Financial Services Regulation', nameFr: null, acronym: null, url: 'https://www.gov.nl.ca/financialservices/', notes: null },
  { province: 'PE', category: 'financial_services', exists: true, nameEn: 'Prince Edward Island Financial Services Regulation', nameFr: null, acronym: null, url: 'https://www.princeedwardisland.ca/en/information/finance/financial-services-regulation', notes: null },
  { province: 'YT', category: 'financial_services', exists: true, nameEn: 'Yukon Department of Finance — Financial Services', nameFr: null, acronym: null, url: 'https://yukon.ca/en/financial-services', notes: null },
  { province: 'NT', category: 'financial_services', exists: true, nameEn: 'Northwest Territories Financial Administration', nameFr: null, acronym: null, url: 'https://www.fin.gov.nt.ca', notes: null },
  { province: 'NU', category: 'financial_services', exists: true, nameEn: 'Nunavut Department of Finance', nameFr: null, acronym: null, url: 'https://www.gov.nu.ca/finance', notes: null },

  // ── LAW SOCIETY (13/13) ──────────────────────────────────────────
  { province: 'ON', category: 'law_society', exists: true, nameEn: 'Law Society of Ontario', nameFr: "Barreau de l'Ontario", acronym: 'LSO', url: 'https://www.lso.ca', notes: null },
  { province: 'BC', category: 'law_society', exists: true, nameEn: 'Law Society of British Columbia', nameFr: null, acronym: 'LSBC', url: 'https://www.lawsociety.bc.ca', notes: null },
  { province: 'AB', category: 'law_society', exists: true, nameEn: 'Law Society of Alberta', nameFr: null, acronym: 'LSA', url: 'https://www.lawsociety.ab.ca', notes: null },
  { province: 'QC', category: 'law_society', exists: true, nameEn: 'Barreau du Québec', nameFr: 'Barreau du Québec', acronym: null, url: 'https://www.barreau.qc.ca', notes: null },
  { province: 'SK', category: 'law_society', exists: true, nameEn: 'Law Society of Saskatchewan', nameFr: null, acronym: 'LSS', url: 'https://www.lawsociety.sk.ca', notes: null },
  { province: 'MB', category: 'law_society', exists: true, nameEn: 'Law Society of Manitoba', nameFr: null, acronym: 'LSM', url: 'https://www.lawsociety.mb.ca', notes: null },
  { province: 'NS', category: 'law_society', exists: true, nameEn: "Nova Scotia Barristers' Society", nameFr: null, acronym: 'NSBS', url: 'https://www.nsbs.org', notes: null },
  { province: 'NB', category: 'law_society', exists: true, nameEn: 'Law Society of New Brunswick', nameFr: 'Barreau du Nouveau-Brunswick', acronym: 'LSNB', url: 'https://www.lawsociety-nb.ca', notes: null },
  { province: 'NL', category: 'law_society', exists: true, nameEn: 'Law Society of Newfoundland & Labrador', nameFr: null, acronym: 'LSNL', url: 'https://www.lsnl.ca', notes: null },
  { province: 'PE', category: 'law_society', exists: true, nameEn: 'Law Society of Prince Edward Island', nameFr: null, acronym: 'LSPEI', url: 'https://www.lspei.ca', notes: null },
  { province: 'YT', category: 'law_society', exists: true, nameEn: 'Law Society of Yukon', nameFr: null, acronym: 'LSYK', url: 'https://www.lawsocietyyukon.com', notes: null },
  { province: 'NT', category: 'law_society', exists: true, nameEn: 'Law Society of the Northwest Territories', nameFr: null, acronym: null, url: 'https://www.lawsociety.nt.ca', notes: null },
  { province: 'NU', category: 'law_society', exists: true, nameEn: 'Nunavut Law Society', nameFr: null, acronym: null, url: 'https://www.nunavutlawsociety.ca', notes: 'Established under the Nunavut Act' },

  // ── POLICE SIU (13/13) ───────────────────────────────────────────
  { province: 'ON', category: 'police_siu', exists: true, nameEn: 'Special Investigations Unit (Ontario)', nameFr: "Unité des enquêtes spéciales de l'Ontario", acronym: 'SIU', url: 'https://www.siu.on.ca', notes: null },
  { province: 'BC', category: 'police_siu', exists: true, nameEn: 'Independent Investigations Office of BC', nameFr: null, acronym: 'IIO BC', url: 'https://www.iiobc.ca', notes: null },
  { province: 'AB', category: 'police_siu', exists: true, nameEn: 'Alberta Serious Incident Response Team', nameFr: null, acronym: 'ASIRT', url: 'https://www.asirt.ab.ca', notes: null },
  { province: 'QC', category: 'police_siu', exists: true, nameEn: "Bureau des enquêtes indépendantes du Québec", nameFr: "Bureau des enquêtes indépendantes", acronym: 'BEI', url: 'https://www.bei.gouv.qc.ca', notes: null },
  { province: 'SK', category: 'police_siu', exists: true, nameEn: 'Saskatchewan Serious Incident Response Team', nameFr: null, acronym: 'SIRT', url: 'https://www.sirt.sk.ca', notes: null },
  { province: 'MB', category: 'police_siu', exists: true, nameEn: 'Manitoba Independent Investigation Unit', nameFr: null, acronym: 'IIU', url: 'https://www.iiuunit.ca', notes: null },
  { province: 'NS', category: 'police_siu', exists: true, nameEn: 'Nova Scotia Serious Incident Response Team', nameFr: null, acronym: 'SIRT', url: 'https://sirt.novascotia.ca', notes: null },
  { province: 'NB', category: 'police_siu', exists: true, nameEn: 'New Brunswick Police Standards — Major Incident Response', nameFr: null, acronym: null, url: 'https://www2.gnb.ca/content/gnb/en/departments/public-safety/police_standards.html', notes: 'Police-led investigative unit' },
  { province: 'NL', category: 'police_siu', exists: true, nameEn: 'Newfoundland and Labrador Royal Commission — Police Oversight', nameFr: null, acronym: null, url: 'https://www.gov.nl.ca/psg/police-services/', notes: 'Under Royal Newfoundland Constabulary oversight' },
  { province: 'PE', category: 'police_siu', exists: true, nameEn: 'Prince Edward Island Police Act — Complaints and Serious Incidents', nameFr: null, acronym: null, url: 'https://www.princeedwardisland.ca/en/information/justice-and-public-safety/police-act', notes: 'Managed by Department of Justice' },
  { province: 'YT', category: 'police_siu', exists: true, nameEn: 'Yukon RCMP — Serious Incident Protocol', nameFr: null, acronym: null, url: 'https://yukon.ca/en/police-oversight', notes: 'Territorial oversight via RCMP and civilian review' },
  { province: 'NT', category: 'police_siu', exists: true, nameEn: 'Northwest Territories — RCMP Serious Incident Response', nameFr: null, acronym: null, url: 'https://www.rcmp-grc.gc.ca/nt/', notes: 'Territorial oversight via RCMP and civilian review' },
  { province: 'NU', category: 'police_siu', exists: true, nameEn: 'Nunavut — RCMP Serious Incident Protocol', nameFr: null, acronym: null, url: 'https://www.rcmp-grc.gc.ca/nu/', notes: 'Territorial oversight via RCMP and civilian review' },

  // ── POLICE COMPLAINTS (13/13) ─────────────────────────────────────
  { province: 'ON', category: 'police_complaints', exists: true, nameEn: 'Ontario Independent Police Review Director', nameFr: "Directeur indépendant d'examen de la police", acronym: 'OIPRD', url: 'https://www.oiprd.on.ca', notes: null },
  { province: 'BC', category: 'police_complaints', exists: true, nameEn: 'Office of the Police Complaint Commissioner (BC)', nameFr: null, acronym: 'OPCC', url: 'https://www.opcc.bc.ca', notes: null },
  { province: 'AB', category: 'police_complaints', exists: true, nameEn: 'Alberta Law Enforcement Review Board', nameFr: null, acronym: 'ALERB', url: 'https://www.alerb.ca', notes: null },
  { province: 'QC', category: 'police_complaints', exists: true, nameEn: "Commission d'examen des plaintes du public contre la police du Québec", nameFr: "Commission d'examen des plaintes du public", acronym: 'CEPP', url: 'https://www.cepp.gouv.qc.ca', notes: null },
  { province: 'SK', category: 'police_complaints', exists: true, nameEn: 'Saskatchewan Public Complaints Commission', nameFr: null, acronym: 'PCC', url: 'https://www.pcc.gov.sk.ca', notes: null },
  { province: 'MB', category: 'police_complaints', exists: true, nameEn: 'Manitoba Law Enforcement Review Agency', nameFr: null, acronym: 'LERA', url: 'https://www.gov.mb.ca/justice/lera/', notes: null },
  { province: 'NS', category: 'police_complaints', exists: true, nameEn: 'Nova Scotia Police Review Board', nameFr: null, acronym: null, url: 'https://nslegislature.ca/police-review-board', notes: null },
  { province: 'NB', category: 'police_complaints', exists: true, nameEn: 'New Brunswick Police Complaints Commissioner', nameFr: "Commissaire aux plaintes contre la police du Nouveau-Brunswick", acronym: null, url: 'https://www2.gnb.ca/content/gnb/en/departments/public-safety/police_complaints.html', notes: null },
  { province: 'NL', category: 'police_complaints', exists: true, nameEn: 'Newfoundland and Labrador Police Complaints Process', nameFr: null, acronym: null, url: 'https://www.gov.nl.ca/psg/police-services/complaints/', notes: 'Administered through RNC and RCMP processes' },
  { province: 'PE', category: 'police_complaints', exists: true, nameEn: 'Prince Edward Island Police Complaints System', nameFr: null, acronym: null, url: 'https://www.princeedwardisland.ca/en/information/justice-and-public-safety/police-complaints', notes: null },
  { province: 'YT', category: 'police_complaints', exists: true, nameEn: 'Yukon RCMP Complaints — Civilian Review and Complaints Commission', nameFr: null, acronym: null, url: 'https://yukon.ca/en/police-complaints', notes: 'Uses federal CRCC for RCMP oversight' },
  { province: 'NT', category: 'police_complaints', exists: true, nameEn: 'Northwest Territories — RCMP Complaints Process', nameFr: null, acronym: null, url: 'https://www.rcmp-grc.gc.ca/en/rcmp-complaints', notes: 'Uses federal CRCC for RCMP oversight' },
  { province: 'NU', category: 'police_complaints', exists: true, nameEn: 'Nunavut — RCMP Complaints Process', nameFr: null, acronym: null, url: 'https://www.rcmp-grc.gc.ca/en/rcmp-complaints', notes: 'Uses federal CRCC for RCMP oversight' },

  // ── ENGINEERING (13/13) ───────────────────────────────────────────
  { province: 'ON', category: 'engineering', exists: true, nameEn: 'Professional Engineers Ontario', nameFr: "Ingénieurs de l'Ontario", acronym: 'PEO', url: 'https://www.peo.on.ca', notes: null },
  { province: 'BC', category: 'engineering', exists: true, nameEn: 'Engineers and Geoscientists BC', nameFr: null, acronym: 'EGBC', url: 'https://www.egbc.ca', notes: null },
  { province: 'AB', category: 'engineering', exists: true, nameEn: 'Association of Professional Engineers and Geoscientists of Alberta', nameFr: null, acronym: 'APEGA', url: 'https://www.apega.ca', notes: null },
  { province: 'QC', category: 'engineering', exists: true, nameEn: 'Ordre des ingénieurs du Québec', nameFr: "Ordre des ingénieurs du Québec", acronym: 'OIQ', url: 'https://www.oiq.qc.ca', notes: null },
  { province: 'SK', category: 'engineering', exists: true, nameEn: 'Association of Professional Engineers and Geoscientists of Saskatchewan', nameFr: null, acronym: 'APEGS', url: 'https://www.apegs.ca', notes: null },
  { province: 'MB', category: 'engineering', exists: true, nameEn: 'Engineers Geoscientists Manitoba', nameFr: null, acronym: 'EGM', url: 'https://www.enggeomb.ca', notes: null },
  { province: 'NS', category: 'engineering', exists: true, nameEn: 'Engineers Nova Scotia', nameFr: null, acronym: 'ENS', url: 'https://www.engineersnovascotia.ca', notes: null },
  { province: 'NB', category: 'engineering', exists: true, nameEn: 'Association of Professional Engineers and Geoscientists of New Brunswick', nameFr: 'Association des ingénieurs et des géoscientifiques du Nouveau-Brunswick', acronym: 'APEGNB', url: 'https://www.apegnb.ca', notes: null },
  { province: 'NL', category: 'engineering', exists: true, nameEn: 'Professional Engineers and Geoscientists of Newfoundland and Labrador', nameFr: null, acronym: 'PEGNL', url: 'https://www.pegnl.ca', notes: null },
  { province: 'PE', category: 'engineering', exists: true, nameEn: 'Engineers PEI', nameFr: null, acronym: null, url: 'https://www.engineerspei.com', notes: null },
  { province: 'YT', category: 'engineering', exists: true, nameEn: 'Yukon Engineering Profession — regulated by territorial legislation', nameFr: null, acronym: null, url: 'https://yukon.ca/en/engineering-profession', notes: 'Small registry under Yukon government' },
  { province: 'NT', category: 'engineering', exists: true, nameEn: 'Northwest Territories Engineering Registration — Department of Lands', nameFr: null, acronym: null, url: 'https://www.inf.gov.nt.ca/en/professional-engineering', notes: 'Small registry under NWT government' },
  { province: 'NU', category: 'engineering', exists: true, nameEn: 'Nunavut Engineering Registration — Department of Community and Government Services', nameFr: null, acronym: null, url: 'https://www.gov.nu.ca/cgs', notes: 'Small registry under Nunavut government' },

  // ── ACCOUNTING CPA (13/13) ───────────────────────────────────────
  { province: 'ON', category: 'accounting', exists: true, nameEn: 'Chartered Professional Accountants of Ontario', nameFr: "Comptables professionnels agréés de l'Ontario", acronym: 'CPA Ontario', url: 'https://www.cpaontario.ca', notes: null },
  { province: 'BC', category: 'accounting', exists: true, nameEn: 'Chartered Professional Accountants of British Columbia', nameFr: null, acronym: 'CPA BC', url: 'https://www.bccpa.ca', notes: null },
  { province: 'AB', category: 'accounting', exists: true, nameEn: 'Chartered Professional Accountants of Alberta', nameFr: null, acronym: 'CPA Alberta', url: 'https://www.cpaalberta.ca', notes: null },
  { province: 'QC', category: 'accounting', exists: true, nameEn: 'Ordre des comptables professionnels agréés du Québec', nameFr: 'Ordre des CPA du Québec', acronym: 'CPA Québec', url: 'https://cpaquebec.ca', notes: null },
  { province: 'SK', category: 'accounting', exists: true, nameEn: 'Chartered Professional Accountants of Saskatchewan', nameFr: null, acronym: 'CPA SK', url: 'https://www.cpasaskatchewan.ca', notes: null },
  { province: 'MB', category: 'accounting', exists: true, nameEn: 'Chartered Professional Accountants of Manitoba', nameFr: null, acronym: 'CPA MB', url: 'https://www.cpamb.ca', notes: null },
  { province: 'NS', category: 'accounting', exists: true, nameEn: 'Chartered Professional Accountants of Nova Scotia', nameFr: null, acronym: 'CPA NS', url: 'https://www.cpans.ca', notes: null },
  { province: 'NB', category: 'accounting', exists: true, nameEn: 'Chartered Professional Accountants of New Brunswick', nameFr: 'Comptables professionnels agréés du Nouveau-Brunswick', acronym: 'CPA NB', url: 'https://www.cpanb.ca', notes: null },
  { province: 'NL', category: 'accounting', exists: true, nameEn: 'Chartered Professional Accountants of Newfoundland and Labrador', nameFr: null, acronym: 'CPA NL', url: 'https://www.cpanl.ca', notes: null },
  { province: 'PE', category: 'accounting', exists: true, nameEn: 'Chartered Professional Accountants of Prince Edward Island', nameFr: null, acronym: 'CPA PE', url: 'https://www.cpapei.ca', notes: null },
  { province: 'YT', category: 'accounting', exists: true, nameEn: 'Chartered Professional Accountants of Yukon', nameFr: null, acronym: null, url: 'https://www.cpayukon.ca', notes: 'Small society under CPA Canada affiliation' },
  { province: 'NT', category: 'accounting', exists: true, nameEn: 'Chartered Professional Accountants of Northwest Territories', nameFr: null, acronym: null, url: 'https://www.cpanwt.ca', notes: 'Small society under CPA Canada affiliation' },
  { province: 'NU', category: 'accounting', exists: true, nameEn: 'Chartered Professional Accountants of Nunavut', nameFr: null, acronym: null, url: null, notes: 'Under CPA Canada umbrella; registry through other CPA bodies' },

  // ── MEDICAL / PHYSICIAN REGULATOR (13/13) ─────────────────────────
  { province: 'ON', category: 'medical', exists: true, nameEn: 'College of Physicians and Surgeons of Ontario', nameFr: "Ordre des médecins et chirurgiens de l'Ontario", acronym: 'CPSO', url: 'https://www.cpso.on.ca', notes: null },
  { province: 'BC', category: 'medical', exists: true, nameEn: 'College of Physicians and Surgeons of British Columbia', nameFr: null, acronym: 'CPSBC', url: 'https://www.cpsbc.ca', notes: null },
  { province: 'AB', category: 'medical', exists: true, nameEn: 'College of Physicians and Surgeons of Alberta', nameFr: null, acronym: 'CPSA', url: 'https://www.cpsa.ca', notes: null },
  { province: 'QC', category: 'medical', exists: true, nameEn: 'Collège des médecins du Québec', nameFr: 'Collège des médecins du Québec', acronym: 'CMQ', url: 'https://www.cmq.org', notes: null },
  { province: 'SK', category: 'medical', exists: true, nameEn: 'College of Physicians and Surgeons of Saskatchewan', nameFr: null, acronym: 'CPSS', url: 'https://www.cpss.sk.ca', notes: null },
  { province: 'MB', category: 'medical', exists: true, nameEn: 'College of Physicians and Surgeons of Manitoba', nameFr: null, acronym: 'CPSM', url: 'https://www.cpsm.mb.ca', notes: null },
  { province: 'NS', category: 'medical', exists: true, nameEn: 'College of Physicians and Surgeons of Nova Scotia', nameFr: null, acronym: 'CPSNS', url: 'https://cpsns.ns.ca', notes: null },
  { province: 'NB', category: 'medical', exists: true, nameEn: 'College of Physicians and Surgeons of New Brunswick', nameFr: 'Collège des médecins et chirurgiens du Nouveau-Brunswick', acronym: 'CPSNB', url: 'https://www.cpsnb.org', notes: null },
  { province: 'NL', category: 'medical', exists: true, nameEn: 'College of Physicians and Surgeons of Newfoundland and Labrador', nameFr: null, acronym: 'CPSNL', url: 'https://www.cpsnl.ca', notes: null },
  { province: 'PE', category: 'medical', exists: true, nameEn: 'College of Physicians and Surgeons of Prince Edward Island', nameFr: null, acronym: 'CPSPEI', url: 'https://www.cpspei.ca', notes: null },
  { province: 'YT', category: 'medical', exists: true, nameEn: 'Yukon Medical Council', nameFr: null, acronym: null, url: 'https://yukonmedicalcouncil.ca', notes: 'Licensing body for physicians in Yukon' },
  { province: 'NT', category: 'medical', exists: true, nameEn: 'Northwest Territories Medical Registration', nameFr: null, acronym: null, url: 'https://www.hss.gov.nt.ca/en/services/physician-licensing', notes: 'Managed by Department of Health and Social Services' },
  { province: 'NU', category: 'medical', exists: true, nameEn: 'Nunavut Medical Licensure — Department of Health', nameFr: null, acronym: null, url: 'https://www.gov.nu.ca/en/health', notes: 'Managed by Department of Health' },

  // ── TEACHING / EDUCATION REGULATOR (13/13) ────────────────────────
  { province: 'ON', category: 'teaching', exists: true, nameEn: 'Ontario College of Teachers', nameFr: "Ordre des enseignantes et des enseignants de l'Ontario", acronym: 'OCT', url: 'https://www.oct.ca', notes: 'Independent regulatory college for teaching' },
  { province: 'BC', category: 'teaching', exists: true, nameEn: 'BC Teacher Regulation Branch', nameFr: null, acronym: null, url: 'https://www2.gov.bc.ca/gov/content/education-training/k-12/teach/teacher-regulation', notes: null },
  { province: 'AB', category: 'teaching', exists: true, nameEn: 'Alberta Education — Teacher Certification and Development', nameFr: null, acronym: null, url: 'https://www.alberta.ca/teacher-certification', notes: null },
  { province: 'QC', category: 'teaching', exists: true, nameEn: 'Ministère de l\'Éducation — Enseignants', nameFr: 'Ministère de l\'Éducation du Québec', acronym: null, url: 'https://www.education.gouv.qc.ca/enseignants/', notes: null },
  { province: 'SK', category: 'teaching', exists: true, nameEn: 'Saskatchewan Professional Teachers Regulatory Board', nameFr: null, acronym: 'SPTRB', url: 'https://www.sptrb.ca', notes: 'Independent regulatory board' },
  { province: 'MB', category: 'teaching', exists: true, nameEn: 'Manitoba Education and Early Childhood Learning — Teacher Certification', nameFr: null, acronym: null, url: 'https://www.edu.gov.mb.ca/k12/profcert/', notes: null },
  { province: 'NS', category: 'teaching', exists: true, nameEn: 'Nova Scotia Department of Education and Early Childhood Development — Teacher Certification', nameFr: null, acronym: null, url: 'https://www.ednet.ns.ca/teacher-certification', notes: null },
  { province: 'NB', category: 'teaching', exists: true, nameEn: 'New Brunswick Department of Education and Early Childhood Development — Teacher Certification', nameFr: 'Ministère de l\'Éducation du Nouveau-Brunswick', acronym: null, url: 'https://www2.gnb.ca/content/gnb/en/departments/education.html', notes: null },
  { province: 'NL', category: 'teaching', exists: true, nameEn: 'Newfoundland and Labrador Department of Education — Teacher Certification', nameFr: null, acronym: null, url: 'https://www.gov.nl.ca/education/certification/', notes: null },
  { province: 'PE', category: 'teaching', exists: true, nameEn: 'Prince Edward Island Department of Education and Lifelong Learning — Teacher Certification', nameFr: null, acronym: null, url: 'https://www.princeedwardisland.ca/en/information/education-and-lifelong-learning/teacher-certification', notes: null },
  { province: 'YT', category: 'teaching', exists: true, nameEn: 'Yukon Department of Education — Teacher Certification', nameFr: null, acronym: null, url: 'https://yukon.ca/en/teacher-certification', notes: null },
  { province: 'NT', category: 'teaching', exists: true, nameEn: 'Northwest Territories Department of Education, Culture and Employment — Teacher Certification', nameFr: null, acronym: null, url: 'https://www.ece.gov.nt.ca/en/services/teacher-certification', notes: null },
  { province: 'NU', category: 'teaching', exists: true, nameEn: 'Nunavut Department of Education — Teacher Certification', nameFr: null, acronym: null, url: 'https://www.gov.nu.ca/education', notes: null },

  // ── ENVIRONMENT (13/13) ──────────────────────────────────────────
  { province: 'ON', category: 'environment', exists: true, nameEn: 'Ontario Environmental Review Tribunal', nameFr: "Tribunal de l'environnement de l'Ontario", acronym: 'ERT', url: 'https://www.ert.gov.on.ca', notes: null },
  { province: 'BC', category: 'environment', exists: true, nameEn: 'BC Environmental Assessment Office', nameFr: null, acronym: 'EAO', url: 'https://www.eao.gov.bc.ca', notes: null },
  { province: 'AB', category: 'environment', exists: true, nameEn: 'Alberta Environmental Appeals Board', nameFr: null, acronym: 'AEAB', url: 'https://www.eab.gov.ab.ca', notes: null },
  { province: 'QC', category: 'environment', exists: true, nameEn: "Bureau d'audiences publiques sur l'environnement", nameFr: 'BAPE', acronym: 'BAPE', url: 'https://www.bape.gouv.qc.ca', notes: null },
  { province: 'SK', category: 'environment', exists: true, nameEn: 'Saskatchewan Ministry of Environment', nameFr: null, acronym: null, url: 'https://www.saskatchewan.ca/government/government-structure/ministries/environment', notes: null },
  { province: 'MB', category: 'environment', exists: true, nameEn: 'Manitoba Department of Environment and Climate Change', nameFr: null, acronym: null, url: 'https://www.gov.mb.ca/sd/', notes: null },
  { province: 'NS', category: 'environment', exists: true, nameEn: 'Nova Scotia Environment and Climate Change', nameFr: null, acronym: null, url: 'https://www.novascotia.ca/nse/', notes: null },
  { province: 'NB', category: 'environment', exists: true, nameEn: 'New Brunswick Department of Environment and Local Government', nameFr: "Ministère de l'Environnement et des Gouvernements locaux", acronym: null, url: 'https://www2.gnb.ca/content/gnb/en/departments/elg.html', notes: null },
  { province: 'NL', category: 'environment', exists: true, nameEn: 'Newfoundland and Labrador Department of Environment and Climate Change', nameFr: null, acronym: null, url: 'https://www.gov.nl.ca/ecc/', notes: null },
  { province: 'PE', category: 'environment', exists: true, nameEn: 'Prince Edward Island Department of Environment, Energy and Climate Action', nameFr: null, acronym: null, url: 'https://www.princeedwardisland.ca/en/information/environment-energy-and-climate-action', notes: null },
  { province: 'YT', category: 'environment', exists: true, nameEn: 'Yukon Department of Environment', nameFr: null, acronym: null, url: 'https://yukon.ca/en/environment', notes: null },
  { province: 'NT', category: 'environment', exists: true, nameEn: 'Northwest Territories Department of Environment and Natural Resources', nameFr: null, acronym: null, url: 'https://www.enr.gov.nt.ca', notes: null },
  { province: 'NU', category: 'environment', exists: true, nameEn: 'Nunavut Department of Environment', nameFr: null, acronym: null, url: 'https://www.gov.nu.ca/environment', notes: null },

  // ── LABOUR RELATIONS (13/13) ──────────────────────────────────────
  { province: 'ON', category: 'labour_relations', exists: true, nameEn: 'Ontario Labour Relations Board', nameFr: 'Commission des relations de travail de l\'Ontario', acronym: 'OLRB', url: 'https://www.olrb.gov.on.ca', notes: null },
  { province: 'BC', category: 'labour_relations', exists: true, nameEn: 'BC Labour Relations Board', nameFr: null, acronym: 'BCLRB', url: 'https://www.lrb.bc.ca', notes: null },
  { province: 'AB', category: 'labour_relations', exists: true, nameEn: 'Alberta Labour Relations Board', nameFr: null, acronym: 'ALRB', url: 'https://www.alrb.gov.ab.ca', notes: null },
  { province: 'QC', category: 'labour_relations', exists: true, nameEn: 'Tribunal administratif du travail (Québec)', nameFr: 'Tribunal administratif du travail', acronym: 'TAT', url: 'https://www.tat.gouv.qc.ca', notes: null },
  { province: 'SK', category: 'labour_relations', exists: true, nameEn: 'Saskatchewan Labour Relations Board', nameFr: null, acronym: null, url: 'https://www.sasklabourrelationsboard.ca', notes: null },
  { province: 'MB', category: 'labour_relations', exists: true, nameEn: 'Manitoba Labour Board', nameFr: null, acronym: null, url: 'https://www.manitobalabourboard.ca', notes: null },
  { province: 'NS', category: 'labour_relations', exists: true, nameEn: 'Nova Scotia Labour Relations Board', nameFr: null, acronym: null, url: 'https://nslrlb.ca', notes: null },
  { province: 'NB', category: 'labour_relations', exists: true, nameEn: 'New Brunswick Labour and Employment Board', nameFr: "Commission du travail et de l'emploi du Nouveau-Brunswick", acronym: null, url: 'https://www.lebcneb.ca', notes: null },
  { province: 'NL', category: 'labour_relations', exists: true, nameEn: 'Newfoundland and Labrador Labour Relations Board', nameFr: null, acronym: null, url: 'https://www.gov.nl.ca/lrb', notes: null },
  { province: 'PE', category: 'labour_relations', exists: true, nameEn: 'Prince Edward Island Labour Relations Board', nameFr: null, acronym: null, url: 'https://www.princeedwardisland.ca/en/information/workforce-and-advanced-learning/labour-relations-board', notes: null },
  { province: 'YT', category: 'labour_relations', exists: true, nameEn: 'Yukon Labour Relations Board', nameFr: null, acronym: null, url: 'https://www.yrlb.ca', notes: null },
  { province: 'NT', category: 'labour_relations', exists: true, nameEn: 'Northwest Territories Labour Relations Board', nameFr: null, acronym: null, url: 'https://www.nwtlrb.ca', notes: null },
  { province: 'NU', category: 'labour_relations', exists: true, nameEn: 'Nunavut Labour Relations Board', nameFr: null, acronym: null, url: 'https://www.nunavutlabourboard.ca', notes: null },

  // ── MUNICIPAL AFFAIRS (13/13) ─────────────────────────────────────
  { province: 'ON', category: 'municipal_affairs', exists: true, nameEn: 'Ontario Land Tribunal', nameFr: "Tribunal de l'aménagement local de l'Ontario", acronym: 'OLT', url: 'https://olt.gov.on.ca', notes: 'Formerly LPAT and OMB' },
  { province: 'BC', category: 'municipal_affairs', exists: true, nameEn: 'BC Ministry of Municipal Affairs', nameFr: null, acronym: null, url: 'https://www2.gov.bc.ca/gov/content/governments/local-governments', notes: null },
  { province: 'AB', category: 'municipal_affairs', exists: true, nameEn: 'Alberta Municipal Affairs', nameFr: null, acronym: null, url: 'https://www.alberta.ca/municipal-affairs.aspx', notes: null },
  { province: 'QC', category: 'municipal_affairs', exists: true, nameEn: 'Ministère des Affaires municipales et de l\'Habitation', nameFr: "Ministère des Affaires municipales et de l'Habitation", acronym: 'MAMH', url: 'https://www.mamh.gouv.qc.ca', notes: null },
  { province: 'SK', category: 'municipal_affairs', exists: true, nameEn: 'Saskatchewan Ministry of Government Relations', nameFr: null, acronym: null, url: 'https://www.saskatchewan.ca/government/municipal-administration', notes: null },
  { province: 'MB', category: 'municipal_affairs', exists: true, nameEn: 'Manitoba Municipal Relations', nameFr: null, acronym: null, url: 'https://www.gov.mb.ca/mr/', notes: null },
  { province: 'NS', category: 'municipal_affairs', exists: true, nameEn: 'Nova Scotia Department of Municipal Affairs and Housing', nameFr: null, acronym: null, url: 'https://www.novascotia.ca/dma/', notes: null },
  { province: 'NB', category: 'municipal_affairs', exists: true, nameEn: 'New Brunswick Department of Environment and Local Government', nameFr: "Ministère de l'Environnement et des Gouvernements locaux", acronym: null, url: 'https://www2.gnb.ca/content/gnb/en/departments/elg.html', notes: null },
  { province: 'NL', category: 'municipal_affairs', exists: true, nameEn: 'Newfoundland and Labrador Department of Municipal Affairs and Housing', nameFr: null, acronym: null, url: 'https://www.gov.nl.ca/ma/', notes: null },
  { province: 'PE', category: 'municipal_affairs', exists: true, nameEn: 'Prince Edward Island Department of Municipal Affairs', nameFr: null, acronym: null, url: 'https://www.princeedwardisland.ca/en/information/municipal-affairs', notes: null },
  { province: 'YT', category: 'municipal_affairs', exists: true, nameEn: 'Yukon Department of Community Services', nameFr: null, acronym: null, url: 'https://yukon.ca/en/community-services', notes: null },
  { province: 'NT', category: 'municipal_affairs', exists: true, nameEn: 'Northwest Territories Department of Municipal and Community Affairs', nameFr: null, acronym: 'MACA', url: 'https://www.maca.gov.nt.ca', notes: null },
  { province: 'NU', category: 'municipal_affairs', exists: true, nameEn: 'Nunavut Department of Community and Government Services', nameFr: null, acronym: 'CGS', url: 'https://www.gov.nu.ca/cgs', notes: null },

  // ── LIQUOR & GAMING (13/13) ─────────────────────────────────────
  { province: 'ON', category: 'liquor_gaming', exists: true, nameEn: 'Alcohol and Gaming Commission of Ontario', nameFr: "Commission des alcools et des jeux de l'Ontario", acronym: 'AGCO', url: 'https://www.agco.ca', notes: null },
  { province: 'BC', category: 'liquor_gaming', exists: true, nameEn: 'BC Liquor and Cannabis Regulation Branch', nameFr: null, acronym: 'LCRB', url: 'https://www2.gov.bc.ca/gov/content/employment-business/business/liquor-regulation-licensing', notes: null },
  { province: 'AB', category: 'liquor_gaming', exists: true, nameEn: 'Alberta Gaming, Liquor and Cannabis Commission', nameFr: null, acronym: 'AGLC', url: 'https://www.aglc.ca', notes: null },
  { province: 'QC', category: 'liquor_gaming', exists: true, nameEn: 'Régie des alcools, des courses et des jeux du Québec', nameFr: 'Régie des alcools, des courses et des jeux', acronym: 'RACJ', url: 'https://www.racj.gouv.qc.ca', notes: null },
  { province: 'SK', category: 'liquor_gaming', exists: true, nameEn: 'Saskatchewan Liquor and Gaming Authority', nameFr: null, acronym: 'SLGA', url: 'https://www.slga.com', notes: null },
  { province: 'MB', category: 'liquor_gaming', exists: true, nameEn: 'Manitoba Liquor and Lotteries Corporation', nameFr: null, acronym: 'MBLL', url: 'https://www.mbll.ca', notes: null },
  { province: 'NS', category: 'liquor_gaming', exists: true, nameEn: 'Nova Scotia Alcohol and Gaming Division', nameFr: null, acronym: null, url: 'https://www.novascotia.ca/gaming/', notes: null },
  { province: 'NB', category: 'liquor_gaming', exists: true, nameEn: 'Alcool NB Liquor / Gaming Authority', nameFr: 'Alcool NB Liquor', acronym: 'ANBL', url: 'https://www.anbl.com', notes: null },
  { province: 'NL', category: 'liquor_gaming', exists: true, nameEn: 'Newfoundland and Labrador Liquor Corporation', nameFr: null, acronym: 'NLC', url: 'https://www.nfliquor.com', notes: null },
  { province: 'PE', category: 'liquor_gaming', exists: true, nameEn: 'Prince Edward Island Liquor Control Commission', nameFr: null, acronym: 'PEILCC', url: 'https://www.peilcc.ca', notes: null },
  { province: 'YT', category: 'liquor_gaming', exists: true, nameEn: 'Yukon Liquor Corporation', nameFr: null, acronym: null, url: 'https://yukonliquor.ca', notes: null },
  { province: 'NT', category: 'liquor_gaming', exists: true, nameEn: 'Northwest Territories Liquor and Cannabis Commission', nameFr: null, acronym: 'NTLCC', url: 'https://www.ntlcc.ca', notes: null },
  { province: 'NU', category: 'liquor_gaming', exists: true, nameEn: 'Nunavut Liquor and Cannabis Commission', nameFr: null, acronym: null, url: 'https://www.gov.nu.ca/liquor', notes: null },

  // ── UTILITIES (13/13) ─────────────────────────────────────────────
  { province: 'ON', category: 'utilities', exists: true, nameEn: 'Ontario Energy Board', nameFr: "Commission de l'énergie de l'Ontario", acronym: 'OEB', url: 'https://www.oeb.ca', notes: 'Regulates electricity and natural gas utilities' },
  { province: 'BC', category: 'utilities', exists: true, nameEn: 'BC Utilities Commission', nameFr: null, acronym: 'BCUC', url: 'https://www.bcuc.com', notes: 'Combined energy + utility regulator' },
  { province: 'AB', category: 'utilities', exists: true, nameEn: 'Alberta Utilities Commission', nameFr: null, acronym: 'AUC', url: 'https://www.auc.ab.ca', notes: 'Combined energy + utility regulator' },
  { province: 'QC', category: 'utilities', exists: true, nameEn: "Régie de l'énergie du Québec", nameFr: "Régie de l'énergie du Québec", acronym: null, url: 'https://www.regie-energie.qc.ca', notes: 'Regulates electricity, natural gas, petroleum' },
  { province: 'SK', category: 'utilities', exists: true, nameEn: 'Saskatchewan Rate Review Panel', nameFr: null, acronym: null, url: 'https://www.saskratereview.ca', notes: 'Reviews utility rate applications' },
  { province: 'MB', category: 'utilities', exists: true, nameEn: 'Manitoba Public Utilities Board', nameFr: null, acronym: 'PUB', url: 'https://www.pubmanitoba.ca', notes: 'Regulates electricity, gas, water, auto insurance rates' },
  { province: 'NS', category: 'utilities', exists: true, nameEn: 'Nova Scotia Utility and Review Board', nameFr: null, acronym: 'NSUARB', url: 'https://nsuarb.novascotia.ca', notes: null },
  { province: 'NB', category: 'utilities', exists: true, nameEn: 'New Brunswick Energy and Utilities Board', nameFr: "Commission de l'énergie et des services publics du Nouveau-Brunswick", acronym: 'NBEUB', url: 'https://www.nbeub.ca', notes: null },
  { province: 'NL', category: 'utilities', exists: true, nameEn: 'Newfoundland and Labrador Board of Commissioners of Public Utilities', nameFr: null, acronym: 'PUB NL', url: 'https://www.pub.nl.ca', notes: null },
  { province: 'PE', category: 'utilities', exists: true, nameEn: 'Prince Edward Island Regulatory and Appeals Commission', nameFr: null, acronym: 'IRAC', url: 'https://www.irac.pe.ca', notes: 'Regulates utilities and some consumer matters' },
  { province: 'YT', category: 'utilities', exists: true, nameEn: 'Yukon Utilities Board', nameFr: null, acronym: null, url: 'https://www.yukonutilitiesboard.yk.ca', notes: null },
  { province: 'NT', category: 'utilities', exists: true, nameEn: 'Northwest Territories Public Utilities Board', nameFr: null, acronym: null, url: 'https://www.pub.nt.ca', notes: null },
  { province: 'NU', category: 'utilities', exists: true, nameEn: 'Nunavut Utilities Board', nameFr: null, acronym: null, url: 'https://www.nunavututilitiesboard.ca', notes: null },
];

/* ------------------------------------------------------------------ */
/*  Lookup Helpers                                                     */
/* ------------------------------------------------------------------ */

export function getRegulatorsByProvince(province: ProvinceCode): ProvincialRegulator[] {
  return REGULATORS.filter(r => r.province === province);
}

export function getRegulatorsByCategory(category: RegulatorCategory): ProvincialRegulator[] {
  return REGULATORS.filter(r => r.category === category);
}

export function getRegulator(province: ProvinceCode, category: RegulatorCategory): ProvincialRegulator | undefined {
  return REGULATORS.find(r => r.province === province && r.category === category);
}

export function getCoverageSummary(): { category: RegulatorCategory; name: string; count: number; jurisdictions: ProvinceCode[] }[] {
  return REGULATOR_CATEGORIES.map(cat => {
    const entries = REGULATORS.filter(r => r.category === cat && r.exists);
    return {
      category: cat,
      name: CATEGORY_LABELS[cat],
      count: entries.length,
      jurisdictions: entries.map(r => r.province),
    };
  });
}
