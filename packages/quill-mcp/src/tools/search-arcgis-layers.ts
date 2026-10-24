// SPDX-License-Identifier: AGPL-3.0-only

import type { ToolDefinition, ToolHandler } from './types.js';
import { searchArcGISLayers } from './upstream-fetcher.js';

export const definition: ToolDefinition = {
  name: 'search_arcgis_layers',
  description: 'Search ArcGIS feature services and layers across Manitoba, Saskatchewan, and Prince Edward Island. Returns available GIS data services matching your keyword. Use this to find geospatial data for provinces without CKAN portals.',
  inputSchema: { type: 'object', properties: {
    province: { type: 'string', enum: ['mb', 'sk', 'pe'], description: 'Province code (mb=Manitoba, sk=Saskatchewan, pe=PEI)' },
    keyword: { type: 'string', description: 'Search term (e.g., "road", "health", "water", "parcel")' },
  }, required: ['province', 'keyword'] },
};

export const handler: ToolHandler = async (args: Record<string, unknown>) => {
  const province = String(args.province ?? '');
  const keyword = String(args.keyword ?? '').trim();
  if (!province || !keyword) return { content: { tool: 'search_arcgis_layers', error: 'Provide province and keyword' }, isError: true };

  try {
    const { results, total } = await searchArcGISLayers(province, keyword);
    return { content: { tool: 'search_arcgis_layers', province, keyword, layers: results, totalCount: total, server: `ArcGIS REST services for ${province}` } };
  } catch (error) {
    return { content: { tool: 'search_arcgis_layers', error: (error as Error).message }, isError: true };
  }
};
