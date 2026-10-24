/**
 * Quill — declarative upstream-maintenance config.
 *
 * Source of truth for "which government hosts do we depend on, what does a
 * probe look like, when is downtime expected, and what may we say about it".
 * Mirrors `quill-hermes/UPSTREAM-OUTAGES.md` §6.1; the evidence behind each
 * window, incident and source URL is in that report.
 *
 * Rules this file must keep (report §6.2):
 *   - No expected-back time lives in UI code. Windows carry it; observed
 *     downtime does not invent one.
 *   - `typicalRecoveryMinutes` is a MEASURED p50 from the 2026-10 outage window,
 *     and copy that uses it must say "usually". It never becomes an ETA.
 *   - A `data_lock` is `partial`, never `down`: StatCan answers 409 while it
 *     rebuilds tables, which means the service is up.
 *   - `watchWindows` raise logging/alertness only. One occurrence is not a
 *     pattern, so they never produce a user banner.
 *   - `contentRefresh` is publishing cadence, not downtime.
 *
 * Because it is a TypeScript module, a bad cron or an unknown field fails the
 * build and the boot, not a cron job at 03:00. `validateConfig()` runs at
 * startup and in CI.
 */

import { parseCron } from './time.js';

export type UpstreamCopy = {
  downEn?: string;
  downFr?: string;
  degradedEn?: string;
  degradedFr?: string;
  partialEn?: string;
  partialFr?: string;
};

export interface UpstreamLabel {
  en: string;
  fr: string;
}

export interface UpstreamWindow {
  /** `maintenance` = declared outage; `data_lock` = partial content freeze. */
  kind: 'maintenance' | 'data_lock';
  /** Five-field cron, wall clock in `timezone`. */
  cron: string;
  durationMinutes: number;
  /** IANA zone, e.g. America/Toronto. */
  timezone: string;
  /** Statuses that still mean "up" inside the window (StatCan: 200 and 409). */
  expectStatus?: number[];
  /** Where the maintenance schedule is published. */
  source?: string;
  messageEn: string;
  messageFr: string;
}

