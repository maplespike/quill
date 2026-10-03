// SPDX-License-Identifier: AGPL-3.0-or-later

import { NO_REUSE_LICENSE_NOTICE } from '@maplespike/pipeline-core';

/**
 * Shared response builder for all MCP tools.
 * Adds source metadata and an explicit unknown retrieval time; never fabricates acquisition timestamps.
 */

export interface CitationMeta {
  source: string;
  retrievedAt: string | null;
  license: string;
  license_url?: string;
  license_basis?: 'publisher-metadata' | 'source-configuration' | 'no-publisher-declaration';
  attribution_text?: string;
  dataHash?: string;
}

export function buildCitation(source: string, license = NO_REUSE_LICENSE_NOTICE): CitationMeta {
  return {
    source,
    retrievedAt: null,
    license,
  };
}

export function addMeta<T extends Record<string, unknown>>(
  data: T,
  source: string,
  license = NO_REUSE_LICENSE_NOTICE,
): T & CitationMeta {
  return { ...data, ...buildCitation(source, license) };
}
