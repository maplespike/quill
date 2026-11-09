#!/usr/bin/env node
// Weekly report of Dependabot security updates that cannot be applied.
//
// Why this exists
// ---------------
// Dependabot opens security PRs for what it can fix. When the only patched
// release lives in a major version the parent package does not accept, the
// alert stays open forever and the bump never arrives: the PR simply never
// appears. Nothing in the repo noticed those, so they accumulated silently
// (see the 2026-11 rustls / lru / nodemailer batches, #1047).
//
// This script reads the open Dependabot alerts, keeps the ones with no usable
// fix, and keeps one issue in sync:
//
//   "Dependabot: security updates not possible"
//
// Each entry names the package, the vulnerable range, the first patched
// release and why the update is blocked. The issue ends with the triage rule
// (dismiss with a reason, wait for upstream, or a lint- and test-verified
// pnpm.overrides on a branch) and says in as many words that this is NOT an
// infra flake.
//
// Authorization failures are not errors here. On 403/404 from the alerts API
// the script logs a ::notice:: and exits 0: the repository may have
// Dependabot alerts disabled, or the token may lack `security-events: read`,
// and a red weekly cron for that would be noise.
//
// Pure Node, no dependencies (CI ships no YAML/HTTP library). The pure helpers
// are exported for scripts/test-dependabot-unfixable-report.mts.
//
// Usage:
//   GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo \
//     node scripts/gates/dependabot-unfixable-report.mjs [--dry-run]
// Exit 0 on success (including 403/404 from the alerts API), 1 on an
// unexpected API failure.

export const ISSUE_TITLE = 'Dependabot: security updates not possible';

// The blocked reasons this script can report. "no patched release" is the
// API telling us nothing exists yet; "major outside parent range" is the
// common real case — a fix exists only in the next major, and the parent
// package pins the current major.
export const REASON_NO_PATCH = 'no patched release';
export const REASON_MAJOR = 'major outside parent range';

/** First `x.y.z` in a version or range string, or null. */
export function parseVersionTriple(text) {
  if (typeof text !== 'string') return null;
  const m = text.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), raw: m[0] };
}

/**
 * Decide what an alert means for this report.
 *
 * @param {object} alert A Dependabot alert from GET /repos/{o}/{r}/dependabot/alerts.
 * @returns {null|{packageName: string, ecosystem: string, manifestPath: string,
 *   vulnerableRange: string, firstPatched: string|null, reason: string}}
 *   null when the alert is fixable inside its own major (Dependabot will open
 *   or already opened a PR, so it is not our queue).
 */
export function classifyAlert(alert) {
  const vuln = alert?.security_vulnerability;
  if (!vuln) return null;

  const dependency = alert.dependency ?? {};
  const packageName = dependency.package?.name ?? vuln.package?.name ?? 'unknown';
  const ecosystem = dependency.package?.ecosystem ?? vuln.package?.ecosystem ?? 'unknown';
  const vulnerableRange = vuln.vulnerable_version_range ?? 'unknown';
  const firstPatched = vuln.first_patched_version?.identifier ?? null;

  if (!firstPatched) {
    return {
      packageName,
      ecosystem,
      manifestPath: dependency.manifest_path ?? '',
      vulnerableRange,
      firstPatched: null,
      reason: REASON_NO_PATCH
    };
  }

  const rangeMajor = parseVersionTriple(vulnerableRange)?.major ?? null;
  const patched = parseVersionTriple(firstPatched);
  if (rangeMajor !== null && patched && patched.major > rangeMajor) {
    return {
      packageName,
      ecosystem,
      manifestPath: dependency.manifest_path ?? '',
      vulnerableRange,
      firstPatched,
      reason: `${REASON_MAJOR} (${rangeMajor}.x -> ${patched.major}.x)`
    };
  }

  // A patched release exists inside the target major: not our queue.
  return null;
}

/** Collapse duplicate alerts for the same package+ecosystem+manifest. */
export function collectUnfixable(alerts) {
  const out = new Map();
  for (const alert of alerts ?? []) {
    const entry = classifyAlert(alert);
    if (!entry) continue;
    const key = `${entry.ecosystem}:${entry.packageName}:${entry.manifestPath}`;
    const existing = out.get(key);
    if (!existing) {
      out.set(key, entry);
      continue;
    }
    // Keep the widest range and the lowest patched release seen.
    if (!existing.vulnerableRange.includes(entry.vulnerableRange)) {
      existing.vulnerableRange = `${existing.vulnerableRange}; ${entry.vulnerableRange}`;
    }
    if (entry.firstPatched && (!existing.firstPatched || entry.firstPatched < existing.firstPatched)) {
      existing.firstPatched = entry.firstPatched;
      existing.reason = entry.reason;
    }
  }
  return [...out.values()].sort((a, b) => a.packageName.localeCompare(b.packageName));
}

/**
 * Keep the Dependabot update failures whose error is
 * `security_update_not_possible`. GitHub's documented REST surface for
 * Dependabot is the alerts endpoint; a job-failure listing is only available
 * on some deployments, so callers treat any 4xx as "not exposed".
 */
