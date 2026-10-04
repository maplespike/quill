/**
 * Notification service configuration from environment variables.
 */

export interface NotificationConfig {
  /** SMTP host */
  smtpHost: string;
  /** SMTP port (default 587) */
  smtpPort: number;
  /** SMTP secure (TLS) */
  smtpSecure: boolean;
  /** SMTP auth user */
  smtpUser: string;
  /** SMTP auth password */
  smtpPass: string;
  /** Sender email address */
  fromEmail: string;
  /** Sender display name */
  fromName: string;
  /** Polling interval in ms (default 60000 = 1min) */
  pollIntervalMs: number;
  /** Path to SQLite database */
  dbPath: string;
  /** Base URL of the MapleSpike API */
  apiBaseUrl: string;
  /** API key for MapleSpike API */
  apiKey: string;
  /** Maximum emails per polling cycle (default 50) */
  maxEmailsPerCycle: number;
}

export function loadConfig(overrides?: Partial<NotificationConfig>): NotificationConfig {
  return {
    smtpHost: overrides?.smtpHost ?? process.env.SMTP_HOST ?? "",
    smtpPort: overrides?.smtpPort ?? parseInt(process.env.SMTP_PORT ?? "587", 10),
    smtpSecure: overrides?.smtpSecure ?? process.env.SMTP_SECURE === "true",
    smtpUser: overrides?.smtpUser ?? process.env.SMTP_USER ?? "",
    smtpPass: overrides?.smtpPass ?? process.env.SMTP_PASS ?? "",
    fromEmail: overrides?.fromEmail ?? process.env.NOTIFICATION_FROM_EMAIL ?? "noreply@maplespike.ca",
    fromName: overrides?.fromName ?? process.env.NOTIFICATION_FROM_NAME ?? "MapleSpike Alerts",
    pollIntervalMs: overrides?.pollIntervalMs ?? parseInt(process.env.POLL_INTERVAL_MS ?? "60000", 10),
    dbPath: overrides?.dbPath ?? process.env.QUILL_DB_PATH ?? "./quill.db",
    apiBaseUrl: overrides?.apiBaseUrl ?? process.env.QUILL_API_BASE ?? "http://localhost:8082",
    apiKey: overrides?.apiKey ?? process.env.QUILL_API_KEY ?? "dev-key",
    maxEmailsPerCycle: overrides?.maxEmailsPerCycle ?? parseInt(process.env.MAX_EMAILS_PER_CYCLE ?? "50", 10),
  };
}
