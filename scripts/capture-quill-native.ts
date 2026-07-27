#!/usr/bin/env pnpm tsx
/**
 * capture-quill-native.ts — HAR capture using Playwright's native request interception.
 * More reliable than CDP for response body capture.
 */
import { chromium, type Page, type Route, type Request } from 'playwright';
import * as fs from 'node:fs';

const BASE = 'https://quill.maplespike.ca';
const OUTPUT = '/tmp/quill-native-capture.har';

interface LogEntry {
  request: { method: string; url: string; headers: { name: string; value: string }[]; postData?: string };
  response: { status: number; statusText: string; headers: { name: string; value: string }[]; content?: { text: string; mimeType: string } };
  startedDateTime: string;
  time: number;
  _flow: string;
}

async function captureFlow(page: Page, label: string, fn: () => Promise<void>): Promise<LogEntry[]> {
  const entries: LogEntry[] = [];
  const responseBodies = new Map<string, string>();
  const responseMeta = new Map<string, { status: number; statusText: string; headers: any[] }>();

  // Intercept ALL requests and responses
  await page.route('**/*', async (route: Route, request: Request) => {
    const startTime = new Date().toISOString();
    const reqHeaders = request.headers();
    const headerArray = Object.entries(reqHeaders).map(([name, value]) => ({ name, value: String(value) }));

    let postData: string | null = null;
    if (request.postData()) {
      postData = request.postData();
    }
    const entry: LogEntry = {
      request: { method: request.method(), url: request.url(), headers: headerArray, postData: postData || undefined },
      response: { status: 0, statusText: '', headers: [] },
      startedDateTime: startTime,
      time: 0,
      _flow: label,
    };

    const requestId = request.url() + ':' + startTime;

    // Continue the request and capture response
    const response = await route.fetch(); // fetch without browser execution
    entry.response.status = response.status();
    entry.response.statusText = response.statusText();
    const respHeaders = response.headers();
    entry.response.headers = Object.entries(respHeaders).map(([name, value]) => ({ name, value: String(value) }));

    // Get response body
    try {
      const body = await response.body();
      const text = body.toString('utf-8');
      entry.response.content = { text, mimeType: response.headers()['content-type'] || '' };
      entry.time = Date.now() - new Date(startTime).getTime();
    } catch {
      entry.response.content = { text: '', mimeType: '' };
    }

    entries.push(entry);
    await route.fulfill({ response });
  });

  await fn();

  // Remove the route interceptor
  await page.unroute('**/*');
  return entries;
}

async function main() {
  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/run/current-system/sw/bin/chromium',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  const allEntries: LogEntry[] = [];

  // Define flows — each flow gets its own route interception session
  const flows: { label: string; fn: () => Promise<void> }[] = [
    {
      label: 'homepage',
      fn: async () => {
        await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(3000);
      },
    },
    {
      label: 'watcher',
      fn: async () => {
        await page.goto(BASE + '/watcher', { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(5000);
      },
    },
    {
      label: 'pricing',
      fn: async () => {
        await page.goto(BASE + '/pricing', { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(5000);
      },
    },
    {
      label: 'dashboard',
      fn: async () => {
        await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(8000);
      },
    },
    {
      label: 'docs',
      fn: async () => {
        await page.goto(BASE + '/docs', { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(3000);
      },
    },
    {
      label: 'api-explorer',
      fn: async () => {
        await page.goto(BASE + '/api-explorer', { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(3000);
      },
    },
    {
      label: 'ask',
      fn: async () => {
        await page.goto(BASE + '/ask', { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(5000);
      },
    },
  ];

  for (const flow of flows) {
    console.log(`▶  Flow: ${flow.label}`);
    const entries = await captureFlow(page, flow.label, flow.fn);
    allEntries.push(...entries);
    console.log(`   → ${entries.length} entries`);
  }

  // Filter
  const staticRe = /\.(png|jpg|jpeg|gif|svg|css|js|woff|woff2|ico|ttf|eot|webp|mp4|webm|avif)$/i;
  const nonStatic = allEntries.filter(e => !staticRe.test(e.request.url));
  const apiCalls = allEntries.filter(e => e.request.url.includes('api.quill.maplespike.ca') || e.request.url.includes('/api/v1'));

  // Write full HAR
  const har = { log: { version: '1.2', creator: { name: 'capture-quill-native' }, entries: allEntries } };
  fs.writeFileSync(OUTPUT, JSON.stringify(har, null, 2));
  console.log(`✅ ${OUTPUT} (${allEntries.length} entries)`);

  const apiHar = { log: { version: '1.2', creator: { name: 'capture-quill-native-api' }, entries: apiCalls } };
  fs.writeFileSync(OUTPUT.replace('.har', '-api.har'), JSON.stringify(apiHar, null, 2));

  // Summary
  console.log(`\n📊 Summary:`);
  console.log(`   Total entries: ${allEntries.length}`);
  console.log(`   Non-static: ${nonStatic.length}`);
  console.log(`   api.quill.maplespike.ca calls: ${apiCalls.length}`);

  for (const e of apiCalls) {
    const bodyLen = (e.response.content?.text || '').length;
    console.log(`   ${e.response.status} ${e.request.method} ${e.request.url} [${bodyLen}B] [${e._flow}]`);
    if (bodyLen > 0 && bodyLen < 500) {
      console.log(`     → ${(e.response.content?.text || '').slice(0, 250)}`);
    } else if (bodyLen > 0) {
      console.log(`     → ${(e.response.content?.text || '').slice(0, 100)}... [${bodyLen}B total]`);
    }
  }

  await browser.close();
  console.log('🏁 Done.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
