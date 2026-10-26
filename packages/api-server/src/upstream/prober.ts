/**
 * Quill — upstream prober.
 *
 * One in-process interval in the API server, not a CronJob: the state is a
 * five-minute rolling window of samples, and a per-minute CronJob would have to
 * persist that window to a table the API reads back — more moving parts for the
 * same answer. The API pod already runs continuously, the probes are read-only
 * GETs, and two replicas double-probing the same public endpoints is harmless.
 *
 * Storage note (task constraint: "existing DB if there is one, else in-memory
 * with a short cache"): state lives in memory and is rebuilt within one probe
 * interval after a restart. Nothing here is worth a migration yet; the moment
 * we want 30-day history the samples go to SQLite next to `ingest_runs`.
 *
 * `GET /v1/upstream/status` reads `status()`; the prober never touches the
 * response path, so a slow upstream can only delay a probe, never a request.
 */

import logger from '../logger.js';
import {
  UPSTREAM_MAINTENANCE,
  type UpstreamHost,
  type UpstreamMaintenanceConfig,
  type UpstreamProbe,
} from './maintenance-config.js';
import { activeWindow } from './time.js';
import {
  evaluateHost,
  type HostEvaluation,
  type ProbeSample,
  type UpstreamState,
} from './state.js';

export interface UpstreamHostStatus extends HostEvaluation {
  id: string;
  host: string;
  aliases: string[];
  affects: string[];
  /** Epoch ms of the newest sample; null before the first probe. */
  sampledAt: number | null;
  latencyMs: number | null;
  /** ISO instant of the last state change. */
  since: string | null;
}

export interface UpstreamStatusPayload {
  generatedAt: string;
  probe: {
    enabled: boolean;
    intervalSeconds: number;
    rollingWindowSeconds: number;
    hostsProbed: number;
  };
  summary: {
    /** Worst state across all hosts. */
    state: UpstreamState;
    offendingHosts: string[];
  };
  /** The one notice the site may show, or null. Keeps copy out of the UI. */
  banner: {
    host: string;
    state: UpstreamState;
    message: { en: string; fr: string };
    source: string | null;
    expectedBackAt: string | null;
    affects: string[];
  } | null;
  hosts: UpstreamHostStatus[];
}

interface HostRuntime {
  samples: ProbeSample[];
  state: UpstreamState | null;
  since: string | null;
}

function jsonHasPath(value: unknown, path: string): boolean {
  const segments = path.replace(/^\$\.?/, '').split('.').filter(Boolean);
  let cursor: unknown = value;
  for (const segment of segments) {
    if (cursor === null || typeof cursor !== 'object') return false;
    cursor = (cursor as Record<string, unknown>)[segment];
    if (cursor === undefined) return false;
  }
  return true;
}

export interface ProbeOutcome {
  ok: boolean;
  status: number;
  latencyMs: number;
  reason?: string;
}

/**
 * Run one probe and judge the payload, not just the status code.
 *
 * A 200 with an empty body, a bot-wall HTML page, or a moved JSON path is a
 * failed probe: the endpoint is up but the data is not usable. During a
 * declared `data_lock`, the window's `expectStatus` list decides what counts as
 * healthy (StatCan answers 409 while it rebuilds tables).
 */
export async function runProbe(
  probe: UpstreamProbe,
  options: { timeoutMs: number; allowStatus?: number[]; fetchImpl?: typeof fetch },
): Promise<ProbeOutcome> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const started = Date.now();
  let response: Response;
  try {
    response = await fetchImpl(probe.url, {
      headers: { 'User-Agent': 'QuillUpstreamProbe/1.0 (+https://quill.maplespike.ca)' },
      signal: AbortSignal.timeout(options.timeoutMs),
      redirect: 'follow',
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      reason: `network: ${(err as Error).message}`,
    };
  }

  const status = response.status;
  const body = await response.text().catch(() => '');
  const latencyMs = Date.now() - started;
  const allowed = options.allowStatus ?? (probe.expect.status ? [probe.expect.status] : null);
  if (allowed) {
    if (!allowed.includes(status)) {
      return { ok: false, status, latencyMs, reason: `status ${status} not in ${allowed.join('/')}` };
    }
  } else if (status < 200 || status >= 400) {
    return { ok: false, status, latencyMs, reason: `status ${status}` };
  }

  if (probe.expect.jsonHasPath) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return { ok: false, status, latencyMs, reason: 'malformed JSON' };
    }
    if (!jsonHasPath(parsed, probe.expect.jsonHasPath)) {
      return { ok: false, status, latencyMs, reason: `missing ${probe.expect.jsonHasPath}` };
    }
  }

  if (probe.expect.bodyMatches && !body.includes(probe.expect.bodyMatches)) {
    return { ok: false, status, latencyMs, reason: `body missing "${probe.expect.bodyMatches}"` };
  }

  return { ok: true, status, latencyMs };
}

export class UpstreamProber {
  private readonly config: UpstreamMaintenanceConfig;
  private readonly runtime = new Map<string, HostRuntime>();
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private lastProbeAt: string | null = null;

