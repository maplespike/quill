// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Committee Constants — Quill
 *
 * Known House of Commons committees and URL patterns.
 * The full list was scraped from: https://www.ourcommons.ca/Committees/en/Home
 */

import type { Chamber, CommitteeInfo } from './types.js';


export const COMMITTEES: CommitteeInfo[] = [
  // ---- Standing Committees ----
  { acronym: 'ACVA', nameEn: 'Veterans Affairs',                       nameFr: 'Anciens Combattants',                  category: 'standing' },
  { acronym: 'AGRI', nameEn: 'Agriculture and Agri-Food',              nameFr: 'Agriculture et agroalimentaire',       category: 'standing' },
  { acronym: 'CHPC', nameEn: 'Canadian Heritage',                      nameFr: 'Patrimoine canadien',                  category: 'standing' },
  { acronym: 'CIIT', nameEn: 'International Trade',                    nameFr: 'Commerce international',               category: 'standing' },
  { acronym: 'CIMM', nameEn: 'Citizenship and Immigration',            nameFr: 'Citoyenneté et immigration',           category: 'standing' },
  { acronym: 'ENVI', nameEn: 'Environment and Sustainable Development',nameFr: 'Environnement et développement durable',category: 'standing' },
  { acronym: 'ETHI', nameEn: 'Access to Information, Privacy and Ethics',nameFr: 'Accès à l\'information, protection des renseignements personnels et éthique', category: 'standing' },
  { acronym: 'FAAE', nameEn: 'Foreign Affairs and International Development',nameFr: 'Affaires étrangères et développement international', category: 'standing' },
  { acronym: 'FEWO', nameEn: 'Status of Women',                        nameFr: 'Condition féminine',                   category: 'standing' },
  { acronym: 'FINA', nameEn: 'Finance',                                 nameFr: 'Finances',                             category: 'standing' },
  { acronym: 'FOPO', nameEn: 'Fisheries and Oceans',                    nameFr: 'Pêches et océans',                     category: 'standing' },
  { acronym: 'HESA', nameEn: 'Health',                                  nameFr: 'Santé',                                category: 'standing' },
  { acronym: 'HUMA', nameEn: 'Human Resources, Skills and Social Development and the Status of Persons with Disabilities', nameFr: 'Ressources humaines, développement des compétences, développement social et condition des personnes handicapées', category: 'standing' },
  { acronym: 'INAN', nameEn: 'Indigenous and Northern Affairs',         nameFr: 'Affaires autochtones et du Nord',      category: 'standing' },
  { acronym: 'INDU', nameEn: 'Industry and Technology',                 nameFr: 'Industrie et technologie',             category: 'standing' },
  { acronym: 'JUST', nameEn: 'Justice and Human Rights',                nameFr: 'Justice et droits de la personne',     category: 'standing' },
  { acronym: 'LANG', nameEn: 'Official Languages',                      nameFr: 'Langues officielles',                  category: 'standing' },
  { acronym: 'LIAI', nameEn: 'Liaison',                                 nameFr: 'Liaison',                              category: 'standing' },
  { acronym: 'NDDN', nameEn: 'National Defence',                        nameFr: 'Défense nationale',                    category: 'standing' },
  { acronym: 'OGGO', nameEn: 'Government Operations and Estimates',    nameFr: 'Opérations gouvernementales et prévisions budgétaires', category: 'standing' },
  { acronym: 'PACP', nameEn: 'Public Accounts',                         nameFr: 'Comptes publics',                      category: 'standing' },
  { acronym: 'PROC', nameEn: 'Procedure and House Affairs',             nameFr: 'Procédure et affaires de la Chambre',  category: 'standing' },
  { acronym: 'RNNR', nameEn: 'Natural Resources',                       nameFr: 'Ressources naturelles',                category: 'standing' },
  { acronym: 'SECU', nameEn: 'Public Safety and National Security',     nameFr: 'Sécurité publique et sécurité nationale', category: 'standing' },
  { acronym: 'SRSR', nameEn: 'Science and Research',                    nameFr: 'Sciences et recherche',                category: 'standing' },
  { acronym: 'TRAN', nameEn: 'Transport, Infrastructure and Communities', nameFr: 'Transports, infrastructure et collectivités', category: 'standing' },

  // ---- Joint Committees ----
  { acronym: 'AMAD', nameEn: 'Medical Assistance in Dying',                     nameFr: 'Aide médicale à mourir',                              category: 'joint' },
  { acronym: 'BCAN', nameEn: 'Exercise of Powers Under the Building Canada Act', nameFr: 'Exercice des attributions prévues par la Loi sur le plan d\'action pour le Canada', category: 'joint' },
  { acronym: 'BILI', nameEn: 'Library of Parliament',                            nameFr: 'Bibliothèque du Parlement',                          category: 'joint' },
  { acronym: 'REGS', nameEn: 'Scrutiny of Regulations',                          nameFr: 'Examen de la réglementation',                         category: 'joint' },
];

export const COMMITTEE_MAP = new Map(COMMITTEES.map(c => [c.acronym, c]));


/**
 * Standing Senate committees.
 * URL pattern is identical to HoC but at sencanada.ca.
 */
