/**
 * IMAP Email Poller for Interac e-Transfer Reconciliation
 *
 * Polls IMAP inbox for Interac notification emails, parses them,
 * and credits user accounts when payments match orders.
 */

import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { db } from '../db.js';
import { orders, payment_reconciliations, users, plans } from '@maplespike/database/schema';
import { eq, and, sql } from 'drizzle-orm';
import { parseInteracEmail, validatePayment, ParsedPayment } from './etransfer-parser.js';

// IMAP config from environment
const IMAP_CONFIG = {
  user: process.env.MAPLESPIKE_BILLING_IMAP_USER,
  password: process.env.MAPLESPIKE_BILLING_IMAP_PASS,
  host: process.env.MAPLESPIKE_BILLING_IMAP_HOST,
  port: parseInt(process.env.MAPLESPIKE_BILLING_IMAP_PORT || '993'),
  tls: process.env.MAPLESPIKE_BILLING_IMAP_TLS !== 'false',
};

const INVOICE_EMAIL = process.env.MAPLESPIKE_BILLING_EMAIL || 'billing@maplespike.lan';

/**
 * Poll IMAP inbox for unread Interac e-Transfer emails.
 */
export async function pollPayments(): Promise<{
  processed: number;
  credited: number;
  failed: number;
  errors: string[];
}> {
  const result = {
    processed: 0,
    credited: 0,
    failed: 0,
    errors: [] as string[],
  };

  if (!IMAP_CONFIG.user || !IMAP_CONFIG.password) {
    result.errors.push('IMAP credentials not configured');
    return result;
  }

  const imap = new Imap(IMAP_CONFIG);

  return new Promise((resolve) => {
    imap.once('error', (err: Error) => {
      result.errors.push(`IMAP error: ${err.message}`);
      resolve(result);
    });

    imap.once('end', () => {
      resolve(result);
    });

    imap.connect();

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          result.errors.push(`IMAP open error: ${err.message}`);
          imap.end();
          return;
        }

        // Search for unread emails from Interac
        // Search criteria: UNSEEN + FROM contains "interac" OR "etransfer"
        imap.search(
          [
            ['UNSEEN'],
            ['OR', ['FROM', 'interac'], ['FROM', 'etransfer']],
            ['SINCE', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)], // Last 30 days
          ],
          (searchErr, results) => {
            if (searchErr) {
              result.errors.push(`IMAP search error: ${searchErr.message}`);
              imap.end();
              return;
            }

            if (!results || results.length === 0) {
              console.log('[billing] No new Interac emails to process');
              imap.end();
              return;
            }

            console.log(`[billing] Found ${results.length} unread Interac emails`);

            // Fetch and process emails in batches
            const fetch = imap.fetch(results, {
              bodies: '',
              markSeen: false, // Don't mark as seen yet
            });

            fetch.on('message', (msg) => {
              msg.on('body', async (stream) => {
                try {
                  const parsed = await simpleParser(stream);
                  const emailUid = parsed.uid?.toString() || msg.uid?.toString();

                  // Skip already processed emails
                  const existing = await db
                    .select()
                    .from(payment_reconciliations)
                    .where(eq(payment_reconciliations.emailUid, emailUid))
                    .limit(1);

                  if (existing.length) {
                    console.log(`[billing] Email ${emailUid} already processed, skipping`);
                    // Mark as seen
                    imap.addFlags(emailUid, ['\\Seen'], () => {});
                    return;
                  }

                  // Parse email
                  const payment = parseInteracEmail({
                    uid: emailUid,
                    from: parsed.from?.text || '',
                    subject: parsed.subject || '',
                    text: parsed.text || '',
                  });

                  if (!payment) {
                    result.failed++;
                    result.errors.push(`Failed to parse email ${emailUid}`);
                    imap.addFlags(emailUid, ['\\Seen'], () => {});
                    return;
                  }

                  result.processed++;

                  // Reconcile payment
                  const reconciliation = await reconcilePayment(payment);

                  if (reconciliation.success) {
                    result.credited++;
                    // Mark as seen
                    imap.addFlags(emailUid, ['\\Seen'], () => {});
                  } else {
                    result.failed++;
                    result.errors.push(
                      `Reconciliation failed for email ${emailUid}: ${reconciliation.reason}`
                    );
                    // Keep unseen for retry
                  }
                } catch (error) {
                  result.failed++;
                  result.errors.push(`Error processing message: ${error}`);
                  imap.addFlags(msg.uid, ['\\Seen'], () => {});
                }
              });
            });

            fetch.on('error', (fetchErr) => {
              result.errors.push(`Fetch error: ${fetchErr.message}`);
            });

            fetch.on('end', () => {
              imap.end();
            });
          }
        );
      });
    });
  });
}

/**
 * Reconcile a payment with an order.
 */
async function reconcilePayment(
  payment: ParsedPayment,
): Promise<{ success: boolean; reason?: string }> {
  try {
    // Find matching pending order
    const order = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.orderId, payment.reference),
          eq(orders.status, 'pending'),
          sql`${orders.expiresAt} > ${Math.floor(Date.now() / 1000)}`
        )
      )
      .limit(1);

    if (!order.length) {
      return { success: false, reason: 'No matching pending order' };
    }

    const orderData = order[0];

    // Validate amount
    if (!validatePayment(payment, orderData.amountCents)) {
      return {
        success: false,
        reason: `Amount mismatch: expected ${orderData.amountCents}, got ${payment.amount}`,
      };
    }

    // Get plan details
    const plan = await db
      .select()
      .from(plans)
      .where(eq(plans.planId, orderData.planId))
      .limit(1);

    if (!plan.length) {
      return { success: false, reason: 'Plan not found' };
    }

    // Update order status
    await db
      .update(orders)
      .set({
        status: 'paid',
        paidAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(orders.orderId, orderData.orderId));

    // Credit user account
    await db
      .update(users)
      .set({
        planId: orderData.planId,
        quotaCredits: plan[0].creditsPerMonth,
        quotaResetAt: Math.floor(Date.now() / 1000),
        subscriptionStatus: 'active',
        updatedAt: sql`(datetime('now'))`,
      })
      .where(eq(users.tenantId, orderData.tenantId));

    // Record reconciliation
    await db.insert(payment_reconciliations).values({
      emailUid: payment.emailUid,
      orderId: orderData.orderId,
      senderEmail: payment.sender,
      amountCents: payment.amount,
      reference: payment.reference,
    });

    console.log(
      `[billing] Credited tenant ${orderData.tenantId} with ${plan[0].creditsPerMonth} credits`
    );

    return { success: true };
  } catch (error) {
    console.error('[billing] Reconciliation error:', error);
    return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' };
  }
}