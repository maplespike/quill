/**
 * Short, non-fatal probes for refresh scripts.
 *
 * GET /v1/security/audit-summary must not call this. A hung `corepack`,
 * `npx`, or `pnpm` lookup used to block that route for many seconds and
 * then fall back to the snapshot anyway. Refresh scripts
 * (`scripts/gen-security-audit.mjs`) may still look those binaries up.
 * Each probe gives up after a few seconds and resolves to null.
 */
import { execFile as defaultExecFile } from "node:child_process";

/** A few seconds. Long enough for a local binary, short enough to fail open. */
export const DEFAULT_PROBE_TIMEOUT_MS = 3_000;

/**
 * @param {string} bin
 * @param {string[]} args
 * @param {{ timeoutMs?: number, execFile?: typeof defaultExecFile }} [options]
 * @returns {Promise<string | null>} trimmed stdout, or null on hang, error, or empty output
 */
export function probeCommand(bin, args = [], options = {}) {
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_PROBE_TIMEOUT_MS;
  const execFile = options.execFile ?? defaultExecFile;

  return new Promise((resolve) => {
    let settled = false;
    /** @type {import("node:child_process").ChildProcess | undefined} */
    let child;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => {
      try {
        child?.kill("SIGKILL");
      } catch {
        // A probe that cannot be killed is still a failed probe.
      }
      finish(null);
    }, timeoutMs);

    try {
      child = execFile(
        bin,
        args,
        { encoding: "utf8", timeout: timeoutMs, killSignal: "SIGKILL" },
        (err, stdout) => {
          if (err) return finish(null);
          const trimmed = String(stdout ?? "").trim();
          // Reject empty output and multi-line noise so a probe cannot
          // hand a paragraph to execFile as a binary path.
          if (!trimmed || trimmed.length > 4096 || /[\r\n\0]/.test(trimmed)) return finish(null);
          finish(trimmed);
        },
      );
    } catch {
      finish(null);
    }
  });
}

/**
 * Find a pnpm binary. Order: `pnpm` on PATH, then `corepack which pnpm`,
 * then `npx --no-install which pnpm`. Each step uses `probeCommand`.
 * Returns null when every probe fails or times out. Never throws.
 *
 * @param {{ timeoutMs?: number, execFile?: typeof defaultExecFile }} [options]
 * @returns {Promise<{ bin: string } | null>}
 */
export async function resolvePnpm(options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const run = (bin, args) => probeCommand(bin, args, { ...options, timeoutMs });

  if (await run("pnpm", ["--version"])) return { bin: "pnpm" };

  const fromCorepack = await run("corepack", ["which", "pnpm"]);
  if (fromCorepack && (fromCorepack.startsWith("/") || fromCorepack.startsWith("."))) {
    return { bin: fromCorepack };
  }

  const fromNpx = await run("npx", ["--no-install", "which", "pnpm"]);
  if (fromNpx && (fromNpx.startsWith("/") || fromNpx.startsWith("."))) {
    return { bin: fromNpx };
  }

  return null;
}
