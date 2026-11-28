import { test } from 'node:test';
import assert from 'node:assert/strict';
import { McpMetrics, registerMetricTool } from './metrics.js';

test('MCP metrics count success, error, and rejected tool calls', () => {
  registerMetricTool('search_gazette');
  const metrics = new McpMetrics();
  metrics.record('search_gazette', 'success', 0.2);
  metrics.record('search_gazette', 'error', 2.1);
  metrics.record('search_gazette', 'rejected');

  const output = metrics.render();
  assert.match(output, /quill_mcp_tool_calls_total\{tool="search_gazette",outcome="success"\} 1/);
  assert.match(output, /quill_mcp_tool_calls_total\{tool="search_gazette",outcome="error"\} 1/);
  assert.match(output, /quill_mcp_tool_calls_total\{tool="search_gazette",outcome="rejected"\} 1/);
  assert.match(output, /quill_mcp_tool_call_duration_seconds_count\{tool="search_gazette",outcome="success"\} 1/);
  assert.doesNotMatch(output, /duration_seconds_count\{tool="search_gazette",outcome="rejected"/);
});

test('MCP metrics do not expose arbitrary names, identities, arguments, or errors', () => {
  registerMetricTool('search_gazette');
  const metrics = new McpMetrics();
  metrics.record('customer-secret-token', 'rejected');
  metrics.record('search_gazette', 'error', Number.NaN);
  metrics.record('search_gazette', 'error', Number.POSITIVE_INFINITY);
  metrics.record('search_gazette', 'success', Number.MAX_VALUE);
  const output = metrics.render();
  assert.doesNotMatch(output, /tenant|api[_-]?key|token|session|arguments|query|error_text|customer-secret/);
  assert.match(output, /tool="unregistered",outcome="rejected"/);
  assert.doesNotMatch(output, /NaN|Infinity|1\.79e\+308/);
  assert.match(output, /quill_mcp_tool_call_duration_seconds_sum\{tool="search_gazette",outcome="success"\} 3600/);
  assert.match(output, /quill_mcp_tool_call_duration_seconds_bucket\{tool="search_gazette",outcome="success",le="\+Inf"\} 1/);
});

test('MCP active identities count hosted callers once and expire from the window', () => {
  let now = 2_000_000;
  const metrics = new McpMetrics({ now: () => now, windowMs: 1000, maxIdentities: 2 });
  const apiKey = { hashed: 'api-key:secret-hash', mode: 'api-key' };
  const anonymous = { hashed: 'anonymous-ip:hashed-ip', mode: 'anonymous-ip' };

  metrics.recordIdentity(apiKey);
  metrics.recordIdentity(apiKey);
  metrics.recordIdentity(anonymous);
  assert.match(metrics.render(), /quill_mcp_active_identities 2/);

  // Local stdio callers are not hosted identities.
  metrics.recordIdentity({ hashed: 'self-hosted:session', mode: 'self-hosted' });
  assert.match(metrics.render(), /quill_mcp_active_identities 2/);

  now += 1001;
  const output = metrics.render();
  assert.match(output, /quill_mcp_active_identities 0/);
  assert.doesNotMatch(output, /secret-hash|hashed-ip|self-hosted/);
});

test('MCP quota and payment counters are always present and never carry identities', () => {
  const metrics = new McpMetrics();
  assert.match(metrics.render(), /quill_mcp_quota_hits_total 0/);
  assert.match(metrics.render(), /quill_mcp_payment_hits_total 0/);

  metrics.recordQuotaDenied();
  metrics.recordPaymentAttempt();
  metrics.recordPaymentAttempt();
  const output = metrics.render();
  assert.match(output, /quill_mcp_quota_hits_total 1/);
  assert.match(output, /quill_mcp_payment_hits_total 2/);
  assert.doesNotMatch(output, /api-key|hashed|session|token|customer/);
});
