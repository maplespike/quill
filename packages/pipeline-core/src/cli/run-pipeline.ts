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
import {
  recordIngestRun,
  getLatestIngestRun,
  type IngestRunStatus,
  type RunSources,
  type SourceOutcome,
} from '../ingestion/run-log.js';
import { citationStore } from '../claims/store.js';
import { createSqliteD1Adapter } from '../ingestion/sqlite-d1.js';
import { probeAll } from '../ingestion/change-detect.js';
import { probeUrlsFor } from '../ingestion/probe-urls.js';

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
  /**
   * Change probe -- the I/O seam for the ingest gate, injectable for the same
   * reason runModule is: runOne must stay testable without network access.
   * Omitted in production, where the real probeAll is used.
   */
  probeSources?: typeof probeAll;
}

const DEFAULT_RUNNER: PipelineRunner = { runModule, runEntityResolution };

export interface RunOutcome {
  status: IngestRunStatus;
  records: number;
  claims: number;
  error: string | null;
  /** True when the run-log row was written (false = the run is not observable). */
  logged: boolean;
  /** Per-source outcomes + declared zero reason (null when not classified). */
  sources: RunSources | null;
}

/**
 * Read per-source outcomes from a module result.
 *
 * Two shapes exist in the registry:
 *
 *   1. `sources: [{source, status, records, error}]` — real-time-feeds states
 *      its own verdicts.
 *   2. a dictionary of per-source results — corporate, committees and influence
 *      return `{ <source>: { recordsFound, recordsIngested, errors } }`. Those
 *      modules do report per source, they just never had an envelope, so the
 *      ledger recorded nothing and "all five sources errored" read as "quiet
 *      day" (QUILL-AUDIT.md 2026-10-24, P1).
 *
 * Anything else degrades to `[]`.
 */
export function extractSourceOutcomes(result: unknown): SourceOutcome[] {
  if (!result || typeof result !== 'object') return [];
  const raw = (result as { sources?: unknown }).sources;
  if (Array.isArray(raw)) {
    const out: SourceOutcome[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      if (typeof r.source !== 'string' || r.source.length === 0) continue;
      const status = r.status === 'ok' || r.status === 'empty' || r.status === 'error' ? r.status : null;
      if (!status) continue;
      out.push({
        source: r.source,
        status,
        records: typeof r.records === 'number' ? Math.max(0, Math.trunc(r.records)) : 0,
        error: typeof r.error === 'string' && r.error.length > 0 ? r.error : null,
        ...(typeof r.skipReason === 'string' && r.skipReason.length > 0
          ? { skipReason: r.skipReason }
          : {}),
      });
    }
    return out;
  }
  return extractPerSourceDictionary(result);
}

/**
 * Read the dictionary-of-per-source-results shape:
 * `{ lobbying: { recordsFound: 0, recordsIngested: 0, errors: [...] }, ... }`.
 *
 * A child qualifies only when it carries a numeric `recordsFound` AND an
 * `errors` array — the CorporateIngestionResult shape. That keeps arbitrary
 * result objects (and their nested `records` arrays) from being mistaken for
 * sources.
 */
