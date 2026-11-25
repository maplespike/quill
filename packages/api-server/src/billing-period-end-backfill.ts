/**
 * One-off, idempotent backfill for tenants.stripe_current_period_end.
 *
 * Before the dahlia fix, `customer.subscription.*` read the removed top-level
 * `current_period_end` and `checkout.session.completed` never set it, so paid
 * tenants could be left with NULL — which silently disables reconcile-expiry.
 *
 * Selects tenants that have a stripe_subscription_id but a NULL period end,
 * reads each subscription from Stripe (GET only), and — with --apply — writes
 * items.data[0].current_period_end. DRY-RUN BY DEFAULT: without --apply
 * nothing is written. The UPDATE is guarded by `IS NULL`, so re-runs and
 * concurrent webhook writes are never overwritten.
 *
 * Usage (inside the api pod, SQLite on quill-api-data):
 *   node dist/billing-period-end-backfill.js            # dry run (default)
 *   node dist/billing-period-end-backfill.js --apply    # write
 *   QUILL_DB_PATH=/data/quill.db ...                   # DB path (same env as the API)
 *
 * Needs STRIPE_SECRET_KEY in env (never printed). Output has tenant ids and
 * subscription ids only — no customer PII.
 */

import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import * as stripe from './services/stripe.js';

export type BackfillCandidate = { tenant_id: string; stripe_subscription_id: string };

export interface BackfillStore {
  listCandidates(): BackfillCandidate[] | Promise<BackfillCandidate[]>;
  /** Must only write when the column is still NULL; returns rows changed. */
  setPeriodEndIfNull(tenantId: string, periodEnd: number): number | Promise<number>;
}

export type BackfillOutcome =
  | { tenant_id: string; subscription_id: string; action: 'would_set' | 'set'; period_end: number }
  | { tenant_id: string; subscription_id: string; action: 'skipped_already_set' }
  | { tenant_id: string; subscription_id: string; action: 'no_period_end' }
  | { tenant_id: string; subscription_id: string; action: 'error'; error: string };

export async function backfillPeriodEnd(
  store: BackfillStore,
  opts: {
    apply: boolean;
    retrieve?: (subscriptionId: string) => Promise<unknown>;
  },
): Promise<{ apply: boolean; candidates: number; outcomes: BackfillOutcome[] }> {
  const retrieve = opts.retrieve ?? ((id: string) => stripe.retrieveSubscription(id));
  const candidates = await store.listCandidates();
  const outcomes: BackfillOutcome[] = [];
  for (const c of candidates) {
    const base = { tenant_id: c.tenant_id, subscription_id: c.stripe_subscription_id };
    try {
      const periodEnd = stripe.subscriptionCurrentPeriodEnd(await retrieve(c.stripe_subscription_id));
      if (periodEnd === undefined) {
        outcomes.push({ ...base, action: 'no_period_end' });
        continue;
      }
      if (!opts.apply) {
        outcomes.push({ ...base, action: 'would_set', period_end: periodEnd });
        continue;
      }
      const changed = await store.setPeriodEndIfNull(c.tenant_id, periodEnd);
      outcomes.push(changed > 0 ? { ...base, action: 'set', period_end: periodEnd } : { ...base, action: 'skipped_already_set' });
    } catch (e) {
      // Error class/code only — StripeApiError bodies are not echoed.
      const err = e instanceof stripe.StripeError ? e.code : (e as Error).name || 'Error';
      outcomes.push({ ...base, action: 'error', error: err });
    }
  }
  return { apply: opts.apply, candidates: candidates.length, outcomes };
}

/** SQLite adapter over the API's own DB file. Does not migrate or seed. */
export function sqliteBackfillStore(db: DatabaseSync): BackfillStore {
  return {
    listCandidates() {
      return db
        .prepare(
          `SELECT id AS tenant_id, stripe_subscription_id FROM tenants
           WHERE stripe_subscription_id IS NOT NULL AND stripe_subscription_id != ''
             AND stripe_current_period_end IS NULL
           ORDER BY id`,
        )
        .all() as unknown as BackfillCandidate[];
    },
    setPeriodEndIfNull(tenantId, periodEnd) {
      const r = db
        .prepare('UPDATE tenants SET stripe_current_period_end = ? WHERE id = ? AND stripe_current_period_end IS NULL')
        .run(periodEnd, tenantId);
      return Number(r.changes);
    },
  };
}

async function main(argv: string[]): Promise<number> {
  const apply = argv.includes('--apply');
  const dbPath = process.env.QUILL_DB_PATH || './quill.db';
  const db = new DatabaseSync(dbPath);
  try {
    const res = await backfillPeriodEnd(sqliteBackfillStore(db), { apply });
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', ...res }, null, 2));
    return res.outcomes.some((o) => o.action === 'error') ? 1 : 0;
  } finally {
    db.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(`backfill failed: ${(e as Error).name}`);
      process.exit(2);
    },
  );
}
