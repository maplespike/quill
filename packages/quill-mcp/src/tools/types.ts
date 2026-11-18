// SPDX-License-Identifier: AGPL-3.0-only
/** Shared types for MapleSpike MCP server tools */

export interface ToolDefinition {
  name: string;
  description: string;
  descriptions?: Record<string, string>;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolResponse {
  content: string | Record<string, unknown> | Record<string, unknown>[];
  isError?: boolean;
}

export type ToolHandler = (args: Record<string, unknown>) => ToolResponse | Promise<ToolResponse>;
