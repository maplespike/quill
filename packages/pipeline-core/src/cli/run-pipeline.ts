// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Single-pipeline ingest runner — the unit the CronJob CLI drives.
 *
 * Split out of cli/ingest.ts so the persistence contract is testable without
 * spawning a process or reaching an upstream:
 *
 *  1. `runModule` is called with NO database handle. The registry injects a
 *     SQLite-backed D1 adapter (see ingestion/sqlite-d1.ts) when the module's
 *     main function is db-first. Passing a stub handle here suppresses that
 *     injection, so db-first modules (committees, corporate, influence, the
 *     provincial health modules) throw on their first `db.prepare()` and the
 *     job persists nothing. That was the defect this module fixes.
 *  2. The run is recorded in `ingest_runs` so /v1/ingest/status can report a
 *     stale pipeline instead of a silent stop.
 */

import { getModule, runModule } from '../ingestion/registry.js';
import { runEntityResolution } from '../entity/integration.js';
import { recordIngestRun, type IngestRunStatus } from '../ingestion/run-log.js';
import { citationStore } from '../claims/store.js';
import { createSqliteD1Adapter } from '../ingestion/sqlite-d1.js';

import type { D1Database } from '../ingestion/committees/db.js';

/** CronJob schedule this run belongs to — drives the staleness bound. */
export const SCHEDULE = process.env.QUILL_INGEST_SCHEDULE?.trim() || null;

/**
 * Pipeline alias → registry module name.
 *
 * The Helm chart's `ingestion.schedules` keys are passed verbatim as
 * QUILL_PIPELINE, so every key used in charts/quill/values*.yaml must exist
 * here — otherwise the CronJob exits 1 with "Unknown pipeline" on every tick.
 * src/cli/__tests__/pipeline-aliases.test.ts enforces that mapping.
 */
export const PIPELINE_CONFIG: Record<string, string> = {
  committees: 'committees',
  committee: 'committees',
  corporate: 'corporate',
  influence: 'influence',
  gazette: 'gazette',
  gic: 'gic',
  elections: 'elections',
  'provincial-lobbying': 'provincial-lobbying',
  oversight: 'oversight',
  canlii: 'canlii',
  lmia: 'lmia',
  // The registry entry is named `indigenous` (modulePath ./indigenous-relations/).
  indigenous: 'indigenous',
  defence: 'defence',
  immigration: 'immigration',
  tribunals: 'federal-tribunals',
  veterans: 'veterans',
  fisheries: 'fisheries',
  agriculture: 'agriculture',
  culture: 'culture',
  'ngo-rss': 'ngo-influence-rss',
  'regional-authorities': 'regional-authorities',
  media: 'media-broadcasting',
  realtime: 'real-time-feeds',
  'municipal-long-tail': 'municipal-long-tail',
  universities: 'universities',
  unions: 'unions',
  'corporate-filings': 'corporate-filings',
  provincial: 'provincial',
  federal: 'federal',
  a2aj: 'a2aj',
  legislation: 'legislation',
  'goc-spending': 'goc-spending',
  // `cross-reference` used to map here. It is NOT an ingestion pipeline: the
  // registry marks it updateFrequency 'on-demand' and its only entry point is
  // the query function `searchCrossReference(query)`. Running it with the
  // runner's options object threw "Cannot read properties of undefined
  // (reading 'trim')" — a config error that looked like a module crash.
  // ingestEntryPoint() now refuses such modules outright.
  ati: 'ati',
  'cra-charity': 'cra-charity',
  'criminal-justice': 'criminal-justice',
  'crown-corporations': 'crown-corporations',
  // `education-research` was mapped here but has NO registry entry (the
  // directory exists; the registry only carries the provincial `*-education`
  // modules). The alias could only ever exit 1, so it is gone rather than
  // pointing somewhere invented. Re-add it when the module is registered.
  'federal-budget': 'federal-budget',
  geospatial: 'geospatial',
  'provincial-legislatures': 'provincial-legislatures',
  'provincial-orgs': 'provincial-orgs',
  'provincial-regulators': 'provincial-regulators',
  'social-programs': 'social-programs',
  // The chart shipped `social:` before this map existed; keep the alias so an
  // older values file cannot silently stop the job.
  social: 'social-programs',
  statcan: 'statcan',
  'transport-infrastructure': 'transport-infrastructure',
};

/** Injectable seam: the pipeline calls the registry through this interface. */
export interface PipelineRunner {
  runModule: typeof runModule;
  runEntityResolution: typeof runEntityResolution;
}

const DEFAULT_RUNNER: PipelineRunner = { runModule, runEntityResolution };

export interface RunOutcome {
  status: IngestRunStatus;
  records: number;
  claims: number;
  error: string | null;
  /** True when the run-log row was written (false = the run is not observable). */
  logged: boolean;
}

/**
 * Open the shared SQLite store as a D1-compatible handle.
 * Returns null when the database cannot be opened — the caller fails the run,
 * because an ingest that cannot persist is not a successful ingest.
 */
