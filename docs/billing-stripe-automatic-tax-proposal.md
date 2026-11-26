# Proposal: Stripe Tax (`automatic_tax`) instead of a flat 13% HST

Status: **proposal only — nothing switches.** Checkout keeps charging 0% tax
while `GST_HST_REGISTERED` is anything but the literal `true` (covered by
`src/__tests__/tax-unregistered-checkout.test.ts`). This doc is for Maple
(owner) and whoever does the books; the tax facts below should be confirmed
with an accountant before any flag is flipped.

## Why the current registered path is wrong

`tax-ledger.ts` has one rate, `HST_RATE_ON = 0.13`, applied to every customer
once `GST_HST_REGISTERED=true`. That is Ontario's HST. Quill is operated from
**Manitoba**, which does not use HST:

- Manitoba charges **GST 5%** (federal) plus **RST/PST 7%** (provincial, a
  separate registration with Manitoba Finance, not CRA).
- Under the GST/HST place-of-supply rules, the federal component of a sale of
  an online service to a Canadian customer generally follows the **customer's**
  province: 5% GST in GST-only provinces, HST at the HST-province rate
  (e.g. Ontario 13%, the Atlantic provinces 14–15%).
- Provincial sales taxes (MB RST, BC PST, SK PST, QC QST) each have their own
  registration and digital-services rules.

So a flat 13% would over-charge most customers (e.g. a Manitoba buyer should
see GST 5% + RST 7%, not 13%), under-charge Atlantic HST provinces, and
mis-label the tax on invoices. Hand-maintaining a province table in code is
the wrong fix; Stripe Tax already does place-of-supply calculation.

## Proposed design

1. **New flag `STRIPE_AUTOMATIC_TAX`**, default off. When off, behaviour is
   exactly today's (0% while unregistered; the existing `computeHst` path is
   untouched).
2. When on **and** `GST_HST_REGISTERED=true`:
   - Checkout Session gets `automatic_tax[enabled]=true` and
     `billing_address_collection=required` (or
     `customer_update[address]=auto` for existing customers), so Stripe has a
     location to compute against.
   - `computeHst` is **not** added to the amount — Stripe adds tax on top of
     the price. The line item amount is the plan price.
   - Prices are `tax_behavior=exclusive` (the live lookup-key prices
     `quill_pro_monthly` / `quill_business_monthly` already are; the inline
     `price_data` path must set `tax_behavior=exclusive` too).
   - Products carry a Stripe tax code for SaaS (business use vs personal use —
     pick from Stripe's tax-code list with the accountant).
   - Optional: `tax_id_collection[enabled]=true` so business buyers can add a
     GST/HST number to the invoice.
3. **Fail closed.** If `STRIPE_AUTOMATIC_TAX=true` but `GST_HST_REGISTERED` is
   not `true`, or Stripe Tax has no active registrations
   (`GET /v1/tax/registrations`), checkout returns 503 rather than charging
   tax unregistered or silently charging none. Startup logs the mismatch.
   Lookup-key checkout (#1422) already fails closed when HST is registered;
   this flag is what would replace that guard.
4. **Ledger.** The CRA small-supplier threshold is on taxable revenue
   **before** tax. With automatic tax, `invoice.payment_succeeded` must record
   `amount_paid − total tax` (from the invoice's tax amounts), and the tax
   collected should be recorded separately for remittance reporting. Refunds
   need the same split.
5. **Portal copy.** Pricing stays "$50 CAD / month" with a "plus applicable
   taxes" note once the flag is on; Checkout shows the tax line itself.

## What Maple / Infra must set up first (Stripe dashboard, test mode first)

- Stripe Tax enabled; head-office address = Manitoba.
- Registrations entered for every registration actually held (CRA GST/HST
  number; Manitoba RST; any other provinces only if registered there).
- Default product tax code + `tax_behavior=exclusive` on the live prices.
- Then: `GST_HST_REGISTERED=true`, `STRIPE_AUTOMATIC_TAX=true` in staging
  (Stripe test mode) before production.

## Test plan (when implemented)

- Flag off: identical request bodies to today (snapshot test), 0% while
  unregistered.
- Flag on + registered: session has `automatic_tax[enabled]=true`, address
  collection, no `computeHst` uplift on `unit_amount`.
- Flag on + unregistered, or no Stripe registrations: 503, no session created.
- Ledger: an invoice with tax records pre-tax revenue toward the threshold.
- Staging e2e in Stripe test mode with a Manitoba and an Ontario test address
  (expect GST+RST vs 13% HST).

## Out of scope

Switching anything now, changing `HST_RATE_ON`, or calling live Stripe.
