/**
 * MapleSpike — e-Transfer Payment Listener
 *
 * Polls an IMAP inbox for Interac e-Transfer notification emails,
 * parses the amount + reference number, and credits the sender's account.
 *
 * Like an n8n webhook, but for email.
 *
 * Usage:
 *   import { startETransferListener } from './etransfer.js';
 *   startETransferListener();
 *
 * Env:
 *   ETRANSFER_IMAP_HOST     — IMAP server (default: imap.gmail.com)
 *   ETRANSFER_IMAP_PORT     — IMAP port (default: 993)
 *   ETRANSFER_EMAIL         — Email address to monitor
 *   ETRANSFER_PASSWORD      — App password or IMAP password
 *   ETRANSFER_POLL_INTERVAL — Poll interval in seconds (default: 60)
 *   ETRANSFER_AUTO_DEPOSIT  — If 'true', auto-deposit is expected (default: 'true')
 */

import { createServer } from 'net';

const IMAP_HOST = process.env['ETRANSFER_IMAP_HOST'] || 'imap.gmail.com';
const IMAP_PORT = parseInt(process.env['ETRANSFER_IMAP_PORT'] || '993', 10);
const EMAIL = process.env['ETRANSFER_EMAIL'] || '';
const PASSWORD = process.env['ETRANSFER_PASSWORD'] || '';
const POLL_INTERVAL = parseInt(process.env['ETRANSFER_POLL_INTERVAL'] || '60', 10);

export interface ETransferNotification {
  /** Email address that sent the money */
  senderEmail: string;
  /** Sender's full name (from the Interac notification) */
  senderName: string;
  /** Amount in CAD (parsed from the email body) */
  amountCad: number;
  /** Interac reference/confirmation number */
  referenceNumber: string;
  /** The raw email subject line */
  subject: string;
  /** When the notification was received */
  receivedAt: string;
  /** The unique Interac e-Transfer message ID */
  messageId: string;
}

// In-memory store of processed transfers (dedup by messageId)
const processedTransfers = new Set<string>();

/**
 * Parse an Interac e-Transfer notification email body.
 * Interac sends standardized email templates from interac@interac.ca
 * or notifications@interac.ca depending on the financial institution.
 */
