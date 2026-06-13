/**
 * MapleSpike — e-Transfer Billing Route
 *
 * POST /v1/billing/etransfer/notify — Manual notification (for testing without IMAP)
 * GET  /v1/billing/etransfer/status  — Check if e-Transfer listener is active
 * POST /v1/billing/etransfer/trigger — Trigger a manual poll of the IMAP inbox
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse, type BuildContext } from '../response.js';
import { validateBody } from '../validate.js';
import { checkForTransfers, processTransfer, parseETransferEmail } from '../etransfer.js';

/**
 * POST /v1/billing/etransfer/notify
 * Manually register an e-Transfer payment (useful for testing or manual verification).
 * In production, the IMAP listener auto-detects these.
 */
export const eTransferNotifyHandler: RouteHandler = async (request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };

  try {
    const body = await request.json() as Record<string, unknown>;
    const errs = validateBody(body, {
      email: { type: 'string', required: true },
      amount: { type: 'number', required: true, min: 0.01 },
      reference: { type: 'string', minLength: 3 },
    });
    if (errs.length > 0) {
      return jsonResponse(buildError('VALIDATION_ERROR', errs.map((e: { field: string; message: string }) => e.message).join('; '), bc), 400);
    }

    const transfer = {
      senderEmail: body.email as string,
      senderName: (body.name as string) || 'Manual Entry',
      amountCad: body.amount as number,
      referenceNumber: (body.reference as string) || `manual-${Date.now()}`,
      subject: `e-Transfer from ${body.email}`,
      receivedAt: new Date().toISOString(),
      messageId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };

    await processTransfer(transfer);

    return jsonResponse(buildSuccess({
      message: `e-Transfer of $${transfer.amountCad} CAD from ${transfer.senderEmail} processed`,
      reference: transfer.referenceNumber,
    }, bc));
  } catch (err) {
    return jsonResponse(buildError('ETRANSFER_ERROR', (err as Error).message, bc), 500);
  }
};

/**
 * GET /v1/billing/etransfer/status
 * Check if the e-Transfer IMAP listener is active and configured.
 */
export const eTransferStatusHandler: RouteHandler = async (_request, ctx) => {
  const bc: BuildContext = { tenant: ctx.tenant, requestId: ctx.requestId, startTime: ctx.startTime };

  const email = process.env['ETRANSFER_EMAIL'] || '';
  return jsonResponse(buildSuccess({
    configured: !!email,
    email: email || '(not set)',
    imapHost: process.env['ETRANSFER_IMAP_HOST'] || 'imap.gmail.com',
    pollInterval: parseInt(process.env['ETRANSFER_POLL_INTERVAL'] || '60', 10),
    listenerActive: email ? true : false,
    docs: 'Create an app password for your Gmail account at https://myaccount.google.com/apppasswords',
  }, bc));
};