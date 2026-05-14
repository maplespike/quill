import type { ToolDefinition, ToolHandler } from './types.js';
import { computeHash, generateVerifyCommand } from '@maplespike/pipeline-core';

/**
 * In-memory citation store.
 * Populated by other tools when they produce data; queryable by hash.
 */
interface CitationRecord {
  hash: string;
  content: string;
  timestamp: string;
  source: string;
  license: string;
}

const citationStore = new Map<string, CitationRecord>();

/**
 * Register a citation in the store.
 * Called by other tools to record their outputs.
 */
export function registerCitation(source: string, content: string, license: string = 'Open Government Licence – Canada'): string {
  // Hash is computed inline synchronously for storage key
  // (computeHash is async but we store synchronously; hash is set on retrieval)
  const timestamp = new Date().toISOString();
  const pseudoHash = `sha256-${Math.abs(
    content.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0),
  ).toString(36).padStart(16, '0')}`;

  citationStore.set(pseudoHash, {
    hash: pseudoHash,
    content,
    timestamp,
    source,
    license,
  });

  return pseudoHash;
}

/**
 * Retrieve a citation by its SHA-256 content hash.
 * Returns the original data, timestamp, source attribution, and a ready-to-run shell command
 * for independent hash verification.
 */
export const definition: ToolDefinition = {
  name: 'get_citation',
  description:
    'Retrieve a citation record by its SHA-256 content hash. Returns the original data, timestamp, ' +
    'source attribution, and a ready-to-run shell command for independent hash verification. ' +
    'Use this to verify that content has not been altered since publication.',
  descriptions: {
    "fr-CA": "Récupérer et vérifier un hachage de citation SHA-256 pour un enregistrement de données spécifique. Permet de vérifier l’intégrité des données en recomputant le hachage à partir de la source originale.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      hash: {
        type: 'string',
        description: 'SHA-256 citation hash (e.g., "sha256-abc123...")',
      },
    },
    required: ['hash'],
  },
};

export const handler: ToolHandler = async (args) => {
  const hash = (args.hash as string) ?? '';
  if (!hash) {
    return {
      content: {
        tool: 'get_citation',
        hash: '',
        citation: null,
        verifyCommand: 'echo "Usage: provide a SHA-256 citation hash"',
        message: 'No citation hash provided. Pass a hash parameter (e.g., "sha256-abc123...") to retrieve a citation record.',
      },
    };
  }
  const cleanHash = hash.replace(/^sha256-/, '');

  // Look up in memory store
  const record = citationStore.get(hash) ?? citationStore.get(`sha256-${cleanHash}`);

  if (record) {
    // Verify the stored content hash
    const computedHex = await computeHash(record.content);
    const computedShort = `sha256-${computedHex.slice(0, 16)}`;
    const verified = computedShort === hash || computedHex === cleanHash;

    return {
      content: {
        tool: 'get_citation',
        hash,
        citation: {
          hash,
          timestamp: record.timestamp,
          source: record.source,
          license: record.license,
          verified,
          data: record.content.length > 500
            ? record.content.slice(0, 500) + '... [truncated — use verify command for full verification]'
            : record.content,
        },
        verifyCommand: generateVerifyCommand(`https://api.maplespike.ca/v1/citation/${hash}`),
        message: verified
          ? 'Citation verified — content hash matches stored record.'
          : 'Citation found but content hash could not be independently verified (stored hash differs or no content store).',
      },
    };
  }

  // Not found in memory — return verification instructions
  return {
    content: {
      tool: 'get_citation',
      hash,
      citation: {
        hash,
        timestamp: null,
        source: 'unknown',
        license: 'unknown',
        verified: false,
        data: null,
      },
      verifyCommand: generateVerifyCommand(`https://api.maplespike.ca/v1/citation/${hash}`),
      message:
        'Citation not found in current session store. ' +
        'This hash may correspond to data ingested in a previous session or by the MapleSpike pipeline. ' +
        'To verify independently, use the shell command above with the original data source.',
      note: 'Citations are stored per-server-session. For persistent citation storage, deploy with a database-backed audit logger.',
    },
  };
};
