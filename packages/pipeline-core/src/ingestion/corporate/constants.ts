/**
 * Corporate Constants — MapleSpike Pipeline
 *
 * Known URLs for Canadian corporate public-data sources
 * and a curated list of tracked entities.
 */

/* ------------------------------------------------------------------ */
/*  URL Patterns                                                       */
/* ------------------------------------------------------------------ */

export const CORPORATE_SOURCES = {
  /** Federal Lobbying Registry */
  LOBBYING: {
    BASE: 'https://lobbycanada.gc.ca',
    SEARCH: 'https://lobbycanada.gc.ca/app/secure/ocr/lobbyistsregistry/registrationsearch.shtml',
  /** Monthly registered communication CSV reports */
  MONTHLY_CSV: 'https://lobbycanada.gc.ca/app/secure/ocr/lobbyistsregistry/communicationscsv.shtml',
  /** Monthly reports CSV download (new path) */
  MONTHLY_CSV_DOWNLOAD: 'https://lobbycanada.gc.ca/app/secure/ocr/lobbyistsregistry/monthlyCommunicationReportsCSV.shtml',
    /** Open Data JSON */
    OPEN_DATA: 'https://open.canada.ca/data/dataset/lobbyists-registry',
  },

  /** CanadaBuys / Government Procurement */
  PROCUREMENT: {
    BASE: 'https://canadabuys.canada.ca',
    TENDERS: 'https://canadabuys.canada.ca/en/tender-opportunities',
    /** Standing Offers and Supply Arrangements */
    SOSA: 'https://canadabuys.canada.ca/en/standing-offers-and-supply-arrangements',
    /** Contract History (buyandsell legacy) */
    CONTRACT_HISTORY: 'https://buyandsell.gc.ca/procurement-data',
  /** Open Canada dataset (proactive disclosure) */
  OPEN_DATA: 'https://open.canada.ca/data/en/dataset/d8f85d91-7dec-4fd1-8055-483b77225d8b',
    RSS_FEED: 'https://canadabuys.canada.ca/notices/rss',
  },

  /** Corporations Canada */
  CORPORATIONS: {
    BASE: 'https://ised-isde.canada.ca/cc/lc/gcrecherche-recherche.html',
  /** Open Data — federal corporations dataset */
  OPEN_DATA: 'https://open.canada.ca/data/en/dataset/0032ce54-c5dd-4b66-99a0-320a7b5e99f2',
  },

  /** Open Canada CKAN search templates */
  CKAN: {
    SEARCH: 'https://search.open.canada.ca/api/select?wt=json',
    PACKAGE: 'https://open.canada.ca/data/api/3/action/package_show',
    /** Proactive disclosure — contracts over $10K */
    PROACTIVE_DISCLOSURE: 'https://search.open.canada.ca/api/select?q=proactive+disclosure+contracts&rows=100&wt=json',
  },

  /** SEDI (insider trading reports) */
  SEDI: {
    BASE: 'https://www.sedi.ca',
    SEARCH: 'https://www.sedi.ca/sedi/SVTOCPublish?language=en',
  },

  /** OSFI (financial institution data) */
  OSFI: {
    BASE: 'https://www.osfi-bsif.gc.ca',
    DATA: 'https://www.osfi-bsif.gc.ca/Eng/fin-if/Pages/default.aspx',
  },

  /** Bank of Canada */
  BOC: {
    BASE: 'https://www.bankofcanada.ca',
    RATES: 'https://www.bankofcanada.ca/rates/',
    VALA: 'https://www.vala.ca', // executive speaking transcripts
  },

  /** Media company RSS / IR feeds (for executive statement tracking) */
  MEDIA: {
    /** CBC/Radio-Canada media centre */
    CBC_PRESSROOM: 'https://www.cbc.ca/mediacentre/rss',
    /** Globe and Mail press releases (via Newswire) */
    GLOBE_IR: 'https://www.globenewswire.com/RssFeed/organization/6686bbc7-fc47-4eeb-9d1f-4f9caaf98797',
    /** Postmedia corporate news */
    POSTMEDIA_CORP: 'https://www.postmedia.com/category/news/feed/',
    /** Quebecor news releases */
    QUEBECOR_NEWS: 'https://www.quebecor.com/en/press-releases/feed',
    /** Corus Entertainment news */
    CORUS_NEWS: 'https://www.corusent.com/news/feed/',
    /** Rogers Media news */
    ROGERS_MEDIA: 'https://www.rogersmediainc.com/news/feed/',
    /** Bell Media news (via BCE corporate) */
    BCE_NEWS: 'https://www.bce.ca/news-and-media/feed',
  } as const,
} as const;

/* ------------------------------------------------------------------ */
/*  Tracked High-Impact Entities                                       */
/* ------------------------------------------------------------------ */

/**
 * High-impact executives whose public statements are tracked.
 * These individuals represent organizations whose decisions
 * significantly affect Canadians' economic well-being.
 */
