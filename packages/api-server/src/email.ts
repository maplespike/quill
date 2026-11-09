/**
 * Quill — Email Service
 *
 * Sends transactional emails (verification, welcome, onboarding).
 * Supports SendGrid API (recommended) and console fallback for development.
 *
 * Classification: verification and welcome mail confirm an account the
 * person just created. They are transactional. Do not add a marketing
 * unsubscribe or a commercial-message postal block to these messages.
 * Commercial alert mail lives in @maplespike/notification-service.
 *
 * Usage:
 *   import { sendVerificationEmail, getEmailConfig } from './email.js';
 *   await sendVerificationEmail({ to: 'user@example.com', token: 'abc123' });
 */

import pino from 'pino';

const log = pino({
  level: process.env.QUILL_LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
});

export interface EmailConfig {
  provider: 'sendgrid' | 'console';
  sendgridApiKey?: string;
  fromEmail: string;
  fromName: string;
  appUrl: string;
  appName: string;
}

export interface VerificationEmailParams {
  to: string;
  name: string;
  token: string;
}

export interface WelcomeEmailParams {
  to: string;
  name: string;
}

let _config: EmailConfig | null = null;

/**
 * Initialize email config from environment variables.
 * Call once at startup.
 */
export function initEmailConfig(env: Record<string, string | undefined>): EmailConfig {
  _config = {
    provider: (env.EMAIL_PROVIDER as EmailConfig['provider']) || 'console',
    sendgridApiKey: env.SENDGRID_API_KEY,
    fromEmail: env.EMAIL_FROM || 'noreply@maplespike.ca',
    fromName: env.EMAIL_FROM_NAME || 'MapleSpike',
    appUrl: env.APP_URL || 'https://quill.maplespike.ca',
    appName: env.APP_NAME || 'MapleSpike',
  };
  return _config;
}