  constructor(
    config: UpstreamMaintenanceConfig = UPSTREAM_MAINTENANCE,
    deps: { fetchImpl?: typeof fetch; now?: () => Date } = {},
  ) {
    this.config = config;
    this.fetchImpl = deps.fetchImpl ?? fetch;
    this.now = deps.now ?? (() => new Date());
    for (const host of config.hosts) {
      this.runtime.set(host.id, { samples: [], state: null, since: null });
    }
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Probe every host once, in parallel. Never throws. */
  async probeOnce(): Promise<void> {
    const now = this.now();
    const tasks = this.config.hosts
      // A blocked_permanent host is logged and disabled in the pipeline; there
      // is no value in hammering a 403 every minute (report §6.2 rule 7).
      .filter((host) => !host.blockedPermanent)
      .map(async (host) => {
        const runtime = this.runtime.get(host.id);
        if (!runtime) return;
        const window = host.windows
          .map((w) => ({ window: w, active: activeWindow(w, now) }))
          .find((entry) => entry.active !== null);
        const allowStatus = window?.window.expectStatus;
        const outcome = await runProbe(host.probe, {
          timeoutMs: this.config.probe.timeoutMs,
          allowStatus,
          fetchImpl: this.fetchImpl,
        });
        runtime.samples.push({
          at: now.getTime(),
          ok: outcome.ok,
          status: outcome.status,
          latencyMs: outcome.latencyMs,
        });
        // Keep one window plus a margin: enough for hysteresis, bounded memory.
        const cutoff = now.getTime() - this.config.probe.rollingWindowSeconds * 3000;
        runtime.samples = runtime.samples.filter((s) => s.at >= cutoff);
        if (!outcome.ok) {
          logger.warn(
            { host: host.host, status: outcome.status, reason: outcome.reason },
            'upstream probe failed',
          );
        }
      });

    await Promise.all(tasks);
    this.lastProbeAt = now.toISOString();
    this.refreshStates(now);
  }

  private refreshStates(now: Date): void {
    for (const host of this.config.hosts) {
      const runtime = this.runtime.get(host.id);
      if (!runtime) continue;
      const evaluation = evaluateHost(host, runtime.samples, runtime.state, now, this.config.probe);
      if (runtime.state !== evaluation.state) {
        runtime.since = now.toISOString();
        runtime.state = evaluation.state;
        if (evaluation.state !== 'up' && evaluation.state !== 'unknown') {
          logger.warn(
            { host: host.host, state: evaluation.state, since: runtime.since },
            'upstream state changed',
          );
        }
      }
    }
  }

  /** Current status for `GET /v1/upstream/status`. */
  status(): UpstreamStatusPayload {
    const now = this.now();
    // Re-evaluate: a window can open between probes (08:30 ET is not on a probe
    // boundary), and that must show up without waiting for the next sample.
    this.refreshStates(now);

    const hosts: UpstreamHostStatus[] = this.config.hosts.map((host) => {
      const runtime = this.runtime.get(host.id) ?? { samples: [], state: null, since: null };
      const evaluation = evaluateHost(host, runtime.samples, runtime.state, now, this.config.probe);
      const latest = runtime.samples[runtime.samples.length - 1];
      return {
        ...evaluation,
        id: host.id,
        host: host.host,
        aliases: host.aliases ?? [],
        affects: host.affects,
        sampledAt: latest ? latest.at : null,
        latencyMs: latest ? latest.latencyMs : null,
        since: runtime.since,
      };
    });

    const offending = hosts.filter((h) => h.state !== 'up' && h.state !== 'unknown' && h.state !== 'blocked_permanent');
    let worst: UpstreamHostStatus | null = null;
    for (const host of hosts) {
      if (!worst || host.severity > worst.severity) worst = host;
    }
    const bannered = offending
      .filter((h) => h.showBanner)
      .sort((a, b) => b.severity - a.severity)[0];

    return {
      generatedAt: now.toISOString(),
      probe: {
        enabled: this.running,
        intervalSeconds: this.config.probe.intervalSeconds,
        rollingWindowSeconds: this.config.probe.rollingWindowSeconds,
        hostsProbed: hosts.filter((h) => h.state !== 'blocked_permanent').length,
      },
      summary: {
        state: worst?.state ?? 'up',
        offendingHosts: offending.map((h) => h.host),
      },
      banner: bannered
        ? {
            host: bannered.host,
            state: bannered.state,
            message: bannered.message,
            source: bannered.source,
            expectedBackAt: bannered.expectedBackAt,
            affects: bannered.affects,
          }
        : null,
      hosts,
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const tick = () => {
      void this.probeOnce().catch((err) => {
        logger.error({ err: (err as Error).message }, 'upstream prober tick failed');
      });
    };
    // First probe shortly after boot so /v1/upstream/status is real within
    // seconds; the interval then owns the cadence.
    setTimeout(tick, 2_000).unref?.();
    this.timer = setInterval(tick, this.config.probe.intervalSeconds * 1000);
    // Never hold the process open: tests and one-shot CLIs import the server.
    this.timer.unref?.();
    logger.info(
      { intervalSeconds: this.config.probe.intervalSeconds, hosts: this.config.hosts.length },
      'upstream prober started',
    );
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
  }

  /** Diagnostics for /v1/health-style checks; not part of the public payload. */
  get lastProbe(): string | null {
    return this.lastProbeAt;
  }
}

/** Shared instance. The route imports this; `startUpstreamProber()` arms it. */
export const upstreamProber = new UpstreamProber();

/**
 * Arm the prober unless `QUILL_UPSTREAM_PROBE` says otherwise. Tests and
 * one-shot CLIs never probe; a deploy can disable it without a code change.
 */
export function startUpstreamProber(env: Record<string, string | undefined> = process.env): boolean {
  const flag = (env.QUILL_UPSTREAM_PROBE ?? '').toLowerCase();
  const disabled = flag === '0' || flag === 'false' || flag === 'off';
  if (disabled) {
    logger.info('upstream prober disabled by QUILL_UPSTREAM_PROBE');
    return false;
  }
  upstreamProber.start();
  return true;
}

export type { UpstreamHost };
