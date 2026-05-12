#!/usr/bin/env node
/**
 * CivInt Pipeline Data Generator
 *
 * Fetches real data from ALL 13 pipeline ingestion sources using only
 * Node.js built-ins + global fetch(). No npm dependencies.
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
  'CivIntPipeline/0.1 (civic-tech; mailto:j_kroeker@reverb256.ca)';

const FETCH_TIMEOUT = 15000;

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


async function fetchUrl(url, timeout = FETCH_TIMEOUT) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8' },
    signal: AbortSignal.timeout(timeout),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);
  return resp;
}

async function fetchText(url, timeout = FETCH_TIMEOUT) {
  const resp = await fetchUrl(url, timeout);
  return resp.text();
}

async function fetchJson(url, timeout = FETCH_TIMEOUT) {
  const resp = await fetchUrl(url, timeout);
  return resp.json();
}

function now() {
  return new Date().toISOString();
}

function safe(fn, label) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      process.stdout.write(`  ⚠ ${label}: ${e.message.slice(0, 100)}\n`);
      return { status: 'error', error: e.message, data: [] };
    }
  };
}


async function fetchHocCommittees() {
  process.stdout.write('  HOC committees...\n');
  const allRecords = [];

  for (const c of HOUSE_COMMITTEES) {
    process.stdout.write(`    ${c.acr}...`);
    try {
      // Fetch meeting list
      const listUrl = `${OURCOMMONS_BASE}/Committees/en/${c.acr}/Meetings`;
      const listHtml = await fetchText(listUrl, 10000);

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

      process.stdout.write(`${meetingNums.length} meetings...`);

      // Fetch details for recent meetings
      for (const meetingNum of meetingNums.slice(0, 3)) {
        const evUrl = `${OURCOMMONS_BASE}/DocumentViewer/en/45-1/${c.acr}/meeting-${meetingNum}/evidence`;
        try {
          const html = await fetchText(evUrl, 10000);

          // Extract metadata from HTML
          const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
          const dateMatch = html.match(
            /Date[:\s]*([A-Za-z]+day,\s+[A-Za-z]+\s+\d+,\s+\d{4})/i,
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
          process.stdout.write(`#${meetingNum} `);
        } catch {
          process.stdout.write(`#${meetingNum}✗ `);
        }
      }
      process.stdout.write('ok\n');
    } catch (e) {
      process.stdout.write(`ERR: ${e.message.slice(0, 60)}\n`);
    }
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors: 0,
    data: allRecords,
  };
}


async function fetchSenateCommittees() {
  process.stdout.write('  Senate committees...\n');
  const allRecords = [];

  for (const c of SENATE_COMMITTEES_LIST) {
    process.stdout.write(`    ${c.acr}...`);
    try {
      const listUrl = `${SENATE_BASE}/Committees/en/${c.acr}/Meetings`;
      const listHtml = await fetchText(listUrl, 10000);

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

      process.stdout.write(`${meetingNums.length} meetings...`);

      for (const meetingNum of meetingNums.slice(0, 2)) {
        const evUrl = `${SENATE_BASE}/DocumentViewer/en/45-1/${c.acr}/meeting-${meetingNum}/evidence`;
        try {
          const html = await fetchText(evUrl, 10000);
          const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
          const dateMatch = html.match(
            /Date[:\s]*([A-Za-z]+day,\s+[A-Za-z]+\s+\d+,\s+\d{4})/i,
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
          process.stdout.write(`#${meetingNum} `);
        } catch {
          /* skip */
        }
      }
      process.stdout.write('ok\n');
    } catch {
      process.stdout.write('skip\n');
    }
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors: 0,
    data: allRecords,
  };
}


async function fetchGazette() {
  process.stdout.write('  Canada Gazette...\n');
  const allRecords = [];

  for (const [part, url] of Object.entries(GAZETTE_RSS)) {
    process.stdout.write(`    Part ${part}...`);
    try {
      const xml = await fetchText(url, 10000);

      // Minimal RSS XML parser
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
      process.stdout.write(`${items.length} items...`);

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
      process.stdout.write('ok\n');
    } catch (e) {
      process.stdout.write(`ERR: ${e.message.slice(0, 50)}\n`);
    }
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors: 0,
    data: allRecords,
  };
}


