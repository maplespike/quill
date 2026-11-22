#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.QUILL_PREVIEW_URL || 'http://127.0.0.1:4390';
const output = process.env.QUILL_DESIGN_OUTPUT || '/tmp/quill-design-review';
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/chromium', args: ['--no-sandbox'] });
await mkdir(output, { recursive: true });
const results = [];
const englishRoutes = ['/en', '/fr', '/explorer', '/docs', '/pricing', '/signup', '/dashboard', '/workspace', '/agents', '/ask', '/signal', '/watcher', '/verify', '/api-explorer', '/status', '/claims', '/citation', '/data-sources', '/privacy', '/terms', '/contact', '/blog', '/changelog', '/checkout'];
const routes = [...englishRoutes, ...englishRoutes.filter(route => !['/en', '/fr'].includes(route)).map(route => '/fr' + route), '/', '/dashboard/extraction', '/dashboard/owasp', '/dashboard/billing', '/checkout/return'];

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push({ url: page.url(), message: error.message }));
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    for (const route of routes) {
      const response = await page.goto(base + route, { waitUntil: 'load' });
      assert.equal(response.status(), 200, `${route}: HTTP status`);
      await page.waitForTimeout(100);
      const state = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        theme: document.documentElement.dataset.theme,
        language: document.documentElement.lang,
        mainCount: document.querySelectorAll('main').length,
        titleCount: document.querySelectorAll('h1').length,
        externalFonts: performance.getEntriesByType('resource').some(entry => /fonts\.googleapis|fonts\.gstatic/.test(entry.name)),
      }));
      assert.ok(state.scroll <= width + 1, `${route} at ${width}px overflows to ${state.scroll}px`);
      assert.equal(state.theme, 'ink-and-paper', `${route}: theme`);
      assert.equal(state.externalFonts, false, `${route}: external font request`);
      assert.equal(state.mainCount, 1, `${route}: main landmark count`);
      assert.equal(state.titleCount, 1, `${route}: h1 count`);
      assert.equal(state.language, route === '/fr' || route.startsWith('/fr/') ? 'fr' : 'en', `${route}: language`);
      // Every route that uses BaseLayout must carry a working light/dark
      // toggle. Assert the full cycle so a token or binding regression cannot
      // ship on one page and pass on another. /api-reference is the one
      // standalone page (Scalar owns the viewport, no site chrome).
      if (route === '/api-reference' || route === '/fr/api-reference') {
        assert.equal(await page.locator('#theme-toggle').count(), 0, `${route}: standalone page should not render site chrome`);
      } else {
        const toggle = page.locator('#theme-toggle');
        assert.equal(await toggle.count(), 1, `${route}: theme toggle missing`);
        const readTheme = () => page.evaluate(() => ({
          name: document.documentElement.dataset.theme,
          dark: document.documentElement.classList.contains('dark'),
          bodyBg: getComputedStyle(document.body).backgroundColor,
          pressed: document.getElementById('theme-toggle')?.getAttribute('aria-pressed'),
        }));
        const beforeToggle = await readTheme();
        await toggle.click();
        await page.waitForFunction(was => document.documentElement.classList.contains('dark') !== was, beforeToggle.dark);
        const afterToggle = await readTheme();
        assert.equal(afterToggle.name, 'ink-and-paper', `${route}: toggle renamed the theme`);
        assert.equal(afterToggle.dark, !beforeToggle.dark, `${route}: toggle did not flip the dark class`);
        assert.equal(afterToggle.pressed, String(afterToggle.dark), `${route}: aria-pressed out of sync`);
        assert.notEqual(afterToggle.bodyBg, beforeToggle.bodyBg, `${route}: page plane did not change`);
        await toggle.click();
        await page.waitForFunction(was => document.documentElement.classList.contains('dark') === was, beforeToggle.dark);
        assert.equal((await readTheme()).bodyBg, beforeToggle.bodyBg, `${route}: page plane did not restore`);
        // Leave no focus on the toggle: the keyboard test below starts from a
        // clean document and expects the skip link as the first Tab stop.
        await page.evaluate(() => document.activeElement?.blur());
      }
      results.push({ route, width, ...state });
      if (['/en', '/fr', '/explorer', '/docs', '/pricing', '/dashboard'].includes(route)) {
        await page.screenshot({ path: `${output}/${route.slice(1)}-${width}.png`, fullPage: true });
      }
    }
  }

  // Mobile menu, Escape, and SPA lifecycle. No reload is used between clicks.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/fr');
  const menu = page.locator('#mobile-menu-toggle');
  await menu.click();
  assert.equal(await menu.getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  assert.equal(await menu.evaluate(element => element === document.activeElement), true);
  await menu.click();
  await page.locator('#mobile-nav a[href="/fr/explorer"]').click();
  await page.waitForURL('**/fr/explorer');
  assert.equal(await page.locator('.tool-links a[aria-current="page"]').getAttribute('href'), '/fr/explorer');
  await page.locator('#mobile-menu-toggle').click();
  assert.equal(await page.locator('#mobile-menu-toggle').getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Escape');
  await page.locator('.quill-wordmark').click();
  await page.waitForURL('**/fr');
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__LANG), 'fr');
  assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
  assert.equal(await page.locator('.nav-signin').textContent().then(text => text.trim()), 'Connexion');

  // Clipboard success and failure must remain functional after SPA return.
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('[data-copy-target="mcp-config-text"]').click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.equal(JSON.parse(copied).mcpServers.quill.url, 'https://mcp.maplespike.ca/sse');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('Denied')) } }));
  await page.locator('[data-copy-target="mcp-config-text"]').click();
  await page.waitForFunction(() => document.querySelector('.copy-status')?.textContent.includes('Échec'));

  // Search handoff uses the user's query and the correct locale.
  const requests = [];
  await page.route('**/api/v1/gov/search?**', async route => {
    requests.push(route.request().url());
    await route.fulfill({ json: { data: { results: [], provenance: { status: 'live' } } } });
  });
  await page.locator('#landing-query').fill('housing & policy');
  await page.locator('.hero-search button').click();
  await page.waitForURL('**/fr/explorer?query=*');
  await page.waitForFunction(() => document.querySelector('#query')?.value === 'housing & policy');
  await page.waitForTimeout(200);
  assert.ok(requests.some(url => new URL(url).searchParams.get('q') === 'housing & policy'), 'Search uses existing API query contract');

  // Desktop header remains visible after scroll.
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(base + '/explorer');
  await page.evaluate(() => window.scrollTo(0, 700));
  assert.equal(await page.locator('.primary-nav').evaluate(element => getComputedStyle(element).opacity), '1');
  assert.ok(await page.locator('.site-header').evaluate(element => Math.abs(element.getBoundingClientRect().top) < 1));
  await page.goto(base + '/en');
  // The beta banner precedes the skip link in the tab order. Tab until the
  // skip link receives focus, then prove Enter moves focus to <main>.
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => document.activeElement?.getAttribute('href') === '#main-content')) break;
  }
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('href')), '#main-content', 'skip link is reachable by keyboard');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'main-content');

  // Auth display fixture: no live account or state-changing API call.
  await page.evaluate(() => window.QuillAuth.setAuth('design-test-token', 'design-reader', 'oauth'));
  assert.equal(await page.locator('#nav-account-btn').count(), 1);
  await page.locator('#nav-account-btn').click();
  assert.equal(await page.locator('#nav-account-dropdown').isVisible(), true);
  await page.evaluate(() => window.QuillAuth.logout());
  assert.equal(await page.locator('.nav-signin').count(), 1);

  const noJS = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const staticPage = await noJS.newPage();
  await staticPage.goto(base + '/fr');
  assert.equal(await staticPage.locator('h1').isVisible(), true);
  assert.equal(await staticPage.locator('.no-js-navigation').isVisible(), true);
  assert.equal(await staticPage.locator('.research-pathways').isVisible(), true);
  assert.ok(await staticPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await noJS.close();

  const reduced = await browser.newContext({ reducedMotion: 'reduce' });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto(base + '/explorer');
  assert.equal(await reducedPage.locator('.reveal-on-scroll').first().evaluate(element => getComputedStyle(element).opacity), '1');
  await reduced.close();

  // Each delivered source-directory target must be a useful search URL.
  await page.goto(base + '/en');
  for (const href of await page.locator('.source-directory a').evaluateAll(elements => elements.map(element => element.href))) {
    assert.ok(new URL(href).searchParams.get('query'));
  }
  const art = await readFile(new URL('../public/assets/public-record.webp', import.meta.url));
  assert.ok(art.byteLength < 100_000, `Artwork size ${art.byteLength} exceeds budget`);
  assert.deepEqual(errors, [], `Browser errors: ${JSON.stringify(errors)}`);
  await writeFile(`${output}/results.json`, JSON.stringify({ base, routes: results, interactions: 'passed', browserErrors: errors, artworkBytes: art.byteLength }, null, 2));
  console.log(`PASS: ${results.length} responsive route checks; menu, keyboard, locale, SPA, clipboard, search, auth display, no-JS, and reduced motion. Evidence: ${output}`);
} finally {
  await browser.close();
}
