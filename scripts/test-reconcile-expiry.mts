import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Render the scheduler with its real chart inputs, not the full chart.
const chart = mkdtempSync(path.join(tmpdir(), 'quill-expiry-chart-'));
after(() => rmSync(chart, { recursive: true, force: true }));
before(() => {
  mkdirSync(path.join(chart, 'templates'));
  for (const file of ['Chart.yaml', 'values.yaml', 'values-prod.yaml', 'templates/_helpers.tpl', 'templates/reconcile-expiry.yaml']) {
    copyFileSync(path.join(ROOT, 'charts/quill', file), path.join(chart, file));
  }
});

function render(production: boolean, extra: string[] = [], release = 'quill', namespace = 'maplespike'): string {
  return execFileSync('helm', ['template', release, chart, '--namespace', namespace,
    ...(production ? ['-f', path.join(chart, 'values-prod.yaml')] : []), ...extra], { encoding: 'utf8' });
}

function command(rendered: string): string {
  const block = rendered.match(/            - \|\n([\s\S]*?)            resources:/);
  assert.ok(block, 'rendered shell command');
  return block[1].replace(/^              /gm, '');
}

test('expiry scheduler is opt-in; production renders the existing bounded secret-only contract', () => {
  assert.ok(!render(false).includes('kind: CronJob'));
  assert.ok(!render(true, ['--set', 'billing.reconcileExpiry.enabled=false']).includes('kind: CronJob'));
  const job = render(true);
  for (const expected of [
    'kind: CronJob', 'name: quill-reconcile-expiry', 'namespace: maplespike',
    'schedule: "17 3 * * *"', 'concurrencyPolicy: Forbid', 'startingDeadlineSeconds: 300',
    'backoffLimit: 2', 'activeDeadlineSeconds: 600', 'restartPolicy: Never',
    'image: curlimages/curl:8.11.1', 'name: maplespike-secrets', 'key: quill-billing-secret',
    'optional: false', '-H "X-Billing-Secret: ${QUILL_BILLING_SECRET}"',
    '--connect-timeout 10 --max-time 60',
    'http://quill-api.maplespike.svc.cluster.local:8082/v1/billing/reconcile-expiry',
  ]) assert.ok(job.includes(expected), expected);
  assert.ok(!job.includes('Authorization:'));
  // A cron pod must not match the API Deployment/Service's app=quill-api selector.
  assert.ok(!job.includes('app: quill-api'));
});

test('scheduler target follows the release, namespace, and API port', () => {
  const job = render(false, ['--set', 'billing.reconcileExpiry.enabled=true', '--set', 'api.port=9090'], 'research', 'sandbox');
  assert.ok(job.includes('name: research-reconcile-expiry'));
  assert.ok(job.includes('namespace: sandbox'));
  assert.ok(job.includes('http://research-api.sandbox.svc.cluster.local:9090/v1/billing/reconcile-expiry'));
});

test('rendered curl command fails on HTTP errors and never prints bodies or secrets', async () => {
  const secret = 'synthetic-job-secret';
  let status = 200;
  let calls = 0;
  let receivedMethod: string | undefined;
  let receivedSecret: string | undefined;
  const server = createServer((req, res) => {
    calls++;
    receivedMethod = req.method;
    receivedSecret = req.headers['x-billing-secret'] as string | undefined;
    res.writeHead(status);
    res.end('synthetic-tenant-response-must-not-be-logged');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const shell = command(render(true)).replace(
      'http://quill-api.maplespike.svc.cluster.local:8082', `http://127.0.0.1:${address.port}`);
    for (const code of [200, 403, 500]) {
      status = code;
      const result = await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
        const child = spawn('/bin/sh', ['-c', shell], { env: { ...process.env, QUILL_BILLING_SECRET: secret } });
        let output = '';
        child.stdout.on('data', chunk => { output += chunk; });
        child.stderr.on('data', chunk => { output += chunk; });
        child.on('error', reject);
        child.on('close', exit => resolve({ code: exit, output }));
      });
      assert.equal(result.code === 0, code === 200);
      assert.equal(receivedMethod, 'POST');
      assert.equal(receivedSecret, secret);
      assert.ok(!result.output.includes(secret));
      assert.ok(!result.output.includes('synthetic-tenant-response'));
    }
    assert.equal(calls, 3);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});
