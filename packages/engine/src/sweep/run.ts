/**
 * Policy-intelligence sweep — the process the engine CronJob runs.
 *
 * The chart used to declare engine.schedule and the image command pointed
 * at this file, but the file did not exist and no CronJob template rendered.
 * GET /v1/engine/status therefore stayed never_run.
 *
 * Importing this module does not exit. The CLI path runs only when Node
 * starts this file directly.
 */

import { pathToFileURL } from "node:url";
import { closeDb, runMigrations } from "../db/connection";
import { runEnginePipeline } from "../orchestrator";

export interface SweepResult {
  briefId: string | null;
  signals: number;
  records: number;
}

/** Migrate the shared store, run the pipeline, and report whether a brief landed. */
export function runSweep(): SweepResult {
  runMigrations();
  const result = runEnginePipeline();
  return {
    briefId: result.brief?.id ?? result.summary.brief?.id ?? null,
    signals: result.signals.length,
    records: result.summary.totalRecords,
  };
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectRun()) {
  try {
    const sweep = runSweep();
    if (!sweep.briefId) {
      console.error(
        "engine sweep produced no brief: no canonical records landed in the store",
      );
      process.exitCode = 1;
    } else {
      console.log(
        `engine sweep wrote brief ${sweep.briefId} (${sweep.signals} signals, ${sweep.records} records)`,
      );
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    closeDb();
  }
}
