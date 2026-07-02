// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Shared response builder for all MCP tools.
 * Ensures every response has: source, retrievedAt, license, dataHash.
 */

export interface CitationMeta {
  source: string;
  retrievedAt: string;
  license: string;
  dataHash?: string;
}

export function buildCitation(source: string): CitationMeta {
  return {
    source,
    retrievedAt: new Date().toISOString(),
    license: 'OGL-Canada (https://open.canada.ca/en/open-government-licence-canada)',
  };
}

export function addMeta<T extends Record<string, unknown>>(data: T, source: string): T & CitationMeta {
  return { ...data, ...buildCitation(source) };
}
