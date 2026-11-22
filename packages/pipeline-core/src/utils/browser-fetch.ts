/**
 * Lightpanda Browser Fetch — Quill
 *
 * Thin wrapper around the `lightpanda` CLI binary (Zig-built headless
 * browser, https://lightpanda.io). Spawns `lightpanda fetch --dump <fmt> <url>`
 * per request and returns the post-render DOM as raw text.
 *
 * Unlike httpGet() (undici GET), browserFetch() executes JS in the page
 * before dumping the DOM — recovering content that's hidden behind Nuxt /
 * Next / React hydration (e.g. https://www.pbo-dpb.ca/en/publications, which
 * ships an effectively empty SSR shell and only fills publication cards
 * client-side).
 *
 * Self-healing:
 *   - Hard timeout (SIGTERM → 1s grace → SIGKILL) so CronJobs can't hang
 *     even if the Zig binary traps SIGTERM.
 *   - Stream cap on stdout (50 MB) and stderr (1 MB) — kill the process
 *     on overflow so a runaway verbose SPA page can't OOM the host.
 *   - `__MAPLESPIKE_MOCK_BROWSER` flag (mirrors `__MAPLESPIKE_MOCK_FETCH`
 *     in utils/http.ts) lets unit tests skip the subprocess entirely and
 *     return canned HTML — no real binary required.
 *
 * Runtime requirement:
 *   - The `lightpanda` binary is taken from $LIGHTPANDA_BIN when that
 *     variable is set. Otherwise the wrapper looks up `lightpanda` on PATH.
 *     The repo's Nix / docker-compose / Helm layers do NOT install it;
 *     self-hosters must pull the precompiled CLI from
 *     https://github.com/lightpanda-io/lightpanda/releases
 *     or skip the browserFetch callers.
 *   - bundle-safe: `node:child_process` is dynamic-imported so the file
 *     still compiles for Cloudflare Workers / Bun (where browserFetch is
 *     effectively a no-op unless those runtimes happen to ship child_process).
 *     A runtime call from Workers raises a clear error at the spawn step.
 *
 * @internal No callsite in `packages/pipeline-core/src/ingestion/**` as of
 * 2026-07-11 — fetchers opt in individually with a feature flag in
 * followup turns. If you add a caller, update the AGENTS.md
 * "Browser rendering (lightpanda CLI)" section to remove the "no fetcher
 * wired yet" claim.
 *
 * Usage:
 *   const resp = await browserFetch('https://www.pbo-dpb.ca/en/publications', {
 *     dump: 'html',
 *     waitUntil: 'domcontentloaded',
 *     timeoutMs: 30_000,
 *   });
 *   // resp.body — rendered HTML describing publication cards
 */

/** LIGHTPANDA_BIN when set, otherwise the `lightpanda` name for a PATH lookup. */
export function browserBin(): string {
  const fromEnv = process.env['LIGHTPANDA_BIN']?.trim();
  return fromEnv || 'lightpanda';
}

// Default --log-level read from env at module load. Per-call
// BrowserFetchOptions.logLevel overrides this when set.
const ENV_LOG_LEVEL = process.env['LIGHTPANDA_LOG_LEVEL'] as
  | BrowserLogLevel
  | undefined;

// Stream caps (bytes) — chosen to be larger than any plausible rendered page
// but small enough that a runaway SPA can't OOM the host. Stdout is big
// because legitimately-rendered HTML is verbose; stderr is small because
// lightpanda diagnostic output should be SO-out-of-band.
const MAX_STDOUT_BYTES = 50 * 1024 * 1024;
const MAX_STDERR_BYTES = 1 * 1024 * 1024;

// Test override flag — mirrors __MAPLESPIKE_MOCK_FETCH in utils/http.ts.
// When true, browserFetch skips the subprocess and returns canned HTML.
declare global {
  // eslint-disable-next-line no-var
  var __MAPLESPIKE_MOCK_BROWSER: boolean | undefined;
}

export type BrowserFetchDump = 'html' | 'markdown' | 'semantic_tree' | 'semantic_tree_text';
export type BrowserWaitUntil = 'load' | 'domcontentloaded' | 'networkidle' | 'done';
export type BrowserLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface BrowserFetchOptions {
  /** `--dump` value. Default: 'html'. */
  dump?: BrowserFetchDump;
  /** `--strip-mode` comma list. e.g. 'js,css', 'full', 'ui'. */
  stripMode?: string;
  /** `--wait-ms` (max render wait). Default: 5000 inside lightpanda. */
  waitMs?: number;
  /** `--wait-until` event. Default: 'done' inside lightpanda. */
  waitUntil?: BrowserWaitUntil;
  /** `--wait-selector` (CSS selector to wait for after --wait-until). */
  waitSelector?: string;
  /** `--wait-script` (JS expr; wait until truthy after --wait-until). */
  waitScript?: string;
  /** `--obey-robots` */
  obeyRobots?: boolean;
  /** `--user-agent` (must not contain "Mozilla"). */
  userAgent?: string;
  /** `--user-agent-suffix` (appended to default). */
  userAgentSuffix?: string;
  /** `--http-proxy` URL (optionally `username:password@host:port`). Empty strings are skipped. */
  httpProxy?: string;
  /** `--proxy-bearer-token`. Empty strings are skipped. */
  proxyBearerToken?: string;
  /** `--http-timeout` (transfer completion, ms). */
  httpTimeout?: number;
  /** `--http-max-concurrent` */
  httpMaxConcurrent?: number;
  /** `--http-max-host-open` */
  httpMaxHostOpen?: number;
  /** `--log-level` (overrides LIGHTPANDA_LOG_LEVEL env default) */
  logLevel?: BrowserLogLevel;
  /** Hard timeout on the child process. Default: 30_000. */
  timeoutMs?: number;
}

