/**
 * Tool registry — loads all 4 CivInt MCP tools
 */

import type { ToolDefinition, ToolHandler } from './types.js';
import * as queryGovData from './query-gov-data.js';
import * as factCheck from './fact-check.js';
import * as getCitation from './get-citation.js';
import * as latestReleases from './latest-releases.js';

export interface ToolModule {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export function getAllTools(): ToolModule[] {
  return [
    queryGovData,
    factCheck,
    getCitation,
    latestReleases,
  ];
}

export function getToolNames(): string[] {
  return getAllTools().map(t => t.definition.name);
}
