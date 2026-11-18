// SPDX-License-Identifier: AGPL-3.0-only
/**
 * MapleSpike MCP Tool — verify_claim
 *
 * Claim hash lookup and canonical-record integrity comparison. Supplying data
 * recomputes its canonical JSON hash locally; neither lookup nor hash equality
 * authenticates the upstream source or establishes reuse rights.
 */

import type { ToolDefinition, ToolHandler } from './types.js';
import { canonicalJson, computeHash, citationStore } from '@maplespike/pipeline-core';

export const definition: ToolDefinition = {
  name: 'verify_claim',
  description:
    'Look up a Quill claim hash and, when data is supplied, compare the SHA-256 of its canonical JSON representation. ' +
    'A store match checks that a record with this hash is indexed; a recomputed match checks record integrity. ' +
    'Neither establishes source authenticity, completeness, accuracy, or reuse rights. Returns { verified, matches, recomputedSha256 }.',
  descriptions: {
    "fr-CA": "Rechercher un hachage de revendication Quill et, si des données sont fournies, comparer le SHA-256 de leur représentation JSON canonique. Une correspondance vérifie l'intégrité de l'enregistrement, pas l'authenticité de la source ni les droits de réutilisation.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      sha256: {
        type: 'string',
        maxLength: 64,
        description: 'SHA-256 hash to verify (accepts "sha256:<hex>" or bare hex)',
      },
      data: {
        type: 'string',
        maxLength: 2000,
        description: 'Optional JSON value — Quill recomputes the hash of this value after canonical JSON serialization; this does not authenticate its source',
      },
    },
  },
};

export const handler: ToolHandler = async (args) => {
  const rawHash = ((args.sha256 as string) ?? (args.hash as string) ?? '').trim();
  const data = args.data;

  if (!rawHash) {
    return {
      content: {
        tool: 'verify_claim',
        error: 'No sha256 provided. Pass a SHA-256 hash to verify, optionally with the original data.',
      },
      isError: true,
    };
  }

  const cleanHash = rawHash.toLowerCase().replace(/^sha256[:-]/, '');

  // 1. If data is provided, recompute and compare locally — this is the
  //    strongest check (does not trust Quill's stored record).
  let recomputed: string | null = null;
  if (data !== undefined) {
    recomputed = await computeHash(canonicalJson(data), 'sha256');
    if (recomputed !== cleanHash) {
      return {
        content: {
          tool: 'verify_claim',
          sha256: `sha256:${cleanHash}`,
          verified: false,
          matches: false,
          recomputedSha256: recomputed,
          message:
            `Recomputed hash does NOT match the claimed hash. The data may have been altered ` +
            `or the claim refers to different content. Recomputed: sha256:${recomputed}`,
        },
      };
    }
  }

  // 2. Check the persistent claim store.
  const stored = citationStore.get(cleanHash);

  if (stored && recomputed === null) {
    // Hash exists in store and no independent data was given — compare hashes only.
    return {
      content: {
        tool: 'verify_claim',
        sha256: `sha256:${cleanHash}`,
        verified: true,
        matches: true,
        recomputedSha256: null,
        source: stored.bundle.sourceName,
        retrievedAt: stored.bundle.retrievedAt ?? null,
        provenanceEvidence: stored.bundle.provenanceEvidence,        message: 'Hash found in the Quill claim store. Provide the canonical record value to compare its hash independently; this does not authenticate the source or establish reuse rights.',
      },
    };
  }

  if (stored && recomputed === cleanHash) {
    return {
      content: {
        tool: 'verify_claim',
        sha256: `sha256:${cleanHash}`,
        verified: true,
        matches: true,
        recomputedSha256: recomputed,
        source: stored.bundle.sourceName,
        retrievedAt: stored.bundle.retrievedAt ?? null,
        provenanceEvidence: stored.bundle.provenanceEvidence,
        message: 'Canonical record hash matches and the record exists in the Quill claim store. This does not authenticate the source or establish reuse rights.',
      },
    };
  }

  if (recomputed === cleanHash) {
    return {
      content: {
        tool: 'verify_claim',
        sha256: `sha256:${cleanHash}`,
        verified: true,
        matches: true,
        recomputedSha256: recomputed,
        message: 'The provided value reproduces the claimed canonical-record hash, independent of Quill storage. This does not authenticate its source or establish reuse rights.',
      },
    };
  }

  // Nothing matched.
  return {
    content: {
      tool: 'verify_claim',
      sha256: `sha256:${cleanHash}`,
      verified: false,
      matches: false,
      recomputedSha256: recomputed,
      message:
        recomputed === null
          ? 'Hash not found in the claim store and no data was provided to recompute. Pass the original data to verify independently.'
          : 'Recomputed hash does not match the claimed hash.',
    },
  };
};
