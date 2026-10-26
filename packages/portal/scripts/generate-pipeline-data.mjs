#!/usr/bin/env node
/**
 * Quill Data Generator
 *
 * Fetches real data from ALL 13 pipeline ingestion sources using only
 * Node.js built-ins + global fetch(). No npm dependencies.
 *
 * Features:
 *  - AbortController-based per-source timeouts (15s)
 *  - Parallel execution with Promise.allSettled
 *  - One retry after 2s delay on fetch failures
 *  - Structured output per source with actual error counts
 *  - Exit code 0 even with partial failures
 *
 * Output: assets/pipeline-data.json  (used by the dashboard frontend)
 *
 * Run:  node scripts/generate-pipeline-data.mjs
 * From: packages/portal/
 *
 * Each source implements its own inline fetcher + minimal parser so that
 * this script is fully self-contained (no dependency on pipeline-core's
 * TypeScript modules).
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';


const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = resolve(__dirname, '..', 'assets');
const OUTPUT_FILE = resolve(ASSETS_DIR, 'pipeline-data.json');

const USER_AGENT =
  'Quill/0.1 (civic-tech; mailto:hello@maplespike.ca)';

const FETCH_TIMEOUT = 15000;
const SOURCE_TIMEOUT = 15000;
const RETRY_DELAY = 2000;

const OURCOMMONS_BASE = 'https://www.ourcommons.ca';
const SENATE_BASE = 'https://sencanada.ca';
const CKAN_API = 'https://open.canada.ca/data/api/3/action';
const GAZETTE_RSS = {
  I: 'https://gazette.gc.ca/rp-pr/p1/index.rss',
  II: 'https://gazette.gc.ca/rp-pr/p2/index.rss',
};

const HOUSE_COMMITTEES = [
  { acr: 'PACP', name: 'Public Accounts' },
  { acr: 'ETHI', name: 'Access to Information, Privacy and Ethics' },
  { acr: 'FINA', name: 'Finance' },
  { acr: 'INDU', name: 'Industry and Technology' },
  { acr: 'SECU', name: 'Public Safety and National Security' },
  { acr: 'FAAE', name: 'Foreign Affairs' },
  { acr: 'ENVI', name: 'Environment' },
  { acr: 'NDDN', name: 'National Defence' },
  { acr: 'LANG', name: 'Official Languages' },
  { acr: 'JUST', name: 'Justice and Human Rights' },
  { acr: 'ACVA', name: 'Veterans Affairs' },
  { acr: 'HESA', name: 'Health' },
];

const SENATE_COMMITTEES_LIST = [
  { acr: 'SOCI', name: 'Human Rights' },
  { acr: 'RIDR', name: 'Indigenous Peoples' },
  { acr: 'SLCI', name: 'Legal and Constitutional Affairs' },
  { acr: 'SSOC', name: 'Social Affairs, Science and Technology' },
  { acr: 'SCDV', name: 'National Security and Defence' },
];

/**
 * Fetch a URL with AbortController support and one retry on failure.
 * - signal: optional per-source AbortSignal (composed with per-fetch timeout)
 * - On failure, waits 2s then retries once (unless aborted)
 */
async function fetchUrl(url, timeout = FETCH_TIMEOUT, signal = null) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // Compose per-source signal with per-fetch timeout signal
      const effectiveSignal = signal
        ? AbortSignal.any([signal, AbortSignal.timeout(timeout)])
        : AbortSignal.timeout(timeout);

      const resp = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8',
        },
        signal: effectiveSignal,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);
      return resp;
    } catch (err) {
      // Don't retry on abort (per-source timeout or explicit cancel)
      if (err.name === 'AbortError') throw err;
      lastError = err;
      if (attempt === 1) {
        await sleep(RETRY_DELAY);
      }
    }
  }
  throw lastError;
}

async function fetchText(url, timeout = FETCH_TIMEOUT, signal = null) {
  const resp = await fetchUrl(url, timeout, signal);
  return resp.text();
}

async function fetchJson(url, timeout = FETCH_TIMEOUT, signal = null) {
  const resp = await fetchUrl(url, timeout, signal);
  return resp.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function now() {
  return new Date().toISOString();
}

function safe(fn, label) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      process.stdout.write(`  \u26a0 ${label}: ${e.message.slice(0, 100)}\n`);
      return { status: 'error', error: e.message, data: [], records: 0, errors: 1 };
    }
  };
}

/** Log buffer for collecting per-source output printed after completion */
const logBuffer = [];
function log(msg) {
  logBuffer.push(msg);
}
function flushLog(label) {
  for (const msg of logBuffer) {
    process.stdout.write(msg);
  }
  logBuffer.length = 0;
}

/**
 * Wraps a source function with an AbortController-based timeout.
 * The AbortController's signal is passed to all fetch calls within
 * the source, so in-flight requests are aborted on timeout.
 * Includes one retry of the entire source (2s delay) on failure.
 */
async function runSource(label, fn) {
  let lastResult;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new Error(`Source "${label}" timed out after ${SOURCE_TIMEOUT / 1000}s`));
    }, SOURCE_TIMEOUT);

    try {
      const result = await fn(controller.signal);
      clearTimeout(timer);
      // Ensure structured output
      return {
        status: result?.status || 'ok',
        records: result?.records || 0,
        errors: result?.errors || 0,
        data: result?.data || [],
        attempt,
      };
    } catch (err) {
      clearTimeout(timer);
      lastResult = {
        status: 'error',
        records: 0,
        errors: 1,
        data: [],
        error: err.message,
        attempt,
      };
      // On abort/timeout, don't retry the whole source
      if (err.name === 'AbortError') break;
      // On last attempt, don't retry
      if (attempt === 2) break;
      // Wait 2s before retrying the source
      await sleep(RETRY_DELAY);
    }
  }

  return lastResult;
}


