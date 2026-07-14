/**
 * MapleSpike MCP Server — core protocol implementation
 *
 * Implements the Model Context Protocol (MCP) over stdio and SSE transports.
 * JSON-RPC 2.0 based, supporting tools/list and tools/call methods.
 */

import type { ToolDefinition, ToolHandler, ToolResponse } from './tools/types.js';
import { validatePayment, extractPaymentFromArgs } from './x402-middleware.js';
import type { PaymentProof } from './x402-middleware.js';
import { getToolPrice } from './pricing.js';
import { getQuotaTracker, type QuotaIdentity, type QuotaTracker } from './quota.js';
import { runWithIdentity } from './context.js';

// ─── Types ──────────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface ServerCapabilities {
  experimental?: Record<string, unknown>;
  tools?: Record<string, unknown>;
  resources?: Record<string, unknown>;
  prompts?: Record<string, unknown>;
}

// ─── Logging ────────────────────────────────────────────────────────────

import pino from 'pino';

const log = pino({
  level: process.env.QUILL_LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'silent'),
  redact: ['req.headers.authorization', 'req.headers.cookie'],
});

// ─── Output Sanitization ─────────────────────────────────────────────────
// OWASP LLM07: Insecure Output Handling — strip dangerous content before
// returning tool results to MCP clients (AI agents).
// Two layers: XSS sanitization (inline) + PII redaction (pipeline-core).

import { sanitizeOutput as sanitizePII } from '@maplespike/pipeline-core';

function sanitizeString(val: string): string {
  let s = val;
  // Remove <script> and </script> tags (case-insensitive)
  s = s.replace(/<script\b[^>]*>/gi, '');
  s = s.replace(/<\/script\s*>/gi, '');
  // Remove javascript: protocol from URLs
  s = s.replace(/\bjavascript\s*:/gi, '');
  // Remove data: protocol from URLs (unless a known safe image type)
  s = s.replace(/\bdata:(?!image\/(?:png|jpe?g|gif|webp|svg\+xml))/gi, '');
  // Truncate to 100,000 chars max
  if (s.length > 100000) {
    s = s.slice(0, 100000);
  }
  return s;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }
  if (Array.isArray(value)) {
    return value.map(v => sanitizeValue(v));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      result[key] = sanitizeValue(v);
    }
    return result;
  }
  return value;
}

function sanitizeOutput(response: ToolResponse): ToolResponse {
  const content = response.content;
  let sanitized: ToolResponse['content'];

  if (typeof content === 'string') {
    sanitized = sanitizeString(content);
  } else if (Array.isArray(content)) {
    sanitized = content.map(item => sanitizeValue(item)) as Record<string, unknown>[];
  } else {
    sanitized = sanitizeValue(content ?? {}) as Record<string, unknown>;
  }

  // Layer 2: PII redaction — applied after XSS sanitization
  sanitized = sanitizePII(sanitized) as ToolResponse['content'];

  return { ...response, content: sanitized };
}

// ─── MCP Server ─────────────────────────────────────────────────────────

export class McpServer {
  private tools = new Map<string, { definition: ToolDefinition; handler: ToolHandler }>();
  private initialized = false;
  private clientCapabilities: Record<string, unknown> = {};
  private serverVersion = '0.1.0';
  private serverName = 'maplespike-canada-mcp';
  /** Optional quota tracker — when present, gates calls after the free tier. */
  private quota: QuotaTracker | null = null;

  /** Inject a quota tracker (typically via getQuotaTracker() singleton). */
  setQuota(tracker: QuotaTracker): void {
    this.quota = tracker;
  }

  // ── Timeout handling ──────────────────────────────────────────────────

  // Maximum time (ms) a single tool.handler() may run. The Hermes gateway
  // times out after 60s, so stay safely under that so we can return a clean
  // JSON-RPC error instead of letting the gateway kill the connection.
  private handlerTimeoutMs = parseInt(
    process.env['QUILL_HANDLER_TIMEOUT_MS'] ?? '',
    10,
  ) || 55_000;

  // ── Tool registration ─────────────────────────────────────────────────

