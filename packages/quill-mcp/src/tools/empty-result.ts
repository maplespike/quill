/**
 * Helper to build an empty-result response with a suggestion.
 * Standardizes the "no results" experience across tools.
 */
export function emptyResult(tool: string, suggestion: string, extra?: Record<string, unknown>) {
  return {
    content: {
      tool,
      results: [],
      total: 0,
      suggestion,
      ...extra,
    },
  };
}

export function errorResult(tool: string, error: string, suggestion?: string) {
  return {
    content: {
      tool,
      error,
      ...(suggestion ? { suggestion } : {}),
    },
    isError: true,
  };
}