export interface UpstreamWatchWindow {
  cron: string;
  durationMinutes: number;
  timezone: string;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface UpstreamAnnouncedIncident {
  state: 'open' | 'closed';
  /** ISO instant the announcement became effective. */
  since: string;
  source: string;
  messageEn: string;
  messageFr: string;
}

export interface UpstreamContentRefresh {
  cron: string;
  timezone: string;
  everyNWeeks?: number;
  note: string;
  source?: string;
}

export interface UpstreamProbe {
  url: string;
  expect: {
    /** Exact status, or the first entry of a list when the window allows more. */
    status?: number;
    /** Dotted path that must exist in a JSON body, e.g. `$.result.results`. */
    jsonHasPath?: string;
    /** Substring the body must contain, e.g. `<item>`. */
    bodyMatches?: string;
  };
}

export interface UpstreamHost {
  id: string;
  /** Primary hostname as it appears in copy and logs. */
  host: string;
  /** Alternate hostnames that serve the same content (open/ouvert). */
  aliases?: string[];
  /** Human label, used to build generic copy for hosts without bespoke text. */
  label?: UpstreamLabel;
  probe: UpstreamProbe;
  /** Features this host breaks when it is not up. */
  affects: string[];
  windows: UpstreamWindow[];
  watchWindows?: UpstreamWatchWindow[];
  announcedIncident?: UpstreamAnnouncedIncident;
  contentRefresh?: UpstreamContentRefresh;
  /** Measured p50 recovery, minutes. Copy must say "usually". */
  typicalRecoveryMinutes?: number;
  /**
   * The host rejects our traffic by policy (403) and no window will help.
   * State is `blocked_permanent`: logged and filed, never shown as a user
   * banner (report §6.2 rule 7).
   */
  blockedPermanent?: boolean;
  copy?: UpstreamCopy;
}

export interface UpstreamMaintenanceConfig {
  version: 1;
  defaultTimezone: string;
  probe: {
    /** Informational: the in-process prober uses `intervalSeconds`. */
    schedule: string;
    timeoutMs: number;
    rollingWindowSeconds: number;
    /** Failures inside the rolling window that mean DOWN. */
    downAfterFailures: number;
    /** Consecutive 200s required to leave DOWN (hysteresis). */
    upAfterSuccesses: number;
    /** Slow but working. */
    degradedIfP95MsOver: number;
    /** How often the in-process prober runs. */
    intervalSeconds: number;
  };
  hosts: UpstreamHost[];
}

const TORONTO = 'America/Toronto';

export const UPSTREAM_MAINTENANCE: UpstreamMaintenanceConfig = {
  version: 1,
  defaultTimezone: TORONTO,
  probe: {
    schedule: '*/1 * * * *',
    timeoutMs: 8000,
    rollingWindowSeconds: 300,
    downAfterFailures: 3,
    upAfterSuccesses: 5,
    degradedIfP95MsOver: 4000,
    intervalSeconds: 60,
  },
  hosts: [
    {
      id: 'open-canada-ckan',
      host: 'open.canada.ca',
      aliases: ['ouvert.canada.ca'],
      label: { en: 'Federal open-data search', fr: 'La recherche fédérale de données ouvertes' },
      probe: {
        url: 'https://open.canada.ca/data/api/3/action/package_search?q=health&rows=1',
        expect: { status: 200, jsonHasPath: '$.result.results' },
      },
      affects: ['search_gov', 'search_datasets', 'canlii_fallback'],
      // No published maintenance window. The 2026-10 outage was unannounced.
      windows: [],
      // p50 of the 2026-10 windows measured in UPSTREAM-OUTAGES.md §2.1.
      typicalRecoveryMinutes: 45,
      copy: {
        degradedEn: 'Federal open-data search is responding slowly. Some results may be missing.',
        degradedFr: 'La recherche fédérale de données ouvertes répond lentement. Certains résultats peuvent manquer.',
        downEn: "Federal open-data search isn't responding. Showing cached results; we retry automatically.",
        downFr: 'La recherche fédérale de données ouvertes ne répond pas. Les résultats en cache restent affichés; nous réessayons automatiquement.',
      },
    },
    {
      id: 'statcan-wds',
      host: 'www150.statcan.gc.ca',
      label: { en: 'Statistics Canada data service', fr: 'Le service de données de Statistique Canada' },
      probe: {
        url: 'https://www150.statcan.gc.ca/t1/wds/rest/getAllCubesListLite?limit=1',
        expect: { status: 200 },
      },
      affects: ['statcan_series'],
      windows: [
        {
          // Not an outage: a nightly content freeze. WDS answers 409 while it
          // rebuilds the cube list, so 409 is a healthy status inside this window.
          kind: 'data_lock',
          cron: '0 0 * * 1-5',
          durationMinutes: 510,
          timezone: TORONTO,
          expectStatus: [200, 409],
          source: 'https://www.statcan.gc.ca/en/developers/wds/user-guide',
          messageEn: 'Statistics Canada publishes new data at 08:30 ET. Tables stay locked until then.',
          messageFr: "Statistique Canada diffuse les nouvelles données à 8 h 30 (HE). Les tableaux restent verrouillés d'ici là.",
        },
      ],
      copy: {
        partialEn: 'Statistics Canada publishes new data at 08:30 ET. Tables stay locked until then.',
        partialFr: "Statistique Canada diffuse les nouvelles données à 8 h 30 (HE). Les tableaux restent verrouillés d'ici là.",
        downEn: "Statistics Canada's data service isn't responding. Series stay cached; we retry automatically.",
        downFr: 'Le service de données de Statistique Canada ne répond pas. Les séries restent en cache; nous réessayons automatiquement.',
        degradedEn: "Statistics Canada's data service is responding slowly. Some series may be stale.",
        degradedFr: 'Le service de données de Statistique Canada répond lentement. Certaines séries peuvent être périmées.',
      },
    },
    {
      id: 'gazette-rss',
      host: 'www.gazette.gc.ca',
      label: { en: 'Canada Gazette feeds', fr: 'Les fils de la Gazette du Canada' },
      probe: {
        url: 'https://www.gazette.gc.ca/rss/p1-eng.xml',
        expect: { status: 200, bodyMatches: '<item>' },
      },
      affects: ['gazette'],
      windows: [],
      contentRefresh: {
        cron: '0 14 * * 5',
        timezone: TORONTO,
        note: 'Part I, Fridays 14:00 ET. Part II, alternate Wednesdays 09:00 ET.',
        source: 'https://gazette.gc.ca/cg-gc/lm-sp-eng.html',
      },
      // One occurrence only (12 h 23 min of 503 on 2026-09-26). Raised
      // alertness, no banner, no window.
      watchWindows: [
        {
          cron: '0 22 * * 5',
          durationMinutes: 1200,
          timezone: TORONTO,
          reason: '12 h 23 min of 503 on 2026-09-26, a Part I publication Saturday.',
          confidence: 'low',
        },
      ],
      copy: {
        downEn: "Canada Gazette feeds aren't responding. New issues appear on the normal schedule; we retry automatically.",
        downFr: 'Les fils de la Gazette du Canada ne répondent pas. Les nouveaux numéros paraissent selon le calendrier normal; nous réessayons automatiquement.',
        degradedEn: 'Canada Gazette feeds are responding slowly. The newest issue may lag.',
        degradedFr: 'Les fils de la Gazette du Canada répondent lentement. Le numéro le plus récent peut tarder.',
      },
    },
    {
      id: 'nl-open-data',
      host: 'opendata.gov.nl.ca',
      label: { en: 'Newfoundland and Labrador open data', fr: 'Les données ouvertes de Terre-Neuve-et-Labrador' },
      probe: {
        url: 'https://opendata.gov.nl.ca/api/3/action/package_search?q=test&rows=1',
        expect: { status: 200 },
      },
      affects: ['search_datasets'],
      // Emergency shutdown, not a schedule.
      windows: [],
      announcedIncident: {
        state: 'open',
        since: '2026-10-21T18:30:00Z',
        source: 'https://www.gov.nl.ca/releases/2026/exec/1021n03/',
        messageEn:
          'Newfoundland and Labrador took its open-data portal offline as a security precaution. No restoration time has been published.',
        messageFr:
          "Terre-Neuve-et-Labrador a mis hors ligne son portail de données ouvertes par précaution. Aucune heure de rétablissement n'a été publiée.",
      },
      copy: {
        downEn: "Newfoundland and Labrador's open-data portal is offline. No restoration time has been published.",
        downFr: "Le portail de données ouvertes de Terre-Neuve-et-Labrador est hors ligne. Aucune heure de rétablissement n'a été publiée.",
        degradedEn: "Newfoundland and Labrador's open-data portal is responding slowly.",
        degradedFr: 'Le portail de données ouvertes de Terre-Neuve-et-Labrador répond lentement.',
      },
    },
    {
      id: 'ontario-ckan',
      host: 'data.ontario.ca',
      label: { en: 'Ontario open data', fr: 'Les données ouvertes de l’Ontario' },
      probe: {
        url: 'https://data.ontario.ca/api/3/action/package_search?q=test&rows=1',
        expect: { status: 200, jsonHasPath: '$.result.results' },
      },
      affects: ['search_datasets'],
      windows: [],
    },
    {
      id: 'bc-ckan',
      host: 'catalogue.data.gov.bc.ca',
      label: { en: 'BC Data Catalogue', fr: 'Le catalogue de données de la C.-B.' },
      probe: {
        url: 'https://catalogue.data.gov.bc.ca/api/3/action/package_search?q=test&rows=1',
        expect: { status: 200, jsonHasPath: '$.result.results' },
      },
      affects: ['search_datasets'],
      windows: [],
    },
    {
      id: 'alberta-ckan',
      host: 'open.alberta.ca',
      label: { en: 'Alberta open data', fr: 'Les données ouvertes de l’Alberta' },
      probe: {
        url: 'https://open.alberta.ca/api/3/action/package_search?q=test&rows=1',
        expect: { status: 200, jsonHasPath: '$.result.results' },
      },
      affects: ['search_datasets'],
      windows: [],
    },
    {
      id: 'quebec-ckan',
      host: 'www.donneesquebec.ca',
      label: { en: 'Québec open data', fr: 'Les données ouvertes du Québec' },
      probe: {
        url: 'https://www.donneesquebec.ca/api/3/action/package_search?q=test&rows=1',
        expect: { status: 200, jsonHasPath: '$.result.results' },
      },
      affects: ['search_datasets'],
      windows: [],
    },
    {
      id: 'nwt-ckan',
      host: 'opendata.gov.nt.ca',
      label: { en: 'Northwest Territories open data', fr: 'Les données ouvertes des Territoires du Nord-Ouest' },
      probe: {
        url: 'https://opendata.gov.nt.ca/api/3/action/package_search?q=test&rows=1',
        expect: { status: 200, jsonHasPath: '$.result.results' },
      },
      affects: ['search_datasets'],
      windows: [],
    },
    {
      id: 'lobby-canada',
      host: 'lobbycanada.gc.ca',
      label: { en: 'Federal lobbying registry', fr: 'Le registre fédéral des lobbyistes' },
      probe: {
        url: 'https://lobbycanada.gc.ca/',
        expect: { status: 200 },
      },
      affects: ['corporate_pipeline'],
      windows: [],
      // 403 to every automated client, consistently, since at least 2026-08.
      // Log and disable the source; never show this as a user-facing outage.
      blockedPermanent: true,
    },
  ],
};

/** Labels used when a host has no bespoke copy. */
export function hostLabel(host: UpstreamHost): UpstreamLabel {
  return host.label ?? { en: host.host, fr: host.host };
}

const TIMEZONES = new Set(['UTC', TORONTO, 'America/Vancouver', 'America/Edmonton', 'America/Halifax', 'America/St_Johns']);

/**
 * Fail fast on a config mistake. Called at API startup and from the test suite,
 * so a malformed cron or a duplicate host id never reaches production.
 */
export function validateConfig(config: UpstreamMaintenanceConfig = UPSTREAM_MAINTENANCE): string[] {
  const errors: string[] = [];
  if (config.version !== 1) errors.push(`unsupported config version: ${config.version}`);

  const ids = new Set<string>();
  const hostnames = new Set<string>();
  try {
    parseCron(config.probe.schedule);
  } catch (err) {
    errors.push(`probe.schedule: ${(err as Error).message}`);
  }
  if (!(config.probe.downAfterFailures >= 1)) errors.push('probe.downAfterFailures must be >= 1');
  if (!(config.probe.upAfterSuccesses >= 1)) errors.push('probe.upAfterSuccesses must be >= 1');
  for (const host of config.hosts) {
    if (ids.has(host.id)) errors.push(`duplicate host id: ${host.id}`);
    ids.add(host.id);
    for (const name of [host.host, ...(host.aliases ?? [])]) {
      if (hostnames.has(name)) errors.push(`duplicate hostname: ${name}`);
      hostnames.add(name);
    }
    if (!host.affects.length) errors.push(`${host.id}: affects[] must name at least one feature`);
    for (const window of host.windows) {
      try {
        parseCron(window.cron);
      } catch (err) {
        errors.push(`${host.id} window "${window.cron}": ${(err as Error).message}`);
      }
      if (!(window.durationMinutes > 0)) errors.push(`${host.id}: window duration must be > 0`);
      if (!TIMEZONES.has(window.timezone)) errors.push(`${host.id}: unknown timezone ${window.timezone}`);
      if (!window.messageEn || !window.messageFr) {
        errors.push(`${host.id}: window needs messageEn and messageFr (the site is bilingual)`);
      }
    }
    for (const watch of host.watchWindows ?? []) {
      try {
        parseCron(watch.cron);
      } catch (err) {
        errors.push(`${host.id} watchWindow "${watch.cron}": ${(err as Error).message}`);
      }
    }
    if (host.announcedIncident) {
      if (Number.isNaN(Date.parse(host.announcedIncident.since))) {
        errors.push(`${host.id}: announcedIncident.since is not an ISO instant`);
      }
      if (!host.announcedIncident.source) errors.push(`${host.id}: announcedIncident needs a source URL`);
    }
    if (!(config.probe.downAfterFailures >= 1)) errors.push('probe.downAfterFailures must be >= 1');
    if (!(config.probe.upAfterSuccesses >= 1)) errors.push('probe.upAfterSuccesses must be >= 1');
  }
  return errors;
}
