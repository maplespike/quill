/**
 * Municipal Council Data Constants — MapleSpike Pipeline
 *
 * Known city URLs, vendor platform patterns, default city configurations,
 * and URL builder utilities for Canadian municipal council data.
 *
 * Each city uses different systems — this file centralises that knowledge.
 */

import type { CityCode, CityConfig, CityInfo, VendorPlatform } from './types.js';


/* ------------------------------------------------------------------ */
/*  All Target Cities                                                  */
/* ------------------------------------------------------------------ */

export const ALL_CITIES: CityInfo[] = [
  { code: 'toronto',      name: 'Toronto',    province: 'ON', vendorPlatform: 'toronto-custom',   isImplemented: true,  isFrench: false },
  { code: 'vancouver',    name: 'Vancouver',  province: 'BC', vendorPlatform: 'vancouver-custom', isImplemented: true,  isFrench: false },
  { code: 'montreal',     name: 'Montreal',   province: 'QC', vendorPlatform: 'montreal-custom',  isImplemented: false, isFrench: true  },
  { code: 'calgary',      name: 'Calgary',    province: 'AB', vendorPlatform: 'escribe',          isImplemented: false, isFrench: false },
  { code: 'edmonton',     name: 'Edmonton',   province: 'AB', vendorPlatform: 'escribe',          isImplemented: false, isFrench: false },
  { code: 'ottawa',       name: 'Ottawa',     province: 'ON', vendorPlatform: 'escribe',          isImplemented: false, isFrench: false },
  { code: 'winnipeg',     name: 'Winnipeg',   province: 'MB', vendorPlatform: 'civicweb',         isImplemented: false, isFrench: false },
  { code: 'quebec-city',  name: 'Quebec City', province: 'QC', vendorPlatform: 'montreal-custom', isImplemented: false, isFrench: true  },
  { code: 'hamilton',     name: 'Hamilton',   province: 'ON', vendorPlatform: 'escribe',          isImplemented: false, isFrench: false },
  { code: 'halifax',      name: 'Halifax',    province: 'NS', vendorPlatform: 'civicweb',         isImplemented: false, isFrench: false },
] as const;

/** Only cities with full implementation */
export const IMPLEMENTED_CITIES: CityInfo[] = ALL_CITIES.filter(c => c.isImplemented);


/* ------------------------------------------------------------------ */
/*  City-Specific Configurations                                       */
/* ------------------------------------------------------------------ */

