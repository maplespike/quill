#!/usr/bin/env node
/**
 * Screenshot-driven check: the embedded checkout form mounts for a signed-in visitor.
 *
 * WHAT THIS PROVES
 * ----------------
 * The two bugs that made "Sign in first" permanent were (1) the island reading
 * only `window.MAPLESPIKE.apiKey`, which every shipped config leaves empty, and
 * (2) the api sending the retired `ui_mode=embedded`. Neither is visible to a
 * unit test: one is a browser-storage read, the other is a Stripe-side 400. This
 * script drives the real page in a real browser and asserts the end of that path:
 * a credential from `localStorage['quill-api-key']` becomes an `Authorization`
 * header, and the returned `client_secret` becomes a mounted payment form.
 *
 * HOW IT AVOIDS CHARGING ANYONE
 * -----------------------------
 * Only the *request* is intercepted: `POST /v1/billing/stripe/checkout` is
 * fulfilled with a `client_secret` for a real Stripe session that this check
 * owns and expires afterwards (`E2E_CLIENT_SECRET_FILE`). No tenant, no customer,
 * no order row is created, and nothing is ever submitted — the assertion stops at
 * "the form rendered". The publishable key still comes from the deployed bundle,
 * so a build with the wrong key mode fails here exactly as it would for a visitor.
 *
 * RUN
 * ---
 *   node packages/portal/e2e/checkout-embedded.mjs
 *
 *   E2E_BASE_URL             default https://quill.maplespike.ca
 *   E2E_CLIENT_SECRET_FILE   path to a file holding a live/test `cs_..._secret`.
 *                            Absent -> the check SKIPs (exit 0) and says so.
 *   E2E_STRIPE_SECRET_KEY[_FILE]
 *                            a test-mode `sk_test_...`: the check then creates its
 *                            own session and expires it, which is how CI runs this
 *                            with no live key and no operator involvement.
 *   E2E_PUBLISHABLE_KEY      `pk_test_...` override, injected as
 *                            window.MAPLESPIKE.stripePublishableKey at document
 *                            start. Required with a test-mode secret: the deployed
 *                            bundle carries the live key, and Stripe refuses to
 *                            mount a test-mode client_secret with it.
 *   E2E_SCREENSHOT           default /tmp/quill-checkout-embedded.png
 *   E2E_BROWSER_CHANNEL      default `chrome` (system Chrome); set to `chromium`
 *                            to use Playwright's own download.
 *   E2E_EXECUTABLE_PATH      explicit browser binary; otherwise /usr/bin/chromium
 *                            is used when present.
 *
 * Exit 0 = passed or skipped, 1 = failed. A skip is printed loudly on purpose:
 * "green because nothing ran" is the failure mode this whole exercise is about.
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname } from "node:path";

const BASE = (process.env.E2E_BASE_URL || "https://quill.maplespike.ca").replace(/\/$/, "");
const SECRET_FILE = process.env.E2E_CLIENT_SECRET_FILE || "";
const STRIPE_KEY_FILE = process.env.E2E_STRIPE_SECRET_KEY_FILE || "";
const STRIPE_KEY = (process.env.E2E_STRIPE_SECRET_KEY || "").trim();
const PUBLISHABLE = (process.env.E2E_PUBLISHABLE_KEY || "").trim();
const OUT = process.env.E2E_SCREENSHOT || "/tmp/quill-checkout-embedded.png";
const CHANNEL = process.env.E2E_BROWSER_CHANNEL || "chrome";
const API_PATTERN = "**/v1/billing/stripe/checkout";
const STORAGE_KEY = "quill-api-key";
const FIXTURE_KEY = "quill_e2e_fixture_key";

const failures = [];
function fail(what) {
  failures.push(what);
  console.error(`FAIL  ${what}`);
}
function pass(what) {
  console.log(`ok    ${what}`);
}

function stripeSecretKey() {
  if (STRIPE_KEY) return STRIPE_KEY;
  if (STRIPE_KEY_FILE && existsSync(STRIPE_KEY_FILE)) return readFileSync(STRIPE_KEY_FILE, "utf8").trim();
  return "";
}

/**
 * Mint our own session so the check needs nobody's help: the CI path. Test mode
 * never moves money, and the session is expired in the `finally` below whether
 * the assertions pass or not.
 */
async function createSession(key) {
  const body = new URLSearchParams({
    mode: "payment",
    ui_mode: "embedded_page",
    return_url: `${BASE}/checkout/return`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "cad",
    "line_items[0][price_data][unit_amount]": "100",
    "line_items[0][price_data][product_data][name]": "e2e form check (never charged)",
    "metadata[order_id]": "e2e-form-check",
    expires_at: String(Math.floor(Date.now() / 1000) + 1800),
  });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`could not create a session (HTTP ${response.status}): ${json?.error?.message ?? "unknown"}`);
  }
  return { id: json.id, clientSecret: json.client_secret };
}

const secretKey = stripeSecretKey();
let ownedSession = null;
let clientSecret = "";

if (SECRET_FILE && existsSync(SECRET_FILE)) {
  clientSecret = readFileSync(SECRET_FILE, "utf8").trim();
} else if (secretKey) {
  try {
    ownedSession = await createSession(secretKey);
    clientSecret = ownedSession.clientSecret;
    console.log(`ok    created and own session ${ownedSession.id} (expired at the end)`);
  } catch (error) {
    console.error(`FAIL  ${error.message}`);
    process.exit(1);
  }
} else {
  console.log(
    "SKIP  no client_secret and no E2E_STRIPE_SECRET_KEY — the checkout form check did not run.\n" +
      "      This is a skip, not a pass. Provide one of them to actually verify the form.",
  );
  process.exit(0);
}

