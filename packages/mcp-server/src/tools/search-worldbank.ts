import type { ToolDefinition, ToolHandler } from './types.js';

export const definition: ToolDefinition = {
  name: 'search_worldbank',
  description:
    'Search World Bank development indicators — GDP, inflation, unemployment, ' +
    'population, trade, health, education, environment, poverty, energy, and more. ' +
    'Covers 16,000+ indicators across 200+ countries from the World Bank Indicators API.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search terms — indicator name, topic, or country (e.g., "GDP Canada", "inflation", "population Nigeria")',
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default 10)',
      },
      country: {
        type: 'string',
        description: 'ISO-2 country code to filter results (e.g., "CA", "US", "IN", "CN")',
      },
      indicator: {
        type: 'string',
        description: 'Specific indicator code (e.g., "NY.GDP.MKTP.CD", "SP.POP.TOTL")',
      },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const query = String(args.query ?? '');
  const limit = Number(args.limit ?? 10);
  const country = args.country ? String(args.country).toUpperCase() : null;
  const indicatorFilter = args.indicator ? String(args.indicator) : null;

  if (!query.trim() && !indicatorFilter) {
    return {
      content: {
        tool: 'search_worldbank',
        query: '',
        error: 'No search query provided. Try a topic, country, or indicator code.',
      },
      isError: true,
    };
  }

  try {
    // Import and call the worldbank ingestion module
    const mod = await import('@maplespike/pipeline-core/ingestion/worldbank/index.js');
    const { WB_INDICATORS, WB_TOP_INDICATORS, WB_INDICATOR_CATEGORIES } = mod;

    // Filter indicators by query
    const queryLower = query.toLowerCase();
    let matchedIndicators: Array<{ code: string; name: string; category: string; matched: boolean }> = [];

    const indicatorEntries = Object.entries(WB_INDICATORS) as [string, string][];
    for (const [key, code] of indicatorEntries) {
      if (indicatorFilter && code !== indicatorFilter) continue;

      const name = key.replace(/_/g, ' ').toLowerCase()
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
      const category = WB_INDICATOR_CATEGORIES[code] ?? 'economy';
      const nameLower = name.toLowerCase();

      const matchQuery = !query.trim() || nameLower.includes(queryLower) ||
        code.toLowerCase().includes(queryLower) ||
        category.includes(queryLower);

      if (matchQuery) {
        matchedIndicators.push({ code, name, category, matched: true });
      }
    }

    // Sort by relevance
    matchedIndicators.sort((a, b) => {
      const aExact = a.name.toLowerCase() === queryLower ? -1 : 0;
      const bExact = b.name.toLowerCase() === queryLower ? 1 : 0;
      return aExact || a.name.localeCompare(b.name);
    });

    const results = matchedIndicators.slice(0, limit);

    return {
      content: {
        tool: 'search_worldbank',
        query,
        limit,
        country,
        totalIndicators: matchedIndicators.length,
        results: results.map(r => ({
          indicatorCode: r.code,
          name: r.name,
          category: r.category,
          url: `https://data.worldbank.org/indicator/${r.code}`,
        })),
      },
    };
  } catch (err) {
    return {
      content: {
        tool: 'search_worldbank',
        query,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      isError: true,
    };
  }
};
