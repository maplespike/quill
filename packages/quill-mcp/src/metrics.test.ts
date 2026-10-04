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
