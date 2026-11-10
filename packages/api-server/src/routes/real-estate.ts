// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — GET /v1/real-estate
 *
 * Live real estate data ingestion via pipeline-core. Pulls housing starts,
 * vacancy rates, CREA sales, average prices, provincial land registries,
 * property assessments, and mortgage arrears data.
 *
 * Filter matching is normalized (lowercase + strip non-alphanumeric) so user
 * requests like "housing starts", "housing-starts", "Housing_Starts" all match.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, jsonResponse } from '../response.js';
import { ingestAllRealEstate } from '@maplespike/pipeline-core/real-estate';
import { runLivePipeline, normalizeFilterString } from './_live.js';

/**
 * Map user-facing category aliases to the canonical sector names produced by
 * pipeline-core's ingestAllRealEstate. Some user terms (rental, vacancy) map
 * to multiple upstream sectors — when we see a multi-match, normaliseFilterString
 * will short-circuit on the first match, so we also run a substring scan as
 * a safety net (see filter below).
 */
const CATEGORY_ALIASES: Record<string, string> = {
  starts: 'housing-starts',
  housing: 'housing-starts',
  vacancy: 'rental-market',
  rental: 'rental-market',
  rentals: 'rental-registries',
  sales: 'house-prices',
  price: 'house-prices',
  prices: 'house-prices',
  transactions: 'land-registry',
  properties: 'property-assessments',
  assessments: 'property-assessments',
  mortgage: 'mortgage-arrears',
  arrears: 'mortgage-arrears',
};

export const realEstateDataHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  const cacheKey = `real-estate:${url.searchParams.toString() || 'all'}`;

  const live = await runLivePipeline(ctx, cacheKey, async () => ingestAllRealEstate(), {
    ttlSeconds: 300,
  });

  let records = live.records;
  if (category) {
    const wantedRaw = CATEGORY_ALIASES[category.toLowerCase()] ?? category;
    const wantedNorm = normalizeFilterString(wantedRaw);
    const wantedAlt = normalizeFilterString(category);
    // Substring fallback — covers sector names like "rental-market" when the
    // user types "rental" and the alias map only lists "rental-registries".
    records = records.filter((r) => {
      const sector = (r as { sector?: string }).sector ?? '';
      const norm = normalizeFilterString(sector);
      return (
        norm === wantedNorm
        || norm === wantedAlt
        || norm.includes(wantedAlt)
        || norm.includes(wantedNorm)
      );
    });
  }
  records = records.slice(0, limit);

  return jsonResponse(
    buildSuccess(
      {
        domain: 'real-estate',
        records,
        provenance: live.provenance,
        filters: { category: category || null, limit },
      },
      ctx,
    ),
  );
};
