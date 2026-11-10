// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — upstream status state machine.
 *
 * The UI reads one state per host and nothing else. Every rule below maps to
 * `quill-hermes/UPSTREAM-OUTAGES.md` §6.2, and the rules exist to keep the copy
 * honest:
 *
 *   scheduled  inside a declared maintenance window; expectedBackAt = window end
 *   partial    inside a `data_lock` (StatCan 00:00-08:30 ET) — never `down`
 *   announced  an operator published an incident; expectedBackAt is null
 *   down       failures at or above the threshold, outside any window
 *   degraded   slow, or failing below the threshold; cached data keeps serving
 *   up         healthy
 *   unknown    no samples yet; the UI says nothing
 *   blocked_permanent  rejects us by policy (403); logged, never a banner
 *
 * Two properties matter most:
 *   1. A single failed probe never flips anything. DOWN needs
 *      `downAfterFailures` failures inside the rolling window, and leaving DOWN
 *      needs `upAfterSuccesses` consecutive successes (hysteresis).
 *   2. No ETA is invented. `expectedBackAt` is set only by a declared window.
 *      A measured p50 may appear as `typicalRecoveryMinutes`, and copy that uses
 *      it must say "usually".
 */

import { activeWindow, formatClock, zoneLabel } from './time.js';
import {
  hostLabel,
  type UpstreamHost,
  type UpstreamMaintenanceConfig,
  type UpstreamWindow,
} from './maintenance-config.js';

export type UpstreamState =
  | 'up'
  | 'degraded'
  | 'down'
  | 'scheduled'
  | 'partial'
  | 'announced'
  | 'unknown'
  | 'blocked_permanent';

export interface ProbeSample {
  /** Epoch ms of the request. */
  at: number;
  ok: boolean;
  /** HTTP status, 0 when the request produced no response. */
  status: number;
  latencyMs: number;
}

export interface BilingualMessage {
  en: string;
  fr: string;
}

export interface HostEvaluation {
  state: UpstreamState;
  /** failures / samples inside the rolling window. null when there are none. */
  failureRate: number | null;
  sampleCount: number;
  /** Only a declared window sets this. Never derived from typicalRecoveryMinutes. */
  expectedBackAt: string | null;
  window: { kind: UpstreamWindow['kind']; startsAt: string; endsAt: string } | null;
  /** Where the reader can check the claim. */
  source: string | null;
  confidence: 'observed' | 'scheduled' | 'announced' | 'policy';
  message: BilingualMessage;
  /** False for up / unknown / blocked_permanent and for watch windows. */
  showBanner: boolean;
  /** Higher wins when several hosts are unhealthy. */
  severity: number;
  typicalRecoveryMinutes?: number;
}

const SEVERITY: Record<UpstreamState, number> = {
  down: 5,
  announced: 4,
  partial: 3,
  scheduled: 3,
  degraded: 2,
  up: 0,
  unknown: 0,
  blocked_permanent: 0,
};

function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index];
}

function consecutiveSuccesses(samples: ProbeSample[]): number {
  let count = 0;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (!samples[i].ok) break;
    count++;
  }
  return count;
}

function scheduledMessage(endsAt: Date, timezone: string): BilingualMessage {
  const clock = `${formatClock(endsAt, timezone)} ${zoneLabel(timezone)}`;
  return {
    en: `Scheduled maintenance, back by ${clock}.`,
    fr: `Maintenance planifiée, retour vers ${clock}.`,
  };
}

/**
 * Evaluate one host. Pure: same inputs, same output, no clock reads.
 *
 * @param previousState the state this host reported last time; drives hysteresis
 */