function extractPerSourceDictionary(result: unknown): SourceOutcome[] {
  const out: SourceOutcome[] = [];
  for (const [name, value] of Object.entries(result as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const child = value as Record<string, unknown>;
    if (typeof child.recordsFound !== 'number' || !Array.isArray(child.errors)) continue;

    const found = Math.max(0, Math.trunc(child.recordsFound));
    const errors = child.errors.filter((e): e is string => typeof e === 'string' && e.length > 0);
    const declaredSkip =
      typeof child.skipReason === 'string' && child.skipReason.length > 0 ? child.skipReason : null;

    const status = errors.length > 0 ? 'error' : found > 0 ? 'ok' : 'empty';
    out.push({
      source: name,
      status,
      records: found,
      // The first error is the reason; the rest stay in the module's own log.
      error: errors[0] ?? null,
      ...(declaredSkip
        ? { skipReason: declaredSkip }
        : status === 'empty'
          ? {
              skipReason:
                'source answered but returned no records — check whether the publisher moved the feed',
            }
          : {}),
    });
  }
  return out;
}

/**
 * Read a module's declared zero-records reason (e.g.
 * `zeroReason: 'no-new-records-since-last-run'`). Null when the module
 * declared nothing — a zero-record run with no declaration is a failure.
 */
export function extractZeroReason(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const raw = (result as { zeroReason?: unknown }).zeroReason;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
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
        process.env.QUILL_DB_PATH ?? '(unset — defaults to ./quill.sqlite)'
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
 *
 * The count verbs cover what the scheduled modules actually emit (GH#921):
 * `recordsIngested` (gazette, corporate), `meetingsIngested` /
 * `interventionsIngested` (committees), `reportsIngested` (oversight),
 * `actorsFound` / `connectionsFound` / `fundingFlowsFound` (influence), and
 * the discovery verbs (`*Found`) every module fills on its result envelope.
 * Before this list existed a full working committees run reported 0.
 *
 * Discovery verbs (`*Found`) are read BEFORE ingested verbs: the run log's
 * `records` column means "records parsed by the module", and a quiet run
 * (upstream answered, everything already ingested — `meetingsFound: 3,
 * meetingsIngested: 0`) is a WORKING collector. Counting the ingested verb
 * there would false-positive the zero-records classification below on every
 * deduplicated run. A broken parser finds nothing, so both verbs are 0 and
 * the run fails — exactly the condition GH#921 asks to catch.
 */
const COUNT_FIELDS = [
  'records', 'recordsIngested', 'recordsCount',
  'meetingsIngested', 'interventionsIngested', 'reportsIngested',
  'actorsFound', 'connectionsFound', 'fundingFlowsFound',
  'count', 'total', 'inserted', 'processed',
];

/** Discovery verbs — `*Found` fields mean "the upstream had N of these". */
function foundVerbValue(r: Record<string, unknown>): number | null {
  for (const key of Object.keys(r)) {
    if (/Found$/.test(key) && typeof r[key] === 'number') return r[key] as number;
  }
  return null;
}

export function countRecords(result: unknown, depth = 0): number {
  if (Array.isArray(result)) return result.length;
  if (!result || typeof result !== 'object') return 0;
  const r = result as Record<string, unknown>;

  for (const key of ['records', 'results', 'items', 'data']) {
    if (Array.isArray(r[key])) return (r[key] as unknown[]).length;
  }
  const found = foundVerbValue(r);
  if (found !== null) return found;
  for (const key of COUNT_FIELDS) {
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

  let outcome: RunOutcome = { status: 'success', records: 0, claims: 0, error: null, logged: false, sources: null };
  // Per-source detail survives a thrown classification: "all 5 sources failed"
  // is only actionable if the ledger also says WHICH five and why.
  let classifiedSources: RunSources | null = null;
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
    // ── Change gate (event half of the trigger) ────────────────────────
    // The clock decides only how quickly we NOTICE a change, never whether we
    // do work. Probe each declared source with conditional requests; when every
    // one is unchanged, skip the pipeline and record why (status: skipped, with
    // a declared zero reason, so a quiet run is distinguishable from a silent
    // failure). probeAll() returns changed:true on ANY probe error, so a broken
    // source still runs and stays visible — this gate can only skip a run it
    // PROVED was a no-op. Opt out per run with QUILL_INGEST_FORCE=1.
    const probeUrls = probeUrlsFor(moduleName);
    // A failed previous run must not be laundered into a green skip. probeAll
    // compares upstream state (ETag/Last-Modified), not what landed in the
    // store, so "no change" after a failure proves only that the publisher did
    // not move — never that the rows arrived. Corporate did exactly this on
    // 2026-10-23: the 02:00 run failed on three dead sources, the retry's gate
    // said no-change, and the ledger read status=success records=0
    // zeroReason=no-change-since-last-run (QUILL-AUDIT.md 2026-10-24, P1).
    const previousRun = getLatestIngestRun(alias);
    const previousFailed = previousRun?.status === 'failed';
    if (previousFailed && probeUrls.length > 0) {
      console.log(
        `[CLI] ↻  ${moduleName}: previous run failed (${
          previousRun?.started_at ?? 'unknown time'
        }) — running instead of trusting the change gate`,
      );
    }
    if (probeUrls.length > 0 && !previousFailed && process.env['QUILL_INGEST_FORCE'] !== '1') {
      const probe = runner.probeSources ?? probeAll;
      // The gate must never be the reason a pipeline does not run. probeAll
      // already catches per-source errors; this catches a throw from the probe
      // call ITSELF (a bug, a missing dep) and treats it as 'changed', so a
      // broken gate degrades to the old always-run behaviour instead of
      // failing the run before the module is ever called.
      let changed = true;
      let results: Awaited<ReturnType<typeof probeAll>>['results'] = [];
      try {
        const probed = await probe(probeUrls);
        changed = probed.changed;
        results = probed.results;
      } catch (probeErr) {
        console.warn(
          `[CLI] ⚠  Change probe failed for ${moduleName} — running unconditionally: ` +
            `${probeErr instanceof Error ? probeErr.message : String(probeErr)}`,
        );
      }
      if (!changed) {
        const summary = `No change across ${probeUrls.length} source(s) since last run`;
        console.log(`[CLI] ⏭  ${moduleName}: ${summary}`);
        for (const r of results) {
          console.log(`[CLI]     ${r.reason} (${r.statusCode}) ${r.url}`);
        }
        outcome.records = 0;
        outcome.sources = {
          sources: results.map(r => ({
            source: r.url,
            status: 'ok' as const,
            records: 0,
            error: null,
            // Record WHY each source was not read, not only that it was not.
            skipReason: `change gate: ${r.reason} (${r.statusCode})`,
          })),
          zeroReason: 'no-change-since-last-run',
        };
        outcome.logged = recordIngestRun({
          pipeline: alias,
          startedAt,
          finishedAt: new Date(),
          status: 'success',
          records: 0,
          claims: 0,
          schedule: SCHEDULE,
          error: null,
          sources: outcome.sources,
        });
        console.log(`[CLI] ⏭  ${moduleName}: skipped (unchanged) — logged=${outcome.logged}`);
        return outcome;
      }
      console.log(`[CLI] Change detected for ${moduleName} (${results.filter(r => r.changed).length}/${probeUrls.length} source(s)) — running`);
    }

    // No db argument — the registry injects the adapter for db-first modules
    // and hands the options object to everyone else.
    const result = await runner.runModule(moduleName, {});

    // ── GH#921: classify the result honestly ──────────────────────────
    // A module result that reports failure (an `error` string or
    // `success: false` — 21 modules emit the latter on HTTP failure) must
    // never count as a successful run.
    const resultError = (result as { error?: unknown } | null | undefined)?.error;
    if (typeof resultError === 'string' && resultError.trim().length > 0) {
      throw new Error(resultError);
    }
    if ((result as { success?: unknown } | null | undefined)?.success === false) {
      const detail = (result as { error?: unknown }).error;
      throw new Error(
        typeof detail === 'string' && detail.length > 0
          ? detail
          : `${moduleName} reported success: false`,
      );
    }
    // A health-check skip is an upstream refusal, not a success with zero
    // records: the module never ran.
    const skipped = result as { skipped?: unknown; reason?: unknown } | null | undefined;
    if (skipped?.skipped === true) {
      throw new Error(
        typeof skipped.reason === 'string' && skipped.reason.length > 0
          ? `skipped: ${skipped.reason}`
          : 'skipped: upstream health check refused the run',
      );
    }

    outcome.records = countRecords(result);
    outcome.claims = Math.max(0, citationStore.size - claimsBefore);

    // Per-source outcomes (modules that report them — real-time-feeds today)
    // plus the zero-records classification below make a silent collector
    // failure visible instead of a green `records=0`.
    const sources = extractSourceOutcomes(result);
    if (outcome.records === 0) {
      const errored = sources.filter(s => s.status === 'error');
      const answered = sources.filter(s => s.status !== 'error');
      if (sources.length > 0 && errored.length === sources.length) {
        // Every source failed — this is a collector failure, not a quiet day.
        // Record the per-source verdicts before failing the run.
        classifiedSources = { sources, zeroReason: 'all-sources-failed' };
        throw new Error(
          `all ${sources.length} source(s) failed: ` +
            errored.map(s => `${s.source} (${s.error ?? 'error'})`).join('; '),
        );
      }
      if (sources.length === 0 || answered.length === 0) {
        // No source outcomes and zero records: indistinguishable from a
        // parser that silently stopped matching. Fail unless the module
        // declared the zero legitimate.
        const declared = extractZeroReason(result);
        if (!declared) {
          throw new Error('zero-records-without-declared-reason');
        }
        outcome.sources = { sources, zeroReason: declared };
      } else {
        // Sources answered but nothing new: legitimate quiet run.
        outcome.sources = { sources, zeroReason: 'no-new-records-since-last-run' };
      }
    } else {
      outcome.sources = { sources, zeroReason: null };
    }

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
      sources: classifiedSources,
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
    sources: outcome.sources ?? null,
  });
  if (!outcome.logged) {
    console.error('[CLI] ❌ Run log write failed — the run is not observable. Check QUILL_DB_PATH.');
  }

  return outcome;
}
