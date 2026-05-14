import type { ToolDefinition, ToolHandler } from './types.js';
import { chatCompletion } from '../ai/gateway.js';
import { searchGovData } from './api-client.js';

/**
 * AI Ask Tool
 *
 * Ask a natural language question about Canadian government data.
 * Searches across all pipeline sources (committees, lobbying, procurement,
 * regulations, courts, oversight) and returns a cited answer synthesized by AI.
 */

export const definition: ToolDefinition = {
  name: 'ai_ask',
  description:
    'Ask a natural language question about Canadian government data. Uses AI to search across all pipeline sources ' +
    '(committees, lobbying, procurement, regulations, courts, oversight) and return a cited, synthesized answer.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language question about Canadian government data (e.g., "What did the ethics commissioner investigate in 2024?")',
      },
      source_filter: {
        type: 'string',
        description: 'Optional: narrow search to a specific source type (e.g., "committees", "lobbying", "procurement", "regulations", "courts", "oversight")',
      },
    },
    required: ['query'],
  },
};

/**
 * Map source filter string to pipeline data source keys.
 */
function resolveSourceKeys(filter?: string): string[] {
  const sourceMap: Record<string, string[]> = {
    committees: ['hoc', 'senate'],
    lobbying: ['lobbying'],
    procurement: ['procurement'],
    regulations: ['gazette'],
    courts: ['canlii'],
    oversight: ['oversight'],
    gic: ['gic'],
    elections: ['elections'],
    corporate: ['corporate'],
    influence: ['influence'],
    provincial_lobbying: ['provincialLobbying'],
    lmia: ['lmia'],
  };

  if (!filter) {
    // All sources
    return Object.values(sourceMap).flat();
  }

  const key = filter.toLowerCase().replace(/[\s-]+/g, '_');
  return sourceMap[key] || [filter];
}

export const handler: ToolHandler = async (args) => {
  const query = (args.query as string) ?? '';
  if (!query.trim()) {
    return {
      content: {
        tool: 'ai_ask',
        query: '',
        error: 'No question provided. Please include a question about Canadian government data.',
      },
      isError: true,
    };
  }

  const sourceFilter = (args.source_filter as string) ?? '';
  const sourceKeys = resolveSourceKeys(sourceFilter);

  try {
    // Step 1: Search live API
    const result = await searchGovData(query, 'all', 15);
    let searchResults = result.results;
    let totalFound = result.total;

    // Step 2: Build context from pipeline results
    const contextParts: string[] = [];
    const citations: Array<{ source: string; title: string; url?: string }> = [];

    for (const record of searchResults.slice(0, 10)) {
      const source = record._source || record.source || 'unknown';
      const title = record.title || record.name || record.caseName || 'Record';
      const url = record.url || record.source || '';
      const summary = record.summary || record.description || '';

      contextParts.push(`[Source: ${source}] ${title}${summary ? ': ' + summary.slice(0, 500) : ''}`);
      citations.push({ source, title, url });
    }

    // Step 3: Build the AI prompt with context
    const systemPrompt = `You are a Canadian government data analyst. Answer the user's question based on the provided pipeline data context.

Rules:
- Base your answer ONLY on the context provided below.
- If the context doesn't contain enough information to answer, say so clearly.
- Cite specific sources from the context in your answer using [Source: name] markers.
- Keep your answer concise, factual, and well-structured.
- If relevant numbers or statistics are present, include them.`;

    const contextBlock = contextParts.length > 0
      ? `\n\nPipeline Data Context:\n${contextParts.join('\n')}`
      : '\n\nNo pipeline data records were found matching the query. If you have general knowledge that can help, you may provide a limited answer noting the lack of specific pipeline evidence.';

    const userMessage = `Question: ${query}${contextBlock}`;

    // Step 4: Send to AI Gateway for synthesis
    const result = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      { temperature: 0.3, maxTokens: 2048 },
    );

    return {
      content: {
        tool: 'ai_ask',
        query,
        sourceFilter: sourceFilter || undefined,
        answer: result.content,
        citations,
        totalPipelineRecordsFound: totalFound,
        pipelineRecordsUsed: searchResults.length,
        model: result.model,
        usage: result.usage,
      },
    };
  } catch (error) {
    return {
      content: {
        tool: 'ai_ask',
        query,
        sourceFilter: sourceFilter || undefined,
        error: `AI synthesis failed: ${(error as Error).message}`,
      },
      isError: true,
    };
  }
};
