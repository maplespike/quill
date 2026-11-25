#!/usr/bin/env tsx
/**
 * Prod storage cutover: local-path copies sit beside the Longhorn PVCs,
 * the flag defaults to the old claims, and backups stay on Longhorn.
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

function render(flag?: boolean): string {
  const args = ["template", "quill", "charts/quill", "-f", "charts/quill/values-prod.yaml"];
  if (flag === true) args.push("--set", "storageCutover.useLocalPathCopies=true");
  if (flag === false) args.push("--set", "storageCutover.useLocalPathCopies=false");
  return execFileSync("helm", args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function pvcDocs(rendered: string): { name: string; doc: string }[] {
  const out: { name: string; doc: string }[] = [];
  for (const doc of rendered.split(/^---\s*$/m)) {
    if (!/^kind:\s*PersistentVolumeClaim\s*$/m.test(doc)) continue;
    const name = doc.match(/^\s*name:\s*(\S+)\s*$/m)?.[1] ?? "";
    out.push({ name, doc });
  }
  return out;
}

function claimNamesIn(doc: string, kind: string, name: string): string[] {
  const chunks = doc.split(/^---\s*$/m);
  const found: string[] = [];
  for (const chunk of chunks) {
    if (!new RegExp(`^kind:\\s*${kind}\\s*$`, "m").test(chunk)) continue;
    if (!new RegExp(`^\\s*name:\\s*${name}\\s*$`, "m").test(chunk)) continue;
    for (const m of chunk.matchAll(/^\s*claimName:\s*(\S+)\s*$/gm)) {
      found.push(m[1]);
    }
  }
  return found;
}

function cronHasRwo(doc: string, name: string): boolean {
  const chunks = doc.split(/^---\s*$/m);
  const chunk = chunks.find(
    (c) => /^kind:\s*CronJob\s*$/m.test(c) && new RegExp(`^\\s*name:\\s*${name}\\s*$`, "m").test(c),
  );
  assert.ok(chunk, `missing CronJob ${name}`);
  return /app:\s*quill-api/.test(chunk) && /topologyKey:\s*kubernetes.io\/hostname/.test(chunk);
}

test("chart: default and explicit false keep old Longhorn PVCs and add local-path copies", (t) => {
  if (!haveHelm()) {
    t.skip("helm is not installed on this runner");
    return;
  }
  for (const rendered of [render(), render(false)]) {
    const pvcs = pvcDocs(rendered);
    const names = pvcs.map((p) => p.name).sort();
    assert.deepEqual(
      names.filter((n) => n.startsWith("quill-")),
      [
        "quill-api-data",
        "quill-api-data-local",
        "quill-backups",
        "quill-search-data",
        "quill-search-data-local",
      ],
    );
    assert.ok(!names.includes("quill-backups-local"), "no local-path backups claim");

    const byName = Object.fromEntries(pvcs.map((p) => [p.name, p.doc]));
    assert.match(byName["quill-api-data"], /storageClassName:\s*"?longhorn"?/);
    assert.match(byName["quill-search-data"], /storageClassName:\s*"?longhorn"?/);
    assert.match(byName["quill-backups"], /storageClassName:\s*"?longhorn"?/);
    assert.match(byName["quill-api-data-local"], /storageClassName:\s*"?local-path"?/);
    assert.match(byName["quill-search-data-local"], /storageClassName:\s*"?local-path"?/);
    assert.match(byName["quill-api-data-local"], /storage:\s*"?5Gi"?/);
    assert.match(byName["quill-search-data-local"], /storage:\s*"?5Gi"?/);

    assert.deepEqual(claimNamesIn(rendered, "Deployment", "quill-api"), ["quill-api-data"]);
    assert.ok(claimNamesIn(rendered, "Deployment", "quill-search").includes("quill-search-data"));
    assert.ok(!claimNamesIn(rendered, "Deployment", "quill-search").includes("quill-search-data-local"));
    assert.ok(claimNamesIn(rendered, "CronJob", "quill-backup-sqlite").includes("quill-api-data"));
    assert.ok(claimNamesIn(rendered, "CronJob", "quill-backup-search").includes("quill-search-data"));
    assert.ok(claimNamesIn(rendered, "CronJob", "quill-backup-search").includes("quill-backups"));

    for (const job of ["quill-backup-search", "quill-backup-freshness", "quill-backup-drill"]) {
      assert.ok(cronHasRwo(rendered, job), `${job} must use rwoApiCoLocate`);
    }
  }
});

test("chart: useLocalPathCopies=true switches api and search only", (t) => {
  if (!haveHelm()) {
    t.skip("helm is not installed on this runner");
    return;
  }
  const rendered = render(true);
  const names = pvcDocs(rendered).map((p) => p.name);
  assert.ok(names.includes("quill-api-data"));
  assert.ok(names.includes("quill-search-data"));
  assert.ok(names.includes("quill-api-data-local"));
  assert.ok(names.includes("quill-search-data-local"));
  assert.ok(names.includes("quill-backups"));
  assert.ok(!names.includes("quill-backups-local"));

  assert.deepEqual(claimNamesIn(rendered, "Deployment", "quill-api"), ["quill-api-data-local"]);
  assert.ok(claimNamesIn(rendered, "Deployment", "quill-search").includes("quill-search-data-local"));
  assert.ok(!claimNamesIn(rendered, "Deployment", "quill-search").includes("quill-search-data"));
  assert.ok(claimNamesIn(rendered, "CronJob", "quill-backup-sqlite").includes("quill-api-data-local"));
  assert.ok(claimNamesIn(rendered, "CronJob", "quill-backup-search").includes("quill-search-data-local"));
  assert.ok(claimNamesIn(rendered, "CronJob", "quill-backup-search").includes("quill-backups"));
  assert.ok(claimNamesIn(rendered, "CronJob", "quill-backup-freshness").includes("quill-backups"));
  assert.ok(claimNamesIn(rendered, "CronJob", "quill-backup-drill").includes("quill-backups"));
});
