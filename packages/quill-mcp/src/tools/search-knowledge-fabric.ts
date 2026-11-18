// SPDX-License-Identifier: AGPL-3.0-only
/**
 * search_knowledge_fabric MCP Tool — MapleSpike
 *
 * Query the Knowledge Fabric vector knowledge base. Returns
 * AI-synthesized answers with citations from local Qdrant storage
 * and web search results via RRF fusion.
 */

import type { ToolDefinition, ToolHandler } from './types.js';

const KF_API_URL = process.env.KNOWLEDGE_FABRIC_URL || 'http://knowledge-fabric.ai-inference.svc.cluster.local:3100';

export const definition: ToolDefinition = {
  name: 'search_knowledge_fabric',
  description:
    'Query the Knowledge Fabric vector knowledge base for deep research across ' +
    'brain sessions, wiki pages, and web sources. Returns synthesized answers with ' +
    'source citations. Use for questions requiring institutional or historical knowledge.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', maxLength: 2000, description: 'Question or search query' },
      file_back: {
        type: 'boolean',
        description: 'Save the answer as a Q&A wiki page for future queries',
      },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (params) => {
  const { query, file_back = false } = params as Record<string, unknown>;

  try {
    const resp = await fetch(`${KF_API_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'MapleSpike/0.2' },
      body: JSON.stringify({ question: query, fileBack: file_back }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`Knowledge Fabric API ${resp.status}: ${body.slice(0, 200)}`);
    }

    const json = (await resp.json()) as {
      success: boolean;
      data: { answer: string; chunks_used: number; web_results_used: number; collections: string[] };
    };

    if (!json.success) {
      throw new Error('Knowledge Fabric query failed');
    }

    return {
      content: {
        tool: 'search_knowledge_fabric',
        query,
        answer: json.data.answer,
        sources: {
          local_chunks: json.data.chunks_used,
          web_results: json.data.web_results_used,
          collections: json.data.collections,
        },
      },
    };
  } catch (error) {
    const msg = (error as Error).message;
    return {
      content: {
        tool: 'search_knowledge_fabric',
        query,
        error: msg,
        note: 'Ensure the Knowledge Fabric API server is running (pnpm run server in knowledge-fabric/).',
      },
      isError: true,
    };
  }
};
