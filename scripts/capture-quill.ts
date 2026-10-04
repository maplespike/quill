#!/usr/bin/env pnpm tsx
/**
 * capture-quill.ts — Playwright-driven HAR capture for quill.maplespike.ca.
 *
 * Captures the backend API calls the portal makes during key user flows.
 *
 * Usage:
 *   pnpm tsx scripts/capture-quill.ts --output quill-capture.har --timeout 30000
 *
 * Flags:
 *   --output, -o  HAR output path (default: quill-capture.har)
 *   --headed      Visible browser (default: headless)
 *   --timeout     Per-action timeout ms (default: 30000)
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import * as fs from 'node:fs';
import * as process from 'node:process';

const BASE = 'https://quill.maplespike.ca';

interface Config {
  output: string;
  headed: boolean;
  timeout: number;
}

function parseArgs(): Config {
  const argv = process.argv.slice(2);
  const cfg: Config = { output: 'quill-capture.har', headed: false, timeout: 30_000 };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--output': case '-o': cfg.output = argv[++i]; break;
      case '--headed': cfg.headed = true; break;
      case '--timeout': cfg.timeout = Number(argv[++i]); break;
    }
  }
  return cfg;
}

// ─── HAR recording via CDP ─────────────────────────────────────────────────────

async function startHarCapture(page: Page) {
  const cdpSession = await page.context().newCDPSession(page);
  await cdpSession.send('Network.enable');
  const entries: any[] = [];

  const onRequest = (params: any) => {
    const req = params.request;
    const reqHeaders = req.headers || {};
    const headerArray = typeof req.headers === 'object' && !Array.isArray(req.headers)
      ? Object.entries(req.headers).map(([name, value]) => ({ name, value: String(value) }))
      : (req.headers || []);
    const entry: any = {
      request: {
        method: req.method,
        url: req.url,
        headers: Array.isArray(headerArray) ? headerArray.map((h: any) => ({ name: h.name || h.name, value: String(h.value || h.value) })) : [],
      },
      response: { status: 0, statusText: '', headers: [], content: { mimeType: '', size: 0 } },
      startedDateTime: new Date().toISOString(),
      time: 0,
      _requestId: params.requestId,
    };
    if (params.request?.postData) {
      entry.request.postData = {
        mimeType: req.headers?.['content-type'] || 'application/octet-stream',
        text: params.request.postData,
      };
    }
    entries.push(entry);
  };

  const onResponse = async (params: any) => {
    const resp = params.response;
    const respHeaders = resp.headers || {};
    const respHeaderArray = typeof resp.headers === 'object' && !Array.isArray(resp.headers)
      ? Object.entries(resp.headers).map(([name, value]) => ({ name, value: String(value) }))
      : (resp.headers || []);
    const entry = entries.find((e: any) => e._requestId === params.requestId);
    if (!entry) return;
    entry.response.status = resp.status;
    entry.response.statusText = resp.statusText;
    entry.response.headers = Array.isArray(respHeaderArray)
      ? respHeaderArray.map((h: any) => ({ name: h.name || h, value: String(h.value || h) }))
      : [];
    entry.response.content.mimeType = resp.mimeType || '';
    entry.response.content.size = resp.encodedDataLength || 0;
    try {
      const body = await cdpSession.send('Network.getResponseBody', { requestId: params.requestId });
      entry.response.content.text = body.body;
    } catch { /* no body */ }
    entry.time = resp?.timing?.receiveHeadersEnd || 0;
  };

  cdpSession.on('Network.requestWillBeSent', onRequest);
  cdpSession.on('Network.responseReceived', onResponse);

  return () => {
    cdpSession.off('Network.requestWillBeSent', onRequest);
    cdpSession.off('Network.responseReceived', onResponse);
    cdpSession.detach();
    return entries;
  };
}

function writeHarFile(entries: any[], outputPath: string): void {
  const har = { log: { version: '1.2', creator: { name: 'capture-quill.ts', version: '0.1.0' }, entries } };
  fs.writeFileSync(outputPath, JSON.stringify(har, null, 2), 'utf-8');
  console.log(`✅ HAR written: ${outputPath} (${entries.length} entries)`);
}

const SENSITIVE_HEADERS = new Set([
  'authorization', 'cookie', 'set-cookie', 'x-api-key', 'token',
  'x-auth-token', 'x-csrf-token', 'x-xsrf-token', 'api-key',
]);

function sanitizeHar(inputPath: string, outputPath: string, maxBodyLen = 2000): void {
  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  for (const entry of raw.log.entries) {
    for (const h of entry.request?.headers || []) {
      if (SENSITIVE_HEADERS.has(h.name.toLowerCase())) h.value = '[REDACTED]';
    }
    for (const h of entry.response?.headers || []) {
      if (SENSITIVE_HEADERS.has(h.name.toLowerCase())) h.value = '[REDACTED]';
    }
    if (entry.response?.content?.text && entry.response.content.text.length > maxBodyLen) {
      entry.response.content.text = entry.response.content.text.slice(0, maxBodyLen) + '\n... [TRUNCATED]';
    }
  }
  fs.writeFileSync(outputPath, JSON.stringify(raw, null, 2), 'utf-8');
  console.log(`✅ Sanitized HAR written: ${outputPath}`);
}