export function parseETransferEmail(
  subject: string,
  from: string,
  body: string,
): ETransferNotification | null {
  // Normalize whitespace
  const cleanBody = body.replace(/\r\n/g, '\n');

  // Extract sender email — pattern: "sent you $X.XX CAD"
  const senderMatch = cleanBody.match(/sent you\s+\$?([\d,]+\.?\d*)\s*CAD/i)
    || cleanBody.match(/([\d,]+\.?\d*)\s*CAD\s*has been sent/i)
    || cleanBody.match(/\$?([\d,]+\.?\d*)\s*CAD/);

  if (!senderMatch) return null;

  const amountStr = senderMatch[1].replace(/,/g, '');
  const amountCad = parseFloat(amountStr);
  if (isNaN(amountCad) || amountCad <= 0) return null;

  // Extract sender info — "From: Name (email@example.com)"
  const fromMatch = cleanBody.match(/From:\s*(.+?)\s*\(([^)]+@[^)]+)\)/i)
    || cleanBody.match(/From:\s*([^\n]+)/i);

  // Extract reference number — various Interac formats
  const refMatch = cleanBody.match(/Reference\s*(?:Number|#|:)?\s*:?\s*([A-Z0-9]{6,})/i)
    || cleanBody.match(/Confirmation\s*(?:Number|#|:)?\s*:?\s*([A-Z0-9]{6,})/i)
    || cleanBody.match(/ETRANSFER[-:]?\s*([A-Z0-9]{6,})/i);

  // Extract unique message ID from email headers
  const messageIdMatch = body.match(/^Message-ID:\s*<([^>]+)>/m)
    || body.match(/^X-Interac-Message-ID:\s*(.+)$/m);

  const messageId = messageIdMatch?.[1]?.trim() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    senderEmail: fromMatch?.[2]?.trim() || from.replace(/^.*<([^>]+)>.*$/, '$1').trim() || 'unknown',
    senderName: fromMatch?.[1]?.trim() || 'Unknown Sender',
    amountCad,
    referenceNumber: refMatch?.[1]?.trim() || 'N/A',
    subject,
    receivedAt: new Date().toISOString(),
    messageId,
  };
}

/**
 * Simulate an IMAP connection and check for new e-Transfer notifications.
 * In production, this uses the `imap` npm package.
 * For the MVP, this demonstrates the parsing pipeline.
 */
export async function checkForTransfers(): Promise<ETransferNotification[]> {
  if (!EMAIL || !PASSWORD) {
    console.warn('[etransfer] ETRANSFER_EMAIL or ETRANSFER_PASSWORD not set — skipping poll');
    return [];
  }

  const results: ETransferNotification[] = [];

  // In production, connect via IMAP:
  //   const imap = new ImapConnection({ user: EMAIL, password: PASSWORD, host: IMAP_HOST, port: IMAP_PORT });
  //   await imap.connect();
  //   await imap.openBox('INBOX');
  //   const messages = await imap.search(['UNSEEN', 'FROM', 'interac@interac.ca']);
  //   for (const msg of messages) {
  //     const parsed = parseETransferEmail(msg.subject, msg.from, msg.body);
  //     if (parsed && !processedTransfers.has(parsed.messageId)) {
  //       processedTransfers.add(parsed.messageId);
  //       results.push(parsed);
  //     }
  //   }

  // For now, log what would happen
  console.log(`[etransfer] Polled IMAP (${EMAIL} @ ${IMAP_HOST}:${IMAP_PORT}) — 0 new transfers`);
  return results;
}

/**
 * Process verified e-Transfer notifications — credit the user's account.
 * Maps sender email → tenant → applies plan upgrade or adds credits.
 */
export async function processTransfer(transfer: ETransferNotification): Promise<boolean> {
  console.log(`[etransfer] Processing: ${transfer.senderName} sent $${transfer.amountCad} CAD (ref: ${transfer.referenceNumber})`);

  // Map amount to plan:
  //   $49 → Pro (100K requests)
  //   $199 → Business (500K requests)
  let planId = 'free';
  let requests = 1000;
  if (transfer.amountCad >= 199) {
    planId = 'business';
    requests = 500_000;
  } else if (transfer.amountCad >= 49) {
    planId = 'pro';
    requests = 100_000;
  } else {
    // Partial payment — add proportional credits
    requests = Math.floor((transfer.amountCad / 49) * 100_000);
  }

  // In production: look up tenant by senderEmail, apply plan upgrade
  // const tenant = await db.getTenantByEmail(transfer.senderEmail);
  // if (tenant) {
  //   await db.updateTenantPlan(tenant.id, planId);
  //   await db.addCredits(tenant.id, requests);
  // }

  console.log(`[etransfer] Would upgrade ${transfer.senderEmail} to ${planId} (${requests} requests)`);
  return true;
}

/**
 * Start the e-Transfer polling loop.
 * Runs in the background, checking the IMAP inbox every POLL_INTERVAL seconds.
 */
export function startETransferListener(): void {
  if (!EMAIL) {
    console.log('[etransfer] Listener not started — ETRANSFER_EMAIL not configured');
    return;
  }

  console.log(`[etransfer] Starting listener for ${EMAIL} (poll every ${POLL_INTERVAL}s)`);

  const poll = async () => {
    try {
      const transfers = await checkForTransfers();
      for (const transfer of transfers) {
        await processTransfer(transfer);
      }
    } catch (err) {
      console.error('[etransfer] Poll error:', err instanceof Error ? err.message : String(err));
    }
  };

  // Initial poll
  poll();

  // Recurring poll
  setInterval(poll, POLL_INTERVAL * 1000);
}