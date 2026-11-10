// SPDX-License-Identifier: AGPL-3.0-only
import type { ToolDefinition, ToolHandler } from './types.js';
import { fetchGicAppointments } from './upstream-fetcher.js';

/**
 * Search Governor-in-Council (GiC) appointments — order-in-council appointments
 * to federal agencies, boards, commissions, and Crown corporations.
 */
export const definition: ToolDefinition = {
  name: 'search_gic',
  description:
    'Search Governor-in-Council (GiC) appointments to federal agencies, boards, ' +
    'commissions, and Crown corporations. Includes order-in-council appointment data, ' +
    'salary ranges, departmental categories, appointment types, and ' +
    'cross-references with federal lobbying registry for lobbyists-turned-appointees.',
  descriptions: {
    "fr-CA": "Rechercher les nominations du gouverneur en conseil, y compris les titulaires de charge, les échelles salariales et les affiliations ministérielles. Couvre toutes les nominations fédérales par décret.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        maxLength: 2000,
        description: 'Search terms — appointee name, department, or body (e.g., "Bank of Canada", "CRTC")',
      },
      department: {
        type: 'string',
        description: 'Filter by department or portfolio category',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 50,
        description: 'Maximum results to return (default: 10)',
      },
    },
    required: ['query'],
  },
};

export const handler: ToolHandler = async (args) => {
  const query = (args.query as string) ?? '';
  if (!query.trim()) {
    return {
      content: {
        tool: 'search_gic',
        query: '',
        error: 'No search query provided. Please specify an appointee name, department, or body.',
      },
      isError: true,
    };
  }

  const department = (args.department as string) ?? '';
  const limit = Math.min((args.limit as number) ?? 10, 50);

  // Live search via API server
  try {
    const result = await fetchGicAppointments(query, limit);
    let results = result.results;
    let total = result.total;

    // Apply department filter if provided
    let filteredResults = results;
    if (department) {
      const d = department.toLowerCase();
      filteredResults = results.filter((r: any) =>
        JSON.stringify(r).toLowerCase().includes(d)
      );
    }

    return {
      content: {
        tool: 'search_gic',
        query,
        department: department || undefined,
        limit,
        results: filteredResults,
        totalCount: department ? filteredResults.length : total,
      },
    };
  } catch (err) {
    return {
      content: {
        tool: 'search_gic',
        query,
        department: department || undefined,
        limit,
        error: err instanceof Error ? err.message : 'Unknown error fetching GIC appointments',
      },
      isError: true,
    };
  }
};