// ─── Flows ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const config = parseArgs();

  const browser: Browser = await chromium.launch({
    headless: !config.headed,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/run/current-system/sw/bin/chromium',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  // Set viewport to a reasonable desktop size
  await page.setViewportSize({ width: 1440, height: 900 });

  const detachCapture = await startHarCapture(page);

  // ── FLOW 1: Homepage ──
  // Loads landing page, should trigger health/usage API calls
  console.log('▶  Flow 1: Homepage');
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: config.timeout });
  await page.waitForTimeout(2000); // let any lazy-loaded content hydrate
  console.log(`   URL: ${page.url()}`);

  // ── FLOW 2: Explorer ──
  // Browse data modules catalog
  console.log('▶  Flow 2: Explorer');
  await page.goto(BASE + '/explorer', { waitUntil: 'networkidle', timeout: config.timeout });
  await page.waitForTimeout(2000);
  console.log(`   URL: ${page.url()}`);

  // ── FLOW 3: Explorer search (query param) ──
  // Search for "housing" across federal modules
  console.log('▶  Flow 3: Explorer search');
  await page.goto(BASE + '/explorer?query=housing&category=federal', { waitUntil: 'networkidle', timeout: config.timeout });
  await page.waitForTimeout(2000);
  console.log(`   URL: ${page.url()}`);

  // ── FLOW 4: API Explorer ──
  // Interactive API playground
  console.log('▶  Flow 4: API Explorer');
  await page.goto(BASE + '/api-explorer', { waitUntil: 'networkidle', timeout: config.timeout });
  await page.waitForTimeout(2000);
  console.log(`   URL: ${page.url()}`);

  // ── FLOW 5: AI Ask page ──
  // AgentChat component — likely loads model info, maybe auto-suggests
  console.log('▶  Flow 5: AI Ask');
  await page.goto(BASE + '/ask', { waitUntil: 'networkidle', timeout: config.timeout });
  await page.waitForTimeout(3000); // give AgentChat more time to hydrate & fetch
  console.log(`   URL: ${page.url()}`);

  // ── FLOW 6: Docs ──
  // API documentation with inline curl examples
  console.log('▶  Flow 6: Docs');
  await page.goto(BASE + '/docs', { waitUntil: 'networkidle', timeout: config.timeout });
  await page.waitForTimeout(2000);
  console.log(`   URL: ${page.url()}`);

  // ── FLOW 7: Watcher ──
  // WatcherDashboard component — likely calls watcher/status and watcher/events
  console.log('▶  Flow 7: Watcher');
  await page.goto(BASE + '/watcher', { waitUntil: 'networkidle', timeout: config.timeout });
  await page.waitForTimeout(3000); // give WatcherDashboard time to hydrate & fetch
  console.log(`   URL: ${page.url()}`);

  // ── FLOW 8: Dashboard (requires auth — just try, may redirect or show public view) ──
  console.log('▶  Flow 8: Dashboard');
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle', timeout: config.timeout });
  await page.waitForTimeout(2000);
  console.log(`   URL: ${page.url()}`);
  await page.screenshot({ path: '/tmp/quill-dashboard.png', fullPage: false });

  // ── FLOW 9: Pricing ──
  // BillingPlans component — may fetch /v1/billing/plans
  console.log('▶  Flow 9: Pricing');
  await page.goto(BASE + '/pricing', { waitUntil: 'networkidle', timeout: config.timeout });
  await page.waitForTimeout(2000);
  console.log(`   URL: ${page.url()}`);

  // Stop recording
  const entries = detachCapture();

  // Filter: keep only entries with API-like URLs (not static assets)
  const staticExtRe = /\.(png|jpg|jpeg|gif|svg|css|js|woff|woff2|ico|ttf|eot|webp|mp4|webm|avif)$/i;
  const apiEntries = entries.filter((e: any) => !staticExtRe.test(e.request.url));
  const filteredCount = entries.length - apiEntries.length;

  // Identify API base calls specifically (api.maplespike.ca or /api/v1)
  const quillApiEntries = entries.filter((e: any) =>
    e.request.url.includes('api.maplespike.ca') || e.request.url.includes('/api/v1')
  );

  // Write full HAR
  writeHarFile(entries, config.output);

  // Write API-only HAR
  const apiPath = config.output.replace(/\.har$/, '-api.har');
  writeHarFile(apiEntries, apiPath);

  // Write MapleSpike API-specific HAR
  const msApiPath = config.output.replace(/\.har$/, '-msapi.har');
  if (quillApiEntries.length > 0) {
    writeHarFile(quillApiEntries, msApiPath);
  }

  // Write sanitized version
  const sanitizedPath = config.output.replace(/\.har$/, '-sanitized.har');
  writeHarFile(entries, sanitizedPath);
  sanitizeHar(sanitizedPath, sanitizedPath);

  console.log(`📊 Total entries: ${entries.length}`);
  console.log(`🔍 Non-static entries: ${apiEntries.length} (filtered ${filteredCount})`);
  console.log(`🎯 api.maplespike.ca entries: ${quillApiEntries.length}`);

  await browser.close();
  console.log('🏁 Done.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