export function collectUpdateFailures(jobs) {
  const out = [];
  for (const job of jobs ?? []) {
    if (!job || typeof job !== 'object') continue;
    const haystack = JSON.stringify(job);
    if (!haystack.includes('security_update_not_possible')) continue;
    const pkg = job.dependency?.package?.name ?? job.package?.name ?? job.package_name ?? 'unknown';
    const ecosystem = job.dependency?.package?.ecosystem ?? job.package?.ecosystem ?? job.ecosystem ?? 'unknown';
    const error = job.error?.detail ?? job.error?.title ?? job.message ?? 'security_update_not_possible';
    out.push({
      packageName: String(pkg),
      ecosystem: String(ecosystem),
      error: String(error),
      createdAt: job.created_at ?? ''
    });
  }
  return out;
}

const TRIAGE_RULE = [
  '## Triage rule',
  '',
  'An entry here is **not** an infra flake, and it is not a reason to re-run',
  'anything. Pick exactly one of these, and record which one you picked:',
  '',
  '1. **Dismiss with a reason** — when the vulnerable code path is not reachable',
  '   here, or the advisory does not affect this usage. Dismiss the Dependabot',
  '   alert with a documented reason; do not leave it open silently.',
  '2. **Wait for upstream** — when no patched release exists yet. Check that the',
  '   "first patched version" is still empty, then leave the alert open and',
  '   revisit next week. Do not pin to an unreleased branch.',
  '3. **`pnpm.overrides` on a branch** — when the fix is a major bump the parent',
  '   range blocks. Add a scoped override in `package.json`, then prove it with a',
  '   lint pass and the full test run on that branch before it can merge. A',
  '   major version bump still needs Reverb\'s decision.',
  '',
  'Never label this class of alert "infra flake", and never close it with',
  '"flaky" — the update is impossible by version arithmetic, not by CI luck.'
].join('\n');

/** Render the issue body. Deterministic so the weekly update is a clean diff. */
export function renderIssueBody(items, failures = [], now = new Date()) {
  const lines = [];
  lines.push('<!-- dependabot-unfixable-report -->');
  lines.push('## Summary');
  lines.push('');
  const generated = now.toISOString().slice(0, 10);
  lines.push(`Generated ${generated} from open Dependabot alerts plus any exposed`);
  lines.push('Dependabot update failures. These are security updates that Dependabot');
  lines.push('cannot apply on its own.');
  lines.push('');

  lines.push(`### Open alerts with no applicable fix (${items.length})`);
  lines.push('');
  if (items.length === 0) {
    lines.push('None this week.');
  } else {
    lines.push('| Package | Ecosystem | Manifest | Vulnerable range | First patched | Why it is blocked |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const i of items) {
      const patched = i.firstPatched ?? '(none published)';
      const manifest = i.manifestPath ? `\`${i.manifestPath}\`` : '—';
      lines.push(
        `| \`${i.packageName}\` | ${i.ecosystem} | ${manifest} | \`${i.vulnerableRange}\` | \`${patched}\` | ${i.reason} |`
      );
    }
  }
  lines.push('');

  lines.push(`### Recent update failures reported as \`security_update_not_possible\` (${failures.length})`);
  lines.push('');
  if (failures.length === 0) {
    lines.push('None exposed by the API this week.');
  } else {
    lines.push('| Package | Ecosystem | Error | First seen |');
    lines.push('| --- | --- | --- | --- |');
    for (const f of failures) {
      const when = f.createdAt ? f.createdAt.slice(0, 10) : '—';
      lines.push(`| \`${f.packageName}\` | ${f.ecosystem} | ${f.error} | ${when} |`);
    }
  }
  lines.push('');
  lines.push(TRIAGE_RULE);
  lines.push('');
  lines.push('_Maintained by `scripts/gates/dependabot-unfixable-report.mjs` from `.github/workflows/dependabot-unfixable-report.yml`._');
  lines.push('');
  return lines.join('\n');
}

const API_ACCEPT = 'application/vnd.github+json';
const API_VERSION = '2022-11-28';

