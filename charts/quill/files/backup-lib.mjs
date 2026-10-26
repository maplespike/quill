// Shared backup and restore checks for the Quill CronJobs.
//
// The API image runs these files from a ConfigMap. They use node:sqlite,
// which that image already has. No extra package and no secret material.

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const STAMPED = /^.+-\d{8}T\d{6}Z\.(?:db|counts\.json|tar\.gz|meta\.json|dump)$/;

export function quoteSqlitePath(file) {
  if (file.includes("'")) {
    throw new Error(`sqlite backup: path must not contain a single quote: ${file}`);
  }
  return file;
}

export function tableCounts(db) {
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).all();
  const counts = {};
  for (const row of tables) {
    const name = row.name;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;
    const hit = db.prepare(`SELECT count(*) AS c FROM "${name}"`).get();
    counts[name] = Number(hit.c);
  }
  return counts;
}

export function compareCounts(actual, expected) {
  const problems = [];
  const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  for (const key of [...keys].sort()) {
    if (actual[key] !== expected[key]) {
      problems.push(`${key}: backup has ${actual[key] ?? 'no table'}, sidecar says ${expected[key] ?? 'no table'}`);
    }
  }
  return problems;
}

export function listFiles(dir, suffix) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(suffix)) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (!st.isFile()) continue;
    out.push({ name, full, mtimeMs: st.mtimeMs });
  }
  return out;
}

export function newest(entries) {
  if (entries.length === 0) return null;
  return entries.reduce((best, item) => (item.mtimeMs >= best.mtimeMs ? item : best));
}

export function pruneExpired(dir, retentionDays, nowMs = Date.now()) {
  if (!existsSync(dir)) return [];
  const cutoff = nowMs - retentionDays * 24 * 60 * 60 * 1000;
  const removed = [];
  for (const name of readdirSync(dir)) {
    if (!STAMPED.test(name)) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (!st.isFile() || st.mtimeMs >= cutoff) continue;
    unlinkSync(full);
    removed.push(name);
  }
  return removed.sort();
}

export function backupSqliteFile({ sourcePath, destDir, retentionDays = 14, label = 'maplespike' }) {
  if (!sourcePath) throw new Error('sqlite backup: QUILL_DB_PATH is empty');
  if (!existsSync(sourcePath)) throw new Error(`sqlite backup: source missing: ${sourcePath}`);
  mkdirSync(destDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const dest = path.join(destDir, `${label}-${stamp}.db`);
  const src = new DatabaseSync(sourcePath);
  try {
    src.exec('PRAGMA busy_timeout = 60000');
    src.exec(`VACUUM INTO '${quoteSqlitePath(dest)}'`);
  } finally {
    src.close();
  }
  const opened = new DatabaseSync(dest, { readOnly: true });
  let counts;
  try {
    const integrity = opened.prepare('PRAGMA integrity_check').all().map((row) => row.integrity_check);
    if (integrity.length !== 1 || integrity[0] !== 'ok') {
      throw new Error(`sqlite backup: integrity_check failed: ${integrity.join(',')}`);
    }
    counts = tableCounts(opened);
  } finally {
    opened.close();
  }
  const sidecar = dest.replace(/\.db$/, '.counts.json');
  writeFileSync(sidecar, `${JSON.stringify({
    stamp,
    source: path.basename(sourcePath),
    counts,
  }, null, 2)}\n`);
  const removed = pruneExpired(destDir, retentionDays);
  return { dest, sidecar, counts, removed };
}

export function freshness(dir, suffix, maxAgeHours, nowMs = Date.now()) {
  const entries = listFiles(dir, suffix);
  const hit = newest(entries);
  if (!hit) return { ok: false, reason: `no ${suffix} file in ${dir}` };
  const ageHours = (nowMs - hit.mtimeMs) / 36e5;
  if (ageHours > maxAgeHours) {
    return {
      ok: false,
      reason: `${hit.name} is ${ageHours.toFixed(1)}h old (limit ${maxAgeHours}h)`,
      newest: hit,
      ageHours,
    };
  }
  return { ok: true, newest: hit, ageHours };
}

export function checkSqliteRestore(backupPath, scratchPath) {
  mkdirSync(path.dirname(scratchPath), { recursive: true });
  copyFileSync(backupPath, scratchPath);
  const sidecar = backupPath.replace(/\.db$/, '.counts.json');
  if (!existsSync(sidecar)) {
    return { ok: false, problems: [`missing sidecar ${sidecar}`], counts: {} };
  }
  const expected = JSON.parse(readFileSync(sidecar, 'utf8')).counts;
  const db = new DatabaseSync(scratchPath, { readOnly: true });
  try {
    const integrity = db.prepare('PRAGMA integrity_check').all().map((row) => row.integrity_check);
    const problems = [];
    if (integrity.length !== 1 || integrity[0] !== 'ok') {
      problems.push(`integrity_check: ${integrity.join(',')}`);
    }
    const counts = tableCounts(db);
    problems.push(...compareCounts(counts, expected));
    return { ok: problems.length === 0, problems, counts };
  } finally {
    db.close();
  }
}

export function checkSearchArchive({ archive, scratchDir, metaSidecar }) {
  mkdirSync(scratchDir, { recursive: true });
  execFileSync('tar', ['-xzf', archive, '-C', scratchDir], { stdio: 'pipe' });
  const metaPath = path.join(scratchDir, 'quill-meta.json');
  if (!existsSync(metaPath)) {
    throw new Error(`search restore: ${archive} has no quill-meta.json`);
  }
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  const side = JSON.parse(readFileSync(metaSidecar, 'utf8'));
  if (meta.docs !== side.docs) {
    throw new Error(`search restore: docs ${meta.docs} != sidecar ${side.docs}`);
  }
  if (typeof meta.docs !== 'number') {
    throw new Error('search restore: quill-meta.json has no numeric docs count');
  }
  return meta;
}