export const CITY_CONFIGS: Record<CityCode, CityConfig> = {
  /* ================ TORONTO ================ */
  toronto: {
    city: 'toronto',
    name: 'Toronto',
    province: 'ON',
    vendorPlatform: 'toronto-custom',
    baseUrl: 'https://www.toronto.ca',
    meetingsUrl: 'https://www.toronto.ca/city-government/council/meeting-agendas/',
    meetingDetailUrl: 'https://www.toronto.ca/city-government/council/meeting-agendas/{meetingId}',
    agendaUrlPattern: 'https://www.toronto.ca/legdocs/mmis/{year}/{month}/agendas/{meetingId}.pdf',
    minutesUrlPattern: 'https://www.toronto.ca/legdocs/mmis/{year}/{month}/minutes/{meetingId}.pdf',
    budgetUrlPattern: 'https://www.toronto.ca/city-government/budget-finances/',
    apiEndpoints: {
      // Toronto has no public API — relies on HTML scraping
      meetingsList: 'https://www.toronto.ca/city-government/council/meeting-agendas/',
      calendarRss: 'https://www.toronto.ca/city-government/council/meeting-agendas/feed/',
    },
    customHeaders: {
      'User-Agent': 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
    },
    meetingIdPattern: '/city-government/council/meeting-agendas/([^/]+)',
    timezone: 'America/Toronto',
    isFrench: false,
  },

  /* ================ VANCOUVER ================ */
  vancouver: {
    city: 'vancouver',
    name: 'Vancouver',
    province: 'BC',
    vendorPlatform: 'vancouver-custom',
    baseUrl: 'https://vancouver.ca',
    meetingsUrl: 'https://vancouver.ca/your-government/meeting-agendas-and-minutes.aspx',
    meetingDetailUrl: null,
    agendaUrlPattern: 'https://council.vancouver.ca/{year}/Meeting{id}/agenda.pdf',
    minutesUrlPattern: 'https://council.vancouver.ca/{year}/Meeting{id}/minutes.pdf',
    budgetUrlPattern: 'https://vancouver.ca/your-government/budget-and-financial-reports.aspx',
    apiEndpoints: {
      meetingsList: 'https://vancouver.ca/your-government/meeting-agendas-and-minutes.aspx',
      // Vancouver also uses a searchable calendar
      calendarSearch: 'https://vancouver.ca/scripts/calendar/meetings.aspx',
    },
    customHeaders: {
      'User-Agent': 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
    },
    meetingIdPattern: 'Meeting(\\d+)',
    timezone: 'America/Vancouver',
    isFrench: false,
  },

  /* ================ MONTREAL ================ */
  montreal: {
    city: 'montreal',
    name: 'Montreal',
    province: 'QC',
    vendorPlatform: 'montreal-custom',
    baseUrl: 'https://montreal.ca',
    meetingsUrl: 'https://montreal.ca/en/city-council',
    meetingDetailUrl: null,
    agendaUrlPattern: null,
    minutesUrlPattern: null,
    budgetUrlPattern: 'https://montreal.ca/en/budget',
    apiEndpoints: {
      // Montreal's open data portal may have council data
      meetingsList: 'https://montreal.ca/en/city-council',
      openData: 'https://donnees.montreal.ca/',
    },
    customHeaders: {
      'User-Agent': 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
      'Accept-Language': 'fr-CA,fr;q=0.9,en-CA;q=0.8',
    },
    meetingIdPattern: '',
    timezone: 'America/Montreal',
    isFrench: true,
  },

  /* ================ CALGARY ================ */
  calgary: {
    city: 'calgary',
    name: 'Calgary',
    province: 'AB',
    vendorPlatform: 'escribe',
    baseUrl: 'https://www.calgary.ca',
    meetingsUrl: 'https://pub-calgary.escribemeetings.com/',
    meetingDetailUrl: 'https://pub-calgary.escribemeetings.com/Meeting.aspx?Id={meetingId}',
    agendaUrlPattern: 'https://pub-calgary.escribemeetings.com/Agenda.aspx?Id={meetingId}',
    minutesUrlPattern: 'https://pub-calgary.escribemeetings.com/Minutes.aspx?Id={meetingId}',
    budgetUrlPattern: 'https://www.calgary.ca/finance/budget.html',
    apiEndpoints: {
      escribeBase: 'https://pub-calgary.escribemeetings.com',
      // eScribe API endpoints (if exposed)
    },
    customHeaders: {
      'User-Agent': 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
    },
    meetingIdPattern: 'Id=(\\d+)',
    timezone: 'America/Edmonton',
    isFrench: false,
  },

  /* ================ EDMONTON ================ */
  edmonton: {
    city: 'edmonton',
    name: 'Edmonton',
    province: 'AB',
    vendorPlatform: 'escribe',
    baseUrl: 'https://www.edmonton.ca',
    meetingsUrl: 'https://pub-edmonton.escribemeetings.com/',
    meetingDetailUrl: 'https://pub-edmonton.escribemeetings.com/Meeting.aspx?Id={meetingId}',
    agendaUrlPattern: 'https://pub-edmonton.escribemeetings.com/Agenda.aspx?Id={meetingId}',
    minutesUrlPattern: 'https://pub-edmonton.escribemeetings.com/Minutes.aspx?Id={meetingId}',
    budgetUrlPattern: 'https://www.edmonton.ca/budget',
    apiEndpoints: {
      escribeBase: 'https://pub-edmonton.escribemeetings.com',
    },
    customHeaders: {
      'User-Agent': 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
    },
    meetingIdPattern: 'Id=(\\d+)',
    timezone: 'America/Edmonton',
    isFrench: false,
  },

  /* ================ OTTAWA ================ */
  ottawa: {
    city: 'ottawa',
    name: 'Ottawa',
    province: 'ON',
    vendorPlatform: 'escribe',
    baseUrl: 'https://ottawa.ca',
    meetingsUrl: 'https://pub-ottawa.escribemeetings.com/',
    meetingDetailUrl: 'https://pub-ottawa.escribemeetings.com/Meeting.aspx?Id={meetingId}',
    agendaUrlPattern: 'https://pub-ottawa.escribemeetings.com/Agenda.aspx?Id={meetingId}',
    minutesUrlPattern: 'https://pub-ottawa.escribemeetings.com/Minutes.aspx?Id={meetingId}',
    budgetUrlPattern: 'https://ottawa.ca/en/city-hall/budget',
    apiEndpoints: {
      escribeBase: 'https://pub-ottawa.escribemeetings.com',
    },
    customHeaders: {
      'User-Agent': 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
    },
    meetingIdPattern: 'Id=(\\d+)',
    timezone: 'America/Toronto',
    isFrench: false,
  },

  /* ================ WINNIPEG ================ */
  winnipeg: {
    city: 'winnipeg',
    name: 'Winnipeg',
    province: 'MB',
    vendorPlatform: 'civicweb',
    baseUrl: 'https://www.winnipeg.ca',
    meetingsUrl: 'https://www.winnipeg.ca/council/meetings',
    meetingDetailUrl: null,
    agendaUrlPattern: null,
    minutesUrlPattern: null,
    budgetUrlPattern: 'https://www.winnipeg.ca/finance/budget',
    apiEndpoints: {
      meetingsList: 'https://www.winnipeg.ca/council/meetings',
      // CivicWeb may have an API
    },
    customHeaders: {
      'User-Agent': 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
    },
    meetingIdPattern: '',
    timezone: 'America/Winnipeg',
    isFrench: false,
  },

  /* ================ QUEBEC CITY ================ */
  'quebec-city': {
    city: 'quebec-city',
    name: 'Quebec City',
    province: 'QC',
    vendorPlatform: 'montreal-custom',
    baseUrl: 'https://www.ville.quebec.qc.ca',
    meetingsUrl: 'https://www.ville.quebec.qc.ca/citoyens/conseil-municipal/seances/',
    meetingDetailUrl: null,
    agendaUrlPattern: null,
    minutesUrlPattern: null,
    budgetUrlPattern: 'https://www.ville.quebec.qc.ca/finances/budget/',
    apiEndpoints: {
      meetingsList: 'https://www.ville.quebec.qc.ca/citoyens/conseil-municipal/seances/',
    },
    customHeaders: {
      'User-Agent': 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
      'Accept-Language': 'fr-CA,fr;q=0.9',
    },
    meetingIdPattern: '',
    timezone: 'America/Montreal',
    isFrench: true,
  },

  /* ================ HAMILTON ================ */
  hamilton: {
    city: 'hamilton',
    name: 'Hamilton',
    province: 'ON',
    vendorPlatform: 'escribe',
    baseUrl: 'https://www.hamilton.ca',
    meetingsUrl: 'https://pub-hamilton.escribemeetings.com/',
    meetingDetailUrl: 'https://pub-hamilton.escribemeetings.com/Meeting.aspx?Id={meetingId}',
    agendaUrlPattern: 'https://pub-hamilton.escribemeetings.com/Agenda.aspx?Id={meetingId}',
    minutesUrlPattern: 'https://pub-hamilton.escribemeetings.com/Minutes.aspx?Id={meetingId}',
    budgetUrlPattern: 'https://www.hamilton.ca/budget',
    apiEndpoints: {
      escribeBase: 'https://pub-hamilton.escribemeetings.com',
    },
    customHeaders: {
      'User-Agent': 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
    },
    meetingIdPattern: 'Id=(\\d+)',
    timezone: 'America/Toronto',
    isFrench: false,
  },

  /* ================ HALIFAX ================ */
  halifax: {
    city: 'halifax',
    name: 'Halifax',
    province: 'NS',
    vendorPlatform: 'civicweb',
    baseUrl: 'https://www.halifax.ca',
    meetingsUrl: 'https://www.halifax.ca/city-hall/agendas-minutes',
    meetingDetailUrl: null,
    agendaUrlPattern: null,
    minutesUrlPattern: null,
    budgetUrlPattern: 'https://www.halifax.ca/budget',
    apiEndpoints: {
      meetingsList: 'https://www.halifax.ca/city-hall/agendas-minutes',
    },
    customHeaders: {
      'User-Agent': 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
    },
    meetingIdPattern: '',
    timezone: 'America/Halifax',
    isFrench: false,
  },
};


