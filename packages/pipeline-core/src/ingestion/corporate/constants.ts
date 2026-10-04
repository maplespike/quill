/**
 * Corporate Constants — Quill
 *
 * Known URLs for Canadian corporate public-data sources
 * and a curated list of tracked entities.
 */

/* ------------------------------------------------------------------ */
/*  URL Patterns                                                       */
/* ------------------------------------------------------------------ */

export const CORPORATE_SOURCES = {
  /**
   * Federal Lobbying Registry (Office of the Commissioner of Lobbying).
   *
   * The registry's own hosts are behind a Cloudflare WAF that answers 403 to
   * every non-browser client — both `lobbycanada.gc.ca/app/secure/ocr/...`
   * (monthly communication CSVs) and the bulk
   * `lobbycanada.gc.ca/media/.../registrations_...zip`. The open.canada.ca
   * CKAN entry for the dataset resolves (200) and is the only machine-readable
   * descriptor, but its sole data resource is a link back to the blocked host,
   * so the records themselves are NOT reachable from this fleet. Fetchers use
   * the CKAN entry to discover resources and report the block loudly.
   */
  LOBBYING: {
    BASE: 'https://lobbycanada.gc.ca',
    /** CKAN dataset id for "Lobbying Registrations" (metadata reachable). */
    CKAN_DATASET_ID: '70ef2117-1095-4d77-80eb-b87f2bada2a4',
    /** CKAN package_show — verified 200; the data resource it returns is WAF-blocked. */
    CKAN_PACKAGE_SHOW: 'https://open.canada.ca/data/api/3/action/package_show?id=70ef2117-1095-4d77-80eb-b87f2bada2a4',
    SEARCH: 'https://lobbycanada.gc.ca/app/secure/ocr/lobbyistsregistry/registrationsearch.shtml',
    /** Monthly registered communication CSV reports — 403 (Cloudflare WAF). */
    MONTHLY_CSV: 'https://lobbycanada.gc.ca/app/secure/ocr/lobbyistsregistry/communicationscsv.shtml',
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
    /**
     * Proactive disclosure — contracts over $10K. This is a CKAN dataset whose
     * "Contracts over $10,000" resource is datastore-active, so it can be
     * queried row-by-row. (The old `canadabuys.canada.ca/notices/rss` feed
     * returns 404 at every candidate path — CanadaBuys publishes no RSS.)
     */
    OPEN_DATA_DATASET_ID: 'd8f85d91-7dec-4fd1-8055-483b77225d8b',
    CKAN_DATASTORE_SEARCH: 'https://open.canada.ca/data/api/3/action/datastore_search',
    /** Resource id of the datastore-backed "Contracts over $10,000" table. */
    CONTRACTS_RESOURCE_ID: 'fac950c0-00d5-4ec1-a4d3-9cbebf98a305',
    OPEN_DATA: 'https://open.canada.ca/data/en/dataset/d8f85d91-7dec-4fd1-8055-483b77225d8b',
  },

  /** Corporations Canada */
  CORPORATIONS: {
    /** HTML search page — JS-driven, returns 302 with no result table. */
    BASE: 'https://ised-isde.canada.ca/cc/lc/gcrecherche-recherche.html',
    /**
     * Federal Corporation JSON API (documented at
     * ised-isde.canada.ca/site/corporations-canada/en/accessing-federal-corporation-json-datasets).
     * `{corporationId}` is the Corporations Canada corporation number.
     * Verified 200 for e.g. 1007 → Abbotsford Chamber of Commerce.
     */
    API_TEMPLATE: 'https://www.ic.gc.ca/app/scr/cc/CorporationsCanada/api/corporations/{id}.json?lang=eng',
    API_DOCS: 'https://ised-isde.canada.ca/site/corporations-canada/en/accessing-federal-corporation-json-datasets',
    /** Open Data — federal corporations dataset (103 MB CSV dumps, not a feed). */
    OPEN_DATA: 'https://open.canada.ca/data/en/dataset/0032ce54-c5dd-4b66-99a0-320a7b5e99f2',
  },

  /** Open Canada CKAN search templates */
  CKAN: {
    /** CKAN 3 action API (the legacy search.open.canada.ca Solr endpoint 404s). */
    SEARCH: 'https://open.canada.ca/data/api/3/action/package_search',
    PACKAGE: 'https://open.canada.ca/data/api/3/action/package_show',
    /** Proactive disclosure — contracts over $10K (datastore-backed). */
    PROACTIVE_DISCLOSURE:
      'https://open.canada.ca/data/api/3/action/datastore_search' +
      '?resource_id=fac950c0-00d5-4ec1-a4d3-9cbebf98a305&limit=100',
  },

  /** SEDI (insider trading reports) — bot-walled, see sedi.ts. */
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

  /**
   * Media company RSS / IR feeds (for executive statement tracking).
   *
   * Only feeds verified reachable are listed. The dead ones this block used to
   * carry are recorded so they are not re-added blind:
   *   - GlobeNewswire `RssFeed/{org}/en` → HTTP 400 (and the organization
   *     variant fails to connect at all)
   *   - cbc.ca/mediacentre/rss → 404 after redirect
   *   - corusent.com/news/feed, bce.ca/news-and-media/feed → 404
   *   - rogersmediainc.com → gone from DNS (EAI_AGAIN)
   *   - quebecor.com/en/press-releases/feed → 200 but an HTML page with no items
   *   - newswire.ca/rss → 404
   */
  MEDIA: {
    /** Postmedia corporate news — verified 200, RSS with items. */
    POSTMEDIA_CORP: 'https://www.postmedia.com/category/news/feed/',
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
