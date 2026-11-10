// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Quill — GET /v1/energy
 *
 * Live energy data ingestion via pipeline-core. Pulls CKAN packages from
 * Canada Energy Regulator across oil, gas, electricity, mining, pipelines,
 * and renewable energy. Returns the unified envelope (records + provenance).
 *
 * Filter matching is normalized (lowercase + strip non-alphanumeric) so user
 * requests like "crude oil", "crude-oil", "Crude_Oil" all match the same pipe.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, jsonResponse } from '../response.js';
import { ingestAllEnergy } from '@maplespike/pipeline-core/energy';
import { runLivePipeline, normalizeFilterString } from './_live.js';

const SECTOR_ALIASES: Record<string, string> = {
  oil: 'energy-oil',
  gas: 'energy-gas',
  electricity: 'energy-electricity',
  mining: 'energy-mining',
  pipeline: 'energy-pipeline',
  pipelines: 'energy-pipeline',
  renewables: 'energy-renewable',
  renewable: 'energy-renewable',
};

export const energyDataHandler: RouteHandler = async (request, ctx) => {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  const cacheKey = `energy:${url.searchParams.toString() || 'all'}`;

  const live = await runLivePipeline(ctx, cacheKey, async () => ingestAllEnergy(), {
    ttlSeconds: 300,
  });

  let records = live.records;
  if (category) {
    const wantedRaw = SECTOR_ALIASES[category.toLowerCase()] ?? category;
    const wantedNorm = normalizeFilterString(wantedRaw);
    const wantedAlt = normalizeFilterString(category);
    records = records.filter((r) => {
      const sector = (r as { sector?: string }).sector ?? '';
      const norm = normalizeFilterString(sector);
      return norm === wantedNorm || norm === wantedAlt;
    });
  }
  records = records.slice(0, limit);

  return jsonResponse(
    buildSuccess(
      {
        domain: 'energy',
        records,
        provenance: live.provenance,
        filters: { category: category || null, limit },
      },
      ctx,
    ),
  );
};
