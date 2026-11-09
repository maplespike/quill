import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { renewalDisclosure } from '../src/lib/renewal-disclosure';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

describe('renewal disclosure copy', () => {
  test('states the CAD amount, monthly interval, auto-renewal, and cancellation timing', () => {
    const pro = renewalDisclosure('en', 'pro');
    expect(pro).toContain('Pro is $50 CAD per month');
    expect(pro).toContain('renews automatically each month until you cancel');
    expect(pro).toContain('end of the current billing period');
    expect(pro).toContain('keep paid access until then');

    const business = renewalDisclosure('en', 'business');
    expect(business).toContain('Business is $200 CAD per month');
    expect(business).toContain('renews automatically each month');

    const proFr = renewalDisclosure('fr', 'pro');
    expect(proFr).toContain('Le forfait Pro coûte 50 $ CA par mois');
    expect(proFr).toContain('se renouvelle automatiquement chaque mois');
    expect(proFr).toContain('fin de la période de facturation en cours');

    const businessFr = renewalDisclosure('fr', 'business');
    expect(businessFr).toContain('Le forfait Affaires coûte 200 $ CA par mois');
    expect(businessFr).toContain("jusqu'à l'annulation");
  });
});

describe('purchase surfaces show the disclosure before the pay action', () => {
  test('checkout places both plan disclosures immediately before the embedded checkout', () => {
    const checkout = read('src/pages/checkout.astro');
    const disclosure = checkout.indexOf('<RenewalDisclosure');
    const purchase = checkout.indexOf('<EmbeddedCheckoutIsland');
    expect(disclosure).toBeGreaterThan(-1);
    expect(purchase).toBeGreaterThan(disclosure);
    expect(checkout.slice(disclosure, purchase)).toContain('planId="pro"');
    expect(checkout.slice(disclosure, purchase)).toContain('planId="business"');
    expect(checkout.slice(disclosure, purchase)).toContain('data-renewal-slot');
    expect(checkout.slice(disclosure, purchase)).not.toContain('<EmbeddedCheckoutIsland');
  });

  test('pricing places a disclosure immediately before each paid checkout button', () => {
    const pricing = read('src/pages/pricing.astro');
    const parts = pricing.split('<StripeCheckoutButton');
    expect(parts).toHaveLength(3);
    for (const before of parts.slice(0, -1)) {
      expect(before.lastIndexOf('<RenewalDisclosure')).toBeGreaterThan(-1);
      const tail = before.slice(before.lastIndexOf('<RenewalDisclosure'));
      expect(tail).not.toMatch(/<Button|<a /);
    }
  });

  test('terms use the same disclosure sentences', () => {
    const terms = read('src/pages/terms.astro');
    expect(terms).toContain('renewalDisclosure(lang, "pro")');
    expect(terms).toContain('renewalDisclosure(lang, "business")');
    expect(terms).toContain('before you pay');
    expect(terms).toContain('avant que vous payiez');
  });
});
