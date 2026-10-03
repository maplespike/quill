import type { ToolDefinition, ToolHandler } from './types.js';
import { computeHash, canonicalJson, generateVerifyCommand, citationStore, NO_REUSE_LICENSE_NOTICE, buildProvenanceEvidence } from '@maplespike/pipeline-core';
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
    'Retrieve a claim record by its SHA-256 hash. Returns the canonical record hash scope, available source evidence, terms metadata, and a verification command. ' +
    'A hash match checks record integrity; it does not authenticate the source or establish reuse rights.',
  descriptions: {
    "fr-CA": "Récupérer un enregistrement de revendication par son hachage SHA-256. Une correspondance vérifie l'intégrité de l'enregistrement canonique; elle n'authentifie pas la source et n'établit pas les droits de réutilisation.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      hash: {
        type: 'string',
        description: 'SHA-256 hash of Quill canonical record JSON (e.g. "sha256:<64 hex chars>"); a match does not authenticate the source.',
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
  license: string = NO_REUSE_LICENSE_NOTICE,
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
    provenanceEvidence: buildProvenanceEvidence(sha256, {
      sourceUrl: '',
      licenseBasis: 'no-publisher-declaration',
      transformations: [],
    }),
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

  const cleanHash = rawHash.toLowerCase().replace(/^sha256[:-]/, '');
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
          source_retrieved_at: stored.bundle.retrievedAt ?? null,
          claim_created_at: stored.createdAt,
          source: stored.bundle.sourceName,
          license: stored.bundle.license,
          ...(stored.bundle.licenseUrl ? { license_url: stored.bundle.licenseUrl } : {}),
          license_basis: stored.bundle.licenseBasis ?? 'no-publisher-declaration',
          provenance_evidence: stored.bundle.provenanceEvidence,
          ...(stored.bundle.attributionText ? { attribution_text: stored.bundle.attributionText } : {}),
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
          ? 'Canonical record hash matches the stored value. This does not authenticate the source or establish reuse rights.'
          : 'Stored record found but its canonical record hash no longer matches (integrity failure).',
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
        source_retrieved_at: null,
        claim_created_at: null,
        source: 'unknown',
        license: NO_REUSE_LICENSE_NOTICE,
        license_basis: 'no-publisher-declaration',
        provenance_evidence: null,
        verified: false,
        data: null,
      },
      verifyCommand: generateVerifyCommand(`https://api.maplespike.ca/v1/citation/${canonical}`),
      message:
        'Citation not found in the current store. It may correspond to data ingested by a previous ' +
        'pipeline run. The command above checks Quill’s claim endpoint; it does not verify the upstream source. ' +
        'Check the original source directly, or re-run the tool that produced the data.',
    },
  };
};
