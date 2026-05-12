/** Shared types for CivInt MCP server tools */

export interface ToolDefinition {
  name: string;
  description: string;
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
