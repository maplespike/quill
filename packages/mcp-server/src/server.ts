/**
 * CivInt MCP Server — core protocol implementation
 *
 * Implements the Model Context Protocol (MCP) over stdio and SSE transports.
 * JSON-RPC 2.0 based, supporting tools/list and tools/call methods.
 */

import type { ToolDefinition, ToolHandler, ToolResponse } from './tools/types.js';

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

function log(level: 'info' | 'warn' | 'error', msg: string, ...args: unknown[]) {
  // stderr so it doesn't interfere with stdio transport
  console.error(`[civint-mcp] ${level}: ${msg}`, ...args.map(a => typeof a === 'string' ? a : JSON.stringify(a)));
}

// ─── MCP Server ─────────────────────────────────────────────────────────

export class McpServer {
  private tools = new Map<string, { definition: ToolDefinition; handler: ToolHandler }>();
  private initialized = false;
  private clientCapabilities: Record<string, unknown> = {};
  private serverVersion = '0.1.0';
  private serverName = 'civint-canada-mcp';

  // ── Tool registration ─────────────────────────────────────────────────

  registerTool(definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.name, { definition, handler });
    log('info', `Registered tool: ${definition.name}`);
  }

  // ── Incoming message handling ──────────────────────────────────────────

  async handleMessage(
    raw: unknown,
    send: (response: JsonRpcResponse) => void,
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
        log('info', 'Client initialized');
        // Notifications don't have an id — no response
        break;
      case 'tools/list':
        this.handleToolsList(id, send);
        break;
      case 'tools/call':
        await this.handleToolCall(id, params, send);
        break;
      default:
        if (id != null) {
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

    log('info', `Initialize: protocolVersion=${params?.protocolVersion ?? 'unknown'}`);

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
    send: (r: JsonRpcResponse) => void,
  ): void {
    const definitions: ToolDefinition[] = [];
    for (const { definition } of this.tools.values()) {
      definitions.push(definition);
    }

    send(this.result(id ?? null, { tools: definitions }));
  }

  private async handleToolCall(
    id: string | number | undefined,
    params: Record<string, unknown> | undefined,
    send: (r: JsonRpcResponse) => void,
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

    // Run handler; catch sync and async errors
    try {
      const result: ToolResponse = await tool.handler(args);

      // MCP tool result envelope
      // content is an array of text|image|resource items
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
      const msg = err instanceof Error ? err.message : String(err);
      send(this.result(id ?? null, {
        content: [{ type: 'text', text: `Error: ${msg}` }],
        isError: true,
      }));
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
