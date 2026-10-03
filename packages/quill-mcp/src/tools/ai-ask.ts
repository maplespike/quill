import type { ToolDefinition, ToolHandler } from './types.js';
import { chatCompletion } from '../ai/gateway.js';
import { searchGovData } from './api-client.js';
import { scanPII } from '@maplespike/pipeline-core';
import { withClaims } from './claims-helper.js';

/**
 * AI Ask Tool
 *
 * Ask a natural language question about Canadian government data.
 * Searches the pipeline sources it can reach (committees, lobbying, procurement,
 * regulations, courts, oversight) and returns a cited answer synthesized by AI.
 */

export const definition: ToolDefinition = {
  name: 'ai_ask',
  description:
    'Ask a natural language question about Canadian government data. Uses AI to search the pipeline sources ' +
    'it can reach (committees, lobbying, procurement, regulations, courts, oversight) and return a cited, ' +
    'synthesized answer. The answer is model-generated from retrieved records; verify the cited records ' +
    'before relying on the synthesis, and absence of an answer is not evidence of absence in the source.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
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
    const searchResult = await searchGovData(query, 'all', 15);
    const searchResults = (searchResult as any)?.results ?? [];
    const totalFound = (searchResult as any)?.total ?? 0;

    // Step 2: Build context from pipeline results (PII-redacted before AI sees it)
    const contextParts: string[] = [];
    const citations: Array<{ source: string; title: string; url?: string }> = [];

    for (const record of searchResults.slice(0, 10)) {
      const source = record._source || record.source || 'unknown';
      const title = record.title || record.name || record.caseName || 'Record';
      const url = record.url || record.source || '';
      const summary = scanPII(record.summary || record.description || '').redacted;

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

    // Step 4: Try AI synthesis, fall back to search-only mode
    let aiResult: any = null;
    let synthesisError: string | null = null;
    try {
      aiResult = await chatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        { temperature: 0.3, maxTokens: 2048 },
      );
    } catch (err) {
      synthesisError = (err as Error).message;
      // Graceful degradation: return search results without AI synthesis
    }

    if (aiResult) {
      return {
        content: await withClaims({
          tool: 'ai_ask',
          query,
          sourceFilter: sourceFilter || undefined,
          answer: scanPII((aiResult as any)?.content ?? '').redacted,
          citations,
          totalPipelineRecordsFound: totalFound,
          pipelineRecordsUsed: searchResults.length,
          model: (aiResult as any)?.model ?? '',
          usage: (aiResult as any)?.usage ?? {},
        }, citations.map(c => ({
          claim: `Citation: ${c.title}`,
          value: c,
          sourceName: c.source,
          sourceUrl: c.url || '',
          transformations: ['semantic-search'],
        }))),
      };
    }

    // Search-only fallback (no AI gateway available)
    return {
      content: await withClaims({
        tool: 'ai_ask',
        query,
        sourceFilter: sourceFilter || undefined,
        answer: null,
        mode: 'search_only',
        note: synthesisError?.includes('fetch failed')
          ? 'AI synthesis unavailable (no inference gateway). Showing raw search results below.'
          : `AI synthesis unavailable: ${synthesisError}. Showing raw search results.`,
        citations,
        totalRecordsFound: totalFound,
        results: searchResults.slice(0, 10).map((r: Record<string, unknown>) => ({
          title: r.title || r.name || 'Record',
          source: (r._source || r.source || 'unknown') as string,
          url: (r.url || '') as string,
          summary: scanPII(((r.summary || r.description || '') as string).slice(0, 500)).redacted,
        })),
      }, citations.map(c => ({
        claim: `Citation: ${c.title}`,
        value: c,
        sourceName: c.source,
        sourceUrl: c.url || '',
        transformations: ['semantic-search'],
      }))),
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