  registerTool(definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.name, { definition, handler });
    log.info(`Registered tool: ${definition.name}`);
  }

  // ── Incoming message handling ──────────────────────────────────────────

  async handleMessage(
    raw: unknown,
    locale: string,
    send: (response: JsonRpcResponse) => void,
    paymentProof?: PaymentProof,
    identity?: QuotaIdentity,
  ): Promise<void> {
    const msg = this.parseMessage(raw, send);
    if (!msg) return;

    const { method, id, params } = msg;

    switch (method) {
      case 'initialize':
        this.handleInitialize(id, params, send);
        break;
      case 'notifications/initialized':
        this.initialized = true;
        log.info('Client initialized');
        // Notifications don't have an id — no response
        break;
      case 'tools/list':
        this.handleToolsList(id, locale, send);
        break;
      case 'tools/call':
        await this.handleToolCall(id, params, send, paymentProof, identity);
        break;
      default:
        if (id !== null && id !== undefined) {
          send(this.error(id, -32601, `Method not found: ${method}`));
        }
    }
  }

  private parseMessage(
    raw: unknown,
    send: (r: JsonRpcResponse) => void,
  ): JsonRpcRequest | null {
    if (typeof raw !== 'object' || raw === null) {
      send(this.error(null, -32700, 'Parse error: expected object'));
      return null;
    }

    const msg = raw as Record<string, unknown>;

    if (msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      send(this.error(
        (msg.id as string | number) ?? null,
        -32600,
        'Invalid Request: must have jsonrpc: "2.0" and method: string',
      ));
      return null;
    }

    return {
      jsonrpc: '2.0',
      id: (msg.id as string | number) ?? undefined,
      method: msg.method as string,
      params: msg.params as Record<string, unknown> | undefined,
    };
  }

  // ── method handlers ───────────────────────────────────────────────────

  private handleInitialize(
    id: string | number | undefined,
    params: Record<string, unknown> | undefined,
    send: (r: JsonRpcResponse) => void,
  ): void {
    this.clientCapabilities = (params?.capabilities as Record<string, unknown>) ?? {};

    log.info(`Initialize: protocolVersion=${params?.protocolVersion ?? 'unknown'}`);

    const capabilities: ServerCapabilities = {
      tools: {}, // tools/list is supported
    };

    send(this.result(id ?? null, {
      protocolVersion: params?.protocolVersion ?? '2025-03-26',
      capabilities,
      serverInfo: {
        name: this.serverName,
        version: this.serverVersion,
      },
    }));
  }

  private handleToolsList(
    id: string | number | undefined,
    locale: string,
    send: (r: JsonRpcResponse) => void,
  ): void {
    const definitions: ToolDefinition[] = [];
    for (const { definition } of this.tools.values()) {
      const localized = { ...definition };
      if (localized.descriptions?.[locale]) {
        localized.description = localized.descriptions[locale];
      }
      delete (localized as any).descriptions;
      definitions.push(localized);
    }

    send(this.result(id ?? null, { tools: definitions }));
  }

  private async handleToolCall(
    id: string | number | undefined,
    params: Record<string, unknown> | undefined,
    send: (r: JsonRpcResponse) => void,
    paymentProof?: PaymentProof,
    identity?: QuotaIdentity,
  ): Promise<void> {
    const toolName = params?.name as string | undefined;
    const args = (params?.arguments as Record<string, unknown>) ?? {};

    if (!toolName) {
      send(this.error(id ?? null, -32602, 'Invalid params: must include "name"'));
      return;
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      send(this.error(id ?? null, -32602, `Unknown tool: ${toolName}`));
      return;
    }

    // ── x402 payment proof extraction (needed before quota gate) ─────
    // We extract the proof first because the quota gate needs to know
    // whether the caller has already graduated to a paying tier.
    const resolvedProof = paymentProof ?? extractPaymentFromArgs(args);
    const callerIsPaying = Boolean(resolvedProof) && process.env.X402_ENABLED === 'true';

    // ── Quota preflight (when an identity is provided and tracker enabled) ─
    // Free-tier policy: 1000 calls/month per identity, then x402 per-call.
    // Free tools (priceUsd === 0) always pass — see pricing.ts.
    //
    // Spec: paying customers graduate out of the free quota. If the caller
    // provides a valid x402 payment proof AND X402_ENABLED is on, skip the
    // gate entirely and let x402-middleware bill them per call. This is the
    // "1000 free then charge" intent.
    if (this.quota && identity && !callerIsPaying) {
      const price = getToolPrice(toolName).priceUsd;
      const gate = this.quota.preflight(identity, toolName, price);
      if (gate.allowed === false) {
        // gate is narrowed to the denied variant — toFixed works on toolPriceUsd.
        const cost = gate.toolPriceUsd;
        send(this.error(id ?? null, -402, 'Payment Required', {
          ...this.quota.getStatus(identity),
          tool: toolName,
          toolPriceUsd: cost,
          reason: 'free_quota_exceeded',
          message: `Free 1000-call monthly quota exceeded. Tool "${toolName}" requires x402 payment ($${cost.toFixed(3)} USDC).`,
        }));
        return;
      }
    }

    // ── x402 payment check (gated by X402_ENABLED) ─────────────────
    // validatePayment is async in Phase 2+ (Solana RPC verify + replay
    // ledger + credit deduction). Await it here.
    const paymentCheck = await validatePayment(toolName, resolvedProof, identity);
    if (!paymentCheck.allowed) {
      send(this.error(id ?? null, -402, 'Payment Required', {
        ...paymentCheck.paymentRequired,
        tool: toolName,
        price: paymentCheck.price,
        tier: paymentCheck.tier,
        message: paymentCheck.error,
      }));
      return;
    }

    // Validate arguments against the tool's inputSchema
    const validationErrors = validateToolArgs(args, tool.definition.inputSchema);
    if (validationErrors.length > 0) {
      send(this.result(id ?? null, {
        content: [{ type: 'text', text: validationErrors.join('\n') }],
        isError: true,
      }));
      return;
    }

    // Run handler with timeout; catch sync and async errors.
    // The handler runs inside an AsyncLocalStorage.run() context so that
    // system_health (and any future tool that reads getCurrentIdentity())
    // sees the correct per-request identity even when two SSE clients post
    // tools/call concurrently and their handlers interleave on `await`.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const resultPromise = identity
        ? runWithIdentity(identity, () => tool.handler(args))
        : tool.handler(args);
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const msg = `Tool "${toolName}" timed out after ${this.handlerTimeoutMs}ms`;
          log.error(msg);
          reject(new Error(msg));
        }, this.handlerTimeoutMs);
      });
      const rawResult: ToolResponse = await Promise.race([resultPromise, timeoutPromise]);
      clearTimeout(timer);
      const result: ToolResponse = sanitizeOutput(rawResult);

      // Quota accounting happens on successful calls only — errors and
      // timeouts do not consume the user's monthly budget. Underspending is
      // a feature; we don't want charger anxiety from retries.
      if (this.quota && identity && !result.isError) {
        this.quota.recordCall(identity);
      }

      send(this.result(id ?? null, {
        content: [
          {
            type: 'text',
            text: typeof result.content === 'string'
              ? result.content
              : JSON.stringify(result.content, null, 2),
          },
        ],
        isError: result.isError ?? false,
      }));
    } catch (err) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      const isTimeout = msg.includes('timed out');
      send(this.result(id ?? null, {
        content: [{ type: 'text', text: `Error: ${msg}` }],
        isError: true,
      }));
      // On timeout or unrecoverable network error, exit the process so the
      // MCP gateway spawns a fresh one. This prevents a broken process from
      // accumulating failures and being blacklisted by the gateway.
      if (isTimeout) {
        setImmediate(() => process.exit(1));
      }
    }
  }

  // ── JSON-RPC helpers ──────────────────────────────────────────────────

  private result(id: string | number | null, result: unknown): JsonRpcResponse {
    return { jsonrpc: '2.0', id, result };
  }

  private error(id: string | number | null, code: number, message: string, data?: unknown): JsonRpcResponse {
    return { jsonrpc: '2.0', id, error: { code, message, data } };
  }

  // ── Notification helpers (for server->client) ─────────────────────────

  makeNotification(method: string, params?: Record<string, unknown>): string {
    return JSON.stringify({ jsonrpc: '2.0', method, params });
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  getToolCount(): number {
    return this.tools.size;
  }
}

