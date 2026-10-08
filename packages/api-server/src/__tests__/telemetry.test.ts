/**
 * The telemetry module, as the process that imports it sees it.
 *
 * `dev-server.ts` imports this module for its side effects, so "what it did" is
 * only observable from the outside: the tracer it exports and what it says on
 * the way up. The defect this file pins left both silent — the export was the
 * hand-rolled fallback and nothing was logged, because the module reached for
 * `@opentelemetry/api` with an ambient `require` that ESM does not have.
 *
 * The import happens once, here, because the module is evaluated once.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const said: string[] = [];
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => { said.push(args.map(String).join(' ')); };
let telemetry: typeof import('../telemetry.js');
try {
  telemetry = await import('../telemetry.js');
} finally {
  console.warn = originalWarn;
}

describe('telemetry module', () => {
  it('loads the OTel API instead of falling back to the hand-rolled no-op', () => {
    assert.equal(
      typeof (telemetry.tracer as { startActiveSpan?: unknown }).startActiveSpan,
      'function',
      '@opentelemetry/api did not load, so the module is still the no-op fallback',
    );
  });

  it('hands out a tracer whose spans are safe to end', () => {
    const span = telemetry.tracer.startSpan('quill.test');
    assert.equal(typeof span.end, 'function');
    assert.equal(typeof span.setAttribute, 'function');
    assert.equal(typeof span.setStatus, 'function');
  });

  it('says out loud that no span leaves the process', () => {
    assert.ok(
      said.some((m) => m.includes('[telemetry]') && m.includes('spans are discarded')),
      `the module must name the reason spans are not exported, said: ${JSON.stringify(said)}`,
    );
  });
});
