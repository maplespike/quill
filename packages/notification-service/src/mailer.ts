/**
 * Email sending via nodemailer. Supports both real SMTP and a dry-run mode
 * for local development / testing.
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { NotificationConfig } from "./config.js";
import { buildNotificationEmail } from "./templates/email.js";

export interface MailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class Mailer {
  private transporter: Transporter | null = null;
  private config: NotificationConfig;
  private dryRun: boolean;

  constructor(config: NotificationConfig, dryRun?: boolean) {
    this.config = config;
    // Dry-run mode: if SMTP host is empty, don't actually send
    this.dryRun = dryRun ?? !config.smtpHost;
  }

  /** Initialize the SMTP transporter. Call once before sending. */
  async init(): Promise<void> {
    if (this.dryRun) return;

    this.transporter = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpSecure,
      auth: {
        user: this.config.smtpUser,
        pass: this.config.smtpPass,
      },
    });

    await this.transporter.verify();
  }

  /**
   * Send a notification email for a data change event.
   *
   * Decision 0002: caller passes plaintext `to` only for the
   * SMTP transport; the Mailer hashes nothing, persists nothing.
   * Subscription lookup is done by `unsubscribeToken` before
   * this is reached, so we never round-trip through the
   * `subjectHash` index in this method.
   */
  async sendNotification(params: {
    to: string;
    unsubscribeToken: string;
    label?: string;
    sourceId: string;
    eventType: string;
    summary: string;
  }): Promise<MailResult> {
    // Validate required fields — reject empty recipients even in dry-run
    if (!params.to || params.to.trim() === '') {
      return { success: false, error: 'Recipient email address is required' };
    }

    const postalAddress = this.config.postalAddress.trim();
    if (!postalAddress) {
      return {
        success: false,
        error: "NOTIFICATION_POSTAL_ADDRESS is required before a commercial alert can be sent",
      };
    }

    const payload = buildNotificationEmail({
      to: params.to,
      unsubscribeToken: params.unsubscribeToken,
      label: params.label,
      sourceId: params.sourceId,
      eventType: params.eventType,
      summary: params.summary,
      apiBaseUrl: this.config.apiBaseUrl,
      postalAddress,
      senderEmail: this.config.fromEmail,
    });

    if (this.dryRun) {
      console.log(`[mailer:dry-run] To: ${payload.to} | Subject: ${payload.subject}`);
      return { success: true, messageId: `dry-run-${Date.now()}` };
    }

    if (!this.transporter) {
      throw new Error("Mailer not initialized — call init() first");
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });
      return { success: true, messageId: info.messageId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  /** Close the SMTP transport. */
  async close(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
    }
  }
}
