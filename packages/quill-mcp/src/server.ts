/**
 * MapleSpike MCP Server — core protocol implementation
 *
 * Implements the Model Context Protocol (MCP) over stdio and SSE transports.
 * JSON-RPC 2.0 based, supporting tools/list and tools/call methods.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ToolDefinition, ToolHandler, ToolResponse } from './tools/types.js';
import { validatePayment, extractPaymentFromArgs } from './x402-middleware.js';
import type { PaymentProof } from './x402-middleware.js';
import { getToolPrice } from './pricing.js';
import { getQuotaTracker, type QuotaIdentity, type QuotaTracker } from './quota.js';
import { runWithIdentity } from './context.js';
import { mcpMetrics, registerMetricTool } from './metrics.js';

// ── Claim Stack + Agent-native surfaces (WS-1/WS-3) ──────────────
import { citationStore } from '@maplespike/pipeline-core';
import { getEntityById, resolveEntity, findConnections } from '@maplespike/pipeline-core';
import { PIPELINE_CORE_SRC } from './pipeline-root.js';

// ─── Types ──────────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  /** Absent on notifications (MCP spec: notifications carry no id) */
  id?: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
  /** Present only on server->client notifications (e.g. notifications/progress) */
  method?: string;
  params?: Record<string, unknown>;
}

/**
 * Sink for server->client frames. The SSE transport writes them onto the
 * client's event stream; the stdio transport writes one JSON line each to
 * stdout. Transport-agnostic on purpose so both share one dispatcher.
 */
export type McpMessageWriter = (response: JsonRpcResponse) => void;

interface ServerCapabilities {
  experimental?: Record<string, unknown>;
  tools?: Record<string, unknown>;
  resources?: Record<string, unknown>;
  prompts?: Record<string, unknown>;
}

// ─── Logging ────────────────────────────────────────────────────────────

import logger from './logger.js';

const log = logger;

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

function readDispatcherVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(here, '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: unknown };
  if (typeof pkg.version !== 'string' || pkg.version.length === 0) {
    throw new Error(`Missing version in ${pkgPath}`);
  }
  return pkg.version;
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
  /** Matches packages/quill-mcp/package.json. src/ and dist/ both sit one level below it. */
  private serverVersion = readDispatcherVersion();
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
    registerMetricTool(definition.name);
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
      // ── Agent-native surfaces (WS-3) ──────────────────────────────
      case 'resources/list':
        this.handleResourcesList(id, params, send);
        break;
      case 'resources/templates/list':
        this.handleResourcesTemplatesList(id, params, send);
        break;
      case 'resources/read':
        await this.handleResourcesRead(id, params, send);
        break;
      case 'prompts/list':
        this.handlePromptsList(id, params, send);
        break;
      case 'prompts/get':
        this.handlePromptsGet(id, params, send);
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
      resources: { listChanged: false }, // resources/list + read + templates
      prompts: {}, // prompts/list + get
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

  // ── Agent-native surfaces (WS-3) ────────────────────────────────────

  private handleResourcesList(
    id: string | number | undefined,
    _params: Record<string, unknown> | undefined,
    send: (r: JsonRpcResponse) => void,
  ): void {
    const resources = [
      {
        uri: 'quill://tool-index',
        name: 'Quill tool index',
        description: 'Live list of every tool the server exposes, with descriptions — the agent-native replacement for the static discover_tools index.',
        mimeType: 'application/json',
      },
      {
        uri: 'quill://schemas',
        name: 'Module schema index',
        description: 'Index of every ingestion module schema (name, file, field count) — the versioned data contract for composition.',
        mimeType: 'application/json',
      },
      {
        uri: 'quill://claims/latest',
        name: 'Recent claim bundles',
        description: 'Most recently registered claim bundles (record hash, claim, source, source retrieval time when evidenced, and license metadata). A hash match does not authenticate the source or establish reuse rights.',
        mimeType: 'application/json',
      },
    ];
    send(this.result(id ?? null, { resources }));
  }

  private handleResourcesTemplatesList(
    id: string | number | undefined,
    _params: Record<string, unknown> | undefined,
    send: (r: JsonRpcResponse) => void,
  ): void {
    const resourceTemplates = [
      {
        uriTemplate: 'quill://entities/{name}',
        name: 'Entity profile',
        description: 'Resolved entity profile (aliases, appearances, confidence) for a person or organization.',
        mimeType: 'application/json',
      },
      {
        uriTemplate: 'quill://citations/{hash}',
        name: 'Claim bundle',
        description: 'Claim bundle by SHA-256 record hash, with available source evidence and terms metadata. Hash matching checks record integrity, not source authenticity or reuse rights.',
        mimeType: 'application/json',
      },
      {
        uriTemplate: 'quill://crossref/{name}',
        name: 'Entity connections',
        description: 'Relationship network around a person or organization (lobbying, committees, corporate, GIC).',
        mimeType: 'application/json',
      },
      {
        uriTemplate: 'quill://schemas/{module}',
        name: 'Module schema',
        description: 'Versioned field-level schema for a single ingestion module — name, type, required, description per field.',
        mimeType: 'application/json',
      },
    ];
    send(this.result(id ?? null, { resourceTemplates }));
  }

  private async handleResourcesRead(
    id: string | number | undefined,
    params: Record<string, unknown> | undefined,
    send: (r: JsonRpcResponse) => void,
  ): Promise<void> {
    const uri = (params?.uri as string) ?? '';
    if (!uri) {
      send(this.error(id ?? null, -32602, 'Invalid params: must include "uri"'));
      return;
    }

    try {
      // quill://tool-index — live registry dump
      if (uri === 'quill://tool-index') {
        const tools = Array.from(this.tools.values()).map(({ definition }) => ({
          name: definition.name,
          description: definition.description,
        }));
        send(this.result(id ?? null, {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(tools, null, 2),
          }],
        }));
        return;
      }

      // quill://entities/{name}
      const entityMatch = uri.match(/^quill:\/\/entities\/(.+)$/);
      if (entityMatch) {
        const name = decodeURIComponent(entityMatch[1]);
        const byId = getEntityById(name);
        const result = byId ?? resolveEntity(name);
        send(this.result(id ?? null, {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(result, null, 2),
          }],
        }));
        return;
      }

      // quill://citations/{hash}
      const citationMatch = uri.match(/^quill:\/\/citations\/(.+)$/);
      if (citationMatch) {
        const hash = citationMatch[1].toLowerCase().replace(/^sha256[:-]/, '');
        const stored = citationStore.get(hash);
        if (!stored) {
          send(this.error(id ?? null, -32602, `Citation not found: ${hash}`));
          return;
        }
        send(this.result(id ?? null, {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(stored.bundle, null, 2),
          }],
        }));
        return;
      }

      // quill://claims/latest — recently registered claim bundles
      if (uri === 'quill://claims/latest') {
        const claims = citationStore.latest(25);
        send(this.result(id ?? null, {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              count: claims.length,
              claims: claims.map(c => ({
                sha256: `sha256:${c.hash}`,
                claim: c.claim,
                source_name: c.sourceName,
                source_url: c.sourceUrl,
                retrieved_at: c.retrievedAt,
                license: c.license,
                update_frequency: c.updateFrequency,
                created_at: c.createdAt,
              })),
            }, null, 2),
          }],
        }));
        return;
      }

      // quill://schemas — module schema index (cached; extractSchemas is filesystem-heavy)
      if (uri === 'quill://schemas') {
        const schemas = await this.getSchemaIndex();
        send(this.result(id ?? null, {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              schemaCount: schemas.length,
              schemas: schemas.map(s => ({
                name: s.name,
                file: s.file,
                fieldCount: s.fields.length,
                requiredFields: s.fields.filter(f => !f.optional).map(f => f.name),
              })),
            }, null, 2),
          }],
        }));
        return;
      }

      // quill://schemas/{module} — single module schema
      const schemaMatch = uri.match(/^quill:\/\/schemas\/(.+)$/);
      if (schemaMatch) {
        const moduleFilter = decodeURIComponent(schemaMatch[1]).toLowerCase();
        const schemas = (await this.getSchemaIndex())
          .filter(s => s.file.toLowerCase().includes(moduleFilter) || s.name.toLowerCase().includes(moduleFilter));
        if (schemas.length === 0) {
          send(this.error(id ?? null, -32602, `No schema found matching "${schemaMatch[1]}"`));
          return;
        }
        send(this.result(id ?? null, {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(schemas.map(s => ({
              name: s.name,
              file: s.file,
              fields: s.fields.map(f => ({
                name: f.name,
                type: f.type,
                required: !f.optional,
                description: f.description,
              })),
            })), null, 2),
          }],
        }));
        return;
      }

      // quill://crossref/{name}
      const crossrefMatch = uri.match(/^quill:\/\/crossref\/(.+)$/);
      if (crossrefMatch) {
        const name = decodeURIComponent(crossrefMatch[1]);
        const byId = getEntityById(name);
        const resolved = byId ?? resolveEntity(name);
        if (!resolved.id) {
          send(this.error(id ?? null, -32602, `Entity not found: ${name}`));
          return;
        }
        const { connections } = findConnections(resolved.canonicalName);
        send(this.result(id ?? null, {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ center: resolved, connections }, null, 2),
          }],
        }));
        return;
      }

      send(this.error(id ?? null, -32602, `Unknown resource URI: ${uri}`));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      send(this.error(id ?? null, -32602, `Resource read failed: ${msg}`));
    }
  }

  /** Lazily-loaded module schema index (extractSchemas is a filesystem + AST scan — cache it). */
  private schemaIndexPromise: Promise<
    Array<{ name: string; file: string; fields: Array<{ name: string; type: string; optional: boolean; description: string }> }>
  > | null = null;

  private getSchemaIndex(): Promise<
    Array<{ name: string; file: string; fields: Array<{ name: string; type: string; optional: boolean; description: string }> }>
  > {
    if (!this.schemaIndexPromise) {
      this.schemaIndexPromise = import('@maplespike/pipeline-core/doc-generator')
        .then(({ extractSchemas }) => extractSchemas(PIPELINE_CORE_SRC))
        .catch((err) => {
          // Reset so a transient failure retries instead of caching a
          // rejected promise forever (mirrors citation.ts pipelineHashIndex).
          this.schemaIndexPromise = null;
          throw err;
        });
    }
    return this.schemaIndexPromise;
  }

  private handlePromptsList(
    id: string | number | undefined,
    _params: Record<string, unknown> | undefined,
    send: (r: JsonRpcResponse) => void,
  ): void {
    const prompts = [
      {
        name: 'influence-map',
        description: 'Map a lobbyist or organization influence trail across lobbying, committees, GIC appointments, and corporate records.',
      },
      {
        name: 'provenance-brief',
        description: 'Produce a provenance-backed briefing on a regulation, bill, or policy area with verifiable claim bundles.',
      },
      {
        name: 'narrative-shift',
        description: 'Detect narrative shift across Gazette notices and committee evidence for a topic or entity.',
      },
    ];
    send(this.result(id ?? null, { prompts }));
  }

  private handlePromptsGet(
    id: string | number | undefined,
    params: Record<string, unknown> | undefined,
    send: (r: JsonRpcResponse) => void,
  ): void {
    const name = (params?.name as string) ?? '';
    const args = (params?.arguments as Record<string, unknown>) ?? {};
    const target = (args.target as string) ?? '<entity>';

    const promptMessages = (messages: Array<{ role: 'user' | 'assistant'; content: string }>) =>
      messages.map(m => ({ role: m.role, content: { type: 'text', text: m.content } }));

    switch (name) {
      case 'influence-map':
        send(this.result(id ?? null, {
          description: `Map the influence trail of ${target}`,
          messages: promptMessages([
            { role: 'user', content: `Map the influence trail of ${target} across Canadian federal data.\n\nWorkflow:\n1. resolve_entity name=${target} — get canonical identity + aliases + all appearances.\n2. get_entity_profile name=<canonicalName> — MP, lobbying, and GIC records.\n3. find_connections name=<canonicalName> — relationship network (employs, lobbies, directs, owns).\n4. Search committees + debates for appearances: search_committees query=<name>.\n5. Check regulatory/financial threads: search_financial_regulation, search_proactive_disclosure.\n6. Synthesize: produce a timeline of influence events with claim hashes from each response.` },
          ]),
        }));
        return;
      case 'provenance-brief':
        send(this.result(id ?? null, {
          description: `Produce a provenance-backed briefing on ${target}`,
          messages: promptMessages([
            { role: 'user', content: `Produce a provenance-backed briefing on ${target}.\n\nWorkflow:\n1. fact_check claim=<target> — gather corroborating/contradicting official evidence.\n2. search_gazette + search_legislation — regulatory status.\n3. search_committees — parliamentary consideration.\n4. track_bill query=<target> — bill lifecycle if applicable.\n5. For every factual claim in the briefing, attach the sha256 claim hash from the tool response and the source URL.` },
          ]),
        }));
        return;
      case 'narrative-shift':
        send(this.result(id ?? null, {
          description: `Detect narrative shift across Gazette + committee evidence for ${target}`,
          messages: promptMessages([
            { role: 'user', content: `Detect narrative shift for ${target}.\n\nWorkflow:\n1. search_gazette query=${target} — official regulatory notices over time.\n2. search_committees query=${target} — witness statements and testimony.\n3. search_narrative_tracker / search_ngo_rss query=${target} — policy-actor messaging.\n4. Compare terminology, framing, and positions across time windows; flag shifts with dated evidence + claim hashes.` },
          ]),
        }));
        return;
      default:
        send(this.error(id ?? null, -32602, `Unknown prompt: ${name || '(none)'}`));
    }
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
      mcpMetrics.record('unregistered', 'rejected');
      send(this.error(id ?? null, -32602, 'Invalid params: must include "name"'));
      return;
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      mcpMetrics.record('unregistered', 'rejected');
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
        mcpMetrics.record(toolName, 'rejected');
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
      mcpMetrics.record(toolName, 'rejected');
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
      mcpMetrics.record(toolName, 'rejected');
      send(this.result(id ?? null, {
        content: [{ type: 'text', text: validationErrors.join('\n') }],
        isError: true,
      }));
      return;
    }

    // ── Progress notifications (WS-3) ──────────────────────────────
    // If the caller supplied a progressToken (per MCP _meta), emit
    // notifications/progress at start and completion so heavy
    // cross-reference calls (linked_entities, track_bill, signal_check)
    // can stream progress to the agent without blocking.
    const meta = (params?._meta as Record<string, unknown>) ?? {};
    const progressToken = meta.progressToken;
    const sendProgress = (progress: number) => {
      if (progressToken !== undefined) {
        // MCP spec: notifications/progress carries the payload in `params`,
        // has no `id`, and never has a `result`.
        const notification: JsonRpcResponse = {
          jsonrpc: '2.0',
          method: 'notifications/progress',
          params: { progressToken, progress, tool: toolName },
        };
        send(notification);
      }
    };

    // Run handler with timeout; catch sync and async errors.
    // The handler runs inside an AsyncLocalStorage.run() context so that
    // system_health (and any future tool that reads getCurrentIdentity())
    // sees the correct per-request identity even when two SSE clients post
    // tools/call concurrently and their handlers interleave on `await`.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let started = Date.now();
    try {
      sendProgress(0);
      started = Date.now();
      const resultPromise = identity
        ? runWithIdentity(identity, () => tool.handler(args))
        : tool.handler(args);
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const msg = `Tool "${toolName}" timed out after ${this.handlerTimeoutMs}ms`;
          log.error({ tool: toolName, timeoutMs: this.handlerTimeoutMs }, 'Tool handler timed out');
          reject(new Error(msg));
        }, this.handlerTimeoutMs);
      });
      const rawResult: ToolResponse = await Promise.race([resultPromise, timeoutPromise]);
      clearTimeout(timer);
      const durationSeconds = (Date.now() - started) / 1000;
      sendProgress(1);
      if (Date.now() - started > 2000) {
        log.info({ tool: toolName, durationMs: Date.now() - started }, 'Slow tool handler');
      }
      const result: ToolResponse = sanitizeOutput(rawResult);
      mcpMetrics.record(toolName, result.isError ? 'error' : 'success', durationSeconds);

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
      mcpMetrics.record(toolName, 'error', (Date.now() - started) / 1000);
      log.error({ tool: toolName, timeout: isTimeout }, 'MCP tool handler failed');
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

    // Max length for strings (from schema or default 2000)
    if (propType === 'string' && typeof value === 'string') {
      const propMaxLength = (prop.maxLength as number | undefined) ?? 2000;
      if (value.length > propMaxLength) {
        errors.push(`Invalid value for "${key}": ${value.length} chars exceeds max ${propMaxLength}`);
      }
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
