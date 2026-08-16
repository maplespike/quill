import type { ToolDefinition, ToolHandler } from './types.js';
import { computeHash, canonicalJson, generateVerifyCommand, citationStore } from '@maplespike/pipeline-core';
import type { ClaimBundle } from '@maplespike/pipeline-core';

/**
 * Get / Verify a citation by its SHA-256 content hash.
 *
 * Uses the shared CitationStore (SQLite-backed, in-memory fallback) so
 * records persist across sessions when a database is present. Every tool
 * that registers claim bundles via withClaims() is queryable here.
 */
export const definition: ToolDefinition = {
  name: 'get_citation',
  description:
    'Retrieve and verify a citation record by its SHA-256 content hash. Returns the original data, timestamp, ' +
    'source attribution, license, and a ready-to-run shell command for independent verification. ' +
    'Use this to prove that content has not been altered since Quill published it.',
  descriptions: {
    "fr-CA": "Récupérer et vérifier un hachage de citation SHA-256 pour un enregistrement de données spécifique. Permet de vérifier l’intégrité des données en recomputant le hachage à partir de la source originale.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      hash: {
        type: 'string',
        description: 'SHA-256 citation hash (e.g. "sha256:<64 hex chars>")',
      },
    },
    required: ['hash'],
  },
};

/**
 * Register a citation in the store. Kept as the programmatic entry point
 * used by tests and by other tools that want to attest raw content.
 * Returns the canonical "sha256:<hex>" hash.
 */
export async function registerCitation(
  source: string,
  content: string,
  license: string = 'Open Government Licence – Canada',
): Promise<string> {
  // The store persists canonicalJson(value), so the hash MUST be computed
  // over the same canonical form — otherwise get_citation's recompute
  // (computeHash(stored.serialized)) would not match the registered hash.
  const serialized = canonicalJson(content);
  const sha256 = await computeHash(serialized, 'sha256');
  const bundle: ClaimBundle = {
    claim: content.length > 200 ? `${content.slice(0, 200)}…` : content,
    value: content,
    sha256,
    sourceName: source,
    sourceUrl: '',
    retrievedAt: new Date().toISOString(),
    license,
    transformations: [],
  };
  citationStore.put(bundle);
  return `sha256:${sha256}`;
}

export const handler: ToolHandler = async (args) => {
  const rawHash = (args.hash as string) ?? '';
  if (!rawHash) {
    return {
      content: {
        tool: 'get_citation',
        hash: '',
        citation: null,
        verifyCommand: 'echo "Usage: provide a SHA-256 citation hash"',
        message: 'No citation hash provided. Pass a hash (e.g. "sha256:abc…") to retrieve a citation record.',
      },
    };
  }

  const cleanHash = rawHash.toLowerCase().replace(/^sha256[:\-]/, '');
  if (!/^[a-f0-9]{64}$/.test(cleanHash)) {
    return {
      content: {
        tool: 'get_citation',
        hash: rawHash,
        citation: null,
        verifyCommand: 'echo "Invalid hash format"',
        message: `"${rawHash}" is not a valid SHA-256 hash. Expected "sha256:<64 hex chars>".`,
      },
    };
  }

  const stored = citationStore.get(cleanHash);
  const canonical = `sha256:${cleanHash}`;

  if (stored) {
    // Recompute to be sure the serialized value still matches.
    const recomputed = await computeHash(stored.serialized, 'sha256');
    const verified = recomputed === cleanHash;
    const data = stored.serialized;

    return {
      content: {
        tool: 'get_citation',
        hash: canonical,
        citation: {
          hash: canonical,
          timestamp: stored.bundle.retrievedAt ?? stored.createdAt,
          source: stored.bundle.sourceName,
          license: stored.bundle.license,
          verified,
          // Data-quality provenance score — the same 0–1 score attached to
          // claim bundles at build time, so agents can weigh trustworthiness.
          quality: stored.bundle.quality ?? null,
          data: data.length > 500
            ? data.slice(0, 500) + '... [truncated — use verify command for full verification]'
            : data,
        },
        verifyCommand: generateVerifyCommand(`https://api.maplespike.ca/v1/citation/${canonical}`),
        message: verified
          ? 'Citation verified — content hash matches the stored record.'
          : 'Stored record found but its content hash no longer matches (integrity failure).',
      },
    };
  }

  // Not found — give the caller an independent verification recipe.
  return {
    content: {
      tool: 'get_citation',
      hash: canonical,
      citation: {
        hash: canonical,
        timestamp: null,
        source: 'unknown',
        license: 'unknown',
        verified: false,
        data: null,
      },
      verifyCommand: generateVerifyCommand(`https://api.maplespike.ca/v1/citation/${canonical}`),
      message:
        'Citation not found in the current store. It may correspond to data ingested by a previous ' +
        'pipeline run. Verify independently against the original source using the shell command above, ' +
        'or re-run the tool that produced the data (it re-registers fresh claim bundles).',
    },
  };
};
