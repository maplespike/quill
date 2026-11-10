// SPDX-License-Identifier: AGPL-3.0-only
import { connect, type ChannelModel, type Channel, type ConsumeMessage } from 'amqplib';
import { computeHash } from '../../verification/hashing.js';
import {
  MSC_AMQPS_URL, MSC_AMQPS_EXCHANGE, MSC_AMQPS_TOPIC, MSC_AMQPS_QUEUE,
  MSC_AMQPS_ENABLED, REALTIME_CACHE_TTL_MS,
} from './constants.js';
import type { RealtimeRecord } from './types.js';

export interface AmqpsSubscription {
  close: () => Promise<void>;
}

const alertCache = new Map<string, RealtimeRecord[]>();
let lastAlertTime = 0;
let subInitPromise: Promise<AmqpsSubscription | null> | null = null;

export async function subscribeToMscAlerts(
  onAlert: (records: RealtimeRecord[]) => void
): Promise<AmqpsSubscription | null> {
  if (!MSC_AMQPS_ENABLED) return null;
  try {
    // GH#921: the broker moved to dd.weather.gc.ca (q.weather.gc.ca no longer
    // resolves) and requires the sarracenia conventions — exchange `xpublic`,
    // topic prefix v02.post, and a q_anonymous.* queue name (arbitrary queue
    // names are ACCESS_REFUSED for the anonymous user; verified live).
    const conn: ChannelModel = await connect(MSC_AMQPS_URL);
    const ch: Channel = await conn.createChannel();
    await ch.assertQueue(MSC_AMQPS_QUEUE, { durable: false, autoDelete: true });
    await ch.bindQueue(MSC_AMQPS_QUEUE, MSC_AMQPS_EXCHANGE, MSC_AMQPS_TOPIC);

    await ch.consume(MSC_AMQPS_QUEUE, async (msg: ConsumeMessage | null) => {
      if (!msg) return;
      const xml = msg.content.toString();
      const now = new Date().toISOString();
      const records: RealtimeRecord[] = [];
      const entryRegex = /<entry>[\s\S]*?<\/entry>/gi;
      let m: RegExpExecArray | null;
      while ((m = entryRegex.exec(xml)) !== null) {
        const block = m[0];
        const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.trim() || 'Weather Alert';
        const link = block.match(/<link[^>]*href=["']([^"']+)["']/)?.[1] || '';
        const updated = block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/)?.[1] || '';
        const summary = block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
        const region = block.match(/<cap:areaDesc[^>]*>([\s\S]*?)<\/cap:areaDesc>/)?.[1] || '';
        const severity = block.match(/<cap:severity[^>]*>([\s\S]*?)<\/cap:severity>/)?.[1] || 'Unknown';
        records.push({
          source: 'eccc-weather-alerts', title, url: link,
          publishedAt: updated || now, region, severity, summary: summary.substring(0, 500),
          hash: await computeHash(`eccc-alert-${link || title}`, 'sha256'), ingestedAt: now,
        });
      }
      if (records.length > 0) {
        alertCache.set('amqps-last', records);
        lastAlertTime = Date.now();
        onAlert(records);
      }
      ch.ack(msg);
    }, { noAck: false });

    console.log('[AMQPS] Subscribed to MSC weather alerts via AMQPS');
    return { close: async () => { await ch.close(); await conn.close(); } };
  } catch (err) {
    console.warn('[AMQPS] Failed to connect, falling back to HTTPS polling:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

export function getAmqpsCache(): RealtimeRecord[] | null {
  if (lastAlertTime > 0 && Date.now() - lastAlertTime < REALTIME_CACHE_TTL_MS) {
    return alertCache.get('amqps-last') ?? null;
  }
  return null;
}

export function ensureAmqpsSubscription(): Promise<AmqpsSubscription | null> {
  if (!subInitPromise) {
    subInitPromise = subscribeToMscAlerts(() => {}).catch(() => null);
  }
  return subInitPromise;
}
