#!/usr/bin/env node
/**
 * Prod-build smoke test — asserts the design-logic invariants that have
 * broken in production builds while passing in `astro dev`:
 *
 *  1. Language toggle never targets .html-suffixed or self-looping URLs
 *     (build.format: 'file' makes Astro.url.pathname carry /index.html,
 *     /pricing.html etc. — the switcher must normalize them).
 *  2. The dashboard Overview tab is active in the built HTML.
 *  3. The reveal-on-scroll observer ships in dist/script.js (content would
 *     otherwise stay at opacity: 0 — the "invisible pages" regression).
 *  4. Theme-toggle + mobile-menu binding guards shipped (SPA re-bind fixes).
 *  5. Pricing/signup numbers match src/data/plans.json (single source of
 *     truth — a hand-edit that drifts from the API fails here).
 *  6. No leftover hardcoded stat claims in built meta descriptions.
 *
 * Usage: node scripts/smoke-test-dist.mjs   (after `pnpm build`)
 * Exits non-zero on any failed assertion.
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, "../dist");
const DATA = resolve(__dirname, "../src/data");

let failures = 0;
const checks = [];
const fail = (msg) => {
  failures++;
  checks.push(`  ✗ ${msg}`);
};
const pass = (msg) => checks.push(`  ✓ ${msg}`);

function read(rel) {
  const p = join(DIST, rel);
  if (!existsSync(p)) return null;
  return readFileSync(p, "utf8");
}

if (!existsSync(DIST)) {
  console.error("smoke-test-dist: dist/ not found — run `pnpm build` first.");
  process.exit(1);
}

// ── 1. Language toggle targets ────────────────────────────────────
const index = read("index.html") ?? "";
const frLanding = read("fr.html") ?? "";
const pricing = read("pricing.html") ?? "";
const frPricing = read("fr/pricing.html") ?? "";

const toggleHref = (html, want) => new RegExp(`href=["']?${want}["'\\s>]`).test(html);

if (toggleHref(index, "/fr")) pass("index → FR toggle targets /fr");
else fail("index.html is missing an FR toggle targeting /fr");

if (toggleHref(frLanding, "/en")) pass("fr.html → EN toggle targets /en");
else fail("fr.html is missing an EN toggle targeting /en");

if (toggleHref(pricing, "/fr/pricing")) pass("pricing → FR toggle targets /fr/pricing");
else fail("pricing.html is missing an FR toggle targeting /fr/pricing");

if (toggleHref(frPricing, "/pricing")) pass("fr/pricing → EN toggle targets /pricing");
else fail("fr/pricing.html is missing an EN toggle targeting /pricing");

// No .html-suffixed locale targets anywhere in built HTML (the 404/self-loop bug).
const htmlFiles = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith(".html")) htmlFiles.push(p);
  }
})(DIST);
let htmlSuffixHits = 0;
for (const f of htmlFiles) {
  const content = readFileSync(f, "utf8");
  const hits = content.match(/href=["']?\/(en|fr)\/[^"'\s]*\.html["'?\s>]/g) ?? [];
  htmlSuffixHits += hits.length;
}
if (htmlSuffixHits === 0) pass("no .html-suffixed locale toggle targets across dist");
else fail(`${htmlSuffixHits} .html-suffixed locale toggle target(s) found in dist`);

// ── 2. Dashboard Overview tab active ──────────────────────────────
const dashboard = read("dashboard.html") ?? "";
if (dashboard.includes("bg-primary text-primary-foreground"))
  pass("dashboard Overview tab rendered active");
else fail("dashboard.html Overview tab is not active (pathname check broken in prod?)");

// ── 3. Reveal observer shipped ────────────────────────────────────
const scriptJs = read("script.js") ?? "";
if (scriptJs.includes("reveal-on-scroll") && scriptJs.includes("is-visible"))
  pass("reveal-on-scroll observer shipped in dist/script.js");
else fail("dist/script.js is missing the reveal-on-scroll observer");

// ── 4. SPA re-bind guards shipped ─────────────────────────────────
if (scriptJs.includes("themeBound")) pass("theme-toggle re-bind guard shipped");
else fail("dist/script.js is missing the themeBound re-bind guard");
// Astro can inline small modules or emit larger ones as bundled assets.
// Check both delivered forms so the guard survives build optimisation.
const headerScripts = [...index.matchAll(/<script[^>]+src=["']([^"']+)["']/g)]
  .map((match) => match[1].replace(/^\//, ''))
  .filter((path) => path.startsWith('_astro/'))
  .map((path) => read(path) ?? '')
  .join('\n') + '\n' + [...index.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(match => match[1]).join('\n');
if (headerScripts.includes("menuBound") && headerScripts.includes("astro:page-load"))
  pass("bundled mobile-menu dedup and SPA guards shipped");
else fail("built header script is missing the mobile-menu dedup or SPA guard");

// ── 5. Pricing numbers match plans.json ───────────────────────────
try {
  const plans = JSON.parse(readFileSync(join(DATA, "plans.json"), "utf8")).plans;
  const pro = plans.find((p) => p.plan_id === "pro");
  const free = plans.find((p) => p.plan_id === "free");
  const biz = plans.find((p) => p.plan_id === "business");
  const money = (c) => `$${Math.round(c / 100)}`;
  const n = (v) => (v ?? 0).toLocaleString("en-CA");

  const wantPricing = [money(pro.price_cents), `${n(pro.credits_per_month)} API calls`, `${n(free.credits_per_month)}/mo`];
  for (const w of wantPricing) {
    if (pricing.includes(w)) pass(`pricing.html contains ${w}`);
    else fail(`pricing.html missing ${w} (drift from plans.json?)`);
  }
  const wantSignup = [money(pro.price_cents), `${n(pro.credits_per_month)} API calls`, `${pro.rate_limit_per_min} req/min`];
  for (const w of wantSignup) {
    if ((read("signup.html") ?? "").includes(w)) pass(`signup.html contains ${w}`);
    else fail(`signup.html missing ${w} (drift from plans.json?)`);
  }
} catch (e) {
  fail(`could not read plans.json for number checks: ${e.message}`);
}

// ── 6. No hardcoded stat claims in meta descriptions ──────────────
const staleClaims = [
  "208 modules · 165 MCP",
  "174 MCP tools",
  "174 outils MCP",
  "175 MCP tools",
  "165 MCP tools",
  "206 data modules",
  "206 modules de données",
  "206 Canadian government",
  "206 ingestion modules",
];
for (const f of htmlFiles) {
  const content = readFileSync(f, "utf8");
  for (const claim of staleClaims) {
    if (content.includes(claim)) {
      fail(`${f} still contains stale claim "${claim}"`);
      break;
    }
  }
}

// ── 7. Current stats/catalog numbers present (positive check — catches
//      pages that hardcode a NEW count instead of reading the source). ──
try {
  const stats = JSON.parse(readFileSync(join(DATA, "stats.json"), "utf8"));
  const tools = JSON.parse(readFileSync(join(DATA, "tools.json"), "utf8"));
  const catalog = tools.tools.length;
  const want = [
    ["index.html", `${stats.tools} MCP tools`], // index.astro description
    ["fr.html", `${stats.tools}+ outils MCP`],   // BaseLayout fr default description
    ["signup.html", `${stats.modules} Data Modules`],
    ["signup.html", `${stats.tools} MCP Tools`],
    ["docs.html", `${catalog} TOOLS`],           // docs badge == generated catalog size
    ["docs.html", `${catalog} MCP tools`],       // docs table caption
    ["pricing.html", `${stats.modules} modules`], // pricing feature row
  ];
  for (const [rel, claim] of want) {
    const content = read(rel) ?? "";
    if (content.includes(claim)) pass(`${rel} contains current stat "${claim}"`);
    else fail(`${rel} missing current stat "${claim}" (hardcoded elsewhere?)`);
  }
  if (catalog < stats.tools) {
    fail(`docs catalog (${catalog}) is SMALLER than live tools (${stats.tools}) — catalog stale?`);
  }
} catch (e) {
  fail(`could not read stats.json for positive checks: ${e.message}`);
}

// ── 8. Agent discovery artifacts (MCP server cards, agent card, llms pointers) ──
try {
  const metrics = JSON.parse(readFileSync(resolve(__dirname, "../../../docs/metrics.json"), "utf8"));

  const cardsRaw = read(".well-known/mcp/server-cards.json");
  if (!cardsRaw) {
    fail("dist/.well-known/mcp/server-cards.json missing — run scripts/sync-discovery.mjs after build");
  } else {
    const card = JSON.parse(cardsRaw);
    if (card.name === "ca.maplespike/quill") pass("MCP server card present with canonical name");
    else fail(`MCP server card name drifted: ${card.name}`);
    if ((card.remotes?.[0]?.url ?? "") === "https://mcp.maplespike.ca/sse") pass("MCP server card points at the SSE endpoint");
    else fail("MCP server card remote url missing/incorrect");
  }

  if (read(".well-known/mcp/server-card.json")) pass("singular server-card.json alias shipped");
  else fail("dist/.well-known/mcp/server-card.json missing");

  const agentCardRaw = read("agent-card.json");
  if (!agentCardRaw) {
    fail("dist/agent-card.json missing");
  } else {
    const agentCard = JSON.parse(agentCardRaw);
    if (agentCard.counts?.modules === metrics.modules.registryCount && agentCard.counts?.mcpTools === metrics.mcpTools.count) {
      pass("agent-card.json counts match docs/metrics.json");
    } else {
      fail(`agent-card.json counts drifted (got ${agentCard.counts?.modules}/${agentCard.counts?.mcpTools}, want ${metrics.modules.registryCount}/${metrics.mcpTools.count})`);
    }
  }

  const llms = read("llms.txt") ?? "";
  for (const needle of ["mcp.maplespike.ca/sse", ".well-known/mcp/server-cards.json", "/v1/claims/latest"]) {
    if (llms.includes(needle)) pass(`dist/llms.txt references ${needle}`);
    else fail(`dist/llms.txt missing ${needle}`);
  }
} catch (e) {
  fail(`discovery artifact checks errored: ${e.message}`);
}

// ── Report ────────────────────────────────────────────────────────
console.log("smoke-test-dist:" );
console.log(checks.join("\n"));
if (failures > 0) {
  console.error(`\n${failures} assertion(s) FAILED — fix before deploying.`);
  process.exit(1);
}
console.log("\nAll assertions passed.");
