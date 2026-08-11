/**
 * MapleSpike MCP Tool — verify_claim
 *
 * Independent claim verification: given a SHA-256 hash (and optionally the
 * original data), recompute the hash locally and report whether the claim
 * matches what Quill published. This is the trust primitive other systems
 * can call without holding any Quill credentials beyond the free tier.
 */

import type { ToolDefinition, ToolHandler } from './types.js';
import { canonicalJson, computeHash, citationStore } from '@maplespike/pipeline-core';

export const definition: ToolDefinition = {
  name: 'verify_claim',
  description:
    'Verify a Quill claim bundle. Provide a sha256 hash to check it exists in the claim store, ' +
    'and optionally the original data to recompute the hash locally and confirm integrity. ' +
    'Returns { verified, matches, recomputedSha256 }. Use this to audit any hash you received from Quill.',
  descriptions: {
    "fr-CA": "Vérifier un lot de revendications Quill. Fournissez un hachage sha256 pour vérifier son existence dans le registre, et éventuellement les données originales pour recalculer le hachage et confirmer l'intégrité.",
  },
  inputSchema: {
    type: 'object',
    properties: {
      sha256: {
        type: 'string',
        description: 'SHA-256 hash to verify (accepts "sha256:<hex>" or bare hex)',
      },
      data: {
        description: 'Optional original data — the hash is recomputed from canonical JSON of this value and compared',
      },
    },
  },
};

export const handler: ToolHandler = async (args) => {
  const rawHash = ((args.sha256 as string) ?? '').trim();
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

  const cleanHash = rawHash.toLowerCase().replace(/^sha256[:\-]/, '');

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
        retrievedAt: stored.bundle.retrievedAt,
        message:
          'Hash found in the Quill claim store. Pass the original data to also recompute the hash locally for full independent verification.',
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
        retrievedAt: stored.bundle.retrievedAt,
        message: 'Claim verified — recomputed hash matches and the record exists in the Quill claim store.',
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
        message: 'Claim verified — the provided data reproduces the claimed hash (independent of Quill storage).',
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