export function getEmailConfig(): EmailConfig {
  if (!_config) {
    _config = {
      provider: 'console',
      fromEmail: 'noreply@maplespike.ca',
      fromName: 'MapleSpike',
      appUrl: 'https://quill.maplespike.ca',
      appName: 'MapleSpike',
    };
  }
  return _config;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Verification mail. Transactional: it completes an account the person
 * just requested. No commercial unsubscribe and no postal block.
 */
export function renderVerificationEmail(config: EmailConfig, params: VerificationEmailParams): RenderedEmail {
  const verifyUrl = `${config.appUrl}/v1/verify/${params.token}`;
  const subject = `Verify your email — ${config.appName}`;
  const html = `
    <h2>Welcome to ${config.appName}!</h2>
    <p>Hi ${params.name},</p>
    <p>Please verify your email address to activate your account:</p>
    <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Verify Email</a></p>
    <p>Or paste this link in your browser:</p>
    <p><code>${verifyUrl}</code></p>
    <p>This link expires in 24 hours.</p>
    <p>If you didn't create an account, ignore this email.</p>
    <br/>
    <p>— ${config.appName} Team</p>
  `;
  const text = `Welcome to ${config.appName}!\n\nHi ${params.name},\n\nPlease verify your email address to activate your account:\n\n${verifyUrl}\n\nThis link expires in 24 hours.\n\nIf you didn't create an account, ignore this email.\n\n— ${config.appName} Team`;
  return { subject, html, text };
}

/**
 * Send a verification email with a token link.
 */
export async function sendVerificationEmail(params: VerificationEmailParams): Promise<{ sent: boolean; provider: string }> {
  const config = getEmailConfig();
  const { subject, html, text } = renderVerificationEmail(config, params);
  return sendEmail({ to: params.to, subject, html, text });
}

/**
 * Send a welcome email after successful verification.
 * NOTE: API keys are no longer sent via email for security.
 * Users retrieve keys from the dashboard.
 */
/**
 * Welcome mail. Transactional: it confirms verification of an account
 * the person already opened. No commercial unsubscribe and no postal block.
 */
export function renderWelcomeEmail(config: EmailConfig, params: WelcomeEmailParams): RenderedEmail {
  const dashboardUrl = `${config.appUrl}/dashboard`;
  const keysUrl = `${config.appUrl}/dashboard/keys`;
  const docsUrl = `${config.appUrl}/docs`;
  const subject = `Welcome to ${config.appName}!`;
  const html = `
    <h2>You're all set!</h2>
    <p>Hi ${params.name},</p>
    <p>Your email has been verified and your account is now active.</p>
    <p><strong>API keys are available in your dashboard.</strong> For security, we no longer include them in emails.</p>
    <hr/>
    <h3>Quick Start</h3>
    <ol>
      <li>Go to your <a href="${keysUrl}">API Keys</a> page to create a key.</li>
      <li>Use your API key to authenticate: <code>Authorization: Bearer YOUR_KEY</code></li>
      <li>Try your first call: <code>curl -H "Authorization: Bearer YOUR_KEY" ${config.appUrl}/v1/health</code></li>
      <li>Check usage: <code>curl -H "Authorization: Bearer YOUR_KEY" ${config.appUrl}/v1/me</code></li>
    </ol>
    <p><a href="${dashboardUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Go to Dashboard</a></p>
    <p>Read the <a href="${docsUrl}">docs</a> for more.</p>
    <br/>
    <p>— ${config.appName} Team</p>
  `;
  const text = `You're all set!\n\nHi ${params.name},\n\nYour email has been verified and your account is now active.\n\nAPI keys are available in your dashboard. For security, we no longer include them in emails.\n\nQuick Start:\n1. Go to ${keysUrl} to create an API key.\n2. Use your API key: Authorization: Bearer YOUR_KEY\n3. Try: curl -H "Authorization: Bearer YOUR_KEY" ${config.appUrl}/v1/health\n4. Check usage: curl -H "Authorization: Bearer YOUR_KEY" ${config.appUrl}/v1/me\n\nDashboard: ${dashboardUrl}\nDocs: ${docsUrl}\n\n— ${config.appName} Team`;
  return { subject, html, text };
}

export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<{ sent: boolean; provider: string }> {
  const config = getEmailConfig();
  const { subject, html, text } = renderWelcomeEmail(config, params);
  return sendEmail({ to: params.to, subject, html, text });
}

// Decision 0002: `sendContactEmail` is RETIRED. Retained as a
// stub so legacy imports type-check during the migration window.
export type ContactEmailParams = never;

export async function sendContactEmail(_params: never): Promise<{ sent: boolean; provider: string }> {
  console.warn(
    '[email] sendContactEmail is RETIRED under Decision 0002. ' +
      'See /docs/decisions/0002-pii-avoidance.md for the new paths.',
  );
  return { sent: false, provider: 'retired' };
}

/**
 * Low-level email dispatch.
 */
async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: boolean; provider: string }> {
  const config = getEmailConfig();

  if (config.provider === 'sendgrid' && config.sendgridApiKey) {
    return sendViaSendgrid({ to, subject, html, text, config });
  }

  // Console fallback (development)
  log.info('--- Console email (not sent) ---');
  log.info(`To: ${to}`);
  log.info(`Subject: ${subject}`);
  log.info(`Body: ${text.substring(0, 200)}...`);
  log.info('--- End console email ---');
  return { sent: false, provider: 'console' };
}

async function sendViaSendgrid({
  to,
  subject,
  html,
  text,
  config,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
  config: EmailConfig;
}): Promise<{ sent: boolean; provider: string }> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: config.fromEmail, name: config.fromName },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      log.error(`SendGrid error ${response.status}: ${errBody}`);
      return { sent: false, provider: 'sendgrid' };
    }

    log.info(`Sent via SendGrid to ${to} (subject: ${subject})`);
    return { sent: true, provider: 'sendgrid' };
  } catch (err) {
    log.error(`SendGrid send failed: ${err instanceof Error ? err.message : String(err)}`);
    return { sent: false, provider: 'sendgrid' };
  }
}