/* ------------------------------------------------------------------ */
/*  Vendor Platform Detection Patterns                                 */
/* ------------------------------------------------------------------ */

/**
 * URL patterns that indicate a city uses a particular vendor platform.
 * Used for automatic detection and routing in fetchers.
 */
export const VENDOR_PLATFORM_PATTERNS: Record<VendorPlatform, RegExp[]> = {
  escribe: [
    /escribemeetings\.com/i,
    /escribeonline\.com/i,
  ],
  icompass: [
    /icompass\.ca/i,
    /icoms\.ca/i,
  ],
  civicweb: [
    /civicweb\.net/i,
    /civicweb\.com/i,
  ],
  opencouncil: [
    /opengovernment\.org/i,
  ],
  'toronto-custom': [
    /toronto\.ca\/city-government\/council/i,
    /toronto\.ca\/legdocs\/mmis/i,
  ],
  'vancouver-custom': [
    /vancouver\.ca\/your-government/i,
    /council\.vancouver\.ca/i,
  ],
  'montreal-custom': [
    /montreal\.ca\/.*conseil/i,
    /ville\.quebec\.qc\.ca\/conseil/i,
  ],
  'html-scrape': [
    /.*/,
  ],
};


/* ------------------------------------------------------------------ */
/*  Meeting Type Detection Keywords                                    */
/* ------------------------------------------------------------------ */