export function evaluateHost(
  host: UpstreamHost,
  samples: ProbeSample[],
  previousState: UpstreamState | null,
  now: Date,
  probeConfig: UpstreamMaintenanceConfig['probe'],
): HostEvaluation {
  const label = hostLabel(host);
  const copy = host.copy ?? {};
  const base = {
    failureRate: null as number | null,
    sampleCount: 0,
    window: null as HostEvaluation['window'],
    typicalRecoveryMinutes: host.typicalRecoveryMinutes,
  };

  // ── Policy blocks come first: they are not outages and never clear by time.
  if (host.blockedPermanent) {
    return {
      ...base,
      state: 'blocked_permanent',
      expectedBackAt: null,
      source: host.probe.url,
      confidence: 'policy',
      message: {
        en: `${label.en} rejects automated requests. This source is disabled until it allows us again.`,
        fr: `${label.fr} refuse les requêtes automatisées. Cette source est désactivée jusqu'à ce qu'elle nous autorise de nouveau.`,
      },
      showBanner: false,
      severity: SEVERITY.blocked_permanent,
    };
  }

  // ── Declared windows (rule 1 and rule 2).
  for (const window of host.windows) {
    const active = activeWindow(window, now);
    if (!active) continue;
    const windowInfo = {
      kind: window.kind,
      startsAt: active.startsAt.toISOString(),
      endsAt: active.endsAt.toISOString(),
    };

    if (window.kind === 'data_lock') {
      // Rule 2: partial, never down. Tables are locked; the service is up.
      return {
        ...base,
        state: 'partial',
        window: windowInfo,
        expectedBackAt: null,
        source: window.source ?? null,
        confidence: 'scheduled',
        message: { en: window.messageEn, fr: window.messageFr },
        showBanner: true,
        severity: SEVERITY.partial,
      };
    }

    // Rule 1: a declared window owns the copy, including the only ETA we publish.
    return {
      ...base,
      state: 'scheduled',
      window: windowInfo,
      expectedBackAt: active.endsAt.toISOString(),
      source: window.source ?? null,
      confidence: 'scheduled',
      message: scheduledMessage(active.endsAt, window.timezone),
      showBanner: true,
      severity: SEVERITY.scheduled,
    };
  }

  // ── Announced incidents (rule 3): the operator said it; we do not guess when.
  if (host.announcedIncident && host.announcedIncident.state === 'open') {
    return {
      ...base,
      state: 'announced',
      expectedBackAt: null,
      source: host.announcedIncident.source,
      confidence: 'announced',
      message: { en: host.announcedIncident.messageEn, fr: host.announcedIncident.messageFr },
      showBanner: true,
      severity: SEVERITY.announced,
    };
  }

  // ── Observed state (rules 4 and 5).
  const windowStart = now.getTime() - probeConfig.rollingWindowSeconds * 1000;
  const recent = samples.filter((s) => s.at >= windowStart);
  const failures = recent.filter((s) => !s.ok).length;
  const failureRate = recent.length > 0 ? failures / recent.length : null;
  const successes = consecutiveSuccesses(recent);
  const slowP95 = p95(recent.filter((s) => s.ok).map((s) => s.latencyMs));

  let state: UpstreamState;
  if (recent.length === 0) {
    state = 'unknown';
  } else if (previousState === 'down') {
    // Hysteresis: stay DOWN until the host proves itself with a run of 200s.
    state = successes >= probeConfig.upAfterSuccesses ? 'up' : 'down';
  } else if (failures >= probeConfig.downAfterFailures) {
    state = 'down';
  } else if (failures > 0 || (slowP95 > 0 && slowP95 > probeConfig.degradedIfP95MsOver)) {
    state = 'degraded';
  } else {
    state = 'up';
  }

  const observed = {
    ...base,
    state,
    failureRate,
    sampleCount: recent.length,
    expectedBackAt: null,
    source: host.probe.url,
    confidence: 'observed' as const,
    severity: SEVERITY[state],
    showBanner: state === 'down' || state === 'degraded',
  };

  if (state === 'down') {
    // "Usually" is deliberate: a measured p50 is not a promise. Report §6.2 rule 4.
    const usuallyEn = host.typicalRecoveryMinutes
      ? ` Usually back in about ${host.typicalRecoveryMinutes} minutes.`
      : '';
    const usuallyFr = host.typicalRecoveryMinutes
      ? ` Généralement de retour dans environ ${host.typicalRecoveryMinutes} minutes.`
      : '';
    return {
      ...observed,
      message: {
        en:
          (copy.downEn ??
            `${label.en} isn't responding. Showing cached results; we retry automatically.`) + usuallyEn,
        fr:
          (copy.downFr ??
            `${label.fr} ne répond pas. Les résultats en cache restent affichés; nous réessayons automatiquement.`) +
          usuallyFr,
      },
    };
  }

  if (state === 'degraded') {
    return {
      ...observed,
      message: {
        en: copy.degradedEn ?? `${label.en} is responding slowly. Some results may be missing.`,
        fr: copy.degradedFr ?? `${label.fr} répond lentement. Certains résultats peuvent manquer.`,
      },
    };
  }

  return {
    ...observed,
    message: { en: 'Operational', fr: 'Opérationnel' },
  };
}
