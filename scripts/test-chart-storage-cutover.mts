#!/usr/bin/env tsx
/**
 * Prod storage cutover: local-path api/search copies and a static-bind
 * NFS backups PVC render only when the flag is on. Default stays on the
 * old Longhorn PVCs. An empty backupsVolumeName fails the render.
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

function renderAttempt(extra: string[] = []): { ok: true; stdout: string } | { ok: false; status: number; stdout: string; stderr: string } {
  try {
    return { ok: true, stdout: render(extra) };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return {
      ok: false,
      status: e.status ?? 1,
      stdout: String(e.stdout ?? ""),
      stderr: String(e.stderr ?? ""),
    };
  }
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

function cronDoc(doc: string, name: string): string {
  const chunk = doc.split(/^---\s*$/m).find(
    (c) => /^kind:\s*CronJob\s*$/m.test(c) && new RegExp(`^\\s*name:\\s*${name}\\s*$`, "m").test(c),
  );
  assert.ok(chunk, `missing CronJob ${name}`);
  return chunk;
}

function cronHasRwo(doc: string, name: string): boolean {
  const chunk = cronDoc(doc, name);
  return /app:\s*quill-api/.test(chunk) && /topologyKey:\s*kubernetes.io\/hostname/.test(chunk);
}

const LOCAL_PATH = ["quill-api-data-local", "quill-search-data-local"];
const BACKUPS_LOCAL = "quill-backups-local";
const LONGHORN = ["quill-api-data", "quill-search-data", "quill-backups"];
const NFS_PV = "quill-backups-nfs";

test("chart: flag off means no new PVCs and workloads keep the Longhorn claims", (t) => {
  if (!haveHelm()) {
    t.skip("helm is not installed on this runner");
    return;
  }
  for (const rendered of [render(), render(["--set", "storageCutover.useLocalPathCopies=false"])]) {
    const pvcs = pvcDocs(rendered);
    const names = pvcs.map((p) => p.name);
    for (const n of [...LOCAL_PATH, BACKUPS_LOCAL]) {
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

test("chart: flag on renders the static-bind backups PVC plus api/search local copies, with scratch, verify and deadline", (t) => {
  if (!haveHelm()) {
    t.skip("helm is not installed on this runner");
    return;
  }
  const rendered = render([
    "--set",
    "storageCutover.useLocalPathCopies=true",
    "--set",
    `storageCutover.backupsVolumeName=${NFS_PV}`,
  ]);
  const pvcs = pvcDocs(rendered);
  const names = pvcs.map((p) => p.name);
  for (const n of [...LONGHORN, ...LOCAL_PATH, BACKUPS_LOCAL]) {
    assert.ok(names.includes(n), `${n} must render when the flag is on`);
  }

  const byName = Object.fromEntries(pvcs.map((p) => [p.name, p.doc]));
  assert.match(byName["quill-api-data-local"], /storageClassName:\s*"?local-path"?/);
  assert.match(byName["quill-search-data-local"], /storageClassName:\s*"?local-path"?/);

  const backups = byName[BACKUPS_LOCAL];
  assert.match(backups, /storageClassName:\s*""/);
  assert.match(backups, new RegExp(`volumeName:\\s*"?${NFS_PV}"?`));
  assert.match(backups, /ReadWriteMany/);
  assert.match(backups, /storage:\s*"?30Gi"?/);
  assert.doesNotMatch(backups, /storageClassName:\s*"?local-path"?/);
  assert.doesNotMatch(
    backups,
    /selected-node|nodeName:|nodeSelector:|nodeAffinity:/,
    "backups-local must have no node pin",
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
  for (const job of ["quill-backup-search", "quill-backup-freshness", "quill-backup-drill"]) {
    assert.ok(cronHasRwo(rendered, job), `${job} must stay co-located with api-data`);
  }

  for (const job of ["quill-backup-sqlite", "quill-backup-search"]) {
    const chunk = cronDoc(rendered, job);
    assert.match(chunk, /activeDeadlineSeconds:\s*3600/, `${job} must set activeDeadlineSeconds`);
    assert.match(chunk, /name:\s*scratch/, `${job} must mount scratch`);
    assert.match(chunk, /emptyDir:\s*\{\}/, `${job} scratch must be emptyDir`);
    assert.match(chunk, /mountPath:\s*\/scratch/, `${job} must mount scratch at /scratch`);
    assert.match(chunk, /name:\s*SCRATCH_DIR/, `${job} must set SCRATCH_DIR`);
    assert.match(chunk, /name:\s*BACKUPS_MOUNT/, `${job} must set BACKUPS_MOUNT`);
  }

  assert.match(rendered, /PRAGMA integrity_check/);
  assert.match(rendered, /sha256/);
  assert.match(rendered, /write-probe|write probe|not writable/);
});

test("chart: flag on without backupsVolumeName fails the render", (t) => {
  if (!haveHelm()) {
    t.skip("helm is not installed on this runner");
    return;
  }
  const result = renderAttempt(["--set", "storageCutover.useLocalPathCopies=true"]);
  assert.equal(result.ok, false, "helm template must fail when backupsVolumeName is empty");
  if (result.ok) return;
  const text = `${result.stderr}\n${result.stdout}`;
  assert.match(text, /backupsVolumeName/);
  assert.notEqual(result.status, 0);
});
