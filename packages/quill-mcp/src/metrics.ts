import { createHash } from 'node:crypto';

export type Outcome = 'success' | 'error' | 'rejected';
export type HostedIdentityMode = 'api-key' | 'anonymous-ip';
export interface MetricIdentity {
  hashed: string;
  mode: string;
}

type Sample = {
  tool: string;
  outcome: Outcome;
  count: number;
  durationCount: number;
  durationSum: number;
  buckets: number[];
};

const BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60];
const REGISTERED_TOOLS = new Set<string>();
const MAX_REGISTERED_TOOLS = 256;
const IDENTITY_WINDOW_MS = 5 * 60 * 1000;
const MAX_TRACKED_IDENTITIES = 4096;
const HOSTED_MODES: readonly string[] = ['api-key', 'anonymous-ip'];

export function registerMetricTool(name: string): void {
  if (REGISTERED_TOOLS.has(name)) return;
  if (/^[a-zA-Z0-9_.-]{1,100}$/.test(name) && REGISTERED_TOOLS.size < MAX_REGISTERED_TOOLS) {
    REGISTERED_TOOLS.add(name);
  }
}

function escapeLabel(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('"', '\\"');
}

function labels(tool: string, outcome: Outcome, le?: string): string {
  const suffix = le === undefined ? '' : `,le="${escapeLabel(le)}"`;
  return `{tool="${escapeLabel(tool)}",outcome="${outcome}"${suffix}}`;
}

export class McpMetrics {
  private readonly samples = new Map<string, Sample>();
  private readonly identities = new Map<string, number>();
  private readonly windowMs: number;
  private readonly maxIdentities: number;
  private readonly now: () => number;
  private quotaHits = 0;
  private paymentHits = 0;

  constructor(options: { windowMs?: number; maxIdentities?: number; now?: () => number } = {}) {
    this.windowMs = options.windowMs ?? IDENTITY_WINDOW_MS;
    this.maxIdentities = options.maxIdentities ?? MAX_TRACKED_IDENTITIES;
    this.now = options.now ?? Date.now;
  }

  record(tool: string, outcome: Outcome, durationSeconds?: number): void {
    const safeTool = REGISTERED_TOOLS.has(tool) ? tool : 'unregistered';
    const safeOutcome: Outcome = ['success', 'error', 'rejected'].includes(outcome) ? outcome : 'error';
    const safeDuration = durationSeconds !== undefined && Number.isFinite(durationSeconds)
      ? Math.min(3600, Math.max(0, durationSeconds))
      : undefined;
    const key = `${safeTool}\u0000${safeOutcome}`;
    let sample = this.samples.get(key);
    if (!sample) {
      sample = { tool: safeTool, outcome: safeOutcome, count: 0, durationCount: 0, durationSum: 0, buckets: BUCKETS.map(() => 0) };
      this.samples.set(key, sample);
    }
    sample.count++;
    if (safeDuration !== undefined) {
      sample.durationCount++;
      sample.durationSum += safeDuration;
      BUCKETS.forEach((boundary, index) => {
        if (safeDuration <= boundary) sample!.buckets[index]++;
      });
    }
  }

  /** Count a hosted MCP identity once per message; self-hosted stdio is excluded. */
  recordIdentity(identity?: MetricIdentity): void {
    if (!identity || !HOSTED_MODES.includes(identity.mode)) return;
    if (typeof identity.hashed !== 'string' || identity.hashed.length === 0) return;
    const now = this.now();
    this.pruneIdentities(now);
    const key = createHash('sha256').update(identity.hashed).digest('hex');
    if (!this.identities.has(key) && this.identities.size >= this.maxIdentities) {
      const oldest = this.identities.keys().next().value;
      if (oldest !== undefined) this.identities.delete(oldest);
    }
    this.identities.set(key, now + this.windowMs);
  }

  recordQuotaDenied(): void {
    this.quotaHits++;
  }

  recordPaymentAttempt(): void {
    this.paymentHits++;
  }

  private pruneIdentities(now: number): void {
    for (const [key, expires] of this.identities) {
      if (expires <= now) this.identities.delete(key);
    }
  }

  private activeIdentityCount(): number {
    this.pruneIdentities(this.now());
    return this.identities.size;
  }

  render(): string {
    const lines = [
      '# HELP quill_mcp_tool_calls_total MCP tool call outcomes.',
      '# TYPE quill_mcp_tool_calls_total counter',
      '# HELP quill_mcp_tool_call_duration_seconds MCP handler duration in seconds.',
      '# TYPE quill_mcp_tool_call_duration_seconds histogram',
    ];
    for (const sample of this.samples.values()) {
      lines.push(`quill_mcp_tool_calls_total${labels(sample.tool, sample.outcome)} ${sample.count}`);
      if (sample.durationCount === 0) continue;
      BUCKETS.forEach((boundary, index) => {
        lines.push(`quill_mcp_tool_call_duration_seconds_bucket${labels(sample.tool, sample.outcome, String(boundary))} ${sample.buckets[index]}`);
      });
      lines.push(`quill_mcp_tool_call_duration_seconds_bucket${labels(sample.tool, sample.outcome, '+Inf')} ${sample.durationCount}`);
      lines.push(`quill_mcp_tool_call_duration_seconds_sum${labels(sample.tool, sample.outcome)} ${sample.durationSum}`);
      lines.push(`quill_mcp_tool_call_duration_seconds_count${labels(sample.tool, sample.outcome)} ${sample.durationCount}`);
    }
    lines.push(
      '# HELP quill_mcp_active_identities Distinct hosted MCP identities seen in the last five minutes.',
      '# TYPE quill_mcp_active_identities gauge',
      `quill_mcp_active_identities ${this.activeIdentityCount()}`,
      '# HELP quill_mcp_quota_hits_total MCP tool calls denied by the free quota.',
      '# TYPE quill_mcp_quota_hits_total counter',
      `quill_mcp_quota_hits_total ${this.quotaHits}`,
      '# HELP quill_mcp_payment_hits_total MCP tool calls carrying an x402 payment attempt.',
      '# TYPE quill_mcp_payment_hits_total counter',
      `quill_mcp_payment_hits_total ${this.paymentHits}`,
    );
    return `${lines.join('\n')}\n`;
  }
}

export const mcpMetrics = new McpMetrics();
export type { Outcome as McpMetricOutcome };
