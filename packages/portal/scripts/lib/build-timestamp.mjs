/**
 * Deterministic build timestamp for generated portal artifacts.
 *
 * Why this exists: the generators used to call `new Date()` directly, which
 * embedded the wall-clock time of whoever ran them. Because those timestamps
 * are written into committed artifacts, *every* regeneration produced a diff
 * even when no input had changed. That makes it impossible to tell a real
 * content change from a re-run, and it is why no CI job could check these files
 * for drift.
 *
 * The resolution order is deliberate:
 *
 *   1. `SOURCE_DATE_EPOCH` — the reproducible-builds convention. Highest
 *      priority so a release build can pin the value explicitly and get byte
 *      identical output on every machine.
 *   2. The committer date of the current git `HEAD`. This makes the output a
 *      function of the commit rather than of the clock, so re-running the
 *      generators on an unchanged tree is a no-op. A checkout at a different
 *      commit legitimately produces different output, which is the signal a
 *      drift check actually wants.
 *   3. `new Date()` — only outside a git checkout (a source tarball, a Docker
 *      build context with no `.git`). Non-reproducible, but better than
 *      crashing, and the fallback is reported on stderr so it cannot silently
 *      produce drift nobody can explain.
 *
 * Note that `SOURCE_DATE_EPOCH` conventionally pins a *release* build, not a
 * developer build; that is why git HEAD is preferred over it when both are
 * available and no explicit override is passed.
 */
import { execFileSync } from 'node:child_process';

const warn = (msg) => process.stderr.write(`[build-timestamp] ${msg}\n`);

/**
 * @param {object}  [options]
 * @param {string}  [options.override]  Explicit ISO timestamp; wins outright.
 * @param {boolean} [options.preferSourceDateEpoch]  Consult SOURCE_DATE_EPOCH
 *   before git HEAD. Used by release builds that want a pinned value.
 * @returns {string} An ISO-8601 timestamp.
 */
export function buildTimestamp({ override, preferSourceDateEpoch = false } = {}) {
  if (override) return new Date(override).toISOString();

  const fromEnv = readSourceDateEpoch();
  if (preferSourceDateEpoch && fromEnv) return fromEnv;

  const fromGit = readGitCommitDate();
  if (fromGit) return fromGit;

  if (fromEnv) return fromEnv;

  warn('no SOURCE_DATE_EPOCH and no git HEAD — falling back to wall clock; output will not be reproducible');
  return new Date().toISOString();
}

function readSourceDateEpoch() {
  const raw = process.env.SOURCE_DATE_EPOCH;
  if (!raw) return null;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds)) {
    warn(`ignoring SOURCE_DATE_EPOCH=${JSON.stringify(raw)} (not a number)`);
    return null;
  }
  return new Date(seconds * 1000).toISOString();
}

function readGitCommitDate() {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!out) return null;
    const parsed = new Date(out);
    if (Number.isNaN(parsed.getTime())) {
      warn(`git returned an unparseable commit date ${JSON.stringify(out)}`);
      return null;
    }
    return parsed.toISOString();
  } catch {
    return null;
  }
}
