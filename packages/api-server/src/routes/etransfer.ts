/**
 * MapleSpike — e-Transfer Billing Route (DEPRECATED — Decision 0002)
 *
 * The IMAP-based reconciliation flow was retired because IMAP
 * polling pulls full email bodies into Maplespike memory — a
 * direct PII retention violation.
 *
 * Replacement: `/v1/billing/orders` POST mints an order id; the
 * user pays via Stripe Checkout (or Interac Auto-Deposit memo)
 * and the bank webhook at `/v1/billing/reconcile` posts
 * `{ order_id, transaction_uid, amount_cents }` — no email ever
 * reaches our backend.
 *
 * This route is kept to return 410 Gone for legacy callers with
 * a deprecation pointer. New integrations must use the bank webhook.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';

const DEPRECATION_REPLY = {
  deprecated: true,
  decision_doc: '/docs/decisions/0002-pii-avoidance.md',
  replacement_endpoints: {
    create_order: 'POST /v1/billing/orders',
    reconcile:   'POST /v1/billing/reconcile',
    verify:      'POST /v1/billing/verify',
  },
  message:
    'IMAP e-Transfer polling is retired under Decision 0002 (PII avoidance). ' +
    'Use the bank webhook path documented at /docs/decisions/0002-pii-avoidance.md.',
};

/** POST /v1/billing/etransfer/notify — always returns 410 */
export const eTransferNotifyHandler: RouteHandler = async (_request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  return jsonResponse(buildError('ETRANSFER_DEPRECATED', DEPRECATION_REPLY.message, bc), 410,
    { ...buildSuccess(DEPRECATION_REPLY, bc) } as unknown as { error: { code: string; message: string; details: unknown } } | never as never);
};

/** GET /v1/billing/etransfer/status — always reports deprecated */
export const eTransferStatusHandler: RouteHandler = async (_request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  return jsonResponse(
    { ...buildSuccess(DEPRECATION_REPLY, bc),
      status: 410 } as any,
  );
};