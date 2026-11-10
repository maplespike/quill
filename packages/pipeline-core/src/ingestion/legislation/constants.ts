// SPDX-License-Identifier: AGPL-3.0-only
import type { LegislationSource } from './types.js';

export interface LegislationSourceConfig {
  source: LegislationSource;
  name: string;
  jurisdiction: string;
  url: string;
  type: 'xml' | 'html' | 'ckan';
  enabled: boolean;
}

export const LEGISLATION_SOURCES: LegislationSourceConfig[] = [
  {
    source: 'justice-canada-xml',
    name: 'Justice Canada Consolidated Laws (XML)',
    jurisdiction: 'federal',
    url: 'https://github.com/justicecanada/laws-lois-xml',
    type: 'xml',
    enabled: true,
  },
  {
    source: 'ontario-elaws',
    name: 'Ontario e-Laws',
    jurisdiction: 'ON',
    url: 'https://www.ontario.ca/laws',
    type: 'html',
    enabled: true,
  },
  {
    source: 'bc-laws',
    name: 'BC Laws',
    jurisdiction: 'BC',
    url: 'https://www.bclaws.gov.bc.ca/',
    type: 'html',
    enabled: true,
  },
  {
    source: 'quebec-legislation',
    name: 'Quebec Legislation (Données Québec)',
    jurisdiction: 'QC',
    url: 'https://www.donneesquebec.ca/recherche/dataset?q=legislation&sort=metadata_modified+desc',
    type: 'ckan',
    enabled: true,
  },
  {
    source: 'provincial-ckan',
    name: 'Provincial Legislation via CKAN',
    jurisdiction: 'AB,SK,MB,NS,NB,NL,PE',
    url: 'https://open.canada.ca/data/api/3/action/package_search?q=acts+legislation+regulations&rows=30',
    type: 'ckan',
    enabled: true,
  },
];

export const LEGISLATION_UA = 'MapleSpike-Legislation/1.0';
export const LEGISLATION_TIMEOUT_MS = 15_000;
export const MAX_LEGISLATION_RECORDS = 300;
export const JUSTICE_CANADA_XML_MASTER = 'https://laws-lois.justice.gc.ca/eng/XML/Legis.xml';
