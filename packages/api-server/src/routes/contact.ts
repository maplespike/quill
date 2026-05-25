import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import { contactSchema, validateBody, validationError } from '../validation.js';
import { sendContactEmail } from '../email.js';

interface RateEntry {
  timestamps: number[];
}

const ipRateMap = new Map<string, RateEntry>();
const RATE_LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

function pruneOldEntries(): void {
  const now = Date.now();
  for (const [ip, entry] of ipRateMap) {
    entry.timestamps = entry.timestamps.filter(t => now - t < WINDOW_MS);
    if (entry.timestamps.length === 0) {
      ipRateMap.delete(ip);
    }
  }
}

const cleanupTimer = setInterval(pruneOldEntries, CLEANUP_INTERVAL_MS);
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

function checkContactRate(ip: string): boolean {
  const now = Date.now();
  let entry = ipRateMap.get(ip);
  if (!entry) {
    entry = { timestamps: [] };
    ipRateMap.set(ip, entry);
  }
  entry.timestamps = entry.timestamps.filter(t => now - t < WINDOW_MS);
  if (entry.timestamps.length >= RATE_LIMIT) {
    return false;
  }
  entry.timestamps.push(now);
  return true;
}

export const contactHandler: RouteHandler = async (request, ctx) => {
  try {
    const ip = request.headers.get('cf-connecting-ip')
      || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || 'unknown';

    if (!checkContactRate(ip)) {
      return jsonResponse(buildError('RATE_LIMITED', 'Too many contact submissions. Try again later.', ctx), 429);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(buildError('INVALID_BODY', 'Request body must be valid JSON', ctx), 400);
    }

    const parsed = validateBody(contactSchema, body);
    if (!parsed.success) {
      return validationError(parsed.error, ctx, parsed.issues);
    }

    const { name, email, subject, message } = parsed.data;

    const config = ctx.env;
    const contactTo = config.CONTACT_EMAIL || 'maplespike@reverb256.ca';

    sendContactEmail({ to: contactTo, name, email, subject, message }).catch(err =>
      console.error('[Contact] Failed to send email:', err)
    );

    return jsonResponse(buildSuccess({
      message: 'Thank you for your message. We will respond within one business day.',
    }, ctx));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Contact form submission failed';
    console.error('[Contact] Error:', message);
    return jsonResponse(buildError('CONTACT_FAILED', message, ctx), 500);
  }
};

export default contactHandler;
