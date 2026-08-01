/**
 * Quill — Export API
 *
 * REST/JSON export for external clients.
 * GET /v1/export/modules      — List all modules with metadata
 * GET /v1/export/:module      — Live export records as JSON array
 * GET /v1/export/:module/:id  — Live export single record with provenance
 *
 * HONEST DATA POLICY: Module records come from real pipeline-core
 * `runModule(name, ...args)` ingestion. The module list comes from the
 * real registry (`getAllModules()`). No fabricated record counts. No
 * hardcoded sample records.
 *
 * CONTRACT (camelCase keys preserved):
 *   - listModulesHandler returns { total, modules: [{ name, description,
 *     recordCount, lastUpdated, ... }] }   — recordCount and lastUpdated
 *     are now `null` since no live count is pre-computed.
 *   - exportModuleHandler still returns { module, total, limit, offset,
 *     records, exportUrl } on the happy path.
 */

import type { RouteHandler } from '../types.js';
import { buildSuccess, buildError, jsonResponse } from '../response.js';
import {
  getAllModules,
  runModule,
  getModule,
  type ModuleInfo,
} from '@maplespike/pipeline-core';

interface ModuleExportEntry {
  // camelCase keys preserved for client back-compat
  name: string;
  description: string;
  recordCount: number | null; // null = no live count available
  lastUpdated: string | null; // null = never run
  category: string;
  status: string;
  sources: { name: string; format: string }[];
  updateFrequency: string;
  endpoint: string;
}

/** GET /v1/export/modules — real catalog from pipeline-core registry */
export const listModulesHandler: RouteHandler = async (_req, ctx) => {
  const modules = getAllModules() as ModuleInfo[];
  const entries: ModuleExportEntry[] = modules.map((mod) => ({
    name: mod.name,
    description: mod.description,
    // No fake `100` placeholder — explicitly null until a live run
    // populates the count. Clients reading this field get a typed null
    // instead of an undefined.
    recordCount: null,
    lastUpdated: null,
    category: mod.category,
    status: mod.status ?? 'active',
    sources: mod.sources ?? [],
    updateFrequency: mod.updateFrequency,
    endpoint: `/v1/export/${mod.name}`,
  }));

  return jsonResponse(
    buildSuccess(
      {
        total: entries.length,
        modules: entries,
        provenance: {
          status: 'live',
          source_count: 1,
          fetched_at: new Date().toISOString(),
          errors: [],
        },
      },
      ctx,
    ),
  );
};

/**
 * GET /v1/export/:module, GET /v1/export/:module/:id
 *
 * Invokes pipeline-core's `runModule(name, params)` to fetch real
 * records. `runModule` is variadic (`...args: unknown[]`) and the
 * underlying ingest functions only honor `{ limit }`. We pass only
 * `limit` and apply `offset` client-side over the returned records —
 * paginating beyond what live ingestion returns is not supported.
 */
export const exportModuleHandler: RouteHandler = async (req, ctx, params) => {
  const moduleName = params.module ?? '';
  const recordId = params.id;
  const url = new URL(req.url);
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') ?? '50', 10),
    500,
  );
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

  const moduleInfo = getModule(moduleName) as ModuleInfo | undefined;
  if (!moduleInfo) {
    return jsonResponse(
      buildError(
        'MODULE_NOT_FOUND',
        `Unknown module: "${moduleName}". Use /v1/export/modules to list available modules.`,
        ctx,
      ),
      404,
    );
  }

  const fetchedAt = new Date().toISOString();
  const errors: string[] = [];
  let rawRecords: unknown[] = [];

  // Live ingestion via pipeline-core. Same code path the cronjobs use.
  try {
    const result = await runModule(moduleName, { limit });
    const candidate =
      (result as { records?: unknown[] }).records ??
      (result as { items?: unknown[] }).items ??
      (Array.isArray(result) ? (result as unknown[]) : []);
    if (Array.isArray(candidate)) {
      rawRecords = candidate as unknown[];
    } else if (result && typeof result === 'object') {
      // Some modules return { count, sample, ... } envelopes — surface
      // the whole envelope as one synthetic "record" so callers can see
      // what the module returned.
      rawRecords = [result];
    } else {
      errors.push(
        `runModule(${moduleName}) returned non-array result — check pipeline-core contract`,
      );
    }
  } catch (err) {
    errors.push(
      `runModule(${moduleName}) failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Client-side offset/limit — the upstream ingestion is a single call.
  const paginatedRecords = rawRecords.slice(offset, offset + limit) as Record<
    string,
    unknown
  >[];

  const provenance = {
    status:
      rawRecords.length > 0 ? ('live' as const) : ('unavailable' as const),
    source_count: 1,
    fetched_at: fetchedAt,
    errors,
    module: moduleInfo.name,
    module_status: moduleInfo.status ?? 'active',
  };

  // Single-record view — search the FULL result set, not the
  // offset/limit page slice, so a recordId lookup works regardless
  // of the caller's current pagination cursor.
  if (recordId) {
    const record = (rawRecords as Record<string, unknown>[]).find(
      (r) =>
        (r.id as string | undefined) === recordId ||
        (r._id as string | undefined) === recordId ||
        (r.recordId as string | undefined) === recordId,
    );
    if (!record) {
      return jsonResponse(
        buildError(
          'RECORD_NOT_FOUND',
          `Record "${recordId}" not found in module "${moduleName}"`,
          ctx,
        ),
        404,
      );
    }
    return jsonResponse(
      buildSuccess(
        {
          module: moduleName,
          record,
          provenance,
        },
        ctx,
      ),
    );
  }

  // Paginated list view
  return jsonResponse(
    buildSuccess(
      {
        module: moduleName,
        module_info: {
          description: moduleInfo.description,
          category: moduleInfo.category,
          status: moduleInfo.status ?? 'active',
          updateFrequency: moduleInfo.updateFrequency,
        },
        total: rawRecords.length,
        limit,
        offset,
        records: paginatedRecords,
        exportUrl: `${url.origin}/v1/export/${moduleName}`,
        provenance,
      },
      ctx,
    ),
  );
};
