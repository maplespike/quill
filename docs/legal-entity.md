# Legal Entity & Stripe Account Holder — Go-Live Decision

**Wayfinder ticket:** #810 (G1 from #804 decision 1)
**Decision (per grilling #804):** Not yet formalized. Minimum valid path = **sole proprietorship**
holding the Stripe account. Incorporation deferred until revenue justifies it.

## What must be true before the first live charge

1. **A legal person holds the Stripe account.** Stripe requires a legal entity or an individual.
   Until incorporated, **j_kro operates as a sole proprietor** — the Stripe account is opened in
   j_kro's personal name, and revenue is personal income (reported on the T1).
2. **Stripe account = Canada, CAD.** Account country = Canada; default currency CAD. (See #799 —
   account must be activated + CAD enabled before live.) The live `STRIPE_SECRET_KEY` /
   `STRIPE_WEBHOOK_SECRET` (wired in #806) come from *this* account.
3. **Banking.** A Canadian bank account in the account holder's name receives payouts.
4. **Tax.** Sole-prop revenue is self-employment income → T1 + (if >$30k/4q) GST/HST registration
   (see #811 tracker). Keep records; consider a spreadsheet or simple accounting from dollar one.

## Recommended sequence (operator action — not code)

- [ ] Open Stripe account as sole proprietor (Canada, CAD). Or incorporate first if preferred.
- [ ] Confirm bank payout details.
- [ ] Decide: sole prop now, or incorporate (federal/provincial) before go-live. If incorporating,
      open the Stripe account in the **corporation's** name, not personal.
- [ ] Record the chosen entity here (replace the placeholder below) and in `AGENTS.md` /
      `DEPLOY-CHECKLIST.md` so future agents know who contracts with customers.

## Current recorded decision

> **Entity:** Sole proprietorship (j_kro, personal). Stripe account held personally. Incorporation
> deferred. — *Recorded YYYY-MM-DD; update on incorporation.*

## Note

This is a business/legal decision, not engineering. The code/build side (secret wiring #806, image
#808, gating #815, policies #813) is complete and ready; this ticket is the one human step that
cannot be automated. Stripe's own onboarding collects the legal entity details at account creation.
