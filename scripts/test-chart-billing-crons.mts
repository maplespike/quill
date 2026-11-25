#!/usr/bin/env tsx
/**
 * Billing operator CronJobs (templates/billing-cronjobs.yaml).
 *
 * - Off by default and off in values-prod.yaml (enabling is a deliberate change).
 * - When enabled: the three jobs render with the legacy reconcile-expiry
 *   schedule, Forbid concurrency, the batch priority class, the secret by
 *   secretKeyRef only, the right method/URL, and drift → Job failure only on
 *   the read-only subscription reconciliation.
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

function render(args: string[]): string {
  return execFileSync("helm", ["template", "quill", "charts/quill", ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function billingCronJobs(rendered: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const doc of rendered.split(/^---\s*$/m)) {
    if (!/^kind:\s*CronJob\s*$/m.test(doc) || !/app: quill-billing-cron/.test(doc)) continue;
    const name = doc.match(/^\s{2}name:\s*(\S+)\s*$/m)?.[1] ?? "?";
    out.set(name, doc);
  }
  return out;
}

const ENABLE_ALL = [
  "--set", "billing.cronJobs.reconcileExpiry.enabled=true",
  "--set", "billing.cronJobs.taxStatus.enabled=true",
  "--set", "billing.cronJobs.subscriptionReconcile.enabled=true",
];

test("billing crons: disabled by default and in values-prod.yaml", (t) => {
  if (!haveHelm()) return t.skip("helm is not installed on this runner");
  assert.equal(billingCronJobs(render([])).size, 0);
  assert.equal(billingCronJobs(render(["-f", "charts/quill/values-prod.yaml"])).size, 0);
});

test("billing crons: enabled jobs render correctly against prod values", (t) => {
  if (!haveHelm()) return t.skip("helm is not installed on this runner");
  const jobs = billingCronJobs(render(["-f", "charts/quill/values-prod.yaml", ...ENABLE_ALL]));
  assert.deepEqual([...jobs.keys()].sort(), [
    "quill-reconcile-expiry",
    "quill-reconcile-subscriptions",
    "quill-tax-status",
  ]);
  const expect: Record<string, { method: string; path: string; drift: boolean; schedule: string }> = {
    "quill-reconcile-expiry": { method: "POST", path: "/v1/billing/reconcile-expiry", drift: false, schedule: "17 3 * * *" },
    "quill-tax-status": { method: "GET", path: "/v1/billing/tax/status", drift: false, schedule: "7 * * * *" },
    "quill-reconcile-subscriptions": { method: "GET", path: "/v1/billing/reconcile-subscriptions", drift: true, schedule: "41 4 * * *" },
  };
  for (const [name, doc] of jobs) {
    const e = expect[name];
    assert.match(doc, new RegExp(`schedule: "${e.schedule.replace(/\*/g, "\\*")}"`), `${name} schedule`);
    assert.match(doc, /concurrencyPolicy: Forbid/, `${name} Forbid`);
    assert.match(doc, /priorityClassName: fleet-batch/, `${name} batch priority`);
    assert.match(doc, /restartPolicy: Never/);
    assert.match(doc, /resources:\s*\n\s*requests:/, `${name} resources`);
    assert.match(doc, /name: maplespike-secrets\s*\n\s*key: quill-billing-secret/, `${name} secretKeyRef`);
    assert.match(doc, new RegExp(`-X ${e.method} `), `${name} method`);
    assert.match(doc, new RegExp(`value: "http://quill-api\\.[^"]+:8082${e.path.replace(/\//g, "\\/")}"`), `${name} URL`);
    assert.equal(/drift_count":0/.test(doc), e.drift, `${name} drift gate`);
    // The secret is only ever referenced, never inlined.
    assert.doesNotMatch(doc, /X-Billing-Secret: [^$]/, `${name} must not inline a secret`);
  }
});