async function fetchHocCommittees(signal = null) {
  log('  HOC committees...\n');
  const allRecords = [];
  let errors = 0;

  for (const c of HOUSE_COMMITTEES) {
    log(`    ${c.acr}...`);
    try {
      // Fetch meeting list
      const listUrl = `${OURCOMMONS_BASE}/Committees/en/${c.acr}/Meetings`;
      const listHtml = await fetchText(listUrl, 10000, signal);

      // Extract meeting numbers
      const meetingNums = [
        ...new Set(
          [...listHtml.matchAll(/meeting[=-](\d+)/gi)].map((m) =>
            parseInt(m[1], 10),
          ),
        ),
      ]
        .filter((n) => n > 0 && n < 500)
        .sort((a, b) => b - a)
        .slice(0, 5);

      log(`${meetingNums.length} meetings...`);

      // Fetch details for recent meetings
      for (const meetingNum of meetingNums.slice(0, 3)) {
        const evUrl = `${OURCOMMONS_BASE}/DocumentViewer/en/45-1/${c.acr}/meeting-${meetingNum}/evidence`;
        try {
          const html = await fetchText(evUrl, 10000, signal);

          // Extract metadata from HTML
          const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
          const dateMatch = html.match(
            /Date[:\\s]*([A-Za-z]+day,\s+[A-Za-z]+\s+\d+,\s+\d{4})/i,
          );
          const inCamera =
            html.includes('InCameraNote') ||
            html.toLowerCase().includes('in camera');

          // Extract XML export link
          const xmlMatch = html.match(
            /<a\s[^>]*class="[^"]*\bbtn-export-xml\b[^"]*"[^>]*href="([^"]+)"/i,
          );
          const xmlUrl = xmlMatch
            ? xmlMatch[1].startsWith('/')
              ? OURCOMMONS_BASE + xmlMatch[1]
              : xmlMatch[1]
            : null;

          // Count interventions
          const intMatch = html.match(/<Intervention[ >]/g);
          const interventionCount = intMatch ? intMatch.length : 0;

          // Extract witnesses from meta tag
          const witnessMatch = html.match(
            /<meta[^>]*name=["']?Witnesses["']?[^>]*content=["']([^"']*)/i,
          );
          const witnesses = witnessMatch
            ? witnessMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
            : [];

          allRecords.push({
            committee: c.acr,
            name: c.name,
            meeting: meetingNum,
            date: dateMatch ? dateMatch[1].trim() : null,
            inCamera,
            witnesses: [...new Set(witnesses)].slice(0, 15),
            interventionCount,
            source: evUrl,
            xmlSource: xmlUrl,
          });
          log(`#${meetingNum} `);
        } catch {
          errors++;
          log(`#${meetingNum}\u2717 `);
        }
      }
      log('ok\n');
    } catch (e) {
      errors++;
      log(`ERR: ${e.message.slice(0, 60)}\n`);
    }
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors,
    data: allRecords,
  };
}


async function fetchSenateCommittees(signal = null) {
  log('  Senate committees...\n');
  const allRecords = [];
  let errors = 0;

  for (const c of SENATE_COMMITTEES_LIST) {
    log(`    ${c.acr}...`);
    try {
      const listUrl = `${SENATE_BASE}/Committees/en/${c.acr}/Meetings`;
      const listHtml = await fetchText(listUrl, 10000, signal);

      const meetingNums = [
        ...new Set(
          [...listHtml.matchAll(/meeting[=-](\d+)/gi)].map((m) =>
            parseInt(m[1], 10),
          ),
        ),
      ]
        .filter((n) => n > 0 && n < 500)
        .sort((a, b) => b - a)
        .slice(0, 3);

      log(`${meetingNums.length} meetings...`);

      for (const meetingNum of meetingNums.slice(0, 2)) {
        const evUrl = `${SENATE_BASE}/DocumentViewer/en/45-1/${c.acr}/meeting-${meetingNum}/evidence`;
        try {
          const html = await fetchText(evUrl, 10000, signal);
          const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
          const dateMatch = html.match(
            /Date[:\\s]*([A-Za-z]+day,\s+[A-Za-z]+\s+\d+,\s+\d{4})/i,
          );
          const inCamera =
            html.includes('InCameraNote') ||
            html.toLowerCase().includes('in camera');

          const intMatch = html.match(/<Intervention[ >]/g);
          const interventionCount = intMatch ? intMatch.length : 0;

          allRecords.push({
            committee: c.acr,
            name: c.name,
            meeting: meetingNum,
            date: dateMatch ? dateMatch[1].trim() : null,
            inCamera,
            interventionCount,
            source: evUrl,
          });
          log(`#${meetingNum} `);
        } catch {
          errors++;
          /* skip */
        }
      }
      log('ok\n');
    } catch {
      errors++;
      log('skip\n');
    }
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors,
    data: allRecords,
  };
}


async function fetchGazette(signal = null) {
  log('  Canada Gazette...\n');
  const allRecords = [];
  let errors = 0;

  for (const [part, url] of Object.entries(GAZETTE_RSS)) {
    log(`    Part ${part}...`);
    try {
      const xml = await fetchText(url, 10000, signal);

      // Minimal RSS XML parser
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
      log(`${items.length} items...`);

      for (const item of items.slice(0, 30)) {
        const body = item[1];
        const title =
          body.match(/<title[^>]*>([^<]*)/i)?.[1]?.trim() || '';
        const link =
          body.match(/<link[^>]*>([^<]*)/i)?.[1]?.trim() || '';
        const description =
          body.match(/<description[^>]*>([^<]*)/i)?.[1]?.trim() || '';
        const pubDate =
          body.match(/<pubDate[^>]*>([^<]*)/i)?.[1]?.trim() || '';
        const guid =
          body.match(/<guid[^>]*>([^<]*)/i)?.[1]?.trim() || '';

        // Try to extract registration number (SOR/*)
        const regMatch = title.match(/(SOR\/[\d-]+)/i);
        const registrationNumber = regMatch ? regMatch[1] : null;

        // Try to extract department
        const deptMatch = description.match(
          /(?:Department|Ministry|Agency|Office)\s+(?:of\s+)?([A-Z][A-Za-z\s]+?)(?:,|\.|$)/,
        );
        const department = deptMatch ? deptMatch[1].trim() : null;

        allRecords.push({
          id: guid || link,
          title,
          part,
          link,
          publishedAt: pubDate,
          description: description.slice(0, 500),
          registrationNumber,
          department,
        });
      }
      log('ok\n');
    } catch (e) {
      errors++;
      log(`ERR: ${e.message.slice(0, 50)}\n`);
    }
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors,
    data: allRecords,
  };
}


