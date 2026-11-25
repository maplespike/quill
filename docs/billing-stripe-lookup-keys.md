# Stripe catalog prices by lookup_key

Checkout can either send inline `price_data` (the default, and how checkout works today) or use catalog Prices resolved **by lookup_key**. The code never refers to a Price by id.

| Plan | lookup_key | Amount | Currency | Interval | tax_behavior |
|---|---|---:|---|---|---|
| `pro` | `quill_pro_monthly` | 5000 ($50.00) | cad | month ×1 | exclusive |
| `business` | `quill_business_monthly` | 20000 ($200.00) | cad | month ×1 | exclusive |

The map lives in `packages/api-server/src/routes/billing.ts` (`STRIPE_PRICE_LOOKUP_KEYS`). Amounts come from `PLANS[...].price_cents`.

## Runtime flag (API)

| Env | Default | Effect |
|---|---|---|
| `STRIPE_USE_LOOKUP_KEYS` | unset (off) | Only `true` enables lookup. Any other value keeps inline `price_data`. |

With the flag on, `POST /v1/billing/stripe/checkout` calls `GET /v1/prices?lookup_keys[]=…&active=true` and sends `line_items[0][price]`. It **fails closed** with 503 `PRICE_UNAVAILABLE`, creating no session and never falling back to inline pricing, when any of these hold:

- no active price exists for the key, or more than one does
- the price isn't `cad`
- the interval isn't `month` ×1
- `unit_amount` isn't the plan amount
- `GST_HST_REGISTERED=true` (a fixed catalog price can't carry the manual `computeHst` surcharge; see the automatic_tax proposal)

## Reference: TEST-mode price ids

These are for reference only. They are never read by code, and the **live** ids are deliberately not in the repo.

| lookup_key | TEST price id (`acct_…SCVX` test mode) |
|---|---|
| `quill_pro_monthly` | `price_1UfY0PIZlbpvSCVXrpbxcyXw` |
| `quill_business_monthly` | `price_1UfY0TIZlbpvSCVXf9W2DqG9` |

## Staging e2e (Stripe TEST mode)

`packages/api-server/src/__integration__/stripe-lookup-keys.e2e.test.ts` runs as part of `pnpm --filter @maplespike/api-server test:integration`. For each plan it:

1. Checks that the catalog price matches the table above, including `livemode: false`.
2. Creates a real **test-mode** Checkout Session with `STRIPE_USE_LOOKUP_KEYS=true`.
3. Reads the session's line items back and checks they use the looked-up price.
4. Expires the session and deletes the test customer afterwards.

It **skips cleanly** when `STRIPE_TEST_SECRET_KEY` is unset, which is the case in normal CI. It **refuses to run**, failing before any network call, if that variable isn't an `sk_test_` key or if `STRIPE_SECRET_KEY` in the same environment holds a live key. It never prints the key.

### Env Maple and Infra must provide for the staging job

| Env | Required | Who | Notes |
|---|---|---|---|
| `STRIPE_TEST_SECRET_KEY` | yes | Maple (Stripe), Infra (secret wiring) | An `sk_test_` secret key for the account that holds the TEST prices above. Add it as a GitHub Actions secret or staging Secret and **never** a live key. The test sets `STRIPE_SECRET_KEY` from it in-process. |
| `STRIPE_E2E_PRO_PRICE_ID` | optional | Maple | Pins the expected TEST pro price id, e.g. the reference id above. |
| `STRIPE_E2E_BUSINESS_PRICE_ID` | optional | Maple | Pins the expected TEST business price id. |
| `STRIPE_SECRET_KEY` | must **not** be live | Infra | If it's present in the job env and starts with `sk_live_`/`rk_live_`, the e2e refuses to run. |

Example job step:

```yaml
- name: Stripe test-mode lookup_key e2e
  if: env.STRIPE_TEST_SECRET_KEY != ''
  env:
    STRIPE_TEST_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}
  run: pnpm --filter @maplespike/api-server exec tsx --test src/__integration__/stripe-lookup-keys.e2e.test.ts
```

The test key needs permission to read Prices, create Customers and Checkout Sessions, expire sessions, delete customers, and read session line items. Never run this file against live mode.

## Turning the flag on in an environment

1. Confirm that the Prices above exist and are active in that account (the e2e does this for TEST).
2. Set `STRIPE_USE_LOOKUP_KEYS=true` on the API deployment.
3. To roll back, unset the variable to return to inline `price_data`.
