#!/usr/bin/env node

/**
 * Sweep Runner — standalone CLI entry point for K8s CronJob
 *
 * Instantiates the SweepEngine, runs a full sweep across all four
 * Canadian government data sources (spending, lobbying, ciec, gac),
 * and exits. Designed to be invoked by the maplespike-sweep CronJob.
 *
 * Usage:
 *   node dist/sweep/run.js
 *   npx tsx packages/engine/src/sweep/run.ts  (dev)
 */

import { SweepEngine } from "./engine";

async function main(): Promise<void> {
  console.log("[sweep-runner] Starting full sweep...");

  const engine = new SweepEngine();
  const startTime = Date.now();

  try {
    const output = await engine.runFullSweep();

    const elapsed = Date.now() - startTime;
    console.log(
      `[sweep-runner] Full sweep complete in ${elapsed}ms`,
      JSON.stringify({
        durationMs: output.durationMs,
        delta: output.delta,
        briefId: output.brief?.id ?? null,
        threadCount: output.threads?.length ?? 0,
      }),
    );

    process.exit(0);
  } catch (err) {
    console.error("[sweep-runner] Sweep failed:", err);
    process.exit(1);
  }
}

main();