export interface TrackedExecutive {
  name: string;
  organization: string;
  organizationTicker: string | null;
  title: string;
  category: 'banking' | 'telecom' | 'energy' | 'retail' | 'tech' | 'pharma' | 'media' | 'regulator' | 'other';
}

export const TRACKED_EXECUTIVES: TrackedExecutive[] = [
  // Big 5 Banks
  { name: 'Victor Dodig', organization: 'CIBC', organizationTicker: 'CM', title: 'CEO', category: 'banking' },
  { name: 'Dave McKay', organization: 'RBC', organizationTicker: 'RY', title: 'CEO', category: 'banking' },
  { name: 'Darren Entwistle', organization: 'Telus', organizationTicker: 'T', title: 'CEO', category: 'telecom' },
  { name: 'Mirko Bibic', organization: 'BCE / Bell Canada', organizationTicker: 'BCE', title: 'CEO', category: 'telecom' },
  { name: 'Anthony Staffieri', organization: 'Rogers Communications', organizationTicker: 'RCI.B', title: 'CEO', category: 'telecom' },

  // Media / Broadcasting
  // --- Public broadcaster ---
  { name: 'Catherine Tait', organization: 'CBC/Radio-Canada', organizationTicker: null, title: 'President & CEO', category: 'media' },
  // --- Private broadcasters ---
  { name: 'Pierre Karl Péladeau', organization: 'Quebecor', organizationTicker: 'QBR.B', title: 'President & CEO', category: 'media' },
  { name: 'Doug Murphy', organization: 'Corus Entertainment', organizationTicker: 'CJR.B', title: 'CEO', category: 'media' },
  { name: 'Wade Oosterman', organization: 'Bell Media', organizationTicker: 'BCE', title: 'President', category: 'media' },
  { name: 'Colette Watson', organization: 'Rogers Media', organizationTicker: 'RCI.B', title: 'President, Media', category: 'media' },
  // --- Newspapers ---
  { name: 'Andrew MacLeod', organization: 'Postmedia Network', organizationTicker: 'PNC.B', title: 'CEO', category: 'media' },
  { name: 'Phillip Crawley', organization: 'The Globe and Mail', organizationTicker: null, title: 'Publisher & CEO', category: 'media' },
  { name: 'Jordan Bitove', organization: 'Toronto Star / NordStar', organizationTicker: null, title: 'Publisher', category: 'media' },
  { name: 'Brian Myles', organization: 'La Presse', organizationTicker: null, title: 'CEO', category: 'media' },
  // --- News agencies & associations ---
  { name: 'Heather Morrison', organization: 'Canadian Association of Broadcasters', organizationTicker: null, title: 'CEO', category: 'media' },
  { name: 'Esther Enkin', organization: 'Canadian Journalism Forum', organizationTicker: null, title: 'Executive Director', category: 'media' },
];

/* ------------------------------------------------------------------ */
/*  Lobbying Subject Categories (from registry taxonomy)               */
/* ------------------------------------------------------------------ */

export const LOBBYING_SUBJECTS = [
  'Aboriginal Affairs', 'Agriculture', 'Arts and Culture', 'Banking',
  'Budget', 'Climate', 'Consumer Issues', 'Copyright', 'COVID-19',
  'Defence', 'Economic Development', 'Education', 'Employment',
  'Energy', 'Environment', 'Finances', 'Fisheries', 'Forestry',
  'Gambling', 'Government Procurement', 'Health', 'Housing',
  'Immigration', 'Industry', 'Infrastructure', 'Insurance',
  'Intellectual Property', 'Internal Trade', 'International Relations',
  'International Trade', 'Justice', 'Labour', 'Media', 'Mining',
  'National Security', 'Natural Resources', 'Pensions', 'Pharmaceuticals',
  'Postal Service', 'Poverty', 'Privacy', 'Regional Development',
  'Religion', 'Research and Development', 'Science and Technology',
  'Seniors', 'Small Business', 'Sports', 'Taxation', 'Telecommunications',
  'Tourism', 'Transportation', 'Veterans',
] as const;

/* ------------------------------------------------------------------ */
/*  GSIN Categories (Goods and Services Identification Number)         */
/* ------------------------------------------------------------------ */

export interface GSINCategory {
  code: string;
  description: string;
}

export const HIGH_VALUE_GSIN = [
  'D301', // IT Consulting
  'D302', // Systems Development
  'D307', // Programming Services
  'R019', // Computer Services
  'N7010', // ADPE System Configuration
  'N7035', // IT Software
  'N7021', // ADP Central Processing Units
  'N7042', // Mini & Micro Computer
  'N7050', // ADP Components
  'JX', // Professional Services (Management)
  'JA', // Professional Services (Legal)
  'JB', // Professional Services (Engineering)
  'JC', // Professional Services (Architectural)
  'JG', // Professional Services (Economics)
];
