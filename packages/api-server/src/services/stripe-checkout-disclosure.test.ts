import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkoutRenewalMessage, checkoutSessionParams } from './stripe.js';

const session = {
  customerId: 'cus_test',
  amountCents: 5650,
  currency: 'cad',
  productName: 'MapleSpike Pro',
  planId: 'pro',
  tenantId: 'ten_test',
  orderId: 'ord_test',
  intervalMonths: 1,
  successUrl: 'https://quill.maplespike.ca/dashboard',
  cancelUrl: 'https://quill.maplespike.ca/pricing',
  expiresAtUnix: 1_700_000_000,
  renewalAmountCents: 5000,
};

describe('checkout renewal disclosure', () => {
  it('puts the CAD amount, monthly renewal, and cancellation timing on the pay button', () => {
    const message = checkoutRenewalMessage({
      productName: 'MapleSpike Pro',
      amountCents: 5000,
      currency: 'cad',
    });
    assert.match(message, /MapleSpike Pro is \$50 CAD per month/);
    assert.match(message, /renews automatically each month until you cancel/);
    assert.match(message, /end of the current billing period/);
    assert.match(message, /keep paid access until then/);
  });

  it('uses the catalog price in the session message, including French', () => {
    const form = checkoutSessionParams({ ...session, locale: 'fr' });
    const message = String(form['custom_text[submit][message]']);
    assert.equal(form['line_items[0][price_data][unit_amount]'], 5650);
    assert.equal(form.locale, 'fr');
    assert.match(message, /Le forfait MapleSpike Pro coûte 50 \$ CA par mois/);
    assert.match(message, /se renouvelle automatiquement chaque mois/);
    assert.match(message, /fin de la période de facturation en cours/);
    assert.equal(message.includes('5650'), false);
    assert.equal(message.includes('$56'), false);
  });
});
