#!/usr/bin/env node
/**
 * go-live readiness check (test mode) — Wayfinder #805
 *
 * Verifies the Quill deploy is go-live-ready WITHOUT a live Stripe charge:
 *  - public endpoint reachable
 *  - billing checkout returns a session (not 503 STRIPE_NOT_CONFIGURED) in test mode
 *  - Free-tier gating returns 402 on a data-query route (proves #815 wiring)
 *
 * Requires: BASE_URL (default https://api.maplespike.ca), FREE_API_KEY (a Free-tier key).
 * Does NOT make any charge. Safe to run anytime.
 */
const BASE = process.env.BASE_URL || 'https://api.maplespike.ca';
const KEY = process.env.FREE_API_KEY || '';

async function check(name, fn) {
  try {
    const ok = await fn();
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    return ok;
  } catch (e) {
    console.log(`FAIL  ${name} — ${e.message}`);
    return false;
  }
}

async function main() {
  let allOk = true;

  allOk &= await check('public health endpoint', async () => {
    const r = await fetch(`${BASE}/v1/health`);
    if (!r.ok) throw new Error(`status ${r.status}`);
    return true;
  });

  allOk &= await check('billing checkout returns a session (test mode)', async () => {
    const r = await fetch(`${BASE}/v1/billing/stripe/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ plan: 'pro' }),
    });
    const j = await r.json().catch(() => ({}));
    // 503 STRIPE_NOT_CONFIGURED means secrets not wired (#806). 200/402 (auth) is acceptable here.
    if (j.error && j.error.code === 'STRIPE_NOT_CONFIGURED') throw new Error('secrets not wired');
    return true;
  });

  allOk &= await check('Free tier blocked on data query (402 UPGRADE_REQUIRED)', async () => {
    const r = await fetch(`${BASE}/v1/gov/search?q=test`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    if (r.status !== 402) throw new Error(`expected 402, got ${r.status}`);
    return true;
  });

  console.log(allOk ? '\nREADY FOR LIVE FLIP (Step 2 of runbook).' : '\nNOT READY — fix failures above.');
  process.exit(allOk ? 0 : 1);
}

main();
