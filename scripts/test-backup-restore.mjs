import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  backupSqliteFile,
  checkSqliteRestore,
  freshness,
  pruneExpired,
} from '../charts/quill/files/backup-lib.mjs';

const root = path.resolve(import.meta.dirname, '..');

function tempDir() {
  return mkdtempSync(path.join(tmpdir(), 'quill-backup-'));
}

test('sqlite backup restores the same row counts while a writer is open', () => {
  const dir = tempDir();
  try {
    const source = path.join(dir, 'maplespike.db');
    const live = new DatabaseSync(source);
    live.exec('PRAGMA journal_mode = WAL');
    live.exec('CREATE TABLE tenants (id TEXT PRIMARY KEY, name TEXT)');
    live.prepare('INSERT INTO tenants (id, name) VALUES (?, ?)').run('t1', 'Ada');
    const destDir = path.join(dir, 'backups');
    const scratchDir = path.join(dir, 'write-scratch');
    const result = backupSqliteFile({
      sourcePath: source,
      destDir,
      scratchDir,
      backupsMount: dir,
      retentionDays: 14,
    });
    assert.ok(result.dest.startsWith(destDir + '/'), result.dest);
    assert.ok(result.sha256 && /^[0-9a-f]{64}$/.test(result.sha256), result.sha256);
    assert.equal(existsSync(`${result.dest}.sha256`), true);
    live.prepare('INSERT INTO tenants (id, name) VALUES (?, ?)').run('t2', 'Lin');
    const restored = checkSqliteRestore(result.dest, path.join(dir, 'scratch', 'restored.db'));
    assert.equal(restored.ok, true, restored.problems.join('; '));
    assert.equal(restored.counts.tenants, 1);
    assert.deepEqual(result.counts, restored.counts);
    live.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('retention removes a stamped file older than the window and keeps a new one', () => {
  const dir = tempDir();
  try {
    const oldName = 'maplespike-20200101T000000Z.db';
    const newName = 'maplespike-20261026T000000Z.db';
    writeFileSync(path.join(dir, oldName), 'old');
    writeFileSync(path.join(dir, newName), 'new');
    const old = new Date('2020-01-01T00:00:00Z');
    utimesSync(path.join(dir, oldName), old, old);
    const removed = pruneExpired(dir, 14, Date.parse('2026-10-26T00:00:00Z'));
    assert.deepEqual(removed, [oldName]);
    assert.equal(readFileSync(path.join(dir, newName), 'utf8'), 'new');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('freshness fails when the newest backup is too old', () => {
  const dir = tempDir();
  try {
    const name = 'maplespike-20261020T000000Z.db';
    writeFileSync(path.join(dir, name), 'x');
    const then = new Date('2026-10-20T00:00:00Z');
    utimesSync(path.join(dir, name), then, then);
    const stale = freshness(dir, '.db', 26, Date.parse('2026-10-26T00:00:00Z'));
    assert.equal(stale.ok, false);
    const fresh = freshness(dir, '.db', 26, Date.parse('2026-10-20T01:00:00Z'));
    assert.equal(fresh.ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('local restore drill script backs up and checks sqlite and the search index', () => {
  const run = spawnSync('bash', ['scripts/restore-drill.sh', '--local'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(run.stdout, /restore: sqlite .+ ok \(1 tables, 2 rows\)/);
  assert.match(run.stdout, /restore: search .+ ok \(2 docs\)/);
  assert.match(run.stdout, /local restore drill: ok/);
});

test('search backup script drops an archive older than retention', () => {
  const dir = tempDir();
  try {
    const index = path.join(dir, 'index');
    const dest = path.join(dir, 'backups');
    spawnSync('mkdir', ['-p', index], { encoding: 'utf8' });
    writeFileSync(path.join(index, 'quill-meta.json'), '{"docs":1,"kinds":{},"built_at":"2026-10-26T00:00:00Z"}\n');
    writeFileSync(path.join(index, 'segment'), 'seg\n');
    const searchEnv = {
      ...process.env,
      INDEX_DIR: index,
      DEST_DIR: dest,
      SCRATCH_DIR: path.join(dir, 'scratch'),
      BACKUPS_MOUNT: dir,
      RETENTION_DAYS: '14',
    };
    const first = spawnSync('sh', ['charts/quill/files/search-backup.sh'], {
      cwd: root,
      encoding: 'utf8',
      env: searchEnv,
    });
    assert.equal(first.status, 0, first.stderr);
    const old = path.join(dest, 'index-20200101T000000Z.tar.gz');
    const oldMeta = path.join(dest, 'index-20200101T000000Z.meta.json');
    writeFileSync(old, 'old');
    writeFileSync(oldMeta, '{}');
    const then = new Date('2020-01-01T00:00:00Z');
    utimesSync(old, then, then);
    utimesSync(oldMeta, then, then);
    const second = spawnSync('sh', ['charts/quill/files/search-backup.sh'], {
      cwd: root,
      encoding: 'utf8',
      env: searchEnv,
    });
    assert.equal(second.status, 0, second.stderr);
    assert.equal(existsSync(old), false);
    assert.equal(existsSync(oldMeta), false);
    const left = readdirSync(dest).filter((name) => name.endsWith('.tar.gz'));
    assert.ok(left.length >= 1);
    assert.ok(left.every((name) => name !== 'index-20200101T000000Z.tar.gz'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('chart backup contract', (t) => {
  const values = readFileSync(path.join(root, 'charts/quill/values-prod.yaml'), 'utf8');
  const backups = readFileSync(path.join(root, 'charts/quill/templates/backups.yaml'), 'utf8');
  const searchDeploy = readFileSync(path.join(root, 'charts/quill/templates/search-deployment.yaml'), 'utf8');
  const searchSvc = readFileSync(path.join(root, 'charts/quill/templates/search-service.yaml'), 'utf8');
  const redis = readFileSync(path.join(root, 'charts/quill/templates/redis.yaml'), 'utf8');
  const netpol = readFileSync(path.join(root, 'charts/quill/templates/networkpolicy.yaml'), 'utf8');
  const pg = readFileSync(path.join(root, 'charts/quill/files/postgres-backup.sh'), 'utf8');
  // Gate G4: no chart value may name longhorn. Existing bound claims keep
  // their immutable class; new claims from this file bind local-path.
  assert.doesNotMatch(values, /storageClass:\s*longhorn/);
  assert.match(values, /storageClass:\s*local-path/);
  // One-time copy finished on 2026-10-26; prod keeps the flag off.
  assert.match(values, /migrateLegacyIndex: false/);
  assert.match(values, /accessMode: ReadWriteOnce/);
  assert.doesNotMatch(values, /accessMode: ReadWriteMany/);
  // CPU order (Reverb 2026-10-28 15:06 CT): backups stay on the same allowed
  // hosts as the API volume — nexus|sentry, never forge — via
  // affinityHosts / preferredHost (not a hard nodeName: nexus pin).
  const heavyHosts = values.match(
    /affinityHosts: &quillHeavyHosts\n((?:  - .+\n)+)/,
  );
  assert.ok(heavyHosts, 'values-prod must define &quillHeavyHosts');
  const hostList = [...heavyHosts[1].matchAll(/- (\S+)/g)].map((m) => m[1]);
  assert.ok(hostList.includes('nexus'), `heavy hosts need nexus: ${hostList}`);
  assert.ok(
    hostList.includes('sentry'),
    `heavy hosts need sentry: ${hostList}`,
  );
  assert.ok(!hostList.includes('forge'), `heavy hosts must not include forge: ${hostList}`);
  assert.match(values, /preferredHost: &quillPreferredHost nexus/);
  assert.match(values, /backups:\n(?:  .*\n)*?  affinityHosts: \*quillHeavyHosts/);
  assert.match(values, /backups:\n(?:  .*\n)*?  preferredHost: \*quillPreferredHost/);
  assert.match(values, /retentionDays: 3/);
  assert.match(backups, /kind: CronJob/);
  assert.match(backups, /quill.fullname" \. }}-backup-sqlite/);
  assert.match(backups, /quill.fullname" \. }}-backup-search/);
  assert.match(backups, /quill.fullname" \. }}-backup-freshness/);
  assert.match(backups, /quill.fullname" \. }}-backup-drill/);
  assert.match(backups, /name: quill-db-secret/);
  assert.match(backups, /key: postgres-password/);
  assert.doesNotMatch(backups, /sk_live_|postgres-password: [^{\s]/);
  assert.match(searchDeploy, /quill\.searchDataClaim/);
  assert.match(searchDeploy, /type: Recreate/);
  assert.match(searchDeploy, /image: \{\{ \.Values\.redis\.image \| quote \}\}/);
  assert.match(searchDeploy, /imagePullPolicy: \{\{ \.Values\.redis\.pullPolicy \| default "IfNotPresent" \}\}/);
  assert.doesNotMatch(searchDeploy, /image:\s*["']?redis:8\.2\.3-alpine/);
  assert.match(backups, /accessMode \| default "ReadWriteOnce"/);
  assert.match(backups, /image: \{\{ \.Values\.redis\.image \| quote \}\}/);
  assert.match(searchSvc, /storageClassName:/);
  assert.match(redis, /emptyDir: \{\}/);
  assert.match(netpol, /database \| default dict\)\.enabled/);
  assert.match(pg, /pg_dump/);
  assert.doesNotMatch(pg, /echo[^\\n]*PGPASSWORD/);

  // Rendered CronJobs must carry the hostname affinity (co-located with API).
  const rendered = spawnSync(
    'helm',
    ['template', 'quill', 'charts/quill', '-f', 'charts/quill/values-prod.yaml', '-s', 'templates/backups.yaml'],
    { cwd: root, encoding: 'utf8' },
  );
  if (rendered.error && rendered.error.code === 'ENOENT') {
    t.diagnostic('helm is not installed; skipping rendered-affinity assertions');
  } else {
    assert.equal(rendered.status, 0, rendered.stderr || rendered.stdout);
    for (const job of [
      'quill-backup-sqlite',
      'quill-backup-search',
      'quill-backup-freshness',
      'quill-backup-drill',
    ]) {
      assert.match(rendered.stdout, new RegExp(`name: ${job}`));
    }
    // Each backup job must follow the pod that holds the volume it mounts.
    // The search index is ReadWriteOnce and held by quill-search, so the search
    // backup follows quill-search; the other three mount quill-api-data and
    // follow quill-api. Anchoring on app=quill-api put the search backup on the
    // node that did NOT hold the index (2026-11-26 01:45Z: nexus while the
    // index was on sentry), where it hung in ContainerCreating for the full
    // activeDeadlineSeconds and never updated lastSuccessfulTime.
    const docs = rendered.stdout.split(/^---$/m);
    const docFor = (name) => {
      const doc = docs.find((d) => d.includes(`name: ${name}\n`));
      assert.ok(doc, `rendered chart has no ${name} document`);
      return doc;
    };
    const searchBackup = docFor('quill-backup-search');
    assert.match(
      searchBackup,
      /podAffinity:[\s\S]*?requiredDuringSchedulingIgnoredDuringExecution:[\s\S]*?app: quill-search[\s\S]*?topologyKey: kubernetes\.io\/hostname/,
    );
    assert.doesNotMatch(searchBackup, /app: quill-api/);
    for (const job of ['quill-backup-sqlite', 'quill-backup-freshness', 'quill-backup-drill']) {
      assert.match(
        docFor(job),
        /podAffinity:[\s\S]*?requiredDuringSchedulingIgnoredDuringExecution:[\s\S]*?app: quill-api[\s\S]*?topologyKey: kubernetes\.io\/hostname/,
      );
    }
    assert.doesNotMatch(
      rendered.stdout,
      /requiredDuringSchedulingIgnoredDuringExecution:[\s\S]*?kubernetes\.io\/hostname[\s\S]*?- "forge"/,
    );
  }
});


test('migrateLegacyIndex flag is explicit and consulted by the search template', () => {
  // Incident t_41842b38: chore/search-migration-off flipped the flag to
  // false (verified migration complete) and the backup contract locked the
  // new value, but only a hard-coded assertion was updated. A second change
  // that re-stomped the flag would silently regress. The flag is a two-phase
  // toggle (docs/ops/BACKUPS.md step 2 -> 3), so no assertion may hard-code
  // one phase. Lock instead that production sets an explicit boolean and the
  // template actually consults the flag across more than one concern, so the
  // value cannot drift into being decorative: a false flag that still pinned
  // search to nexus and re-ran the legacy copy would silently break the
  // post-migration state.
  const values = readFileSync(path.join(root, 'charts/quill/values-prod.yaml'), 'utf8');
  const searchDeploy = readFileSync(path.join(root, 'charts/quill/templates/search-deployment.yaml'), 'utf8');
  assert.match(values, /migrateLegacyIndex: (true|false)/);
  assert.ok(searchDeploy.includes('.Values.search.migrateLegacyIndex'));
  // The flag gates at least the nexus node pin and the legacy init container.
  assert.ok(searchDeploy.split('.Values.search.migrateLegacyIndex').length - 1 >= 2);
});
