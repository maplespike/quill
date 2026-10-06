// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Per-pipeline change-probe URLs.
 *
 * The ingest gate (change-detect.ts) needs one or more URLs whose change state
 * stands in for "this pipeline has new data". They are listed here, keyed by
 * registry module name, rather than on ModuleInfo because:
 *
 *   - ModuleInfo.sources[].name is a human label, not a fetchable URL.
 *   - A module may read several endpoints; any one changing means the pipeline
 *     must run, so the gate needs the list, not a single URL.
 *
 * A module ABSENT from this map cannot be gated and always runs. That is the
 * safe default: guessing a probe URL would risk skipping a pipeline whose real
 * source changed. Add an entry only for an endpoint that reliably reflects the
 * module data (an RSS feed, a dataset file, an API the module actually calls) --
 * never a landing page that changes for unrelated reasons.
 */

export const PROBE_URLS: Record<string, string[]> = {
  // Commons committee evidence -- the module scrapes ourcommons.ca.
  committees: ['https://www.ourcommons.ca/Committees/en/Home'],

  // BC corporate registry bulk CSVs. These are large files and change rarely,
  // so conditional requests pay for themselves many times over here.
  corporate: [
    'https://d4bf66bykfyaf.cloudfront.net/corporations-active-cbca-en.csv',
  ],

  // Canada Gazette -- three RSS feeds with ETag/Last-Modified support.
  gazette: [
    'https://gazette.gc.ca/rss/p1-eng.xml',
    'https://gazette.gc.ca/rss/p2-eng.xml',
    'https://gazette.gc.ca/rss/en-ls-eng.xml',
  ],

  // Lobbying / influence registry search.
  influence: [
    'https://lobbycanada.gc.ca/app/secure/ocr/lobbyistsregistry/registrationsearch.shtml',
  ],

  // NGO policy feeds -- RSS, the ideal conditional-request target.
  'ngo-influence-rss': [
    'https://cwf.ca/feed/',
    'https://davidsuzuki.org/feed/',
    'https://macdonaldlaurier.ca/feed/',
  ],

  // Oversight bodies: the PBO publications API and the CIEC investigations page.
  oversight: [
    'https://cms.pbo-dpb.ca/api/publications',
    'https://ciec-ccie.parl.gc.ca/en/investigations/Pages/default.aspx',
  ],

  // real-time-feeds subscribes over AMQPS (push), not HTTP -- nothing to probe.
  // It stays absent on purpose and always runs.
};

/** The probe URLs for a module, or an empty list when it cannot be gated. */
export function probeUrlsFor(moduleName: string): string[] {
  return PROBE_URLS[moduleName] ?? [];
}
