/**
 * Live smoke test — calls EVERY registered quill-mcp tool handler with
 * schema-driven args against real upstreams and reports per-tool results.
 *
 * Usage:  pnpm exec tsx scripts/mcp-tool-smoke.mts
 *
 * This is a diagnostic driver (like the verify-828-* scripts), not a
 * committed test. It exercises the wrapped handlers from tools/index.ts
 * (the same path the MCP server uses), so every response is a
 * ToolResponse with { content, isError? }.
 */

import { getAllTools } from '../packages/quill-mcp/src/tools/index.js';
import { installStreamErrorGuard } from '../packages/pipeline-core/src/utils/http.js';

// Install the stream-decompression guard FIRST so a truncated gzip/HTTP2
// upstream body (Z_BUF_ERROR from Node's webstreams adapter — an uncaught
// throw, not a promise rejection) can't kill the run mid-report.
installStreamErrorGuard({
  warn: (obj, msg) => console.warn(`[guard] ${msg ?? ''}`, obj.err instanceof Error ? obj.err.message : ''),
  error: (obj, msg) => console.error(`[guard] ${msg ?? ''}`, obj.err instanceof Error ? obj.err.message : ''),
});

const CONCURRENCY = 6;
const PER_TOOL_TIMEOUT_MS = 25_000;

/**
 * Per-tool arg overrides for tools whose generic schema-driven args would
 * be rejected at validation or hit the wrong upstream (e.g. WDI/comtrade
 * need real country codes, search_un needs a database key, verify_claim
 * needs a real sha256). Keyed by registered tool name.
 */
const ARG_OVERRIDES: Record<string, Record<string, unknown>> = {
  get_wdi_indicator: { indicatorCode: 'NY.GDP.MKTP.CD' },
  compare_wdi_countries: { indicatorCode: 'NY.GDP.MKTP.CD', countries: ['CAN', 'USA'] },
  get_country_wdi_profile: { country: 'CAN' },
  analyze_indicator_trend: { indicatorCode: 'NY.GDP.MKTP.CD', country: 'CAN' },
  fetch_topic_indicators: { topic: 'economy' },
  get_indicator_metadata: { indicatorCode: 'NY.GDP.MKTP.CD' },
  get_comtrade_by_partner: { partner: 'USA' },
  get_comtrade_by_commodity: { commodityCode: '84' },
  get_comtrade_trends: { partner: 'USA' },
  search_un: { database: 'POP' },
  verify_claim: { sha256: `sha256:${'f'.repeat(64)}` },
  ngo_narrative_tracker: { organization: 'Fraser Institute', timeframe: '90d' },
  smart_search: { query: 'inflation trends', mode: 'search' },
  search_valet_api: { series: 'FXUSDCAD' },
  search_weather: { type: 'conditions', location: 'Toronto' },
};