async function fetchGIC() {
  process.stdout.write('  GIC Appointments...\n');
  const allRecords = [];

  // Try CKAN search for GIC datasets
  try {
    process.stdout.write('    Searching CKAN for GIC datasets...');
    const searchUrl = `${CKAN_API}/package_search?q=governor+in+council+appointments&rows=5`;
    const searchData = await fetchJson(searchUrl, 10000);

    if (searchData.success && searchData.result?.results?.length > 0) {
      process.stdout.write(
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
      process.stdout.write('no results, trying known packages...\n');

      // Try known CKAN package IDs
      const knownIds = [
        'd63a5c6d-fd93-4442-ac28-561f4dac90c6',
        '1691db07-7620-4535-9cb0-e5a0512ba35d',
      ];
      for (const pid of knownIds) {
        try {
          const pkgUrl = `${CKAN_API}/package_show?id=${pid}`;
          const pkgData = await fetchJson(pkgUrl, 10000);
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
          /* skip */
        }
      }
    }
    process.stdout.write(`      ${allRecords.length} resources found\n`);
  } catch (e) {
    process.stdout.write(`ERR: ${e.message.slice(0, 60)}\n`);
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors: 0,
    data: allRecords,
  };
}


async function fetchLMIA() {
  process.stdout.write('  LMIA...\n');
  const allRecords = [];

  const packageIds = {
    positive: '90fed587-1364-4f33-a9ee-208181dc0b97',
    negative: 'f82f66f2-a22b-4511-bccf-e1d74db39ae5',
  };

  for (const [outcome, pid] of Object.entries(packageIds)) {
    process.stdout.write(`    ${outcome}...`);
    try {
      const pkgUrl = `${CKAN_API}/package_show?id=${pid}`;
      const data = await fetchJson(pkgUrl, 10000);

      if (data.success) {
        const resources = data.result.resources || [];
        process.stdout.write(`${resources.length} resources\n`);

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
        process.stdout.write('no data\n');
      }
    } catch (e) {
      process.stdout.write(`ERR: ${e.message.slice(0, 50)}\n`);
    }
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors: 0,
    data: allRecords,
  };
}


async function fetchOversight() {
  process.stdout.write('  Oversight bodies...\n');
  const allRecords = [];

  // Try OAG reports listing on Canada.ca
  try {
    process.stdout.write('    OAG (Auditor General)...');
    const oagUrl =
      'https://www.canada.ca/en/auditor-general/our-work/audit-reports.html';
    const html = await fetchText(oagUrl, 10000);

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
    process.stdout.write(`${reportLinks.length} reports found\n`);
  } catch (e) {
    process.stdout.write(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  // Try PBO publications API
  try {
    process.stdout.write('    PBO (Budget Officer)...');
    const pboUrl = 'https://cms.pbo-dpb.ca/api/publications?page=1&pageSize=10';
    const data = await fetchJson(pboUrl, 10000);

    const items = Array.isArray(data) ? data : data.data || [];
    for (const item of items.slice(0, 10)) {
      allRecords.push({
        body: 'PBO',
        title: item.title || item.attributes?.title || '',
        date: item.date || item.attributes?.date || '',
        url: item.url || item.attributes?.url || '',
        type: item.type || item.attributes?.type || '',
        source: 'pbo-api',
      });
    }
    process.stdout.write(`${items.length} publications found\n`);
  } catch (e) {
    process.stdout.write(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  // Try Ethics Commissioner
  try {
    process.stdout.write('    CIEC (Ethics Commissioner)...');
    const ciecUrl =
      'https://ciec-ccie.parl.gc.ca/en/investigations/Pages/default.aspx';
    const html = await fetchText(ciecUrl, 10000);
    const investigations = [
      ...html.matchAll(
        /<a[^>]*href="([^"]+Investigation[^"]*)"[^>]*>([^<]+)<\/a>/gi,
      ),
    ];
    for (const [, href, text] of investigations.slice(0, 10)) {
      allRecords.push({
        body: 'EthicsCommissioner',
        title: text.trim().replace(/\s+/g, ' '),
        url: href.startsWith('http')
          ? href
          : `https://ciec-ccie.parl.gc.ca${href}`,
        source: 'ciec',
      });
    }
    process.stdout.write(`${investigations.length} investigations\n`);
  } catch (e) {
    process.stdout.write(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors: 0,
    data: allRecords,
  };
}


async function fetchElections() {
  process.stdout.write('  Elections / 3rd party...\n');
  const allRecords = [];

  // Search CKAN for third-party election advertising datasets
  try {
    process.stdout.write('    CKAN search...');
    const searchUrl = `${CKAN_API}/package_search?q=third+party+election+advertising&rows=5`;
    const data = await fetchJson(searchUrl, 10000);

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
    process.stdout.write(
      `${allRecords.length} election-related resources\n`,
    );
  } catch (e) {
    process.stdout.write(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  // Try Elections Canada registry page
  try {
    process.stdout.write('    Elections Canada registry...');
    const ecUrl =
      'https://www.elections.ca/content2.aspx?section=pol&dir=thi&document=index&lang=e';
    const html = await fetchText(ecUrl, 10000);

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
    process.stdout.write(`${names.length} registrants\n`);
  } catch (e) {
    process.stdout.write(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors: 0,
    data: allRecords,
  };
}


async function fetchCorporate() {
  process.stdout.write('  Corporate data...\n');
  const allRecords = [];

  // Try open.canada.ca for corporate registry data
  try {
    process.stdout.write('    Corporations Canada CKAN...');
    const pkgUrl = `${CKAN_API}/package_show?id=7d315c6d-5993-4b2d-93ef-bccfd20c2645`;
    const data = await fetchJson(pkgUrl, 10000);

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
      process.stdout.write(`${data.result.resources?.length || 0} resources\n`);
    } else {
      process.stdout.write('no data\n');
    }
  } catch (e) {
    process.stdout.write(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  // Also try to search for corporate/proactive disclosure
  try {
    process.stdout.write('    Proactive disclosure search...');
    const searchUrl = `${CKAN_API}/package_search?q=proactive+disclosure+contracts&rows=3`;
    const data = await fetchJson(searchUrl, 10000);

    if (data.success) {
      for (const pkg of data.result.results || []) {
        allRecords.push({
          dataset: pkg.title,
          type: 'proactive-disclosure',
          packageId: pkg.id,
          resourceCount: pkg.resources?.length || 0,
        });
      }
      process.stdout.write(
        `${data.result.results?.length || 0} datasets\n`,
      );
    } else {
      process.stdout.write('none\n');
    }
  } catch (e) {
    process.stdout.write(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors: 0,
    data: allRecords,
  };
}


async function fetchLobbying() {
  process.stdout.write('  Lobbying registry...\n');
  const allRecords = [];

  // Try the federal lobbying registry CKAN package
  try {
    process.stdout.write('    CKAN package...');
    const pkgUrl = `${CKAN_API}/package_show?id=70ef2117-1095-4d77-80eb-b87f2bada2a4`;
    const data = await fetchJson(pkgUrl, 10000);

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
      process.stdout.write(`${data.result.resources?.length || 0} resources\n`);
    } else {
      process.stdout.write('no data\n');
    }
  } catch (e) {
    process.stdout.write(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  // Also try the lobbycanada.gc.ca site
  try {
    process.stdout.write('    LobbyCanada search page...');
    const url =
      'https://lobbycanada.gc.ca/app/secure/ocr/lobbyistsregistry/registrationsearch.shtml';
    const html = await fetchText(url, 10000);

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
    process.stdout.write(`ok\n`);
  } catch (e) {
    process.stdout.write(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors: 0,
    data: allRecords,
  };
}


async function fetchProcurement() {
  process.stdout.write('  Procurement...\n');
  const allRecords = [];

  // Try the proactive disclosure contract dataset
  try {
    process.stdout.write('    Contract data CKAN...');
    const pkgUrl = `${CKAN_API}/package_show?id=833f4425-c97d-4bf0-9445-5c3e7dfa4948`;
    const data = await fetchJson(pkgUrl, 10000);

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
      process.stdout.write(`${data.result.resources?.length || 0} resources\n`);
    } else {
      process.stdout.write('no data\n');
    }
  } catch (e) {
    process.stdout.write(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  // Try CanadaBuys RSS feed
  try {
    process.stdout.write('    CanadaBuys RSS...');
    const xml = await fetchText(
      'https://canadabuys.canada.ca/notices/rss',
      10000,
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
    process.stdout.write(`${items.length} notices\n`);
  } catch (e) {
    process.stdout.write(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors: 0,
    data: allRecords,
  };
}


async function fetchInfluence() {
  process.stdout.write('  Influence tracking...\n');
  const allRecords = [];

  // Search CKAN for charity/grants data
  try {
    process.stdout.write('    CKAN charity/grants search...');
    const searchUrl = `${CKAN_API}/package_search?q=grants+contributions+charity&rows=5`;
    const data = await fetchJson(searchUrl, 10000);

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
    process.stdout.write(`${data.result?.results?.length || 0} datasets\n`);
  } catch (e) {
    process.stdout.write(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  // Try CRA charity search
  try {
    process.stdout.write('    CRA charity listings...');
    const craUrl =
      'https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/dsplyBscSrch?requestedPage=1&selectedCharityBn=&selectedLegalName=&selectedCity=&selectedCityVilleQ=&selectedCityVilleR=&selectedCityVilleA=&selectedProvince=ON&selectedConceptID=';
    const html = await fetchText(craUrl, 10000);

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
    process.stdout.write(`${charityNames.length} charities\n`);
  } catch (e) {
    process.stdout.write(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors: 0,
    data: allRecords,
  };
}


async function fetchProvincialLobbying() {
  process.stdout.write('  Provincial lobbying (Ontario)...\n');
  const allRecords = [];

  // Try Ontario lobbying registry search
  try {
    process.stdout.write('    Ontario registry...');
    const url =
      'https://lobbyist.oico.on.ca/lobbyistregistry/search';
    const html = await fetchText(url, 10000);

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
    process.stdout.write(`${registrations.length} registrations\n`);
  } catch (e) {
    process.stdout.write(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  // Try Ontario Data Catalogue for lobbying datasets
  try {
    process.stdout.write('    Ontario CKAN...');
    const searchUrl = `https://data.ontario.ca/api/3/action/package_search?q=lobbyists&rows=5`;
    const data = await fetchJson(searchUrl, 10000);

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
    process.stdout.write(
      `${data.result?.results?.length || 0} datasets\n`,
    );
  } catch (e) {
    process.stdout.write(`ERR: ${e.message.slice(0, 50)}\n`);
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors: 0,
    data: allRecords,
  };
}


async function fetchCanLII() {
  process.stdout.write('  CanLII court decisions...\n');
  const allRecords = [];

  // CanLII API requires an API key - try without it (public browse)
  // The caseBrowse endpoint is publicly accessible for some courts
  const courts = [
    { id: 'csc-scc', name: 'Supreme Court of Canada' },
    { id: 'fca-caf', name: 'Federal Court of Appeal' },
    { id: 'fc-cf', name: 'Federal Court' },
  ];

  for (const court of courts) {
    process.stdout.write(`    ${court.name}...`);
    try {
      const url = `https://api.canlii.org/v1/caseBrowse/en/${court.id}/?resultCount=10&offset=0`;
      const resp = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
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
        process.stdout.write(`${cases.length} cases\n`);
      } else {
        process.stdout.write(`HTTP ${resp.status}\n`);
      }
    } catch (e) {
      process.stdout.write(`ERR: ${e.message.slice(0, 50)}\n`);
    }
  }

  // If CanLII API didn't work, try scraping the public website
  if (allRecords.length === 0) {
    process.stdout.write('    Falling back to CanLII.org web scrape...\n');
    try {
      const url =
        'https://www.canlii.org/en/commentary/?page=1&sort=date&resultCount=10';
      const html = await fetchText(url, 10000);
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
      process.stdout.write(`${caseItems.length} cases\n`);
    } catch (e) {
      process.stdout.write(`ERR: ${e.message.slice(0, 50)}\n`);
    }
  }

  return {
    status: allRecords.length > 0 ? 'ok' : 'error',
    records: allRecords.length,
    errors: 0,
    data: allRecords,
  };
}


async function main() {
  const startTime = Date.now();
  process.stdout.write(
    '\n═══════════════════════════════════════════════\n' +
      '  CivInt Pipeline Data Generator\n' +
      `  ${new Date().toISOString()}\n` +
      '═══════════════════════════════════════════════\n\n',
  );

  // Run all 13 sources
  const sources = {};

  process.stdout.write('\n--- Committees ---\n');
  sources.hoc = await safe(fetchHocCommittees, 'HOC')();
  sources.senate = await safe(fetchSenateCommittees, 'Senate')();

  process.stdout.write('\n--- Regulations & Appointments ---\n');
  sources.gazette = await safe(fetchGazette, 'Gazette')();
  sources.gic = await safe(fetchGIC, 'GIC')();
  sources.lmia = await safe(fetchLMIA, 'LMIA')();

  process.stdout.write('\n--- Oversight & Elections ---\n');
  sources.oversight = await safe(fetchOversight, 'Oversight')();
  sources.elections = await safe(fetchElections, 'Elections')();
  sources.canlii = await safe(fetchCanLII, 'CanLII')();

  process.stdout.write('\n--- Corporate & Lobbying ---\n');
  sources.corporate = await safe(fetchCorporate, 'Corporate')();
  sources.lobbying = await safe(fetchLobbying, 'Lobbying')();
  sources.procurement = await safe(fetchProcurement, 'Procurement')();

  process.stdout.write('\n--- Influence & Provincial ---\n');
  sources.influence = await safe(fetchInfluence, 'Influence')();
  sources.provincialLobbying = await safe(
    fetchProvincialLobbying,
    'ProvincialLobbying',
  )();

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
        action = `${label}: "${sample.dataset.slice(0, 60)}" — ${src.records} items`;
      } else if (sample?.committee) {
        action = `${label}: ${sample.committee} #${sample.meeting} — ${src.records} meetings`;
      } else if (sample?.packageTitle) {
        action = `${label}: "${sample.packageTitle.slice(0, 60)}" — ${src.records} resources`;
      } else if (sample?.registrant) {
        action = `${label}: "${sample.registrant}" — ${src.records} entries`;
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

  const output = {
    generatedAt: now(),
    generatedBy: 'generate-pipeline-data.mjs',
    sources,
    stats,
    activity: activity.slice(0, 25),
    pipeline: {}, // dashboard-compatible flat format
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
    `\n✅ Generated at ${OUTPUT_FILE}`,
  );
  console.log(
    `   ${Object.keys(sources).length} sources, ${totalRecords} total records in ${duration}s`,
  );

  // Print summary table
  console.log('\n📊 Source Summary:');
  console.log('─'.repeat(60));
  for (const [key, src] of Object.entries(sources).sort()) {
    const statusIcon = src?.status === 'ok' ? '✅' : '⚠️';
    const paddedKey = key.padEnd(22);
    console.log(
      `  ${statusIcon} ${paddedKey} ${String(src?.records || 0).padStart(6)} records`,
    );
  }
  console.log('─'.repeat(60));
  console.log(
    `  ${'TOTAL'.padEnd(23)} ${String(totalRecords).padStart(6)} records\n`,
  );
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