if (!/^cs_(test|live)_[^_]+_secret_/.test(clientSecret)) {
  console.error("FAIL  the client_secret does not look like a Stripe checkout session secret");
  process.exit(1);
}

// A test-mode secret cannot mount under the live publishable key baked into the
// deployed bundle. Say so instead of reporting a mysterious Stripe.js failure.
const secretIsTest = clientSecret.startsWith("cs_test_");
if (PUBLISHABLE && secretIsTest !== PUBLISHABLE.startsWith("pk_test_")) {
  console.error(
    `FAIL  key mode mismatch: session is ${secretIsTest ? "test" : "live"} but E2E_PUBLISHABLE_KEY is ${
      PUBLISHABLE.startsWith("pk_test_") ? "test" : "live"
    }`,
  );
  process.exit(1);
}

// Chromium is not always where Playwright's `chrome` channel expects it (this
// host has /usr/bin/chromium and no /opt/google/chrome). Prefer an explicit
// path, then the system chromium, then the channel.
const EXEC = process.env.E2E_EXECUTABLE_PATH || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : "");
const browser = await chromium.launch(
  EXEC ? { executablePath: EXEC, args: ["--no-sandbox"] } : { channel: CHANNEL, args: ["--no-sandbox"] },
);
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });

  // Exactly what signup / the OAuth callback / the workspace write on success.
  await context.addInitScript(
    ([key, value]) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* private mode: the check will fail below, which is the point */
      }
    },
    [STORAGE_KEY, FIXTURE_KEY],
  );

  // Runtime publishable key, exactly the path server.py's /config.js injection uses
  // (`resolvePublishableKey` prefers runtime over build-time). This is what lets CI
  // drive the deployed page in test mode without a live-mode session.
  if (PUBLISHABLE) {
    await context.addInitScript((pk) => {
      window.MAPLESPIKE = window.MAPLESPIKE || {};
      window.MAPLESPIKE.stripePublishableKey = pk;
    }, PUBLISHABLE);
  }

  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  let authorization = "";
  let billingCalls = 0;
  await page.route(API_PATTERN, async (route) => {
    billingCalls += 1;
    authorization = route.request().headers()["authorization"] || "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { client_secret: clientSecret } }),
    });
  });

  const navigated = await page
    .goto(`${BASE}/checkout`, { waitUntil: "domcontentloaded", timeout: 60_000 })
    .then(() => true)
    .catch((e) => (fail(`/checkout did not load: ${e.message}`), false));

  if (navigated) {
    // The old symptom. Its absence is the whole point of the fix.
    if (await page.getByText(/Sign in first/i).count()) {
      fail('the page still says "Sign in first" for a visitor with a stored key');
    } else {
      pass('no "Sign in first" message');
    }

    if (await page.getByText(/Checkout is not configured for this build/i).count()) {
      fail("the build is missing its publishable key");
    }

    // The credential bridge: a stored key must reach the api as a bearer token.
    const gotForm = await page
      .waitForSelector("#embedded-checkout iframe", { timeout: 45_000 })
      .then(() => true)
      .catch(() => false);

    if (billingCalls === 0) {
      fail("the page never called POST /v1/billing/stripe/checkout");
    } else if (authorization !== `Bearer ${FIXTURE_KEY}`) {
      fail(`the stored key did not reach the api (Authorization: ${authorization || "<none>"})`);
    } else {
      pass(`stored credential reached the api as Bearer (${billingCalls} call(s))`);
    }

    if (gotForm) {
      pass("Stripe embedded form mounted inside #embedded-checkout");
    } else {
      // Say WHY, not just that it did not: the page's own error text plus the
      // browser console is the difference between "CSP blocked Stripe.js" and
      // "the session was invalid".
      const text = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
      const box = text.match(/Checkout could not start[\s\S]{0,180}/);
      fail(
        "no iframe appeared inside #embedded-checkout within 45s" +
          (box ? ` — page says: ${box[0].trim()}` : "") +
          (consoleErrors.length ? ` — console: ${consoleErrors.slice(0, 3).join(" | ")}` : ""),
      );
    }

    // Give the iframe a moment to paint before the screenshot.
    await page.waitForTimeout(2_500);
    mkdirSync(dirname(OUT), { recursive: true });
    await page.screenshot({ path: OUT, fullPage: true });
    const shot = existsSync(OUT) ? statSync(OUT).size : 0;
    if (shot > 10_000) pass(`screenshot ${OUT} (${Math.round(shot / 1024)} KiB)`);
    else fail(`screenshot ${OUT} is missing or empty (${shot} bytes)`);
  }
} finally {
  await browser.close();
  if (ownedSession) {
    await fetch(`https://api.stripe.com/v1/checkout/sessions/${ownedSession.id}/expire`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    })
      .then(async (r) => {
        const body = await r.json();
        console.log(`ok    expired session ${ownedSession.id} (${body.status ?? r.status})`);
      })
      .catch((e) => console.error(`WARN  could not expire ${ownedSession.id}: ${e.message}`));
  }
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log(`\nall checks passed — embedded checkout form rendered at ${BASE}/checkout`);