export function openDb(): D1Database | null {
  try {
    return createSqliteD1Adapter();
  } catch (err) {
    console.error(
      `[CLI] ❌ Cannot open the ingest store (QUILL_DB_PATH=${
        process.env.QUILL_DB_PATH ?? '(unset — defaults to ./maplespike.sqlite)'
      }): ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/**
 * Registry metadata for a module: the ingest entry points it declares.
 * `ingestAll*` is the shape the runner can drive; anything else (a query
 * function, for example) is not an ingestion pipeline.
 */
export function ingestEntryPoint(moduleName: string): string | null {
  const mod = getModule(moduleName) as { ingestFunctions?: string[] } | undefined;
  const fns = Array.isArray(mod?.ingestFunctions) ? mod.ingestFunctions : [];
  return fns.find(fn => /^ingestAll/.test(fn)) ?? null;
}

/**
 * Best-effort record count for a module result.
 * Handles arrays, `{ records | results | items | data }` envelopes, numeric
 * count fields, and dictionary-shaped results (committees, influence,
 * corporate) whose children are per-source results.
 */
export function countRecords(result: unknown, depth = 0): number {
  if (Array.isArray(result)) return result.length;
  if (!result || typeof result !== 'object') return 0;
  const r = result as Record<string, unknown>;

  for (const key of ['records', 'results', 'items', 'data']) {
    if (Array.isArray(r[key])) return (r[key] as unknown[]).length;
  }
  for (const key of ['count', 'recordsCount', 'total', 'recordsIngested', 'inserted', 'processed',
    // Dictionary-shaped results whose children count what they persisted rather
    // than returning a `records` array (influence reports {actors, funding}).
    'fundingFlowsFound', 'actorsFound', 'connectionsFound']) {
    if (typeof r[key] === 'number') return r[key] as number;
  }

  if (depth >= 3) return 0;
  const values = Object.values(r);
  if (values.length === 0) return 0;
  if (values.every(v => v !== null && typeof v === 'object' && !Array.isArray(v))) {
    return values.reduce<number>((sum, v) => sum + countRecords(v, depth + 1), 0);
  }
  return 0;
}

/**
 * Run one module and persist both the module writes (through the
 * registry-injected adapter) and the run-log row the API reads.
 */
export async function runOne(
  alias: string,
  moduleName: string,
  db: D1Database,
  runner: PipelineRunner = DEFAULT_RUNNER,
): Promise<RunOutcome> {
  const startedAt = new Date();
  const mod = getModule(moduleName);
  const entry = ingestEntryPoint(moduleName);
  console.log(`[CLI] Running ${moduleName}: ${mod?.description ?? '(unknown module)'}`);

  let outcome: RunOutcome = { status: 'success', records: 0, claims: 0, error: null, logged: false };
  // Claim bundles are content-addressed inside the registry hook; the store
  // delta is the only place that count is visible to the caller.
  const claimsBefore = citationStore.size;

  try {
    if (!entry) {
      // A module with no `ingestAll*` entry point cannot be ingested (see
      // ingestEntryPoint). Fail with the reason instead of calling a query
      // function with an options object it never expected — that surfaced as
      // "Cannot read properties of undefined (reading 'trim')" and read as a
      // module crash rather than a scheduling mistake.
      throw new Error(
        `${moduleName} declares no ingestAll* entry point (registry ingestFunctions: ` +
          `${JSON.stringify((mod as { ingestFunctions?: string[] } | undefined)?.ingestFunctions ?? [])}) — ` +
          'it is not an ingestion pipeline; remove it from ingestion.schedules',
      );
    }
    // No db argument — the registry injects the adapter for db-first modules
    // and hands the options object to everyone else.
    const result = await runner.runModule(moduleName, {});
    outcome.records = countRecords(result);
    outcome.claims = Math.max(0, citationStore.size - claimsBefore);
    console.log(`[CLI] ✅ ${moduleName} complete:`, JSON.stringify(result).substring(0, 200));

    const records = (result as { records?: unknown[] } | null)?.records ?? [];
    if (Array.isArray(records) && records.length > 0) {
      const entityResult = await runner.runEntityResolution(
        db as never,
        moduleName,
        records as Array<Record<string, unknown>>,
      );
      if (entityResult.mentionsInserted > 0) {
        console.log(
          `[CLI] 🧠 Entity resolution: ${entityResult.mentionsInserted} mentions, ` +
            `${entityResult.recordsProcessed} records`,
        );
      }
    }
  } catch (err) {
    outcome = {
      status: 'failed',
      records: 0,
      claims: 0,
      error: err instanceof Error ? err.message : String(err),
      logged: false,
    };
    console.error(`[CLI] ❌ ${moduleName} failed:`, err);
  }

  outcome.logged = recordIngestRun({
    pipeline: alias,
    startedAt,
    finishedAt: new Date(),
    status: outcome.status,
    records: outcome.records,
    claims: outcome.claims,
    schedule: SCHEDULE,
    error: outcome.error,
  });
  if (!outcome.logged) {
    console.error('[CLI] ❌ Run log write failed — the run is not observable. Check QUILL_DB_PATH.');
  }

  return outcome;
}
