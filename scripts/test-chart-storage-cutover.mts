#!/usr/bin/env tsx
/**
 * Prod storage cutover: local-path copies render only when the flag is on,
 * default stays on the old Longhorn PVCs, and the backups copy has no node
 * pin while storageCutover.backupsNodeName is empty.
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

function render(extra: string[] = []): string {
  return execFileSync(
    "helm",
    ["template", "quill", "charts/quill", "-f", "charts/quill/values-prod.yaml", ...extra],
    {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
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
  const found: string[] = [];
  for (const chunk of doc.split(/^---\s*$/m)) {
    if (!new RegExp(`^kind:\\s*${kind}\\s*$`, "m").test(chunk)) continue;
    if (!new RegExp(`^\\s*name:\\s*${name}\\s*$`, "m").test(chunk)) continue;
    for (const m of chunk.matchAll(/^\s*claimName:\s*(\S+)\s*$/gm)) {
      found.push(m[1]);
    }
  }
  return found;
}

function cronHasRwo(doc: string, name: string): boolean {
  const chunk = doc.split(/^---\s*$/m).find(
    (c) => /^kind:\s*CronJob\s*$/m.test(c) && new RegExp(`^\\s*name:\\s*${name}\\s*$`, "m").test(c),
  );
  assert.ok(chunk, `missing CronJob ${name}`);
  return /app:\s*quill-api/.test(chunk) && /topologyKey:\s*kubernetes.io\/hostname/.test(chunk);
}

const LOCAL = ["quill-api-data-local", "quill-search-data-local", "quill-backups-local"];
const LONGHORN = ["quill-api-data", "quill-search-data", "quill-backups"];

test("chart: flag off means no new PVCs and workloads keep the Longhorn claims", (t) => {
  if (!haveHelm()) {
    t.skip("helm is not installed on this runner");
    return;
  }
  for (const rendered of [render(), render(["--set", "storageCutover.useLocalPathCopies=false"])]) {
    const pvcs = pvcDocs(rendered);
    const names = pvcs.map((p) => p.name);
    for (const n of LOCAL) {
      assert.ok(!names.includes(n), `${n} must not render when the flag is off`);
    }
    for (const n of LONGHORN) {
      assert.ok(names.includes(n), `${n} must still render`);
    }
    const byName = Object.fromEntries(pvcs.map((p) => [p.name, p.doc]));
    assert.match(byName["quill-api-data"], /storageClassName:\s*"?longhorn"?/);
    assert.match(byName["quill-search-data"], /storageClassName:\s*"?longhorn"?/);
    assert.match(byName["quill-backups"], /storageClassName:\s*"?longhorn"?/);

    assert.deepEqual(claimNamesIn(rendered, "Deployment", "quill-api"), ["quill-api-data"]);
    assert.ok(claimNamesIn(rendered, "Deployment", "quill-search").includes("quill-search-data"));
    assert.ok(claimNamesIn(rendered, "CronJob", "quill-backup-sqlite").includes("quill-api-data"));
    assert.ok(claimNamesIn(rendered, "CronJob", "quill-backup-sqlite").includes("quill-backups"));
    assert.ok(claimNamesIn(rendered, "CronJob", "quill-backup-search").includes("quill-search-data"));
    assert.ok(claimNamesIn(rendered, "CronJob", "quill-backup-search").includes("quill-backups"));
    for (const job of ["quill-backup-search", "quill-backup-freshness", "quill-backup-drill"]) {
      assert.ok(cronHasRwo(rendered, job), `${job} must use rwoApiCoLocate`);
    }
  }
});

test("chart: flag on means 3 new PVCs and no backups pin when the node is empty", (t) => {
  if (!haveHelm()) {
    t.skip("helm is not installed on this runner");
    return;
  }
  const rendered = render(["--set", "storageCutover.useLocalPathCopies=true"]);
  const pvcs = pvcDocs(rendered);
  const names = pvcs.map((p) => p.name);
  for (const n of [...LONGHORN, ...LOCAL]) {
    assert.ok(names.includes(n), `${n} must render when the flag is on`);
  }
  assert.equal(LOCAL.filter((n) => names.includes(n)).length, 3);

  const byName = Object.fromEntries(pvcs.map((p) => [p.name, p.doc]));
  assert.match(byName["quill-api-data-local"], /storageClassName:\s*"?local-path"?/);
  assert.match(byName["quill-search-data-local"], /storageClassName:\s*"?local-path"?/);
  assert.match(byName["quill-backups-local"], /storageClassName:\s*"?local-path"?/);
  assert.match(byName["quill-backups-local"], /storage:\s*"?30Gi"?/);

  const backups = byName["quill-backups-local"];
  assert.doesNotMatch(
    backups,
    /selected-node|nodeName:|nodeSelector:|nodeAffinity:/,
    "backups-local must have no pin while backupsNodeName is empty",
  );

  assert.deepEqual(claimNamesIn(rendered, "Deployment", "quill-api"), ["quill-api-data-local"]);
  assert.ok(claimNamesIn(rendered, "Deployment", "quill-search").includes("quill-search-data-local"));
  assert.ok(!claimNamesIn(rendered, "Deployment", "quill-search").includes("quill-search-data"));
  assert.ok(claimNamesIn(rendered, "CronJob", "quill-backup-sqlite").includes("quill-api-data-local"));
  assert.ok(claimNamesIn(rendered, "CronJob", "quill-backup-sqlite").includes("quill-backups-local"));
  assert.ok(claimNamesIn(rendered, "CronJob", "quill-backup-search").includes("quill-search-data-local"));
  assert.ok(claimNamesIn(rendered, "CronJob", "quill-backup-search").includes("quill-backups-local"));
  assert.ok(claimNamesIn(rendered, "CronJob", "quill-backup-freshness").includes("quill-backups-local"));
  assert.ok(claimNamesIn(rendered, "CronJob", "quill-backup-drill").includes("quill-backups-local"));
});
