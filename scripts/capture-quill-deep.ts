#!/usr/bin/env pnpm tsx
/**
 * capture-quill-deep.ts — Deep capture of Quill API calls.
 * Stays on each page and waits for API responses to complete.
 */
import { chromium, type Page } from 'playwright';
import * as fs from 'node:fs';

const BASE = 'https://quill.maplespike.ca';
const OUTPUT = '/tmp/quill-deep-capture.har';

interface HarEntry {
  request: { method: string; url: string; headers: any; postData?: any };
  response: { status: number; statusText: string; headers: any; content: any };
  startedDateTime: string;
  time: number;
  _requestId: string;
}

async function captureHar(page: Page, label: string, fn: () => Promise<void>): Promise<HarEntry[]> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  const entries: HarEntry[] = [];
  const pendingResponses: Map<string, Promise<void>> = new Map();

  cdp.on('Network.requestWillBeSent', (params: any) => {
    const req = params.request;
    const h = (h: any) => typeof h === 'object' && !Array.isArray(h)
      ? Object.entries(h).map(([n, v]) => ({ name: n, value: String(v) })) : (h || []);
    const entry: any = {
      request: { method: req.method, url: req.url, headers: h(req.headers) },
      response: { status: 0, statusText: '', headers: [], content: { mimeType: '', size: 0 } },
      startedDateTime: new Date().toISOString(), time: 0,
      _requestId: params.requestId,
    };
    if (params.request?.postData) entry.request.postData = { mimeType: 'text/plain', text: params.request.postData };
    entries.push(entry);

    // Wait for response completion
    pendingResponses.set(params.requestId, new Promise<void>(async (resolve) => {
      try {
        const resp = await cdp.send('Network.responseReceived', { requestId: params.requestId });
        entry.response.status = resp.response?.status || 0;
        entry.response.statusText = resp.response?.statusText || '';
        entry.response.headers = h(resp.response?.headers);
        entry.time = resp.response?.timing?.receiveHeadersEnd || 0;
        try {
          const body = await cdp.send('Network.getResponseBody', { requestId: params.requestId });
          entry.response.content = { text: body.body, mimeType: resp.response?.mimeType || '', size: body.body?.length || 0 };
        } catch { }
      } catch { }
      resolve();
    }));
  });

  await fn();
  
  // Wait for pending API responses to complete (max 10s)
  console.log(`   Waiting for ${pendingResponses.size} pending requests...`);
  await Promise.race([
    Promise.allSettled(pendingResponses.values()),
    new Promise(r => setTimeout(r, 10000)),
  ]);

  cdp.detach();
  console.log(`   Captured ${entries.length} entries for "${label}"`);
  return entries;
}

async function main() {
  const browser = await chromium.launch({
    headless: false,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/run/current-system/sw/bin/chromium',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  const allEntries: HarEntry[] = [];

  // ── FLOW 1: Homepage — wait for health + usage API calls ──
  console.log('▶  Flow 1: Homepage');
  const e1 = await captureHar(page, 'homepage', async () => {
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000); // extra time for client-side API calls
  });
  allEntries.push(...e1);

  // ── FLOW 2: Watcher — wait for watcher/status and watcher/events ──
  console.log('▶  Flow 2: Watcher');
  const e2 = await captureHar(page, 'watcher', async () => {
    await page.goto(BASE + '/watcher', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(8000); // longer wait for WatcherDashboard hydration
  });
  allEntries.push(...e2);

  // ── FLOW 3: Pricing — wait for billing/plans ──
  console.log('▶  Flow 3: Pricing');
  const e3 = await captureHar(page, 'pricing', async () => {
    await page.goto(BASE + '/pricing', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(8000);
  });
  allEntries.push(...e3);

  // ── FLOW 4: Dashboard — multiple API calls (health, usage, billing, etc.) ──
  console.log('▶  Flow 4: Dashboard');
  const e4 = await captureHar(page, 'dashboard', async () => {
    await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(10000); // longest wait — most API calls
  });
  allEntries.push(...e4);

  const staticRe = /\.(png|jpg|jpeg|gif|svg|css|js|woff|woff2|ico|ttf|eot|webp|mp4|webm|avif)$/i;
  const apiEntries = allEntries.filter(e => !staticRe.test(e.request.url));

  // Write
  const har = { log: { version: '1.2', creator: { name: 'capture-quill-deep' }, entries: allEntries } };
  fs.writeFileSync(OUTPUT, JSON.stringify(har, null, 2));
  const apiHar = { log: { version: '1.2', creator: { name: 'capture-quill-deep-api' }, entries: apiEntries } };
  fs.writeFileSync(OUTPUT.replace('.har', '-api.har'), JSON.stringify(apiHar, null, 2));

  console.log(`\n📊 Total: ${allEntries.length} | Non-static: ${apiEntries.length}`);

  // Show API calls with status codes
  const apiCalls = allEntries.filter(e => e.request.url.includes('api.quill.maplespike.ca'));
  console.log(`\n🎯 api.quill.maplespike.ca calls (${apiCalls.length}):`);
  for (const e of apiCalls) {
    const bodyLen = (e.response.content?.text || '').length;
    console.log(`   ${e.response.status} ${e.request.method} ${e.request.url} [body: ${bodyLen}B]`);
    if (bodyLen > 0) {
      console.log(`     → ${(e.response.content?.text || '').slice(0, 200)}`);
    }
  }

  await browser.close();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
