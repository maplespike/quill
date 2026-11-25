/**
 * Billing copy drift (audit item 6): the documented checkout endpoint must be
 * the one the router actually serves, and the portal's generated plan catalog
 * must match the backend plan definitions.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeCtx } from './_helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');

describe('billing copy drift', () => {
  it('OpenAPI documents POST /v1/billing/stripe/checkout (plan_id), not the unrouted /v1/billing/checkout', async () => {
    const { openApiHandler } = await import('../routes/openapi.js');
    const res = await openApiHandler(new Request('http://test.local/v1/openapi.json'), makeCtx(), {});
    const body = (await res.json()) as { data: { paths: Record<string, any> } };
    const paths = body.data.paths;
    assert.equal(paths['/v1/billing/checkout'], undefined);
    const op = paths['/v1/billing/stripe/checkout']?.post;
    assert.ok(op, 'stripe checkout documented');
    const schema = op.requestBody.content['application/json'].schema;
    assert.deepEqual(schema.required, ['plan_id']);
    assert.deepEqual(schema.properties.plan_id.enum, ['pro', 'business']);
  });

  it('served /llms.txt lists the real checkout route', async () => {
    const { llmsTxtHandler } = await import('../routes/llms.js');
    const res = await llmsTxtHandler(new Request('http://test.local/llms.txt'), makeCtx(), {});
    const text = await res.text();
    assert.match(text, /\/v1\/billing\/stripe\/checkout/);
    assert.doesNotMatch(text, /\/v1\/billing\/checkout\b/);
  });

  it('router really serves POST /v1/billing/stripe/checkout and not /v1/billing/checkout', () => {
    const index = fs.readFileSync(path.join(here, '../index.ts'), 'utf8');
    assert.match(index, /\\\/v1\\\/billing\\\/stripe\\\/checkout\\\/\?\$\/, method: 'POST'/);
    assert.doesNotMatch(index, /\\\/v1\\\/billing\\\/checkout\\\//);
  });

  it('portal plans.json matches backend PLANS and Stripe amounts (Pro $50/50k, Business $200/250k CAD)', async () => {
    const plans = JSON.parse(
      fs.readFileSync(path.join(repo, 'packages/portal/src/data/plans.json'), 'utf8'),
    ) as { plans: Array<{ plan_id: string; price_cents: number; credits_per_month: number | null }> };
    const by = new Map(plans.plans.map((p) => [p.plan_id, p]));
    assert.equal(by.get('pro')?.price_cents, 5000);
    assert.equal(by.get('pro')?.credits_per_month, 50000);
    assert.equal(by.get('business')?.price_cents, 20000);
    assert.equal(by.get('business')?.credits_per_month, 250000);
    assert.equal(by.get('free')?.price_cents, 0);
    // Backend sources of truth: routes/billing.ts PLANS and the Stripe charge amounts.
    const billing = fs.readFileSync(path.join(here, '../routes/billing.ts'), 'utf8');
    for (const [id, cents, credits] of [['pro', 5000, 50000], ['business', 20000, 250000]] as const) {
      const block = billing.slice(billing.indexOf(`  ${id}: {`), billing.indexOf('features:', billing.indexOf(`  ${id}: {`)));
      assert.match(block, new RegExp(`price_cents: ${cents},`));
      assert.match(block, new RegExp(`credits_per_month: ${credits},`));
    }
    const stripeRoutes = fs.readFileSync(path.join(here, '../routes/billing-stripe.ts'), 'utf8');
    const stripePlans = stripeRoutes.slice(stripeRoutes.indexOf('const STRIPE_PLANS'), stripeRoutes.indexOf('};', stripeRoutes.indexOf('const STRIPE_PLANS')));
    assert.match(stripePlans, /pro: \{\s+amount_cents: 5000,\s+currency: 'cad'/);
    assert.match(stripePlans, /business: \{\s+amount_cents: 20000,\s+currency: 'cad'/);
  });
});
