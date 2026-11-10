// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Provincial Lobbying Types — Quill
 *
 * Types for provincial lobbying registry data across Canadian provinces.
 * Normalized to match the federal LobbyingRecord schema to enable
 * cross-jurisdiction queries (a company can lobby federally AND
 * provincially on the same issue).
 *
 * Sources:
 *   - Ontario: Integrity Commissioner of Ontario (lobbyist.oico.on.ca)
 *   - British Columbia: Office of the Registrar of Lobbyists
 *   - Alberta: Office of the Ethics Commissioner
 *   - Québec: Commissaire au lobbyisme du Québec
 *
 * Source terms vary by registry, publisher, and dataset; public access does not establish reuse permission.
 */

import type { LobbyingRecord } from '../corporate/types.js';


/**
 * Canadian province code used to distinguish records by jurisdiction.
 */
export type Province = 'ON' | 'BC' | 'AB' | 'QC' | 'MB' | 'SK' | 'NS' | 'NB' | 'NL' | 'PE' | 'NT' | 'YT' | 'NU';


/**
 * A lobbying record from a provincial registry, normalized to match
 * the federal LobbyingRecord schema as closely as possible.
 *
 * The `province` field distinguishes the jurisdiction so cross-province
 * queries can be performed against a unified table.
 */
export interface ProvincialLobbyingRecord extends Omit<LobbyingRecord, 'id'> {
  /** SHA-256 citation hash (computed from normalized content) */
  id: string;

  /** Province code */
  province: Province;

  /** Original source-specific identifier (e.g. Ontario registration number) */
  originalId: string | null;

  /** Raw source system name */
  sourceSystem: string;
}


/**
 * Shape of a raw record from the Ontario Lobbyists Registry.
 * The Ontario registry (operated by the Integrity Commissioner of Ontario)
 * has a different schema from the federal registry.
 *
 * Fields are based on the Ontario Lobbyists Registration Act requirements
 * and the public search interface at lobbyist.oico.on.ca.
 */
export interface RawOntarioRecord {
  /** Ontario registration number */
  registrationNumber?: string;

  /** Lobbyist / registrant name */
  lobbyistName?: string;
  lobbyistBusinessName?: string;
  lobbyistAddress?: string;

  /** Client organization being represented */
  clientName?: string;
  clientBusiness?: string;

  /** Subject matter(s) */
  subjectMatters?: string[];

  /** Government institution(s) contacted */
  governmentBodies?: string[];

  /** Public office holder(s) contacted */
  officials?: string[];

  /** Lobbying period */
  registrationStartDate?: string;
  registrationEndDate?: string;

  /** Communication dates */
  communicationDate?: string;

  /** Lobbyist category */
  lobbyistCategory?: string;

  /** Source URL on the Ontario registry */
  sourceUrl?: string;

  /** Catch-all for any other fields */
  [key: string]: unknown;
}


export interface RawBCRecord {
  /** Registration number from BC registry */
  registrationNumber?: string;
  /** Lobbyist / registrant name */
  lobbyistName?: string;
  lobbyistBusinessName?: string;
  lobbyistAddress?: string;
  /** Client organization */
  clientName?: string;
  clientBusiness?: string;
  /** Subject matter(s) */
  subjectMatters?: string[];
  /** Government body/institution contacted */
  governmentBodies?: string[];
  /** Public official contacted */
  officials?: string[];
  /** Lobbying period */
  registrationStartDate?: string;
  registrationEndDate?: string;
  /** Communication date */
  communicationDate?: string;
  /** Lobbyist type / category */
  lobbyistType?: string;
  lobbyistCategory?: string;
  /** Source URL */
  sourceUrl?: string;
  [key: string]: unknown;
}


export interface RawAlbertaRecord {
  /** Registration number from Alberta registry */
  registrationNumber?: string;
  /** Lobbyist / registrant name */
  lobbyistName?: string;
  lobbyistBusinessName?: string;
  lobbyistAddress?: string;
  /** Client organization */
  clientName?: string;
  clientBusiness?: string;
  /** Subject matter(s) */
  subjectMatters?: string[];
  /** Government body/institution contacted */
  governmentBodies?: string[];
  /** Public official contacted */
  officials?: string[];
  /** Lobbying period */
  registrationStartDate?: string;
  registrationEndDate?: string;
  /** Communication date */
  communicationDate?: string;
  /** Lobbyist type / category */
  lobbyistType?: string;
  lobbyistCategory?: string;
  /** Source URL */
  sourceUrl?: string;
  [key: string]: unknown;
}


