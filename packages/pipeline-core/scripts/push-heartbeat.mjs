#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * MapleSpike CronJob heartbeat — pushes metrics to Prometheus Pushgateway.
 *
 * Each CronJob calls this script at the start and end of its run.
 * If a job fails to push its heartbeat within the expected interval,
 * the Prometheus alert "PipelineIngestionStale" fires.
 *
 * Usage:
 *   node scripts/push-heartbeat.mjs <pipeline-name> started
 *   node scripts/push-heartbeat.mjs <pipeline-name> completed [records]
 *   node scripts/push-heartbeat.mjs <pipeline-name> failed [error-message]
 */

const PUSHGATEWAY = process.env.PROMETHEUS_PUSHGATEWAY || 'http://prometheus-pushgateway.observability:9091';
const INSTANCE = process.env.HOSTNAME || 'cronjob';

const pipeline = process.argv[2];
const status = process.argv[3];
const detail = process.argv[4] || '';

if (!pipeline || !status) {
  console.error('Usage: push-heartbeat.mjs <pipeline> <started|completed|failed> [detail]');
  process.exit(1);
}

const metrics = [
  `# HELP pipeline_last_run_seconds Timestamp of last pipeline run`,
  `# TYPE pipeline_last_run_seconds gauge`,
  `pipeline_last_run_seconds{pipeline="${pipeline}",status="${status}",instance="${INSTANCE}"} ${Math.floor(Date.now() / 1000)}`,
  ``,
  `# HELP pipeline_run_count_total Total pipeline runs`,
  `# TYPE pipeline_run_count_total counter`,
  `pipeline_run_count_total{pipeline="${pipeline}",status="${status}"} 1`,
  ``,
  `# HELP pipeline_data_generated_at_seconds Timestamp of last pipeline-data.json generation`,
  `# TYPE pipeline_data_generated_at_seconds gauge`,
  `pipeline_data_generated_at_seconds{pipeline="${pipeline}"} ${Math.floor(Date.now() / 1000)}`,
].join('\n');

const url = `${PUSHGATEWAY}/metrics/job/quill-ingest/instance/${INSTANCE}/pipeline/${pipeline}`;

try {
  const resp = await fetch(url, {
    method: 'POST',
    body: metrics,
    headers: { 'Content-Type': 'text/plain' },
    signal: AbortSignal.timeout(5000),
  });
  if (resp.ok) {
    console.log(`[heartbeat] ${pipeline}: ${status} — pushed to Pushgateway`);
  } else {
    console.warn(`[heartbeat] ${pipeline}: Pushgateway returned HTTP ${resp.status}`);
  }
} catch (err) {
  console.warn(`[heartbeat] ${pipeline}: Pushgateway unreachable (${err instanceof Error ? err.message : err})`);
}
