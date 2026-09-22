/**
 * Quill — Redis endpoint resolution (single source of truth)
 *
 * Gate A2-REDIS (#764, #770). Both Redis consumers — the response cache in
 * `cache/redis.ts` and the rate limiter in `middleware/rate-limiter.ts` —
 * used to fall back to a hardcoded `redis://redis.ai-inference:6379`. No
 * `ai-inference` namespace exists in the cluster, so every deployment that
 * did not set REDIS_URL dialled a host that could never answer: the cache ran
 * in bypass, the limiter ran in pass-through, and the logs filled with
 * connection errors.
 *
 * Configuration decides now. An unset (or blank) REDIS_URL is a valid,
 * explicit answer meaning "no Redis in this environment": callers fall back to
 * their in-process implementation and say so once, at startup. There is no
 * hostname in this codebase for a client to guess at.
 */

/**
 * Resolve the Redis endpoint.
 *
 * @param explicit Caller-supplied URL (wins over the environment). An empty
 *                 string is honoured as "explicitly no Redis".
 * @param env      Environment to read REDIS_URL from; injectable for tests.
 * @returns The configured URL, or null when Redis is not configured.
 */
export function resolveRedisUrl(
  explicit?: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const configured = explicit ?? env.REDIS_URL;
  if (typeof configured !== 'string') return null;
  const trimmed = configured.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Host:port of a Redis URL, for logs. Credentials (user:password@) are
 * dropped — never log secrets.
 */
export function redisHostOf(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
  } catch {
    return '<unparseable REDIS_URL>';
  }
}
