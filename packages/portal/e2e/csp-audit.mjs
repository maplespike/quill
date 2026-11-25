#!/usr/bin/env node
/**
 * Does the portal actually work under its own CSP?
 *
 * WHY THIS EXISTS
 * ---------------
 * A CSP is enforced by the browser, after our JavaScript has already decided it
 * succeeded. Nothing in a unit test, and nothing in the header itself, can tell
 * you whether a page still functions: on 2026-11-23 the checkout page shipped
 * with a policy that blocked Stripe.js, and every static test passed. This walks
 * the real pages in a real browser and fails on the browser's own violations.
 *
 * WHAT IT CHECKS
 * --------------
 * Every HTML route in the build is loaded with the policy from
 * `public/_headers` applied (served locally from `dist/`), and any
 * `securitypolicyviolation` event, page error, or console error fails the run.
 * That covers inline-script hashes, eval removal, img/font/connect origins and
 * anything else a dependency decides to fetch at runtime.
 *
 * RUN
 * ---
 *   node packages/portal/e2e/csp-audit.mjs              # build must exist: pnpm build
 *   node packages/portal/e2e/csp-audit.mjs --url https://quill.maplespike.ca
 *
 *   AUDIT_DIST       default dist
 *   AUDIT_HEADERS    default public/_headers  (source of the local policy)
 *   AUDIT_PORT       default 8099
 *   AUDIT_MAX        cap on routes audited (default: all)
 *
 * Exit 1 on any violation. A route that fails to load is a failure, not a skip.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";

const DIST = resolve(process.env.AUDIT_DIST || new URL("../../dist", import.meta.url).pathname);
const HEADERS_FILE = resolve(process.env.AUDIT_HEADERS || new URL("../public/_headers", import.meta.url).pathname);
const PORT = Number(process.env.AUDIT_PORT || 8099);
const MAX = Number(process.env.AUDIT_MAX || 0);

const urlFlag = process.argv.indexOf("--url");
const REMOTE = urlFlag > -1 ? process.argv[urlFlag + 1].replace(/\/$/, "") : "";
const BASE = REMOTE || `http://127.0.0.1:${PORT}`;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".map": "application/json",
};

/** Pull the `/*` policy — the one every route gets — out of the Pages header file. */
function readPolicy() {
  const text = readFileSync(HEADERS_FILE, "utf8");
  // One policy in the file, applied to `/*`; comments above it are prose, not
  // directives, and a commented-out policy would still match the same regex, so
  // require the line to start with optional whitespace and not a '#'.
  const line = text
    .split("\n")
    .find((l) => /^\s+Content-Security-Policy:\s*\S/i.test(l));
  if (!line) throw new Error(`no Content-Security-Policy in ${HEADERS_FILE}`);
  return line.slice(line.indexOf(":") + 1).trim();
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/** Astro writes `build.format: 'file'` — /checkout is dist/checkout.html. */
function routesFromDist() {
  if (!existsSync(DIST)) throw new Error(`${DIST} does not exist — run pnpm build first`);
  const routes = walk(DIST)
    .filter((path) => path.endsWith(".html"))
    .map((path) => {
      const relative = path.slice(DIST.length + 1).replace(/\.html$/, "");
      return relative === "index" ? "/" : `/${relative}`;
    })
    .sort();
  return MAX > 0 ? routes.slice(0, MAX) : routes;
}

function serveWithPolicy(policy) {
  const server = createServer((req, res) => {
    let path = decodeURIComponent((req.url || "/").split("?")[0]);
    if (path.endsWith("/")) path += "index.html";
    let file = join(DIST, path);
    // Guard against ../ traversal once, before touching the filesystem.
    if (!resolve(file).startsWith(DIST + sep) && resolve(file) !== DIST) {
      res.writeHead(403).end("forbidden");
      return;
    }
    if (!existsSync(file) || statSync(file).isDirectory()) {
      const html = `${file.replace(/\.html$/, "")}.html`;
      if (existsSync(html)) file = html;
      else if (existsSync(join(DIST, "404.html"))) {
        res.writeHead(404, { "Content-Type": MIME[".html"], "Content-Security-Policy": policy });
        res.end(readFileSync(join(DIST, "404.html")));
        return;
      } else {
        res.writeHead(404).end("not found");
        return;
      }
    }
    res.writeHead(200, {
      "Content-Type": MIME[extname(file)] || "application/octet-stream",
      // The same policy Cloudflare Pages serves, so a header-only regression
      // (missing js.stripe.com, a missing frame-src) fails here.
      "Content-Security-Policy": policy,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(PORT, "127.0.0.1", () => ok(server)));
}

/**
 * Remote mode does not need a build: the deployed sitemap already lists the
 * routes. That is what lets the scheduled CI run audit production without
 * paying for a build, and lets a deploy be checked from any host.
 */
async function routesFromRemote() {
  const response = await fetch(`${BASE}/sitemap.xml`);
  if (!response.ok) {
    throw new Error(
      `no ${DIST} and ${BASE}/sitemap.xml returned ${response.status} — build first, or pass AUDIT_DIST`,
    );
  }
  const xml = await response.text();
  const routes = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => {
      try {
        return new URL(match[1]).pathname;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const unique = [...new Set(routes)].sort();
  return MAX > 0 ? unique.slice(0, MAX) : unique;
}

const policy = REMOTE ? "" : readPolicy();
const routes = REMOTE && !existsSync(DIST) ? await routesFromRemote() : routesFromDist();
if (!REMOTE) console.log(`policy: ${policy}\n`);

const server = REMOTE ? null : await serveWithPolicy(policy);
// Bundled Chromium, same as checkout-embedded.mjs. Do not use the `chrome`
// channel: ARC runners have no Google Chrome at /opt/google/chrome.
const EXEC = (process.env.E2E_EXECUTABLE_PATH || "").trim();
const browser = await chromium.launch(
  EXEC ? { executablePath: EXEC, args: ["--no-sandbox"] } : { args: ["--no-sandbox"] },
);

const problems = [];
let audited = 0;

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Recorded before any page script runs, so even a violation during the first
  // inline script is captured.
  await context.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__cspViolations.push({
        directive: event.violatedDirective,
        blocked: event.blockedURI,
        source: event.sourceFile,
        line: event.lineNumber,
        sample: (event.sample || "").slice(0, 120),
      });
    });
  });

  for (const route of routes) {
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 45_000 });
      // Let hydration and any deferred script lookups settle.
      await page.waitForTimeout(250);
      const violations = await page.evaluate(() => window.__cspViolations || []);
      for (const v of violations) {
        problems.push(
          `${route}  ${v.directive} blocked ${v.blocked || "<inline>"}` +
            (v.source ? ` at ${v.source}:${v.line}` : "") +
            (v.sample ? `  sample=${JSON.stringify(v.sample)}` : ""),
        );
      }
      // A violation usually also prints a console error; treat CSP-looking
      // errors as problems even when the event was lost (e.g. a worker).
      for (const text of consoleErrors.filter((t) => /Content Security Policy|CSP/i.test(t))) {
        if (!problems.some((p) => p.startsWith(route))) problems.push(`${route}  console: ${text}`);
      }
      audited += 1;
    } catch (error) {
      problems.push(`${route}  failed to load: ${error.message}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  if (server) await new Promise((ok) => server.close(ok));
}

console.log(`\naudited ${audited}/${routes.length} routes under ${BASE}`);
if (problems.length) {
  console.error(`\n${problems.length} CSP violation(s):`);
  for (const problem of problems.slice(0, 40)) console.error(`  ${problem}`);
  if (problems.length > 40) console.error(`  … ${problems.length - 40} more`);
  process.exit(1);
}
console.log("no Content-Security-Policy violations — every route works under the policy it ships with");
