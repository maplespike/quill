#!/usr/bin/env tsx
/**
 * Fleet priority-class gate (resource policy, 2026-10-26 nexus freeze).
 *
 * Every pod the prod chart renders must carry a priorityClassName:
 *   - fleet-critical: always-on services, backups, restore drill, freshness
 *   - fleet-batch: ingest and engine CronJobs
 * and every CronJob must use concurrencyPolicy: Forbid and set resources.
 * The gate renders the chart; a text match over templates could pass on a
 * template that never renders.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(path.resolve(__dirname, ".."));

function haveHelm(): boolean {
  try {
    execFileSync("helm", ["version", "--short"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

type Workload = { kind: string; name: string; doc: string };

function workloads(): Workload[] {
  const rendered = execFileSync(
    "helm",
    ["template", "quill", "charts/quill", "-f", "charts/quill/values-prod.yaml"],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
  );
  const out: Workload[] = [];
  for (const doc of rendered.split(/^---\s*$/m)) {
    const kind = doc.match(/^kind:\s*(\S+)\s*$/m)?.[1];
    if (!kind || !["Deployment", "StatefulSet", "CronJob"].includes(kind)) continue;
    const name = doc.match(/^\s*name:\s*(\S+)\s*$/m)?.[1] ?? "?";
    out.push({ kind, name, doc });
  }
  return out;
}

function expectedClass(w: Workload): string {
  if (w.kind !== "CronJob") return "fleet-critical";
  return /-backup-/.test(w.name) ? "fleet-critical" : "fleet-batch";
}

test("chart: every workload carries the fleet priority class for its tier", (t) => {
  if (!haveHelm()) {
    t.skip("helm is not installed on this runner");
    return;
  }
  const all = workloads();
  assert.ok(all.length > 0, "chart must render workloads");
  for (const w of all) {
    const pc = w.doc.match(/^\s*priorityClassName:\s*(\S+)\s*$/m)?.[1];
    assert.equal(pc, expectedClass(w), `${w.kind} ${w.name} priorityClassName`);
  }
});

test("chart: every CronJob is concurrencyPolicy Forbid", (t) => {
  if (!haveHelm()) {
    t.skip("helm is not installed on this runner");
    return;
  }
  for (const w of workloads().filter((x) => x.kind === "CronJob")) {
    assert.match(w.doc, /^\s*concurrencyPolicy:\s*Forbid\s*$/m, `${w.name} concurrencyPolicy`);
  }
});

test("chart: every container declares requests and limits", (t) => {
  if (!haveHelm()) {
    t.skip("helm is not installed on this runner");
    return;
  }
  for (const w of workloads()) {
    const containers = (w.doc.match(/^\s+(?:- )?image:\s*\S+/gm) ?? []).length;
    const requests = (w.doc.match(/^\s*requests:\s*$/gm) ?? []).length;
    const limits = (w.doc.match(/^\s*limits:\s*$/gm) ?? []).length;
    assert.ok(containers > 0, `${w.name} renders containers`);
    assert.ok(requests >= containers, `${w.name}: ${requests} requests for ${containers} containers`);
    assert.ok(limits >= containers, `${w.name}: ${limits} limits for ${containers} containers`);
  }
});