async function fetchGIC(signal = null) {
  log('  GIC Appointments...\n');
  const allRecords = [];
  let errors = 0;

  // Try CKAN search for GIC datasets
  try {
    log('    Searching CKAN for GIC datasets...');
    const searchUrl = `${CKAN_API}/package_search?q=governor+in+council+appointments&rows=5`;
    const searchData = await fetchJson(searchUrl, 10000, signal);

    if (searchData.success && searchData.result?.results?.length > 0) {
      log(
        `${searchData.result.results.length} datasets found\n`,
      );

      for (const pkg of searchData.result.results) {
        const resources = pkg.resources || [];
        for (const res of resources.slice(0, 3)) {
          allRecords.push({
            packageTitle: pkg.title,
            packageId: pkg.id,
            resourceFormat: res.format,
            resourceUrl: res.url,
            resourceDescription: res.description || '',
            lastModified: res.last_modified || '',
          });
        }
      }
    } else {
      log('no results, trying known packages...\n');

      // Try known CKAN package IDs
      const knownIds = [
        'd63a5c6d-fd93-4442-ac28-561f4dac90c6',
        '1691db07-7620-4535-9cb0-e5a0512ba35d',
      ];
      for (const pid of knownIds) {
        try {
          const pkgUrl = `${CKAN_API}/package_show?id=${pid}`;
          const pkgData = await fetchJson(pkgUrl, 10000, signal);
          if (pkgData.success) {
            const pkg = pkgData.result;
            for (const res of (pkg.resources || []).slice(0, 3)) {
              allRecords.push({
                packageTitle: pkg.title,
                packageId: pkg.id,
                resourceFormat: res.format,
                resourceUrl: res.url,
                resourceDescription: res.description || '',
              });
            }
          }
        } catch {
          errors++;
          /* skip */
        }
      }
    }
    log(`      ${allRecords.length} resources found\n`);
  } catch (e) {
    errors++;
    log(`ERR: ${e.message.slice(0, 60)}\n`);
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors,
    data: allRecords,
  };
}


async function fetchLMIA(signal = null) {
  log('  LMIA...\n');
  const allRecords = [];
  let errors = 0;

  const packageIds = {
    positive: '90fed587-1364-4f33-a9ee-208181dc0b97',
    negative: 'f82f66f2-a22b-4511-bccf-e1d74db39ae5',
  };

  for (const [outcome, pid] of Object.entries(packageIds)) {
    log(`    ${outcome}...`);
    try {
      const pkgUrl = `${CKAN_API}/package_show?id=${pid}`;
      const data = await fetchJson(pkgUrl, 10000, signal);

      if (data.success) {
        const resources = data.result.resources || [];
        log(`${resources.length} resources\n`);

        for (const res of resources.slice(0, 5)) {
          allRecords.push({
            outcome,
            packageTitle: data.result.title,
            resourceFormat: res.format,
            resourceUrl: res.url,
            resourceName: res.name,
            resourceId: res.id,
            lastModified: res.last_modified || '',
            quarter: res.name?.match(/Q\d/)?.[0] || 'unknown',
          });
        }
      } else {
        log('no data\n');
      }
    } catch (e) {
      errors++;
      log(`ERR: ${e.message.slice(0, 50)}\n`);
    }
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors,
    data: allRecords,
  };
}