export interface RawQuebecRecord {
  /** Registration number from Quebec registry */
  registrationNumber?: string;
  /** Lobbyist / registrant name */
  lobbyistName?: string;
  lobbyistBusinessName?: string;
  lobbyistAddress?: string;
  /** Client organization */
  clientName?: string;
  clientBusiness?: string;
  /** Subject matter(s) */
  subjectMatters?: string[];
  /** Government body/institution contacted */
  governmentBodies?: string[];
  /** Public official contacted */
  officials?: string[];
  /** Lobbying period */
  registrationStartDate?: string;
  registrationEndDate?: string;
  /** Communication date */
  communicationDate?: string;
  /** Lobbyist type / category */
  lobbyistType?: string;
  lobbyistCategory?: string;
  /** Source URL */
  sourceUrl?: string;
  [key: string]: unknown;
}


export interface RawSaskatchewanRecord {
  /** Registration number from Saskatchewan registry */
  registrationNumber?: string;
  /** Lobbyist / registrant name */
  lobbyistName?: string;
  lobbyistBusinessName?: string;
  lobbyistAddress?: string;
  /** Client organization */
  clientName?: string;
  clientBusiness?: string;
  /** Subject matter(s) */
  subjectMatters?: string[];
  /** Government body/institution contacted */
  governmentBodies?: string[];
  /** Public official contacted */
  officials?: string[];
  /** Lobbying period */
  registrationStartDate?: string;
  registrationEndDate?: string;
  /** Communication date */
  communicationDate?: string;
  /** Lobbyist type / category */
  lobbyistType?: string;
  lobbyistCategory?: string;
  /** Source URL */
  sourceUrl?: string;
  [key: string]: unknown;
}


export interface RawManitobaRecord {
  /** Registration number from Manitoba registry */
  registrationNumber?: string;
  /** Lobbyist / registrant name */
  lobbyistName?: string;
  lobbyistBusinessName?: string;
  lobbyistAddress?: string;
  /** Client organization */
  clientName?: string;
  clientBusiness?: string;
  /** Subject matter(s) */
  subjectMatters?: string[];
  /** Government body/institution contacted */
  governmentBodies?: string[];
  /** Public official contacted */
  officials?: string[];
  /** Lobbying period */
  registrationStartDate?: string;
  registrationEndDate?: string;
  /** Communication date */
  communicationDate?: string;
  /** Lobbyist type / category */
  lobbyistType?: string;
  lobbyistCategory?: string;
  /** Source URL */
  sourceUrl?: string;
  [key: string]: unknown;
}


export interface RawNovaScotiaRecord {
  /** Registration number from Nova Scotia registry */
  registrationNumber?: string;
  /** Lobbyist / registrant name */
  lobbyistName?: string;
  lobbyistBusinessName?: string;
  lobbyistAddress?: string;
  /** Client organization */
  clientName?: string;
  clientBusiness?: string;
  /** Subject matter(s) */
  subjectMatters?: string[];
  /** Government body/institution contacted */
  governmentBodies?: string[];
  /** Public official contacted */
  officials?: string[];
  /** Lobbying period */
  registrationStartDate?: string;
  registrationEndDate?: string;
  /** Communication date */
  communicationDate?: string;
  /** Lobbyist type / category */
  lobbyistType?: string;
  lobbyistCategory?: string;
  /** Source URL */
  sourceUrl?: string;
  [key: string]: unknown;
}


export interface RawNewBrunswickRecord {
  /** Registration number from New Brunswick registry */
  registrationNumber?: string;
  /** Lobbyist / registrant name */
  lobbyistName?: string;
  lobbyistBusinessName?: string;
  lobbyistAddress?: string;
  /** Client organization */
  clientName?: string;
  clientBusiness?: string;
  /** Subject matter(s) */
  subjectMatters?: string[];
  /** Government body/institution contacted */
  governmentBodies?: string[];
  /** Public official contacted */
  officials?: string[];
  /** Lobbying period */
  registrationStartDate?: string;
  registrationEndDate?: string;
  /** Communication date */
  communicationDate?: string;
  /** Lobbyist type / category */
  lobbyistType?: string;
  lobbyistCategory?: string;
  /** Source URL */
  sourceUrl?: string;
  [key: string]: unknown;
}


export interface RawNewfoundlandRecord {
  /** Registration number from Newfoundland and Labrador registry */
  registrationNumber?: string;
  /** Lobbyist / registrant name */
  lobbyistName?: string;
  lobbyistBusinessName?: string;
  lobbyistAddress?: string;
  /** Client organization */
  clientName?: string;
  clientBusiness?: string;
  /** Subject matter(s) */
  subjectMatters?: string[];
  /** Government body/institution contacted */
  governmentBodies?: string[];
  /** Public official contacted */
  officials?: string[];
  /** Lobbying period */
  registrationStartDate?: string;
  registrationEndDate?: string;
  /** Communication date */
  communicationDate?: string;
  /** Lobbyist type / category */
  lobbyistType?: string;
  lobbyistCategory?: string;
  /** Source URL */
  sourceUrl?: string;
  [key: string]: unknown;
}


