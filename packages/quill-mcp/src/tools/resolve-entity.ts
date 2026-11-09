/**
 * MapleSpike MCP Tool — resolve_entity
 *
 * Resolves a person or organization name to the mentions found across
 * ingestion modules that have linked records. Returns a consolidated profile
 * with aliases, source appearances, roles, and dates.
 *
 * Data sources: committees, lobbying, SEDI, corporate registry,
 * procurement, OpenCorporates, and all other modules.
 */

import type { ToolDefinition, ToolHandler } from './types.js';
import { resolveEntity, resolveBilingualEntity } from '@maplespike/pipeline-core';
import { withClaims } from './claims-helper.js';

export const definition: ToolDefinition = {
  name: 'resolve_entity',
  description:
    'Resolve a person or organization name to the mentions found in MapleSpike data sources. ' +
    'Returns a consolidated profile with canonical name, aliases, source appearances (committees, ' +
    'lobbying, procurement, corporate, etc.), roles, and dates. Coverage is limited to modules that have ' +
    'ingested and linked records for this name — a missing registry means no linked record, not that none exists.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        maxLength: 2000,
        description: 'Name to resolve — person (e.g. "John Smith") or organization (e.g. "Lockheed Martin Canada")',
      },
      type: {
        type: 'string',
        enum: ['person', 'organization', 'auto'],
        description: 'Entity type hint (default: auto-detect)',
      },
      threshold: {
        type: 'number',
        minimum: 0.5,
        maximum: 1.0,
        description: 'Fuzzy matching threshold (default: 0.7, higher = stricter)',
      },
      lang: {
        type: 'string',
        enum: ['en', 'fr'],
        description: 'Preferred display language for the canonical name (default: en). The name may be supplied in either official language.',
      },
    },
    required: ['name'],
  },
};

export const handler: ToolHandler = async (args) => {
  const name = (args.name as string)?.trim();
  if (!name) {
    return {
      content: {
        tool: 'resolve_entity',
        query: '',
        error: 'No name provided. Please specify a person or organization name to resolve.',
      },
      isError: true,
    };
  }

  const type = (args.type as string) ?? 'auto';
  const threshold = (args.threshold as number) ?? 0.7;
  const lang = args.lang === 'fr' ? 'fr' : 'en';

  // Public institutions carry official EN/FR names. Resolve the pair first so
  // a French query ("Ministère des Finances Canada") reports the bilingual
  // canonical names instead of only the English string it was matched against.
  const bilingualMatch = resolveBilingualEntity(name, lang);

  try {
    const result = resolveEntity(name, type, threshold);
    return {
      content: await withClaims({
        tool: 'resolve_entity',
        query: name,
        type: result.type,
        lang,
        canonicalName: result.canonicalName,
        canonicalNameLocalized: bilingualMatch ? bilingualMatch.preferredName : result.canonicalName,
        bilingual: bilingualMatch
          ? {
              en: bilingualMatch.en,
              fr: bilingualMatch.fr,
              matched_lang: bilingualMatch.matchedLang,
              preferred_name: bilingualMatch.preferredName,
            }
          : null,
        confidence: result.confidence,
        aliases: result.aliases,
        appearances: result.appearances,
        totalAppearances: result.appearances.length,
        summary: `${result.canonicalName} appears in ${result.appearances.length} record(s) across ${new Set(result.appearances.map(a => a.module)).size} module(s).`,
      }, result.appearances.map(a => ({
        claim: `Appearance in ${a.module}: ${a.role || 'mentioned'}${a.date ? ` (${a.date})` : ''}`,
        value: a,
        sourceName: a.module,
        sourceUrl: a.sourceUrl || '',
        transformations: ['entity-resolution'],
      }))),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Entity resolution failed';
    return {
      content: {
        tool: 'resolve_entity',
        query: name,
        error: message,
      },
      isError: true,
    };
  }
};
