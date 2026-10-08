import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The logging-transport policy, as an executable contract.
 *
 * A `pino-pretty` transport runs in a worker thread whose keep-alive timer is
 * referenced, so every one of them pins a live thread for the life of the
 * process. Under NODE_ENV=test that keeps the test runner's child alive after
 * its last test reports and the suite hangs instead of exiting. The decision
 * therefore lives in exactly one place — `devPrettyTransport()` in logger.ts —
 * and this file fails if a module starts making it for itself.
 *
 * The scan below skips this file, which names the hazard inside its own
 * assertion messages.
 */

const SRC = fileURLToPath(new URL('..', import.meta.url));
const SELF = '__tests__/logging-policy.test.ts';

/** Worker threads this process currently holds — the resource the hang comes from. */
function workers(): number {
  return process.getActiveResourcesInfo().filter((r) => r === 'Worker' || r === 'MessagePort').length;
}

const baselineWorkers = workers();

function sourceFiles(): string[] {
  return readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.ts')).sort();
}

function read(rel: string): string {
  return readFileSync(join(SRC, rel), 'utf8');
}

/** Modules that build a logger of their own: the only ones that need a transport. */
function loggerModules(): string[] {
  return sourceFiles().filter((rel) => rel !== SELF && /\bpino\(\s*\{/.test(read(rel)));
}

const POLICY = [
  ['production', undefined],
  ['test', undefined],
  ['development', 'pino-pretty'],
  [undefined, 'pino-pretty'],
] as const;

describe('logging transport policy', () => {
  it('pretty-prints only outside production and tests', async () => {
    const { devPrettyTransport } = await import('../logger.js');
    const saved = process.env.NODE_ENV;
    try {
      for (const [nodeEnv, target] of POLICY) {
        if (nodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = nodeEnv;
        assert.equal(devPrettyTransport()?.target, target, `transport target for NODE_ENV=${nodeEnv}`);
      }
    } finally {
      if (saved === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = saved;
    }
  });

  it('names the pretty transport only in logger.ts', () => {
    const offenders = sourceFiles().filter((rel) => rel !== SELF && rel !== 'logger.ts' && read(rel).includes('pino-pretty'));
    assert.deepEqual(
      offenders,
      [],
      'these modules build their own pretty transport; call devPrettyTransport() from logger.ts instead',
    );
  });

  it('takes every logger transport from devPrettyTransport()', () => {
    const offenders: string[] = [];
    for (const rel of sourceFiles()) {
      if (rel === SELF) continue;
      const text = read(rel);
      if (!/\bpino\(\s*\{/.test(text)) continue; // a payload field named `transport` is not a logger
      const lines = text.split('\n');
      lines.forEach((line, at) => {
        // The call may be wrapped, so look one line past the key before judging it.
        if (/transport\s*:/.test(line) && !lines.slice(at, at + 3).join('\n').includes('devPrettyTransport(')) {
          offenders.push(`${rel}:${at + 1}`);
        }
      });
    }
    assert.deepEqual(offenders, [], 'route these transports through devPrettyTransport() in logger.ts');
  });

  it('spawns no worker thread when the package logs under NODE_ENV=test', async () => {
    assert.equal(process.env.NODE_ENV, 'test', 'this case only means something under NODE_ENV=test');
    const modules = loggerModules();
    assert.ok(modules.includes('logger.ts'), 'the shared logger must still build a logger');
    for (const rel of modules) await import(`../${rel.replace(/\.ts$/, '.js')}`);
    assert.equal(
      workers(),
      baselineWorkers,
      `${workers() - baselineWorkers} transport worker thread(s) survive import under NODE_ENV=test`,
    );
  });
});
