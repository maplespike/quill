/**
 * One bounded HTTP probe for the live endpoint smoke test.
 *
 * The nightly smoke used to call runModule(), which fans out a full ingest.
 * httpGet() waits for a per-host token in an unbounded loop before undici's
 * headersTimeout / bodyTimeout start, so a module that queues hundreds of
 * GETs spends minutes only in that wait. This probe is the request the smoke
 * test actually makes: one GET, a hard per-request timeout, and a fixed
 * attempt cap. A timeout throws, and the message names the URL.
 */

export const LIVE_PROBE_TIMEOUT_MS = 8_000;

/** First try plus one retry. Never more. */
export const LIVE_PROBE_MAX_ATTEMPTS = 2;

export class LiveProbeError extends Error {
  readonly url: string;
  readonly attempts: number;
  readonly timedOut: boolean;

  constructor(message: string, url: string, attempts: number, timedOut: boolean) {
    super(message);
    this.name = 'LiveProbeError';
    this.url = url;
    this.attempts = attempts;
    this.timedOut = timedOut;
  }
}

function isTimeout(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = 'name' in err ? String((err as { name: unknown }).name) : '';
  if (name === 'TimeoutError' || name === 'AbortError') return true;
  const code = 'code' in err ? (err as { code: unknown }).code : undefined;
  if (code === 23 || code === 'ABORT_ERR' || code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'UND_ERR_HEADERS_TIMEOUT' || code === 'UND_ERR_BODY_TIMEOUT') {
    return true;
  }
  const message = err instanceof Error ? err.message : String(err);
  return /timeout|the operation was aborted/i.test(message);
}

export async function probeEndpoint(
  url: string,
  options: { timeoutMs?: number; maxAttempts?: number; fetchImpl?: typeof fetch } = {},
): Promise<{ status: number; url: string }> {
  const timeoutMs = options.timeoutMs ?? LIVE_PROBE_TIMEOUT_MS;
  const maxAttempts = options.maxAttempts ?? LIVE_PROBE_MAX_ATTEMPTS;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new LiveProbeError(`retry cap must be a positive integer for ${url}`, url, 0, false);
  }
  const doFetch = options.fetchImpl ?? globalThis.fetch;
  let last: LiveProbeError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await doFetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'User-Agent': 'Quill-live-smoke/1.0',
          Accept: '*/*',
        },
      });
      await res.body?.cancel().catch(() => undefined);
      // 408 / 429 / 5xx did not answer with data. Retry once, then fail
      // naming the URL. Any other status means the endpoint responded.
      if (res.status >= 500 || res.status === 408 || res.status === 429) {
        last = new LiveProbeError(
          `HTTP ${res.status} from ${url} (attempt ${attempt}/${maxAttempts})`,
          url,
          attempt,
          false,
        );
        if (attempt < maxAttempts) continue;
        throw last;
      }
      return { status: res.status, url };
    } catch (err) {
      if (err instanceof LiveProbeError) {
        if (attempt >= maxAttempts) throw err;
        last = err;
        continue;
      }
      const timedOut = isTimeout(err);
      const detail = err instanceof Error ? err.message : String(err);
      last = new LiveProbeError(
        timedOut
          ? `timed out after ${timeoutMs}ms waiting on ${url} (attempt ${attempt}/${maxAttempts})`
          : `request failed waiting on ${url} (attempt ${attempt}/${maxAttempts}): ${detail}`,
        url,
        attempt,
        timedOut,
      );
      if (attempt >= maxAttempts) throw last;
    }
  }

  throw last ?? new LiveProbeError(`probe failed waiting on ${url}`, url, maxAttempts, true);
}