// ─── Runtime argument validation ─────────────────────────────────────

/**
 * Validate tool call arguments against the tool's inputSchema.
 * Returns an array of error messages (empty = valid).
 */
function validateToolArgs(
  args: Record<string, unknown>,
  schema: ToolDefinition['inputSchema'],
): string[] {
  const errors: string[] = [];
  const properties = schema.properties ?? {};
  const required = schema.required ?? [];

  // Check required fields are present and non-empty strings
  for (const field of required) {
    const value = args[field];
    if (value === undefined || value === null || value === '') {
      errors.push(`Missing required field: "${field}"`);
    }
  }

  // Check type constraints and other validations per property
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue;

    const prop = properties[key] as Record<string, unknown> | undefined;
    if (!prop) continue; // Unknown property — skip validation

    const propType = prop.type as string | undefined;
    const propEnum = prop.enum as string[] | undefined;
    const propMinimum = prop.minimum as number | undefined;
    const propMaximum = prop.maximum as number | undefined;

    // Type check
    if (propType === 'string' && typeof value !== 'string') {
      errors.push(`Invalid type for "${key}": expected string, got ${typeof value}`);
    } else if (propType === 'number' && typeof value !== 'number') {
      errors.push(`Invalid type for "${key}": expected number, got ${typeof value}`);
    }

    // Enum check (for string values)
    if (propEnum && typeof value === 'string' && !propEnum.includes(value)) {
      errors.push(
        `Invalid value for "${key}": expected one of [${propEnum.join(', ')}], got "${value}"`,
      );
    }

    // Minimum / maximum for numbers
    if (propType === 'number' && typeof value === 'number') {
      if (propMinimum !== undefined && value < propMinimum) {
        errors.push(`Invalid value for "${key}": ${value} is less than minimum ${propMinimum}`);
      }
      if (propMaximum !== undefined && value > propMaximum) {
        errors.push(`Invalid value for "${key}": ${value} is greater than maximum ${propMaximum}`);
      }
    }
  }

  return errors;
}