async function fetchOversight(signal = null) {
  log('  Oversight bodies...\n');
  const allRecords = [];
  let errors = 0;

  // Try OAG reports listing on Canada.ca
  try {
    log('    OAG (Auditor General)...');
    const oagUrl =
      'https://www.canada.ca/en/auditor-general/our-work/audit-reports.html';
    const html = await fetchText(oagUrl, 10000, signal);

    // Extract report links
    const reportLinks = [
      ...html.matchAll(
        /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi,
      ),
    ]
      .filter(
        (m) =>
          m[1].includes('auditor-general') &&
          (m[1].endsWith('.html') || m[1].includes('/report/')),
      )
      .slice(0, 15);

    for (const [, href, text] of reportLinks) {
      const fullUrl = href.startsWith('http')
        ? href
        : `https://www.canada.ca${href.startsWith('/') ? '' : '/'}${href}`;
      allRecords.push({
        body: 'OAG',
        title: text.trim().replace(/\s+/g, ' '),
        url: fullUrl,
        source: 'canada.ca',
      });
    }
    log(`${reportLinks.length} reports found\n`);
  } catch (e) {
    errors++;
    log(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  // Try PBO publications API
  try {
    log('    PBO (Budget Officer)...');
    const pboUrl = 'https://rest-393962616e6b.pbo-dpb.ca/publications';
    const data = await fetchJson(pboUrl, 10000, signal);

    const items = Array.isArray(data) ? data : data.data || [];
    for (const item of items.slice(0, 10)) {
      const attrs = item.attributes || item;
      allRecords.push({
        body: 'PBO',
        title: attrs.title_en || attrs.title || '',
        date: attrs.release_date || attrs.date || '',
        url: attrs.permalinks?.en?.website || attrs.url || '',
        type: attrs.type || '',
        source: 'pbo-api',
      });
    }
    log(`${items.length} publications found\n`);
  } catch (e) {
    errors++;
    log(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  // Try Ethics Commissioner
  try {
    log('    CIEC (Ethics Commissioner)...');
    const ciecUrl = 'https://www.ethicscanada.ca/en/investigation-reports';
    const html = await fetchText(ciecUrl, 10000, signal);
    const investigations = [
      ...html.matchAll(
        /<a[^>]*href="([^"]*\/en\/report\/[A-Za-z0-9_-]+)[^"]*"[^>]*>([^<]+)<\/a>/gi,
      ),
    ];
    for (const [, href, text] of investigations.slice(0, 10)) {
      allRecords.push({
        body: 'EthicsCommissioner',
        title: text.trim().replace(/\s+/g, ' '),
        url: href.startsWith('http')
          ? href
          : `https://www.ethicscanada.ca${href}`,
        source: 'ciec',
      });
    }
    log(`${investigations.length} investigations\n`);
  } catch (e) {
    errors++;
    log(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors,
    data: allRecords,
  };
}


async function fetchElections(signal = null) {
  log('  Elections / 3rd party...\n');
  const allRecords = [];
  let errors = 0;

  // Search CKAN for third-party election advertising datasets
  try {
    log('    CKAN search...');
    const searchUrl = `${CKAN_API}/package_search?q=third+party+election+advertising&rows=5`;
    const data = await fetchJson(searchUrl, 10000, signal);

    if (data.success && data.result?.results?.length > 0) {
      for (const pkg of data.result.results) {
        for (const res of (pkg.resources || []).slice(0, 3)) {
          allRecords.push({
            packageTitle: pkg.title,
            packageId: pkg.id,
            resourceFormat: res.format,
            resourceUrl: res.url,
            resourceDescription: res.description || '',
          });
        }
      }
    }
    log(
      `${allRecords.length} election-related resources\n`,
    );
  } catch (e) {
    errors++;
    log(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  // Try Elections Canada registry page
  try {
    log('    Elections Canada registry...');
    const ecUrl =
      'https://www.elections.ca/content2.aspx?section=pol&dir=thi&document=index&lang=e';
    const html = await fetchText(ecUrl, 10000, signal);

    // Try to find registrant names
    const names = [
      ...html.matchAll(
        /<td[^>]*>([A-Z][A-Za-z\s&,.]+?)<\/td>/gi,
      ),
    ]
      .map((m) => m[1].trim())
      .filter((n) => n.length > 3 && n.length < 100)
      .slice(0, 20);

    for (const name of names) {
      allRecords.push({
        registrant: name,
        source: 'elections.ca',
        type: 'third-party',
      });
    }
    log(`${names.length} registrants\n`);
  } catch (e) {
    errors++;
    log(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors,
    data: allRecords,
  };
}


async function fetchCorporate(signal = null) {
  log('  Corporate data...\n');
  const allRecords = [];
  let errors = 0;

  // Try open.canada.ca for corporate registry data
  try {
    log('    Corporations Canada CKAN...');
    const pkgUrl = `${CKAN_API}/package_show?id=7d315c6d-5993-4b2d-93ef-bccfd20c2645`;
    const data = await fetchJson(pkgUrl, 10000, signal);

    if (data.success) {
      for (const res of (data.result.resources || []).slice(0, 5)) {
        allRecords.push({
          dataset: data.result.title,
          format: res.format,
          url: res.url,
          name: res.name,
          lastModified: res.last_modified || '',
        });
      }
      log(`${data.result.resources?.length || 0} resources\n`);
    } else {
      log('no data\n');
    }
  } catch (e) {
    errors++;
    log(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  // Also try to search for corporate/proactive disclosure
  try {
    log('    Proactive disclosure search...');
    const searchUrl = `${CKAN_API}/package_search?q=proactive+disclosure+contracts&rows=3`;
    const data = await fetchJson(searchUrl, 10000, signal);

    if (data.success) {
      for (const pkg of data.result.results || []) {
        allRecords.push({
          dataset: pkg.title,
          type: 'proactive-disclosure',
          packageId: pkg.id,
          resourceCount: pkg.resources?.length || 0,
        });
      }
      log(
        `${data.result.results?.length || 0} datasets\n`,
      );
    } else {
      log('none\n');
    }
  } catch (e) {
    errors++;
    log(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors,
    data: allRecords,
  };
}


async function fetchLobbying(signal = null) {
  log('  Lobbying registry...\n');
  const allRecords = [];
  let errors = 0;

  // Try the federal lobbying registry CKAN package
  try {
    log('    CKAN package...');
    const pkgUrl = `${CKAN_API}/package_show?id=70ef2117-1095-4d77-80eb-b87f2bada2a4`;
    const data = await fetchJson(pkgUrl, 10000, signal);

    if (data.success) {
      for (const res of (data.result.resources || []).slice(0, 5)) {
        allRecords.push({
          packageTitle: data.result.title,
          format: res.format,
          url: res.url,
          name: res.name,
          lastModified: res.last_modified || '',
        });
      }
      log(`${data.result.resources?.length || 0} resources\n`);
    } else {
      log('no data\n');
    }
  } catch (e) {
    errors++;
    log(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  // Also try the lobbycanada.gc.ca site
  try {
    log('    LobbyCanada search page...');
    const url =
      'https://lobbycanada.gc.ca/app/secure/ocr/lobbyistsregistry/registrationsearch.shtml';
    const html = await fetchText(url, 10000, signal);

    // Extract any useful links or info
    const links = [
      ...html.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/gi),
    ]
      .filter((m) => m[1].includes('csv') || m[1].includes('download'))
      .slice(0, 5);

    for (const [, href, text] of links) {
      allRecords.push({
        type: 'registry-link',
        label: text.trim(),
        url: href.startsWith('http')
          ? href
          : `https://lobbycanada.gc.ca${href}`,
      });
    }
    log('ok\n');
  } catch (e) {
    errors++;
    log(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors,
    data: allRecords,
  };
}


async function fetchProcurement(signal = null) {
  log('  Procurement...\n');
  const allRecords = [];
  let errors = 0;

  // Try the proactive disclosure contract dataset
  try {
    log('    Contract data CKAN...');
    const pkgUrl = `${CKAN_API}/package_show?id=833f4425-c97d-4bf0-9445-5c3e7dfa4948`;
    const data = await fetchJson(pkgUrl, 10000, signal);

    if (data.success) {
      for (const res of (data.result.resources || []).slice(0, 5)) {
        allRecords.push({
          dataset: data.result.title,
          format: res.format,
          url: res.url,
          name: res.name,
          lastModified: res.last_modified || '',
        });
      }
      log(`${data.result.resources?.length || 0} resources\n`);
    } else {
      log('no data\n');
    }
  } catch (e) {
    errors++;
    log(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  // Try CanadaBuys RSS feed
  try {
    log('    CanadaBuys RSS...');
    const xml = await fetchText(
      'https://canadabuys.canada.ca/notices/rss',
      10000,
      signal,
    );
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

    for (const item of items.slice(0, 15)) {
      const body = item[1];
      const title = body.match(/<title[^>]*>([^<]*)/i)?.[1]?.trim() || '';
      const link = body.match(/<link[^>]*>([^<]*)/i)?.[1]?.trim() || '';
      const desc = body.match(/<description[^>]*>([^<]*)/i)?.[1]?.trim() || '';

      allRecords.push({
        title,
        url: link,
        description: desc.slice(0, 300),
        source: 'canadabuys-rss',
      });
    }
    log(`${items.length} notices\n`);
  } catch (e) {
    errors++;
    log(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors,
    data: allRecords,
  };
}


async function fetchInfluence(signal = null) {
  log('  Influence tracking...\n');
  const allRecords = [];
  let errors = 0;

  // Search CKAN for charity/grants data
  try {
    log('    CKAN charity/grants search...');
    const searchUrl = `${CKAN_API}/package_search?q=grants+contributions+charity&rows=5`;
    const data = await fetchJson(searchUrl, 10000, signal);

    if (data.success && data.result?.results?.length > 0) {
      for (const pkg of data.result.results.slice(0, 5)) {
        allRecords.push({
          dataset: pkg.title,
          packageId: pkg.id,
          resourceCount: pkg.resources?.length || 0,
          notes: (pkg.notes || '').slice(0, 200),
        });
      }
    }
    log(`${data.result?.results?.length || 0} datasets\n`);
  } catch (e) {
    errors++;
    log(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  // Try CRA charity search
  try {
    log('    CRA charity listings...');
    const craUrl =
      'https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/dsplyBscSrch?requestedPage=1&selectedCharityBn=&selectedLegalName=&selectedCity=&selectedCityVilleQ=&selectedCityVilleR=&selectedCityVilleA=&selectedProvince=ON&selectedConceptID=';
    const html = await fetchText(craUrl, 10000, signal);

    // Extract charity names from table
    const charityNames = [
      ...html.matchAll(
        /<a[^>]*class="[^"]*charity-name[^"]*"[^>]*>([^<]+)<\/a>/gi,
      ),
    ].map((m) => m[1].trim());
    for (const name of charityNames.slice(0, 10)) {
      allRecords.push({
        type: 'charity',
        name,
        source: 'cra-arc',
      });
    }
    log(`${charityNames.length} charities\n`);
  } catch (e) {
    errors++;
    log(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors,
    data: allRecords,
  };
}


async function fetchProvincialLobbying(signal = null) {
  log('  Provincial lobbying (Ontario)...\n');
  const allRecords = [];
  let errors = 0;

  // Try Ontario lobbying registry search
  try {
    log('    Ontario registry...');
    const url =
      'https://lobbyist.oico.on.ca/lobbyistregistry/search';
    const html = await fetchText(url, 10000, signal);

    // Extract registration links
    const registrations = [
      ...html.matchAll(
        /<a[^>]*href="([^"]*registration[^"]*)"[^>]*>([^<]+)<\/a>/gi,
      ),
    ];

    for (const [, href, text] of registrations.slice(0, 15)) {
      allRecords.push({
        type: 'registration',
        title: text.trim().replace(/\s+/g, ' '),
        url: href.startsWith('http')
          ? href
          : `https://lobbyist.oico.on.ca${href}`,
        province: 'ON',
      });
    }
    log(`${registrations.length} registrations\n`);
  } catch (e) {
    errors++;
    log(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  // Try Ontario Data Catalogue for lobbying datasets
  try {
    log('    Ontario CKAN...');
    const searchUrl = `https://data.ontario.ca/api/3/action/package_search?q=lobbyists&rows=5`;
    const data = await fetchJson(searchUrl, 10000, signal);

    if (data.success && data.result?.results?.length > 0) {
      for (const pkg of data.result.results.slice(0, 5)) {
        allRecords.push({
          type: 'dataset',
          dataset: pkg.title,
          packageId: pkg.id,
          resourceCount: pkg.resources?.length || 0,
          source: 'ontario-ckan',
        });
      }
    }
    log(
      `${data.result?.results?.length || 0} datasets\n`,
    );
  } catch (e) {
    errors++;
    log(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors,
    data: allRecords,
  };
}


async function fetchCanLII(signal = null) {
  log('  CanLII court decisions...\n');
  const allRecords = [];
  let errors = 0;

  // CanLII API requires an API key - try without it (public browse)
  // The caseBrowse endpoint is publicly accessible for some courts
  const courts = [
    { id: 'csc-scc', name: 'Supreme Court of Canada' },
    { id: 'fca-caf', name: 'Federal Court of Appeal' },
    { id: 'fc-cf', name: 'Federal Court' },
  ];

  for (const court of courts) {
    log(`    ${court.name}...`);
    try {
      const url = `https://api.canlii.org/v1/caseBrowse/en/${court.id}/?resultCount=10&offset=0`;
      const resp = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        signal: signal || AbortSignal.timeout(10000),
      });

      if (resp.ok) {
        const data = await resp.json();
        const cases = data.cases || data.result || [];
        for (const c of cases.slice(0, 10)) {
          allRecords.push({
            court: court.name,
            caseId: c.caseId || c.id || '',
            caseName: c.caseName || c.title || '',
            citation: c.citation || '',
            decisionDate: c.decisionDate || c.date || '',
            url: c.url || c.link || '',
          });
        }
        log(`${cases.length} cases\n`);
      } else {
        errors++;
        log(`HTTP ${resp.status}\n`);
      }
    } catch (e) {
      errors++;
      log(`ERR: ${e.message.slice(0, 50)}\n`);
    }
  }

  // If CanLII API didn't work, try scraping the public website
  if (allRecords.length === 0) {
    log('    Falling back to CanLII.org web scrape...\n');
    try {
      const url =
        'https://www.canlii.org/en/commentary/?page=1&sort=date&resultCount=10';
      const html = await fetchText(url, 10000, signal);
      const caseItems = [
        ...html.matchAll(
          /<a[^>]*href="([^"]*\/en\/[^"]+)"[^>]*>([^<]+)<\/a>/gi,
        ),
      ]
        .filter((m) => m[1].includes('/ca/'))
        .slice(0, 10);

      for (const [, href, text] of caseItems) {
        allRecords.push({
          court: 'Unknown',
          caseName: text.trim().replace(/\s+/g, ' '),
          url: href.startsWith('http') ? href : `https://www.canlii.org${href}`,
          source: 'canlii-web',
        });
      }
      log(`${caseItems.length} cases\n`);
    } catch (e) {
      errors++;
      log(`ERR: ${e.message.slice(0, 50)}\n`);
    }
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors,
    data: allRecords,
  };
}


// ── Immigration (IRCC open data via CKAN) ──────────────────────────

async function fetchImmigration(signal = null) {
  log('  Immigration IRCC...\n');
  const allRecords = [];
  let errors = 0;
  const ids = [
    'f7e5498e-0ad8-4417-85c9-9b8aff9b9eda',
    '90115b00-f9b8-49e8-afa3-b4cff8facaee',
    '360024f2-17e9-4558-bfc1-3616485d65b9',
    '6e47f705-71ed-41f0-8fd5-d1a8508a3b63',
  ];
  const labels = ['Perm Residents', 'Study Permits', 'Work Permits', 'RPD Decisions'];
  for (let i = 0; i < ids.length; i++) {
    try {
      log(`    ${labels[i]}...`);
      const url = `${CKAN_API}/package_show?id=${ids[i]}`;
      const data = await fetchJson(url, 8000, signal);
      if (data.success) {
        const rc = (data.result.resources || []).length;
        allRecords.push({ dataset: data.result.title, resources: rc, source: labels[i] });
        log(`${rc} resources\n`);
      }
    } catch (e) {
      errors++; log(`ERR: ${e.message.slice(0,40)}\n`);
    }
  }
  return { status: allRecords.length > 0 ? 'ok' : 'error', records: allRecords.length, errors, data: allRecords };
}


// ── Indigenous Relations ──────────────────────────────────────────

async function fetchIndigenous(signal = null) {
  log('  Indigenous Relations...\n');
  const allRecords = [];
  let errors = 0;
  const ids = [
    { id: 'a995192c-7df7-4ec6-954b-6a8fcf99fe8b', label: 'Specific Claims' },
    { id: 'dd2aba36-0ab9-4e66-91ce-2c52261f2993', label: 'Indigenous Services' },
  ];
  for (const item of ids) {
    try {
      log(`    ${item.label}...`);
      const url = `${CKAN_API}/package_show?id=${item.id}`;
      const data = await fetchJson(url, 8000, signal);
      if (data.success) {
        allRecords.push({ dataset: data.result.title, resources: (data.result.resources || []).length, source: item.label });
        log(`${(data.result.resources || []).length} resources\n`);
      }
    } catch (e) { errors++; log(`ERR: ${e.message.slice(0,40)}\n`); }
  }
  return { status: allRecords.length > 0 ? 'ok' : 'error', records: allRecords.length, errors, data: allRecords };
}


// ── Transport Safety Board ───────────────────────────────────────

async function fetchTransport(signal = null) {
  log('  Transport Safety...\n');
  const allRecords = [];
  let errors = 0;
  try {
    const url = `${CKAN_API}/package_search?q=transportation+safety+board&rows=5`;
    const data = await fetchJson(url, 8000, signal);
    if (data.success) {
      for (const r of (data.result.results || []).slice(0, 5)) {
        allRecords.push({ dataset: r.title, resources: (r.resources || []).length, url: `https://open.canada.ca/data/dataset/${r.id}` });
      }
    }
    log(`${allRecords.length} datasets\n`);
  } catch (e) { errors++; log(`ERR: ${e.message.slice(0,40)}\n`); }
  return { status: allRecords.length > 0 ? 'ok' : 'error', records: allRecords.length, errors, data: allRecords };
}


// ── Defence & Veterans ──────────────────────────────────────────

async function fetchDefence(signal = null) {
  log('  Defence & Veterans...\n');
  const allRecords = [];
  let errors = 0;
  const ids = [
    '460aa2e0-5a37-47cf-a858-98b4327d29de',
    '6322b9a3-49f5-4d3f-a61a-b5a077c88f5b',
  ];
  for (const id of ids) {
    try {
      const url = `${CKAN_API}/package_show?id=${id}`;
      const data = await fetchJson(url, 8000, signal);
      if (data.success) {
        allRecords.push({ dataset: data.result.title, resources: (data.result.resources || []).length });
      }
    } catch (e) { errors++; }
  }
  log(`${allRecords.length} datasets\n`);
  return { status: allRecords.length > 0 ? 'ok' : 'error', records: allRecords.length, errors, data: allRecords };
}


// ── Health Canada ────────────────────────────────────────────────

async function fetchHealth(signal = null) {
  log('  Health Canada...\n');
  const allRecords = [];
  let errors = 0;
  const ids = [
    { id: 'd74b5e0c-cf0c-4c9d-b1b3-1a8c3a9b0e4d', label: 'Drug Database' },
    { id: '37bf86f1-fb5e-4a3b-8e0a-9cb7b0c5e12a', label: 'Medical Devices' },
  ];
  for (const item of ids) {
    try {
      const url = `${CKAN_API}/package_show?id=${item.id}`;
      const data = await fetchJson(url, 8000, signal);
      if (data.success) {
        allRecords.push({ dataset: data.result.title, resources: (data.result.resources || []).length });
      }
    } catch (e) { errors++; }
  }
  log(`${allRecords.length} datasets\n`);
  return { status: allRecords.length > 0 ? 'ok' : 'error', records: allRecords.length, errors, data: allRecords };
}


// ── Education Research ──────────────────────────────────────────

async function fetchEducation(signal = null) {
  log('  Education Research...\n');
  const allRecords = [];
  let errors = 0;
  try {
    const url = `${CKAN_API}/package_search?q=research+grants+canada&rows=5`;
    const data = await fetchJson(url, 8000, signal);
    if (data.success) {
      for (const r of (data.result.results || []).slice(0, 5)) {
        allRecords.push({ dataset: r.title, resources: (r.resources || []).length });
      }
    }
    log(`${allRecords.length} datasets\n`);
  } catch (e) { errors++; }
  return { status: allRecords.length > 0 ? 'ok' : 'error', records: allRecords.length, errors, data: allRecords };
}


// ── Science & Research ──────────────────────────────────────────

async function fetchScience(signal = null) {
  log('  Science & Research...\n');
  const allRecords = [];
  let errors = 0;
  const urls = [
    { url: `${CKAN_API}/package_search?q=canadian+space+agency&rows=3`, label: 'Space' },
    { url: `${CKAN_API}/package_search?q=ocean+observations+canada&rows=3`, label: 'Ocean' },
  ];
  for (const item of urls) {
    try {
      const data = await fetchJson(item.url, 8000, signal);
      if (data.success) {
        for (const r of (data.result.results || []).slice(0, 3)) {
          allRecords.push({ dataset: r.title, source: item.label });
        }
      }
    } catch (e) { errors++; }
  }
  log(`${allRecords.length} items\n`);
  return { status: allRecords.length > 0 ? 'ok' : 'error', records: allRecords.length, errors, data: allRecords };
}


/**
 * Build a sample crossReference query result for "Brookfield Asset Management".
 *
 * Mimics the CrossReferenceResult type from pipeline-core's
 * cross-reference engine so that the portal dashboard can render
 * the unified timeline format without needing live API calls.
 *
 * Includes example data across: lobbying, GIC, committees, contracts,
 * and elections — the five modules the cross-reference engine covers.
 */
function buildCrossReferenceSample() {
  const entity = 'Brookfield Asset Management';
  const now = new Date().toISOString();

  const matches = [
    // Lobbying
    {
      module: 'lobbying',
      sourceUrl: 'https://lobbycanada.gc.ca/app/secure/ocr/lobbyistsregistry/registrationsearch.shtml?search=brookfield+asset+management',
      date: '2025-11-14',
      title: 'In-house lobbying registration — Brookfield Asset Management Inc.',
      description: 'Designated public office holders contacted on pension reform, infrastructure investment, and tax treaty matters.',
      relevance: 'direct',
    },
    {
      module: 'lobbying',
      sourceUrl: 'https://lobbycanada.gc.ca/app/secure/ocr/lobbyistsregistry/registrationsearch.shtml?search=brookfield+asset+management',
      date: '2025-06-03',
      title: 'Consultant lobby registration — Brookfield Renewable Partners',
      description: 'Arranged meeting with Minister of Natural Resources regarding renewable energy regulatory framework.',
      relevance: 'direct',
    },
    {
      module: 'lobbying',
      sourceUrl: 'https://lobbycanada.gc.ca/app/secure/ocr/lobbyistsregistry/registrationsearch.shtml?search=brookfield+asset+management',
      date: '2024-09-20',
      title: 'In-house lobbying registration — Brookfield Business Partners',
      description: 'Communication with Innovation, Science and Industry Canada on competition policy.',
      relevance: 'direct',
    },
    // GIC Appointments
    {
      module: 'gic',
      sourceUrl: 'https://open.canada.ca/data/en/dataset/1691db07-7620-4535-9cb0-e5a0512ba35d',
      date: '2025-08-22',
      title: 'GIC Appointment — Canada Infrastructure Bank Board',
      description: 'Governor in Council appointment of nominee affiliated with Brookfield Asset Management to the Canada Infrastructure Bank board of directors.',
      relevance: 'indirect',
    },
    {
      module: 'gic',
      sourceUrl: 'https://open.canada.ca/data/en/dataset/d63a5c6d-fd93-4442-ac28-561f4dac90c6',
      date: '2024-03-15',
      title: 'GIC Appointment — PPP Canada Board',
      description: 'Senior executive from Brookfield named to Public-Private Partnership Canada selection committee.',
      relevance: 'indirect',
    },
    // Committees
    {
      module: 'committees',
      sourceUrl: 'https://www.ourcommons.ca/DocumentViewer/en/44-1/FINA/meeting-120/evidence',
      date: '2025-10-02',
      title: 'FINA — Standing Committee on Finance: Pension Reform Study',
      description: 'Witness testimony referenced Brookfield Asset Management\u2019s role in Canadian pension fund infrastructure investments.',
      relevance: 'direct',
    },
    {
      module: 'committees',
      sourceUrl: 'https://www.ourcommons.ca/DocumentViewer/en/44-1/INDU/meeting-95/evidence',
      date: '2025-04-18',
      title: 'INDU — Standing Committee on Industry: Foreign Investment Review',
      description: 'Committee discussed Brookfield\u2019s acquisition of domestic infrastructure assets and implications under the Investment Canada Act.',
      relevance: 'direct',
    },
    {
      module: 'committees',
      sourceUrl: 'https://www.ourcommons.ca/DocumentViewer/en/44-1/ENVI/meeting-80/evidence',
      date: '2024-11-25',
      title: 'ENVI — Standing Committee on Environment: Clean Energy Transition',
      description: 'Brookfield Renewable Partners mentioned in context of clean energy investment targets and carbon reduction commitments.',
      relevance: 'indirect',
    },
    // Contracts (Proactive Disclosure)
    {
      module: 'proactive-disclosure',
      sourceUrl: 'https://open.canada.ca/data/en/dataset/833f4425-c97d-4bf0-9445-5c3e7dfa4948',
      date: '2025-09-10',
      title: 'Contract 2025-BAM-0042 — Infrastructure Advisory Services',
      description: 'Government contract valued at C$2,850,000 to Brookfield Asset Management Inc. for infrastructure portfolio advisory services.',
      relevance: 'direct',
    },
    {
      module: 'proactive-disclosure',
      sourceUrl: 'https://open.canada.ca/data/en/dataset/833f4425-c97d-4bf0-9445-5c3e7dfa4948',
      date: '2024-12-01',
      title: 'Contract 2024-DND-8911 — Renewable Energy Feasibility Study',
      description: 'Department of National Defence contract with Brookfield Renewable for feasibility study on base energy transition (C$475,000).',
      relevance: 'indirect',
    },
    {
      module: 'proactive-disclosure',
      sourceUrl: 'https://open.canada.ca/data/en/dataset/833f4425-c97d-4bf0-9445-5c3e7dfa4948',
      date: '2024-06-17',
      title: 'Contract 2024-PSPC-3307 — Asset Management Software Licensing',
      description: 'PSPC awarded contract to Brookfield\u2019s technology division for asset management platform licensing (C$1,200,000).',
      relevance: 'indirect',
    },
    // Elections & Campaign Finance
    {
      module: 'elections',
      sourceUrl: 'https://www.elections.ca/content2.aspx?section=pol&dir=thi&document=index&lang=e',
      date: '2025-03-28',
      title: 'Third-party election advertising — Brookfield Asset Management Inc.',
      description: 'Registered third-party sponsor under the Canada Elections Act; incurred advertising expenses of C$215,000 during the 2025 federal election period.',
      relevance: 'direct',
    },
    {
      module: 'elections',
      sourceUrl: 'https://www.elections.ca/content2.aspx?section=pol&dir=thi&document=index&lang=e',
      date: '2024-02-14',
      title: 'Political contribution reporting — Brookfield executives',
      description: 'Aggregate political contributions by Brookfield Asset Management directors and senior officers reported to Elections Canada for 2023 calendar year.',
      relevance: 'indirect',
    },
  ];

  // Build timeline sorted by date descending
  const timeline = [...matches]
    .filter((m) => m.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 50)
    .map((m) => ({
      date: m.date,
      module: m.module,
      event: m.title,
      sourceUrl: m.sourceUrl,
    }));

  return {
    entity,
    entityType: 'organization',
    matches,
    totalMatches: matches.length,
    timeline,
    ingestedAt: now,
  };
}


async function main() {
  const startTime = Date.now();

  // ---- Define all 20+ sources ----
  const sourceDefs = [
    // Committees
    { key: 'hoc', label: 'HOC Committees', fn: (signal) => safe(fetchHocCommittees, 'HOC')(signal) },
    { key: 'senate', label: 'Senate Committees', fn: (signal) => safe(fetchSenateCommittees, 'Senate')(signal) },
    // Regulations & Appointments
    { key: 'gazette', label: 'Canada Gazette', fn: (signal) => safe(fetchGazette, 'Gazette')(signal) },
    { key: 'gic', label: 'GIC Appointments', fn: (signal) => safe(fetchGIC, 'GIC')(signal) },
    { key: 'lmia', label: 'LMIA', fn: (signal) => safe(fetchLMIA, 'LMIA')(signal) },
    // Oversight & Elections
    { key: 'oversight', label: 'Oversight Bodies', fn: (signal) => safe(fetchOversight, 'Oversight')(signal) },
    { key: 'elections', label: 'Elections Canada', fn: (signal) => safe(fetchElections, 'Elections')(signal) },
    { key: 'canlii', label: 'CanLII', fn: (signal) => safe(fetchCanLII, 'CanLII')(signal) },
    // Corporate & Lobbying
    { key: 'corporate', label: 'Corporate Registry', fn: (signal) => safe(fetchCorporate, 'Corporate')(signal) },
    { key: 'lobbying', label: 'Lobbying Registry', fn: (signal) => safe(fetchLobbying, 'Lobbying')(signal) },
    { key: 'procurement', label: 'Procurement', fn: (signal) => safe(fetchProcurement, 'Procurement')(signal) },
    // Influence & Provincial
    { key: 'influence', label: 'Influence Tracking', fn: (signal) => safe(fetchInfluence, 'Influence')(signal) },
    { key: 'provincialLobbying', label: 'Provincial Lobbying', fn: (signal) => safe(fetchProvincialLobbying, 'ProvincialLobbying')(signal) },
    // Immigration (IRCC open data)
    { key: 'immigration', label: 'Immigration IRCC', fn: (signal) => safe(fetchImmigration, 'Immigration')(signal) },
    // Indigenous Relations
    { key: 'indigenous', label: 'Indigenous Relations', fn: (signal) => safe(fetchIndigenous, 'Indigenous')(signal) },
    // Transport Safety Board
    { key: 'transport', label: 'Transport Safety', fn: (signal) => safe(fetchTransport, 'Transport')(signal) },
    // Defence & Veterans
    { key: 'defence', label: 'Defence & Veterans', fn: (signal) => safe(fetchDefence, 'Defence')(signal) },
    // Health data
    { key: 'health', label: 'Health Canada', fn: (signal) => safe(fetchHealth, 'Health')(signal) },
    // Education & Research
    { key: 'education', label: 'Education Research', fn: (signal) => safe(fetchEducation, 'Education')(signal) },
    // Science & Research
    { key: 'science', label: 'Science & Research', fn: (signal) => safe(fetchScience, 'Science')(signal) },
  ];

  process.stdout.write(
    '\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n' +
      '  Quill Data Generator\n' +
      `  ${new Date().toISOString()}\n` +
      '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n\n',
  );

  // ---- Run all sources in parallel with per-source timeouts ----
  process.stdout.write('Running all 13 sources in parallel...\n\n');

  const results = await Promise.allSettled(
    sourceDefs.map((def) =>
      runSource(def.key, def.fn).then((result) => ({ ...result, key: def.key, label: def.label })),
    ),
  );

  // Process results and emit per-source logs
  const sources = {};
  for (const settled of results) {
    if (settled.status === 'fulfilled') {
      const r = settled.value;
      sources[r.key] = {
        status: r.status,
        records: r.records || 0,
        errors: r.errors || 0,
        data: r.data || [],
      };
      // Print source result line
      const attemptStr = r.attempt > 1 ? ` (retry #${r.attempt})` : '';
      const statusIcon = r.status === 'ok' ? '\u2705' : '\u26a0\ufe0f';
      const paddedKey = r.key.padEnd(20);
      process.stdout.write(
        `  ${statusIcon} ${paddedKey} ${String(r.records).padStart(6)} records  ${r.error || ''}${attemptStr}\n`,
      );
    } else {
      // Should not happen with runSource, but handle anyway
      process.stdout.write(`  \u26a0\ufe0f ???: ${settled.reason?.message || 'unknown error'}\n`);
    }
  }

  // Build output
  const totalRecords = Object.values(sources).reduce(
    (sum, s) => sum + (s?.records || 0),
    0,
  );

  // Build per-source stats
  const stats = { totalRecords };
  for (const [key, src] of Object.entries(sources)) {
    stats[key] = src?.records || 0;
  }

  // Build activity feed from successful source data
  const activity = [];
  for (const [key, src] of Object.entries(sources)) {
    if (src?.status === 'ok' && src.records > 0) {
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      const sample = src.data?.[0];
      let action = `${label}: ${src.records} records fetched`;

      if (sample?.title) {
        action = `${label}: "${sample.title.slice(0, 60)}" + ${src.records - 1} more`;
      } else if (sample?.dataset) {
        action = `${label}: "${sample.dataset.slice(0, 60)}" \u2014 ${src.records} items`;
      } else if (sample?.committee) {
        action = `${label}: ${sample.committee} #${sample.meeting} \u2014 ${src.records} meetings`;
      } else if (sample?.packageTitle) {
        action = `${label}: "${sample.packageTitle.slice(0, 60)}" \u2014 ${src.records} resources`;
      } else if (sample?.registrant) {
        action = `${label}: "${sample.registrant}" \u2014 ${src.records} entries`;
      }

      activity.push({
        action,
        type: key,
        time: now(),
        count: src.records,
      });
    }
  }

  // Sort activity by time descending
  activity.sort((a, b) => b.time.localeCompare(a.time));

  // ── Cross-Reference Section ─────────────────────────────────────
  // Sample result for 'Brookfield Asset Management' showing unified
  // timeline format across lobbying, GIC, committees, contracts,
  // and elections. Matches the CrossReferenceResult type from
  // pipeline-core/src/ingestion/cross-reference/types.ts .
  const crossReference = buildCrossReferenceSample();

  const output = {
    generatedAt: now(),
    generatedBy: 'generate-pipeline-data.mjs',
    sources,
    stats,
    activity: activity.slice(0, 25),
    pipeline: {}, // dashboard-compatible flat format
    crossReference,
  };

  // Build dashboard-compatible pipeline module statuses
  for (const [key, src] of Object.entries(sources)) {
    output.pipeline[key] = {
      status: src?.status || 'error',
      lastRun: now(),
      records: src?.records || 0,
      errors: src?.errors || (src?.status === 'error' ? 1 : 0),
    };
  }

  // Write output
  if (!existsSync(ASSETS_DIR)) {
    mkdirSync(ASSETS_DIR, { recursive: true });
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(
    `\n\u2705 Generated at ${OUTPUT_FILE}`,
  );
  console.log(
    `   ${Object.keys(sources).length} sources, ${totalRecords} total records in ${duration}s`,
  );

  // Print summary table
  console.log('\n\ud83d\udcca Source Summary:');
  console.log('\u2500'.repeat(60));
  for (const [key, src] of Object.entries(sources).sort()) {
    const statusIcon = src?.status === 'ok' ? '\u2705' : '\u26a0\ufe0f';
    const paddedKey = key.padEnd(22);
    console.log(
      `  ${statusIcon} ${paddedKey} ${String(src?.records || 0).padStart(6)} records`,
    );
  }
  console.log('\u2500'.repeat(60));
  console.log(
    `  ${'TOTAL'.padEnd(23)} ${String(totalRecords).padStart(6)} records\n`,
  );
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  // Always exit 0 -- partial failures are expected
  process.exit(0);
});