export interface RawPEIRecord {
  /** Registration number from Prince Edward Island registry */
  registrationNumber?: string;
  /** Lobbyist / registrant name */
  lobbyistName?: string;
  lobbyistBusinessName?: string;
  lobbyistAddress?: string;
  /** Client organization */
  clientName?: string;
  clientBusiness?: string;
  /** Subject matter(s) */
  subjectMatters?: string[];
  /** Government body/institution contacted */
  governmentBodies?: string[];
  /** Public official contacted */
  officials?: string[];
  /** Lobbying period */
  registrationStartDate?: string;
  registrationEndDate?: string;
  /** Communication date */
  communicationDate?: string;
  /** Lobbyist type / category */
  lobbyistType?: string;
  lobbyistCategory?: string;
  /** Source URL */
  sourceUrl?: string;
  [key: string]: unknown;
}


export interface RawYukonRecord {
  /** Registration number from Yukon registry */
  registrationNumber?: string;
  /** Lobbyist / registrant name */
  lobbyistName?: string;
  lobbyistBusinessName?: string;
  lobbyistAddress?: string;
  /** Client organization */
  clientName?: string;
  clientBusiness?: string;
  /** Subject matter(s) */
  subjectMatters?: string[];
  /** Government body/institution contacted */
  governmentBodies?: string[];
  /** Public official contacted */
  officials?: string[];
  /** Lobbying period */
  registrationStartDate?: string;
  registrationEndDate?: string;
  /** Communication date */
  communicationDate?: string;
  /** Lobbyist type / category */
  lobbyistType?: string;
  lobbyistCategory?: string;
  /** Source URL */
  sourceUrl?: string;
  [key: string]: unknown;
}


export interface RawNWTRecord {
  /** Registration number from Northwest Territories registry */
  registrationNumber?: string;
  /** Lobbyist / registrant name */
  lobbyistName?: string;
  lobbyistBusinessName?: string;
  lobbyistAddress?: string;
  /** Client organization */
  clientName?: string;
  clientBusiness?: string;
  /** Subject matter(s) */
  subjectMatters?: string[];
  /** Government body/institution contacted */
  governmentBodies?: string[];
  /** Public official contacted */
  officials?: string[];
  /** Lobbying period */
  registrationStartDate?: string;
  registrationEndDate?: string;
  /** Communication date */
  communicationDate?: string;
  /** Lobbyist type / category */
  lobbyistType?: string;
  lobbyistCategory?: string;
  /** Source URL */
  sourceUrl?: string;
  [key: string]: unknown;
}


export interface RawNunavutRecord {
  /** Registration number from Nunavut registry */
  registrationNumber?: string;
  /** Lobbyist / registrant name */
  lobbyistName?: string;
  lobbyistBusinessName?: string;
  lobbyistAddress?: string;
  /** Client organization */
  clientName?: string;
  clientBusiness?: string;
  /** Subject matter(s) */
  subjectMatters?: string[];
  /** Government body/institution contacted */
  governmentBodies?: string[];
  /** Public official contacted */
  officials?: string[];
  /** Lobbying period */
  registrationStartDate?: string;
  registrationEndDate?: string;
  /** Communication date */
  communicationDate?: string;
  /** Lobbyist type / category */
  lobbyistType?: string;
  lobbyistCategory?: string;
  /** Source URL */
  sourceUrl?: string;
  [key: string]: unknown;
}


export interface ProvincialIngestionResult {
  source: string;
  province: Province;
  recordsFound: number;
  recordsIngested: number;
  errors: string[];
  durationMs: number;
}


export interface ProvinceConfig {
  code: Province;
  name: string;
  commissioner: string;
  registryUrl: string;
  ckanPortalUrl?: string;
  ckanPackageId?: string;
  hasMonthlyCsv: boolean;
}

