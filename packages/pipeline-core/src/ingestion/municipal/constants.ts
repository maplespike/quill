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
  { code: 'montreal',     name: 'Montreal',   province: 'QC', vendorPlatform: 'montreal-custom',  isImplemented: true, isFrench: true  },
  { code: 'calgary',      name: 'Calgary',    province: 'AB', vendorPlatform: 'escribe',          isImplemented: true, isFrench: false },
  { code: 'edmonton',     name: 'Edmonton',   province: 'AB', vendorPlatform: 'escribe',          isImplemented: true, isFrench: false },
  { code: 'ottawa',       name: 'Ottawa',     province: 'ON', vendorPlatform: 'escribe',          isImplemented: true, isFrench: false },
  { code: 'winnipeg',     name: 'Winnipeg',   province: 'MB', vendorPlatform: 'civicweb',         isImplemented: true, isFrench: false },
  { code: 'quebec-city',  name: 'Quebec City', province: 'QC', vendorPlatform: 'montreal-custom', isImplemented: true, isFrench: true  },
  { code: 'hamilton',     name: 'Hamilton',   province: 'ON', vendorPlatform: 'escribe',          isImplemented: true, isFrench: false },
  { code: 'halifax',      name: 'Halifax',    province: 'NS', vendorPlatform: 'civicweb',         isImplemented: true, isFrench: false },
  // Tier 2 cities with open data portals
  { code: 'mississauga',  name: 'Mississauga',  province: 'ON', vendorPlatform: 'html-scrape', isImplemented: true, isFrench: false },
  { code: 'surrey',       name: 'Surrey',       province: 'BC', vendorPlatform: 'html-scrape', isImplemented: true, isFrench: false },
  { code: 'london',       name: 'London',       province: 'ON', vendorPlatform: 'html-scrape', isImplemented: true, isFrench: false },
  { code: 'saskatoon',    name: 'Saskatoon',    province: 'SK', vendorPlatform: 'html-scrape', isImplemented: true, isFrench: false },
  { code: 'regina',       name: 'Regina',       province: 'SK', vendorPlatform: 'html-scrape', isImplemented: true, isFrench: false },
  // Quebec cities via Données Québec
  { code: 'laval',        name: 'Laval',        province: 'QC', vendorPlatform: 'html-scrape', isImplemented: true, isFrench: true  },
  { code: 'gatineau',     name: 'Gatineau',     province: 'QC', vendorPlatform: 'html-scrape', isImplemented: true, isFrench: true  },
  { code: 'longueuil',    name: 'Longueuil',    province: 'QC', vendorPlatform: 'html-scrape', isImplemented: true, isFrench: true  },
  { code: 'levis',        name: 'Lévis',        province: 'QC', vendorPlatform: 'html-scrape', isImplemented: true, isFrench: true  },
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
    portalType: 'ckan',
    baseUrl: 'https://vancouver.ca',
    meetingsUrl: 'https://vancouver.ca/your-government/meeting-agendas-and-minutes.aspx',
    meetingDetailUrl: null,
    agendaUrlPattern: 'https://council.vancouver.ca/{year}/Meeting{id}/agenda.pdf',
    minutesUrlPattern: 'https://council.vancouver.ca/{year}/Meeting{id}/minutes.pdf',
    budgetUrlPattern: 'https://vancouver.ca/your-government/budget-and-financial-reports.aspx',
    apiEndpoints: {
      meetingsList: 'https://vancouver.ca/your-government/meeting-agendas-and-minutes.aspx',
      calendarSearch: 'https://vancouver.ca/scripts/calendar/meetings.aspx',
      ckanBase: 'https://opendata.vancouver.ca/api/3/action',
      packageList: 'https://opendata.vancouver.ca/api/3/action/package_list',
      packageShow: 'https://opendata.vancouver.ca/api/3/action/package_show?id={id}',
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
    portalType: 'ckan',
    baseUrl: 'https://montreal.ca',
    meetingsUrl: 'https://montreal.ca/en/city-council',
    meetingDetailUrl: null,
    agendaUrlPattern: null,
    minutesUrlPattern: null,
    budgetUrlPattern: 'https://montreal.ca/en/budget',
    apiEndpoints: {
      meetingsList: 'https://montreal.ca/en/city-council',
      ckanBase: 'https://donnees.montreal.ca/api/3/action',
      packageList: 'https://donnees.montreal.ca/api/3/action/package_list',
      packageShow: 'https://donnees.montreal.ca/api/3/action/package_show?id={id}',
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
    portalType: 'socrata',
    baseUrl: 'https://www.calgary.ca',
    meetingsUrl: 'https://pub-calgary.escribemeetings.com/',
    meetingDetailUrl: 'https://pub-calgary.escribemeetings.com/Meeting.aspx?Id={meetingId}',
    agendaUrlPattern: 'https://pub-calgary.escribemeetings.com/Agenda.aspx?Id={meetingId}',
    minutesUrlPattern: 'https://pub-calgary.escribemeetings.com/Minutes.aspx?Id={meetingId}',
    budgetUrlPattern: 'https://www.calgary.ca/finance/budget.html',
    apiEndpoints: {
      escribeBase: 'https://pub-calgary.escribemeetings.com',
      socrataBase: 'https://data.calgary.ca',
      socrataViews: 'https://data.calgary.ca/api/views',
      socrataDataset: 'https://data.calgary.ca/resource/{dataset_id}.json',
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
    portalType: 'socrata',
    baseUrl: 'https://www.edmonton.ca',
    meetingsUrl: 'https://pub-edmonton.escribemeetings.com/',
    meetingDetailUrl: 'https://pub-edmonton.escribemeetings.com/Meeting.aspx?Id={meetingId}',
    agendaUrlPattern: 'https://pub-edmonton.escribemeetings.com/Agenda.aspx?Id={meetingId}',
    minutesUrlPattern: 'https://pub-edmonton.escribemeetings.com/Minutes.aspx?Id={meetingId}',
    budgetUrlPattern: 'https://www.edmonton.ca/budget',
    apiEndpoints: {
      escribeBase: 'https://pub-edmonton.escribemeetings.com',
      socrataBase: 'https://data.edmonton.ca',
      socrataViews: 'https://data.edmonton.ca/api/views',
      socrataDataset: 'https://data.edmonton.ca/resource/{dataset_id}.json',
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
    portalType: 'ckan',
    baseUrl: 'https://ottawa.ca',
    meetingsUrl: 'https://pub-ottawa.escribemeetings.com/',
    meetingDetailUrl: 'https://pub-ottawa.escribemeetings.com/Meeting.aspx?Id={meetingId}',
    agendaUrlPattern: 'https://pub-ottawa.escribemeetings.com/Agenda.aspx?Id={meetingId}',
    minutesUrlPattern: 'https://pub-ottawa.escribemeetings.com/Minutes.aspx?Id={meetingId}',
    budgetUrlPattern: 'https://ottawa.ca/en/city-hall/budget',
    apiEndpoints: {
      escribeBase: 'https://pub-ottawa.escribemeetings.com',
      ckanBase: 'https://open.ottawa.ca/api/3/action',
      packageList: 'https://open.ottawa.ca/api/3/action/package_list',
      packageShow: 'https://open.ottawa.ca/api/3/action/package_show?id={id}',
      resourceShow: 'https://open.ottawa.ca/api/3/action/resource_show?id={id}',
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
    portalType: 'socrata',
    baseUrl: 'https://www.winnipeg.ca',
    meetingsUrl: 'https://www.winnipeg.ca/council/meetings',
    meetingDetailUrl: null,
    agendaUrlPattern: null,
    minutesUrlPattern: null,
    budgetUrlPattern: 'https://www.winnipeg.ca/finance/budget',
    apiEndpoints: {
      meetingsList: 'https://www.winnipeg.ca/council/meetings',
      socrataBase: 'https://data.winnipeg.ca',
      socrataViews: 'https://data.winnipeg.ca/api/views',
      socrataDataset: 'https://data.winnipeg.ca/resource/{dataset_id}.json',
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
    portalType: 'donnees-quebec',
    baseUrl: 'https://www.ville.quebec.qc.ca',
    meetingsUrl: 'https://www.ville.quebec.qc.ca/citoyens/conseil-municipal/seances/',
    meetingDetailUrl: null,
    agendaUrlPattern: null,
    minutesUrlPattern: null,
    budgetUrlPattern: 'https://www.ville.quebec.qc.ca/finances/budget/',
    apiEndpoints: {
      meetingsList: 'https://www.ville.quebec.qc.ca/citoyens/conseil-municipal/seances/',
      donneesQuebec: 'https://www.donneesquebec.ca/api/3/action',
      orgSearch: 'https://www.donneesquebec.ca/api/3/action/organization_show?id=ville-de-quebec',
      packageList: 'https://www.donneesquebec.ca/api/3/action/package_list',
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
    portalType: 'arcgis-hub',
    baseUrl: 'https://www.hamilton.ca',
    meetingsUrl: 'https://pub-hamilton.escribemeetings.com/',
    meetingDetailUrl: 'https://pub-hamilton.escribemeetings.com/Meeting.aspx?Id={meetingId}',
    agendaUrlPattern: 'https://pub-hamilton.escribemeetings.com/Agenda.aspx?Id={meetingId}',
    minutesUrlPattern: 'https://pub-hamilton.escribemeetings.com/Minutes.aspx?Id={meetingId}',
    budgetUrlPattern: 'https://www.hamilton.ca/budget',
    apiEndpoints: {
      escribeBase: 'https://pub-hamilton.escribemeetings.com',
      arcgisHubSearch: 'https://open.hamilton.ca/api/search/definition/',
      arcgisHubBase: 'https://open.hamilton.ca',
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
    portalType: 'arcgis-hub',
    baseUrl: 'https://www.halifax.ca',
    meetingsUrl: 'https://www.halifax.ca/city-hall/agendas-minutes',
    meetingDetailUrl: null,
    agendaUrlPattern: null,
    minutesUrlPattern: null,
    budgetUrlPattern: 'https://www.halifax.ca/budget',
    apiEndpoints: {
      meetingsList: 'https://www.halifax.ca/city-hall/agendas-minutes',
      arcgisHubSearch: 'https://data-hrm.hub.arcgis.com/api/search/definition/',
      arcgisHubBase: 'https://data-hrm.hub.arcgis.com',
    },
    customHeaders: {
      'User-Agent': 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)',
    },
    meetingIdPattern: '',
    timezone: 'America/Halifax',
    isFrench: false,
  },

  /* ================ MISSISSAUGA ================ */
  mississauga: {
    city: 'mississauga',
    name: 'Mississauga',
    province: 'ON',
    vendorPlatform: null,
    portalType: 'custom-api',
    baseUrl: 'https://www.mississauga.ca',
    meetingsUrl: 'https://www.mississauga.ca/city-council/',
    meetingDetailUrl: null,
    agendaUrlPattern: null,
    minutesUrlPattern: null,
    budgetUrlPattern: 'https://www.mississauga.ca/budget/',
    apiEndpoints: {
      dataPortal: 'https://data.mississauga.ca',
      searchApi: 'https://data.mississauga.ca/api/search/definition/',
    },
    customHeaders: { 'User-Agent': 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)' },
    meetingIdPattern: '',
    timezone: 'America/Toronto',
    isFrench: false,
  },

  /* ================ SURREY (BC) ================ */
  surrey: {
    city: 'surrey',
    name: 'Surrey',
    province: 'BC',
    vendorPlatform: null,
    portalType: 'arcgis-hub',
    baseUrl: 'https://www.surrey.ca',
    meetingsUrl: 'https://www.surrey.ca/city-government/meetings',
    meetingDetailUrl: null,
    agendaUrlPattern: null,
    minutesUrlPattern: null,
    budgetUrlPattern: 'https://www.surrey.ca/budget',
    apiEndpoints: {
      arcgisHubSearch: 'https://opendata-surrey.hub.arcgis.com/api/search/definition/',
      arcgisMapServer: 'https://gisservices.surrey.ca/arcgis/rest/services/OpenData/MapServer',
      arcgisHubBase: 'https://opendata-surrey.hub.arcgis.com',
    },
    customHeaders: { 'User-Agent': 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)' },
    meetingIdPattern: '',
    timezone: 'America/Vancouver',
    isFrench: false,
  },

  /* ================ LONDON (ON) ================ */
  london: {
    city: 'london',
    name: 'London',
    province: 'ON',
    vendorPlatform: null,
    portalType: 'custom-api',
    baseUrl: 'https://london.ca',
    meetingsUrl: 'https://london.ca/city-hall/meetings',
    meetingDetailUrl: null,
    agendaUrlPattern: null,
    minutesUrlPattern: null,
    budgetUrlPattern: 'https://london.ca/budget',
    apiEndpoints: {
      dataPortal: 'https://opendata.london.ca',
      searchApi: 'https://opendata.london.ca/api/search/definition/',
    },
    customHeaders: { 'User-Agent': 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)' },
    meetingIdPattern: '',
    timezone: 'America/Toronto',
    isFrench: false,
  },

  /* ================ SASKATOON ================ */
  saskatoon: {
    city: 'saskatoon',
    name: 'Saskatoon',
    province: 'SK',
    vendorPlatform: null,
    portalType: 'socrata',
    baseUrl: 'https://www.saskatoon.ca',
    meetingsUrl: 'https://www.saskatoon.ca/city-hall/meetings',
    meetingDetailUrl: null,
    agendaUrlPattern: null,
    minutesUrlPattern: null,
    budgetUrlPattern: 'https://www.saskatoon.ca/budget',
    apiEndpoints: {
      dataPortal: 'https://data.saskatoon.ca',
      socrataBase: 'https://data.saskatoon.ca',
      socrataViews: 'https://data.saskatoon.ca/api/views',
      socrataDataset: 'https://data.saskatoon.ca/resource/{dataset_id}.json',
    },
    customHeaders: { 'User-Agent': 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)' },
    meetingIdPattern: '',
    timezone: 'America/Regina',
    isFrench: false,
  },

  /* ================ REGINA ================ */
  regina: {
    city: 'regina',
    name: 'Regina',
    province: 'SK',
    vendorPlatform: null,
    portalType: 'ckan',
    baseUrl: 'https://www.regina.ca',
    meetingsUrl: 'https://www.regina.ca/city-government/meetings',
    meetingDetailUrl: null,
    agendaUrlPattern: null,
    minutesUrlPattern: null,
    budgetUrlPattern: 'https://www.regina.ca/budget',
    apiEndpoints: {
      dataPortal: 'https://open.regina.ca',
      ckanBase: 'https://open.regina.ca/api/3/action',
      packageList: 'https://open.regina.ca/api/3/action/package_list',
    },
    customHeaders: { 'User-Agent': 'MapleSpikePipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)' },
    meetingIdPattern: '',
    timezone: 'America/Regina',
    isFrench: false,
  },

  // Quebec cities all route through the provincial Données Québec CKAN
  /* ================ LAVAL (via Données Québec) ================ */
  laval: {
    city: 'laval', name: 'Laval', province: 'QC', vendorPlatform: null,
    portalType: 'donnees-quebec',
    baseUrl: 'https://www.laval.ca', meetingsUrl: '', meetingDetailUrl: null,
    agendaUrlPattern: null, minutesUrlPattern: null, budgetUrlPattern: '',
    apiEndpoints: {
      donneesQuebec: 'https://www.donneesquebec.ca/api/3/action',
      orgSearch: 'https://www.donneesquebec.ca/api/3/action/organization_show?id=ville-de-laval',
    },
    customHeaders: { 'User-Agent': 'MapleSpikePipeline/0.1', 'Accept-Language': 'fr-CA,fr;q=0.9' },
    meetingIdPattern: '', timezone: 'America/Montreal', isFrench: true,
  },

  /* ================ GATINEAU (via Données Québec) ================ */
  gatineau: {
    city: 'gatineau', name: 'Gatineau', province: 'QC', vendorPlatform: null,
    portalType: 'donnees-quebec',
    baseUrl: 'https://www.gatineau.ca', meetingsUrl: '', meetingDetailUrl: null,
    agendaUrlPattern: null, minutesUrlPattern: null, budgetUrlPattern: '',
    apiEndpoints: {
      donneesQuebec: 'https://www.donneesquebec.ca/api/3/action',
      orgSearch: 'https://www.donneesquebec.ca/api/3/action/organization_show?id=ville-de-gatineau',
    },
    customHeaders: { 'User-Agent': 'MapleSpikePipeline/0.1', 'Accept-Language': 'fr-CA,fr;q=0.9' },
    meetingIdPattern: '', timezone: 'America/Montreal', isFrench: true,
  },

  /* ================ LONGUEUIL (via Données Québec) ================ */
  longueuil: {
    city: 'longueuil', name: 'Longueuil', province: 'QC', vendorPlatform: null,
    portalType: 'donnees-quebec',
    baseUrl: 'https://www.longueuil.quebec', meetingsUrl: '', meetingDetailUrl: null,
    agendaUrlPattern: null, minutesUrlPattern: null, budgetUrlPattern: '',
    apiEndpoints: {
      donneesQuebec: 'https://www.donneesquebec.ca/api/3/action',
      orgSearch: 'https://www.donneesquebec.ca/api/3/action/organization_show?id=ville-de-longueuil',
    },
    customHeaders: { 'User-Agent': 'MapleSpikePipeline/0.1', 'Accept-Language': 'fr-CA,fr;q=0.9' },
    meetingIdPattern: '', timezone: 'America/Montreal', isFrench: true,
  },

  /* ================ LÉVIS (via Données Québec) ================ */
  levis: {
    city: 'levis', name: 'Lévis', province: 'QC', vendorPlatform: null,
    portalType: 'donnees-quebec',
    baseUrl: 'https://www.levis.ca', meetingsUrl: '', meetingDetailUrl: null,
    agendaUrlPattern: null, minutesUrlPattern: null, budgetUrlPattern: '',
    apiEndpoints: {
      donneesQuebec: 'https://www.donneesquebec.ca/api/3/action',
      orgSearch: 'https://www.donneesquebec.ca/api/3/action/organization_show?id=ville-de-levis',
    },
    customHeaders: { 'User-Agent': 'MapleSpikePipeline/0.1', 'Accept-Language': 'fr-CA,fr;q=0.9' },
    meetingIdPattern: '', timezone: 'America/Montreal', isFrench: true,
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
