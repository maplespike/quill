import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchJson, cached } from './upstream-fetcher.js';

interface WeatherResponse {
  features?: Array<{
    properties: Record<string, unknown>;
  }>;
}

export const definition: ToolDefinition = {
  name: 'search_weather',
  description:
    'Search Canadian weather data from Environment Canada — current conditions, ' +
    'forecasts, severe weather alerts, air quality health index (AQHI), radar, ' +
    'marine forecasts, and climate normals. Powered by MSC GeoMet (OGC API).',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Weather data type: "conditions" (current), "forecast" (3-day), "alerts" (warnings), "aqhi" (air quality), "climate" (normals)',
        enum: ['conditions', 'forecast', 'alerts', 'aqhi', 'climate'],
      },
      location: {
        type: 'string',
        description: 'Location name or coordinates (e.g., "Toronto", "Vancouver", "45.42,-75.69")',
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default 10)',
      },
    },
    required: ['type', 'location'],
  },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const type = String(args.type ?? 'conditions');
  const location = String(args.location ?? '');
  const limit = Number(args.limit ?? 10);

  if (!location.trim()) {
    return { content: { tool: 'search_weather', error: 'No location provided.' }, isError: true };
  }

  try {
    const baseUrl = 'https://api.weather.gc.ca';
    const typeMap: Record<string, string> = {
      conditions: 'conditions',
      forecast: 'forecasts',
      alerts: 'alerts',
      aqhi: 'aqhi/observations',
      climate: 'climate/daily',
    };
    const endpoint = typeMap[type] || 'conditions';

    const result = await cached(`weather_${type}`, { location, limit }, async () => {
      const url = `${baseUrl}/${endpoint}?limit=${limit}&lang=en`;
      const data = await fetchJson<WeatherResponse>(url);
      return {
        results: data?.features?.slice(0, limit).map(f => f.properties) ?? [],
        total: data?.features?.length ?? 0,
      };
    });

    return {
      content: {
        tool: 'search_weather',
        type,
        location,
        ...result,
        _citation: {
          source_name: 'Environment Canada MSC GeoMet',
          source_url: `${baseUrl}/${endpoint}`,
          license: 'Open Government Licence - Canada',
          retrieved_at: new Date().toISOString(),
        },
      },
    };
  } catch (err) {
    return {
      content: {
        tool: 'search_weather',
        type,
        location,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      isError: true,
    };
  }
};