export const PROVINCE_CONFIGS: ProvinceConfig[] = [
  {
    code: 'ON',
    name: 'Ontario',
    commissioner: 'Integrity Commissioner of Ontario',
    registryUrl: 'https://lobbyist.oico.on.ca/lobbyistregistry/',
    ckanPortalUrl: 'https://data.ontario.ca',
    ckanPackageId: 'ontario-lobbyists-registry',
    hasMonthlyCsv: false,
  },
  {
    code: 'BC',
    name: 'British Columbia',
    commissioner: 'Office of the Registrar of Lobbyists',
    registryUrl: 'https://lobbyists.bc.ca/',
    hasMonthlyCsv: false,
  },
  {
    code: 'AB',
    name: 'Alberta',
    commissioner: 'Office of the Ethics Commissioner',
    registryUrl: 'https://www.albertalobbyistregistry.ca/',
    hasMonthlyCsv: false,
  },
  {
    code: 'QC',
    name: 'Quebec',
    commissioner: 'Commissaire au lobbyisme du Quebec',
    registryUrl: 'https://www.lobbyists.quebec/',
    hasMonthlyCsv: true,
  },
  {
    code: 'SK',
    name: 'Saskatchewan',
    commissioner: 'Office of the Registrar of Lobbyists',
    registryUrl: 'https://www.sasklobbyistregistry.ca/',
    hasMonthlyCsv: false,
  },
  {
    code: 'MB',
    name: 'Manitoba',
    commissioner: 'Office of the Lobbyist Registrar',
    registryUrl: 'https://www.lobbyistregistrar.mb.ca/',
    hasMonthlyCsv: false,
  },
  {
    code: 'NS',
    name: 'Nova Scotia',
    commissioner: 'Registrar of Lobbyists',
    registryUrl: 'https://novascotia.ca/sns/Lobbyist/',
    hasMonthlyCsv: false,
  },
  {
    code: 'NB',
    name: 'New Brunswick',
    commissioner: 'Office of the Integrity Commissioner',
    registryUrl: 'https://www.oic-bci.ca/',
    hasMonthlyCsv: false,
  },
  {
    code: 'NL',
    name: 'Newfoundland and Labrador',
    commissioner: 'Commissioner of Lobbyists',
    registryUrl: 'https://www.gov.nl.ca/gs/registries/lobbyists/',
    hasMonthlyCsv: false,
  },
  {
    code: 'PE',
    name: 'Prince Edward Island',
    commissioner: 'Registrar of Lobbyists',
    registryUrl: 'https://www.princeedwardisland.ca/en/feature/lobbyist-registry',
    hasMonthlyCsv: false,
  },
  {
    code: 'YT',
    name: 'Yukon',
    commissioner: 'Office of the Yukon Lobbyist Registry',
    registryUrl: 'https://yukonlobbyistregistry.ca/',
    hasMonthlyCsv: false,
  },
  {
    code: 'NT',
    name: 'Northwest Territories',
    commissioner: 'N/A — No lobbying registry',
    registryUrl: 'https://www.gov.nt.ca/',
    hasMonthlyCsv: false,
  },
  {
    code: 'NU',
    name: 'Nunavut',
    commissioner: 'N/A — No lobbying registry',
    registryUrl: 'https://www.gov.nu.ca/',
    hasMonthlyCsv: false,
  },
];


/**
 * Maps Ontario subject matter strings to the federal lobbying subject taxonomy.
 * Ontario uses different category labels than the federal registry.
 */
export const ONTARIO_SUBJECT_MAP: Record<string, string[]> = {
  'Agriculture and Food': ['Agriculture'],
  'Arts and Culture': ['Arts and Culture'],
  'Budget and Fiscal Policy': ['Budget', 'Finances'],
  'Children and Youth Services': ['Seniors', 'Poverty'],
  'Citizenship and Immigration': ['Immigration'],
  'Colleges and Universities': ['Education'],
  'Consumer Protection': ['Consumer Issues', 'Industry'],
  'COVID-19 Response': ['COVID-19'],
  'Economic Development': ['Economic Development'],
  'Education': ['Education'],
  'Energy': ['Energy'],
  'Environment': ['Environment', 'Climate'],
  'Finance': ['Finances', 'Banking'],
  'Government Procurement': ['Government Procurement'],
  'Health': ['Health'],
  'Housing': ['Housing'],
  'Indigenous Relations': ['Aboriginal Affairs'],
  'Infrastructure': ['Infrastructure'],
  'Justice and Public Safety': ['Justice', 'National Security'],
  'Labour and Employment': ['Labour', 'Employment'],
  'Municipal Affairs': ['Regional Development'],
  'Natural Resources': ['Natural Resources'],
  'Privacy and Data Protection': ['Privacy'],
  'Research and Innovation': ['Research and Development', 'Science and Technology'],
  'Seniors and Accessibility': ['Seniors'],
  'Small Business': ['Small Business'],
  'Sports and Recreation': ['Sports'],
  'Taxation': ['Taxation'],
  'Telecommunications': ['Telecommunications'],
  'Tourism': ['Tourism'],
  'Transportation': ['Transportation'],
};