export const SENATE_COMMITTEES: CommitteeInfo[] = [
  { acronym: 'SOCI', nameEn: 'Human Rights',                           nameFr: 'Droits de la personne',                        category: 'standing' },
  { acronym: 'RIDR', nameEn: 'Indigenous Peoples',                     nameFr: 'Peuples autochtones',                         category: 'standing' },
  { acronym: 'SCME', nameEn: 'Media and Communications',               nameFr: 'Médias et communications',                    category: 'standing' },
  { acronym: 'SLCI', nameEn: 'Legal and Constitutional Affairs',       nameFr: 'Affaires juridiques et constitutionnelles',    category: 'standing' },
  { acronym: 'SSOC', nameEn: 'Social Affairs, Science and Technology', nameFr: 'Affaires sociales, sciences et technologie',   category: 'standing' },
  { acronym: 'SBAF', nameEn: 'Banking, Commerce and the Economy',      nameFr: 'Banques, commerce et économie',                category: 'standing' },
  { acronym: 'NFFN', nameEn: 'Fisheries and Oceans',                   nameFr: 'Pêches et océans',                            category: 'standing' },
  { acronym: 'SEEE', nameEn: 'Energy, the Environment and Natural Resources', nameFr: 'Énergie, environnement et ressources naturelles', category: 'standing' },
  { acronym: 'SEGD', nameEn: 'Agriculture and Forestry',               nameFr: 'Agriculture et foresterie',                   category: 'standing' },
  { acronym: 'SREV', nameEn: 'Ethics and Values',                      nameFr: 'Éthique et valeurs',                          category: 'standing' },
  { acronym: 'SBLD', nameEn: 'Internal Economy, Budgets and Administration', nameFr: 'Régie interne, budget et administration',      category: 'standing' },
  { acronym: 'SCDV', nameEn: 'National Security and Defence',          nameFr: 'Sécurité nationale et défense',               category: 'standing' },
  { acronym: 'SLCN', nameEn: 'Language',                                nameFr: 'Langue',                                      category: 'standing' },
  { acronym: 'SOCC', nameEn: 'Official Languages',                      nameFr: 'Langues officielles',                         category: 'standing' },
  { acronym: 'SNAA', nameEn: 'Aboriginal Peoples',                      nameFr: 'Peuples autochtones',                         category: 'standing' },
  { acronym: 'SSCI', nameEn: 'Science and Technology',                  nameFr: 'Sciences et technologie',                     category: 'standing' },
  { acronym: 'SSBC', nameEn: 'Subcommittees',                           nameFr: 'Sous-comités',                                category: 'subcommittee' },
  { acronym: 'SPEN', nameEn: 'Pension',                                 nameFr: 'Pensions',                                    category: 'standing' },
  { acronym: 'SROG', nameEn: 'Rules, Procedures and the Rights of Parliament', nameFr: 'Règles, procédure et droits du Parlement',   category: 'standing' },
  { acronym: 'STRA', nameEn: 'Transport and Communication',             nameFr: 'Transports et communications',                category: 'standing' },
];

export const SENATE_COMMITTEE_MAP = new Map(SENATE_COMMITTEES.map(c => [c.acronym, c]));


/**
 * Base URL for the House of Commons committees site.
 */
export const OURCOMMONS_BASE = 'https://www.ourcommons.ca';

/**
 * Base URL for the Senate committees site.
 */
export const SENATE_BASE_URL = 'https://sencanada.ca';

/**
 * Resolve the base URL for a given chamber.
 */
export function getBaseUrl(chamber: Chamber): string {
  return chamber === 'senate' ? SENATE_BASE_URL : OURCOMMONS_BASE;
}

/**
 * Meeting list page for a committee.
 */
export function meetingListUrl(acronym: string, baseUrl: string = OURCOMMONS_BASE): string {
  return `${baseUrl}/Committees/en/${acronym}/Meetings`;
}

/**
 * DocumentViewer evidence page (HTML).
 */
export function evidenceUrl(
  parliament: number,
  session: number,
  acronym: string,
  meetingNumber: number,
  baseUrl: string = OURCOMMONS_BASE,
): string {
  return `${baseUrl}/DocumentViewer/en/${parliament}-${session}/${acronym}/meeting-${meetingNumber}/evidence`;
}

/**
 * Evidence XML URL (derived from HTML page link, but pattern is predictable).
 * /Content/Committee/{Parl}{Session}/{Acronym}/Evidence/{EvId}/{Acronym}EV{N}-{Lang}.XML
 * The EvId is NOT predictable so we scrape it from the HTML page.
 */
export function evidenceHtmlUrl(
  parliament: number,
  session: number,
  acronym: string,
  meetingNumber: number,
  baseUrl: string = OURCOMMONS_BASE,
): string {
  return evidenceUrl(parliament, session, acronym, meetingNumber, baseUrl);
}

/**
 * Minutes XML URL.
 */
export function minutesXmlUrl(
  parliament: number,
  session: number,
  acronym: string,
  meetingNumber: number,
  baseUrl: string = OURCOMMONS_BASE,
): string {
  return `${baseUrl}/DocumentViewer/en/${parliament}-${session}/${acronym}/meeting-${meetingNumber}/minutes?format=xml`;
}


/** 45th Parliament, 1st Session (May 26, 2025 – present) */
export const CURRENT_PARLIAMENT = 45;
export const CURRENT_SESSION = 1;