/**
 * Maps keywords found in meeting titles/descriptions to canonical
 * MeetingType values.  Checked case-insensitively.
 */
export const MEETING_TYPE_KEYWORDS: Record<string, string> = {
  // Council
  'city council': 'council',
  'conseil municipal': 'council',
  'council meeting': 'council',
  'regular council': 'council',
  'special council': 'council',
  'statutory council': 'council',

  // Committee
  'committee': 'committee',
  'comité': 'committee',
  'commission': 'committee',
  'standing committee': 'standing-committee',
  'sub-committee': 'sub-committee',
  'subcommittee': 'sub-committee',
  'task force': 'task-force',
  'taskforce': 'task-force',

  // Board
  'board': 'board',
  'board of': 'board',
  'conseil d\'administration': 'board',

  // Advisory
  'advisory': 'advisory',
  'advisory committee': 'advisory',
  'working group': 'advisory',
  'groupe de travail': 'advisory',

  // Public hearing
  'public hearing': 'public-hearing',
  'audience publique': 'public-hearing',
  'town hall': 'public-hearing',

  // Budget
  'budget': 'budget',
  'budget committee': 'budget',
  'budget meeting': 'budget',
};

/* Decision type detection keywords */
export const DECISION_TYPE_KEYWORDS: Record<string, string> = {
  'approved': 'approved',
  'adopted': 'approved',
  'carried': 'approved',
  'passed': 'approved',
  'agreed': 'approved',
  'adopté': 'approved',
  'approuvé': 'approved',

  'defeated': 'defeated',
  'rejected': 'defeated',
  'failed': 'defeated',
  'rejeté': 'defeated',

  'deferred': 'deferred',
  'postponed': 'deferred',
  'reporté': 'deferred',

  'amended': 'amended',
  'modifié': 'amended',

  'referred': 'referred',
  'referred to': 'referred',
  'renvoyé': 'referred',

  'withdrawn': 'withdrawn',
  'retiré': 'withdrawn',

  'tabled': 'tabled',
  'table': 'tabled',

  'out of order': 'ruled-out-of-order',
  'ruled out': 'ruled-out-of-order',
  'irrecevable': 'ruled-out-of-order',
};


