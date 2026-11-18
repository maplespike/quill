// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — e-Transfer Billing Route (DEPRECATED — Decision 0002)
 *
 * The IMAP-based reconciliation flow was retired because IMAP polling pulls
 * full email bodies into Maplespike memory — a direct PII retention violation.
 *
 * Replacement flow:
 *   POST /v1/billing/orders   — mint an order id
 *   POST /v1/billing/reconcile — bank webhook posts { order_id, transaction_uid, amount_cents }
 *   POST /v1/billing/verify    — confirm an order
 *
 * This route is kept to return 410 Gone for legacy callers with a clear
 * deprecation pointer. New integrations must use the bank webhook.
 */

import type { RouteHandler } from '../types.js';
import { buildError, jsonResponse, type BuildContext } from '../response.js';

const DEPRECATION_MESSAGE =
  'IMAP e-Transfer polling is retired under Decision 0002 (PII avoidance). ' +
  'Use the bank webhook flow instead:\n' +
  '  POST /v1/billing/orders    → mint an order id\n' +
  '  POST /v1/billing/reconcile → bank webhook validates payment\n' +
  '  POST /v1/billing/verify    → confirm an order\n' +
  'See /docs/decisions/0002-pii-avoidance.md for the full migration guide.';

/**
 * Structured replacement info exposed via the standard `error.details`
 * envelope field so machine callers can read the migration target
 * without parsing the human-readable message.
 */
const DEPRECATION_DETAILS = [
  {
    deprecated: true,
    decision_doc: '/docs/decisions/0002-pii-avoidance.md',
    replacement_endpoints: {
      create_order: 'POST /v1/billing/orders',
      reconcile: 'POST /v1/billing/reconcile',
      verify: 'POST /v1/billing/verify',
    },
  },
];

/** POST /v1/billing/etransfer/notify — always returns 410 Gone. */
export const eTransferNotifyHandler: RouteHandler = async (_request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  return jsonResponse(
    buildError('ETRANSFER_DEPRECATED', DEPRECATION_MESSAGE, bc, 410, DEPRECATION_DETAILS),
    410,
  );
};

/** GET /v1/billing/etransfer/status — always returns 410 Gone. */
export const eTransferStatusHandler: RouteHandler = async (_request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };
  return jsonResponse(
    buildError('ETRANSFER_DEPRECATED', DEPRECATION_MESSAGE, bc, 410, DEPRECATION_DETAILS),
    410,
  );
};