export interface BrowserResponse {
  /** Lightpanda exit code. 0 == success. */
  exitCode: number;
  /** Rendered DOM as text (post --dump transformation). */
  body: string;
  /** true when exitCode === 0 AND body has content. */
  ok: boolean;
  /** Captured stderr (diagnostics on failure). */
  stderr: string;
}

const MOCK_HTML = '<!doctype html><html><body><h1>Mocked Lightpanda Render</h1></body></html>';

/**
 * Fetch a URL using the lightpanda CLI binary.
 *
 * Spawns `<BIN> fetch --dump <fmt> <url>` and resolves with the rendered
 * DOM as a string. Throws on hard timeout, on size-cap overflow, or on
 * spawn failure (binary missing, exec denied, etc).
 */
export async function browserFetch(
  url: string,
  options: BrowserFetchOptions = {},
): Promise<BrowserResponse> {
  // Test bypass — return canned HTML and skip the subprocess entirely.
  if (globalThis.__MAPLESPIKE_MOCK_BROWSER === true) {
    return {
      exitCode: 0,
      body: MOCK_HTML,
      ok: true,
      stderr: '',
    };
  }

  const args: string[] = ['fetch', '--dump', options.dump ?? 'html'];
  if (options.stripMode !== undefined) {
    args.push('--strip-mode', options.stripMode);
  }
  if (options.waitMs !== undefined) {
    args.push('--wait-ms', String(options.waitMs));
  }
  if (options.waitUntil !== undefined) {
    args.push('--wait-until', options.waitUntil);
  }
  if (options.waitSelector !== undefined) {
    args.push('--wait-selector', options.waitSelector);
  }
  if (options.waitScript !== undefined) {
    args.push('--wait-script', options.waitScript);
  }
  if (options.obeyRobots) {
    args.push('--obey-robots');
  }
  if (options.userAgent !== undefined) {
    args.push('--user-agent', options.userAgent);
  }
  if (options.userAgentSuffix !== undefined) {
    args.push('--user-agent-suffix', options.userAgentSuffix);
  }
  // Truthy guards — empty strings produce `--http-proxy ''` which lightpanda
  // rejects with a confusing error. Only push the flag when the caller
  // actually has a value to send.
  if (options.httpProxy) {
    args.push('--http-proxy', options.httpProxy);
  }
  if (options.proxyBearerToken) {
    args.push('--proxy-bearer-token', options.proxyBearerToken);
  }
  if (options.httpTimeout !== undefined) {
    args.push('--http-timeout', String(options.httpTimeout));
  }
  if (options.httpMaxConcurrent !== undefined) {
    args.push('--http-max-concurrent', String(options.httpMaxConcurrent));
  }
  if (options.httpMaxHostOpen !== undefined) {
    args.push('--http-max-host-open', String(options.httpMaxHostOpen));
  }

  // logLevel — per-call option wins over the LIGHTPANDA_LOG_LEVEL env default.
  const logLevel = options.logLevel ?? ENV_LOG_LEVEL;
  if (logLevel !== undefined) {
    args.push('--log-level', logLevel);
  }

  args.push(url);

  return runLightpanda(args, options.timeoutMs ?? 30_000, url);
}

async function runLightpanda(
  args: string[],
  hardTimeoutMs: number,
  url: string,
): Promise<BrowserResponse> {
  // Dynamic import via `await` so the file still bundles for runtimes that
  // don't provide node:child_process (Cloudflare Workers today; ESM bundlers
  // can't statically tree-shake the spawn symbol away otherwise).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cp: any = await import('node:child_process');
  const spawn = cp.spawn;

  return new Promise<BrowserResponse>((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let settled = false;

    const bin = browserBin();
    const proc = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Escalating kill: SIGTERM first, SIGKILL 1s later if lightpanda ignores it.
    // Resolves/rejects as soon as SIGTERM fires, but the kill escalates
    // independently so the resident memory gets reclaimed either way.
    const hardKill = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill('SIGTERM');
      reject(new Error(
        `browserFetch: hard timeout after ${hardTimeoutMs}ms (url=${url})`,
      ));
      // Escalate to SIGKILL if the binary traps SIGTERM
      setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch { /* already reaped */ }
      }, 1_000).unref();
    }, hardTimeoutMs);

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        if (settled) return;
        settled = true;
        proc.kill('SIGKILL');
        clearTimeout(hardKill);
        reject(new Error(
          `browserFetch: stdout exceeded ${MAX_STDOUT_BYTES} bytes (url=${url})`,
        ));
        return;
      }
      stdout += chunk.toString();
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      // Truncate (don't reject) so the most recent MAX_STDERR_BYTES of
      // diagnostic info is preserved. Single branch — no early-return
      // dead path. Char-length vs chunk-byte-length is a known LOW
      // asymmetry for UTF-8 multi-byte chars.
      if (stderr.length + chunk.length > MAX_STDERR_BYTES) {
        stderr = (stderr + chunk.toString()).slice(-MAX_STDERR_BYTES);
      } else {
        stderr += chunk.toString();
      }
    });

    proc.on('error', (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardKill);
      reject(new Error(`browserFetch: spawn failed for ${browserBin()}: ${err.message}`));
    });

    proc.on('close', (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardKill);
      const exitCode = code ?? -1;
      resolve({
        exitCode,
        body: stdout,
        ok: exitCode === 0 && stdout.length > 0,
        stderr,
      });
    });
  });
}

/** True when browserFetch will actually spawn the subprocess on next call. */
export function browserEnabled(): boolean {
  return globalThis.__MAPLESPIKE_MOCK_BROWSER !== true;
}