async function apiGet(fetchImpl, url, token, log) {
  const res = await fetchImpl(url, {
    headers: {
      Accept: API_ACCEPT,
      'X-GitHub-Api-Version': API_VERSION,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  return res;
}

/** Paginate `GET /repos/{repo}/dependabot/alerts?state=open`. */
export async function fetchOpenAlerts({ fetchImpl, apiUrl, repo, token, log, maxPages = 20 }) {
  const alerts = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${apiUrl}/repos/${repo}/dependabot/alerts?state=open&per_page=100&page=${page}`;
    const res = await apiGet(fetchImpl, url, token, log);
    if (res.status === 403 || res.status === 404) {
      log(`::notice::Dependabot alerts API returned ${res.status} for ${repo}; alerts are not readable (disabled or token lacks security-events:read). Exiting 0.`);
      return null;
    }
    if (!res.ok) {
      throw new Error(`Dependabot alerts API ${res.status} ${res.statusText} for ${url}`);
    }
    const body = await res.json();
    if (!Array.isArray(body) || body.length === 0) break;
    alerts.push(...body);
    if (body.length < 100) break;
  }
  return alerts;
}

/**
 * Best-effort read of Dependabot update job failures. GitHub does not document
 * a REST endpoint for these on every plan; any 4xx (or a non-array body)
 * means "not exposed" and yields an empty list.
 */
export async function fetchUpdateFailures({ fetchImpl, apiUrl, repo, token, log }) {
  const url = `${apiUrl}/repos/${repo}/dependabot/jobs?per_page=50`;
  try {
    const res = await apiGet(fetchImpl, url, token, log);
    if (res.status === 403 || res.status === 404) {
      log(`::notice::Dependabot update failures are not exposed by the API (${res.status}); continuing with alerts only.`);
      return [];
    }
    if (!res.ok) {
      log(`::notice::Dependabot update failures could not be read (${res.status}); continuing with alerts only.`);
      return [];
    }
    const body = await res.json();
    const jobs = Array.isArray(body) ? body : Array.isArray(body?.jobs) ? body.jobs : [];
    return collectUpdateFailures(jobs);
  } catch (err) {
    log(`::notice::Dependabot update failures could not be read (${err.message}); continuing with alerts only.`);
    return [];
  }
}

/** Find the open report issue by exact title. */
async function findIssue({ fetchImpl, apiUrl, repo, token, log }) {
  for (let page = 1; page <= 10; page++) {
    const url = `${apiUrl}/repos/${repo}/issues?state=open&per_page=100&page=${page}`;
    const res = await apiGet(fetchImpl, url, token, log);
    if (!res.ok) {
      throw new Error(`Issues API ${res.status} ${res.statusText} for ${url}`);
    }
    const body = await res.json();
    if (!Array.isArray(body) || body.length === 0) return null;
    const match = body.find((issue) => !issue.pull_request && issue.title === ISSUE_TITLE);
    if (match) return match;
    if (body.length < 100) return null;
  }
  return null;
}

/**
 * Run the report. Returns the process exit code. `fetchImpl`, `env` and `log`
 * are injectable so the unit tests never touch the network.
 */
export async function run({
  fetchImpl = globalThis.fetch,
  env = process.env,
  log = (...args) => console.log(...args),
  now = new Date()
} = {}) {
  const token = env.GITHUB_TOKEN ?? '';
  const repo = env.GITHUB_REPOSITORY ?? '';
  const apiUrl = (env.GITHUB_API_URL ?? 'https://api.github.com').replace(/\/+$/, '');
  const dryRun = process.argv.includes('--dry-run') || env.DRY_RUN === '1';

  if (!repo || !/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    log('::error::GITHUB_REPOSITORY must be set to owner/repo');
    return 1;
  }
  if (!token) {
    log('::notice::GITHUB_TOKEN is not set; nothing to read or write. Exiting 0.');
    return 0;
  }

  let alerts;
  try {
    alerts = await fetchOpenAlerts({ fetchImpl, apiUrl, repo, token, log });
  } catch (err) {
    log(`::error::${err.message}`);
    return 1;
  }
  if (alerts === null) return 0;

  const items = collectUnfixable(alerts);
  const failures = await fetchUpdateFailures({ fetchImpl, apiUrl, repo, token, log });
  const body = renderIssueBody(items, failures, now);

  log(`Dependabot unfixable: ${items.length} alert(s), ${failures.length} exposed update failure(s).`);

  if (dryRun) {
    log(`--- ${ISSUE_TITLE} ---`);
    log(body);
    return 0;
  }

  try {
    const existing = await findIssue({ fetchImpl, apiUrl, repo, token, log });
    if (existing) {
      const res = await fetchImpl(`${apiUrl}/repos/${repo}/issues/${existing.number}`, {
        method: 'PATCH',
        headers: {
          Accept: API_ACCEPT,
          'X-GitHub-Api-Version': API_VERSION,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ body })
      });
      if (!res.ok) {
        log(`::error::Could not update issue #${existing.number}: ${res.status} ${res.statusText}`);
        return 1;
      }
      log(`Updated issue #${existing.number}: ${ISSUE_TITLE}`);
    } else {
      const res = await fetchImpl(`${apiUrl}/repos/${repo}/issues`, {
        method: 'POST',
        headers: {
          Accept: API_ACCEPT,
          'X-GitHub-Api-Version': API_VERSION,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        // No labels: this workflow must not change labels.
        body: JSON.stringify({ title: ISSUE_TITLE, body })
      });
      if (!res.ok) {
        log(`::error::Could not open the report issue: ${res.status} ${res.statusText}`);
        return 1;
      }
      const created = await res.json();
      log(`Opened issue #${created.number ?? '?'}: ${ISSUE_TITLE}`);
    }
  } catch (err) {
    log(`::error::${err.message}`);
    return 1;
  }

  return 0;
}

// Only run when invoked directly, not when imported by the tests.
const invokedDirectly = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  run().then((code) => process.exit(code));
}
