/**
 * Interac e-Transfer Email Parser
 *
 * Parses Interac e-Transfer notification emails to extract:
 * - Sender email
 * - Amount
 * - Reference message (order ID)
 */

export interface ParsedPayment {
  sender: string;
  amount: number; // cents
  reference: string;
  emailUid: string;
}

/**
 * Parse an Interac e-Transfer notification email.
 *
 * Expected email format (varies by FI):
 * Subject: Interac e-Transfer: Sender Name sent you $50.00
 * Body:
 *   Sender Name (sender@example.com) sent you $50.00 CAD.
 *   Message: MS-ABC123
 */
export function parseInteracEmail(email: {
  uid: string;
  from: string;
  subject: string;
  text: string;
}): ParsedPayment | null {
  const { uid, from, subject, text } = email;

  try {
    // Extract amount from subject or body
    // Pattern: $50.00, $50.00 CAD, 50.00 CAD
    const amountMatch =
      subject.match(/\$(\d+\.?\d*)/) || text.match(/\$(\d+\.?\d*)/);
    if (!amountMatch) {
      console.warn(`[billing] No amount found in email ${uid}`);
      return null;
    }

    const amountCents = Math.round(parseFloat(amountMatch[1]) * 100);

    // Extract sender email from From header or body
    // Pattern: (sender@example.com)
    const senderMatch =
      from.match(/<([^>]+)>/) ||
      from.match(/\(([^)]+@[^)]+)\)/) ||
      text.match(/\(([^)]+@[^)]+)\)/);
    const sender = senderMatch ? senderMatch[1] : from.trim();

    // Extract reference/message from body
    // Look for order ID format: MS-XXXXXX (6 chars)
    const referenceMatch = text.match(/MS-([A-Z0-9]{6})/i);
    const reference = referenceMatch ? `MS-${referenceMatch[1].toUpperCase()}` : '';

    if (!reference) {
      console.warn(`[billing] No reference found in email ${uid}`);
      return null;
    }

    return {
      sender,
      amount: amountCents,
      reference,
      emailUid: uid,
    };
  } catch (error) {
    console.error(`[billing] Error parsing email ${uid}:`, error);
    return null;
  }
}

/**
 * Validate that payment matches order expectations.
 */
export function validatePayment(
  payment: ParsedPayment,
  expectedAmountCents: number,
): boolean {
  // Allow small rounding differences (±1 cent)
  const diff = Math.abs(payment.amount - expectedAmountCents);
  return diff <= 1;
}