/* ------------------------------------------------------------------ */
/*  URL Builders                                                       */
/* ------------------------------------------------------------------ */

/**
 * Build a city's meeting list URL for a given year.
 */
export function meetingsListUrl(city: CityCode, year?: number): string {
  const config = CITY_CONFIGS[city];
  const url = config.meetingsUrl;
  if (year) {
    return url.replace('{year}', String(year));
  }
  return url;
}

/**
 * Build a meeting detail URL for a specific meeting ID.
 */
export function meetingDetailUrl(city: CityCode, meetingId: string): string | null {
  const config = CITY_CONFIGS[city];
  if (!config.meetingDetailUrl) return null;
  return config.meetingDetailUrl.replace('{meetingId}', encodeURIComponent(meetingId));
}

/**
 * Build an agenda PDF URL for a meeting.
 */
export function agendaUrl(city: CityCode, meetingId: string, year: number, month?: number): string | null {
  const config = CITY_CONFIGS[city];
  if (!config.agendaUrlPattern) return null;
  return config.agendaUrlPattern
    .replace('{year}', String(year))
    .replace('{month}', month ? String(month).padStart(2, '0') : '01')
    .replace('{meetingId}', encodeURIComponent(meetingId))
    .replace('{id}', encodeURIComponent(meetingId));
}

/**
 * Build a minutes PDF URL for a meeting.
 */
export function minutesUrl(city: CityCode, meetingId: string, year: number, month?: number): string | null {
  const config = CITY_CONFIGS[city];
  if (!config.minutesUrlPattern) return null;
  return config.minutesUrlPattern
    .replace('{year}', String(year))
    .replace('{month}', month ? String(month).padStart(2, '0') : '01')
    .replace('{meetingId}', encodeURIComponent(meetingId))
    .replace('{id}', encodeURIComponent(meetingId));
}


/* ------------------------------------------------------------------ */
/*  Utility                                                            */
/* ------------------------------------------------------------------ */

/**
 * Detect the vendor platform from a URL string.
 */
export function detectVendorPlatform(url: string): VendorPlatform {
  for (const [platform, patterns] of Object.entries(VENDOR_PLATFORM_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(url)) {
        return platform as VendorPlatform;
      }
    }
  }
  return 'html-scrape';
}

/**
 * Get the config for a city, throwing if not found.
 */
export function getCityConfig(city: CityCode): CityConfig {
  const config = CITY_CONFIGS[city];
  if (!config) {
    throw new MunicipalCouncilError(`Unknown city: ${city}`);
  }
  return config;
}

/**
 * Check if a city is implemented (has custom fetcher/parser).
 */
export function isCityImplemented(city: CityCode): boolean {
  const info = ALL_CITIES.find(c => c.code === city);
  return info?.isImplemented ?? false;
}


/* ------------------------------------------------------------------ */
/*  Errors                                                             */
/* ------------------------------------------------------------------ */

export class MunicipalCouncilError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly city?: CityCode,
  ) {
    super(message);
    this.name = 'MunicipalCouncilError';
  }
}

export class NotYetImplementedError extends Error {
  constructor(city: CityCode) {
    super(`City ${city} is not yet implemented. Only Toronto and Vancouver are implemented.`);
    this.name = 'NotYetImplementedError';
  }
}
