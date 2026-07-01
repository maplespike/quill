/**
 * Plain-text and HTML email templates for notification events.
 *
 * Decision 0002 (PII Avoidance): templates no longer accept or
 * embed plaintext email. We render against an `unsubscribeToken`
 * that's embedded in the verification mail; the user keeps that
 * token offline to update preferences without our backend ever
 * remembering the plaintext destination.
 */

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Build a notification email for a data change event.
 *
 * The caller passes the plaintext `to` for the actual SMTP
 * delivery; once the mailer sends, the plaintext is gone from
 * our process. The template references `unsubscribeToken` in
 * place of the email in the unsubscribe link.
 */
export function buildNotificationEmail(params: {
  to: string;
  unsubscribeToken: string;
  label?: string;
  sourceId: string;
  eventType: string;
  summary: string;
  apiBaseUrl: string;
}): EmailPayload {
  const { to, unsubscribeToken, label, sourceId, eventType, summary, apiBaseUrl } = params;
  const displayName = label ?? to.split("@")[0] ?? "subscriber";

  const subject = `[MapleSpike] ${eventType}: ${sourceId}`;

  const unsubUrl = `${apiBaseUrl}/v1/notifications/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;

  const text = [
    `Hello ${displayName},`,
    ``,
    `A data change was detected by MapleSpike:`,
    ``,
    `  Source:   ${sourceId}`,
    `  Event:    ${eventType}`,
    `  Summary:  ${summary}`,
    ``,
    `View details at ${apiBaseUrl}`,
    ``,
    `— MapleSpike Alerts`,
    `Unsubscribe: ${unsubUrl}`,
  ].join("\n");

  const html = [
    `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">`,
    `  <h2 style="color: #dc2626;">🔔 Data Change Alert</h2>`,
    `  <p>Hello <strong>${escapeHtml(displayName)}</strong>,</p>`,
    `  <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">`,
    `    <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Source</td>`,
    `        <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(sourceId)}</td></tr>`,
    `    <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Event</td>`,
    `        <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(eventType)}</td></tr>`,
    `    <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Summary</td>`,
    `        <td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(summary)}</td></tr>`,
    `  </table>`,
    `  <p><a href="${escapeHtml(apiBaseUrl)}">View details →</a></p>`,
    `  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">`,
    `  <p style="font-size: 12px; color: #6b7280;">`,
    `    MapleSpike Alerts — <a href="${escapeHtml(unsubUrl)}">Unsubscribe</a>`,
    `  </p>`,
    `</div>`,
  ].join("\n");

  return { to, subject, text, html };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