/** Build a plausible arg object from a tool's inputSchema. */
function buildArgs(name: string, schema: Record<string, unknown>): Record<string, unknown> {
  const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = (schema.required ?? []) as string[];
  const args: Record<string, unknown> = {};

  // Common optional knobs that never hurt.
  if ('limit' in props && !required.includes('limit')) args.limit = 3;
  if ('jurisdiction' in props) args.jurisdiction = 'federal';
  if ('dataset' in props) args.dataset = 'all';

  const sampleFor = (propName: string, prop: Record<string, unknown>): unknown => {
    const type = prop.type as string | undefined;
    // Prefer the first enum value when one is declared.
    if (Array.isArray(prop.enum) && prop.enum.length > 0) return prop.enum[0];
    switch (propName) {
      case 'query': return 'Canada';
      case 'claim': return 'unemployment rate Canada 2024';
      case 'hash': return `sha256:${'f'.repeat(64)}`;
      case 'address': return 'So11111111111111111111111111111111111111112';
      case 'source_url': case 'url': return 'https://www.canada.ca/en.html';
    }
    if (type === 'string' || type === undefined) {
      if (/(year|date)/i.test(propName)) return '2024';
      if (/(code|id|name|lang)/i.test(propName)) return 'en';
      return 'test';
    }
    if (type === 'integer' || type === 'number') return 1;
    if (type === 'boolean') return true;
    if (type === 'array') return ['test'];
    if (type === 'object') return {};
    return 'test';
  };

  for (const field of required) {
    const prop = props[field];
    if (!prop) continue;
    args[field] = sampleFor(field, prop as Record<string, unknown>);
  }
  // Tool-specific overrides win over schema-driven values.
  return { ...args, ...(ARG_OVERRIDES[name] ?? {}) };
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, rej) => {
        timer = setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface Row {
  name: string;
  status: 'OK' | 'ERROR' | 'TIMEOUT' | 'THREW';
  kind: string; // validation | upstream | other | n/a
  detail: string;
  ms: number;
}

async function runOne(row: Row, mod: { handler: (a: Record<string, unknown>) => unknown }): Promise<void> {
  const args = buildArgs(row.name, mod.definition.inputSchema);
  const t0 = Date.now();
  try {
    const result = (await withTimeout(
      Promise.resolve(mod.handler(args)),
      PER_TOOL_TIMEOUT_MS,
    )) as { isError?: boolean; content: unknown };
    row.ms = Date.now() - t0;
    if (!result || !('content' in result)) {
      row.status = 'THREW';
      row.kind = 'other';
      row.detail = 'handler returned null/undefined or missing content';
      return;
    }
    const content = result.content as Record<string, unknown>;
    if (result.isError) {
      row.status = 'ERROR';
      const msg = typeof content === 'string' ? content : String(content?.error ?? JSON.stringify(content).slice(0, 120));
      row.kind = /(query|required|missing|empty|invalid|must be)/i.test(msg) ? 'validation' : 'upstream';
      row.detail = msg.slice(0, 160);
      return;
    }
    row.status = 'OK';
    const found =
      Array.isArray(content?.results) ? (content.results as unknown[]).length
      : Array.isArray(content?.releases) ? (content.releases as unknown[]).length
      : Array.isArray(content?.items) ? (content.items as unknown[]).length
      : 'n/a';
    row.kind = 'n/a';
    row.detail = typeof found === 'number' ? `${found} records` : 'content returned';
  } catch (err) {
    row.ms = Date.now() - t0;
    row.status = /timeout/.test(err instanceof Error ? err.message : String(err)) ? 'TIMEOUT' : 'THREW';
    row.kind = 'other';
    row.detail = (err instanceof Error ? err.message : String(err)).slice(0, 160);
  }
}

async function main(): Promise<void> {
  const tools = getAllTools();
  console.log(`Live smoke: ${tools.length} tools, concurrency ${CONCURRENCY}, ${PER_TOOL_TIMEOUT_MS / 1000}s timeout each\n`);
  const rows: Row[] = tools.map(t => ({
    name: t.definition.name,
    status: 'OK',
    kind: 'n/a',
    detail: '',
    ms: 0,
  }));

  let idx = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (idx < rows.length) {
      const i = idx++;
      await runOne(rows[i], tools[i]);
    }
  });
  await Promise.all(workers);

  // Report
  const ok = rows.filter(r => r.status === 'OK');
  const err = rows.filter(r => r.status === 'ERROR');
  const timedOut = rows.filter(r => r.status === 'TIMEOUT');
  const threw = rows.filter(r => r.status === 'THREW');

  console.log(`\n=== SUMMARY: ${ok.length} OK · ${err.length} error · ${timedOut.length} timeout · ${threw.length} threw ===\n`);
  for (const r of rows) {
    const mark = r.status === 'OK' ? '✅' : r.status === 'ERROR' ? '⚠️' : r.status === 'TIMEOUT' ? '⏱️' : '💥';
    console.log(`${mark} ${r.name.padEnd(34)} ${r.status.padEnd(8)} ${String(r.ms).padStart(6)}ms  ${r.kind !== 'n/a' ? `[${r.kind}] ` : ''}${r.detail}`);
  }

  // Exit non-zero only for hard contract failures (a handler that THREW —
  // the wrapped registry never throws, so any throw is a real bug).
  // Upstream errors and timeouts on slow-but-alive endpoints are diagnostic
  // info, reported above, not gate failures.
  process.exit(threw.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Driver crashed:', err);
  process.exit(2);
});
