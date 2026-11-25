#!/usr/bin/env node
/**
 * scripts/gen-security-audit.mjs
 *
 * Runs `pnpm audit --json` and writes a normalized summary to
 * `packages/portal/public/data/security/audit.json` so the OWASP dashboard
 * can render live dependency-CVE counts without a server round-trip.
 *
 * Output shape (kept small + portable so the dashboard is happy):
 *   {
 *     "generatedAt": "2025-01-01T00:00:00.000Z",
 *     "summary":   { "total": 0, "critical": 0, "high": 0, "moderate": 0, "low": 0, "info": 0 },
 *     "top":       [ { "package": "...", "severity": "...", "title": "..." }, ... up to 20 ]
 *   }
 *
 * Falls back gracefully if `pnpm audit` isn't available or pnpm-lock.yaml is
 * missing — writes a stub with summary: { total: 0, … } so the dashboard can
 * still render with "No CVEs found" instead of crashing on a missing fetch.
 *
 * This script is the refresh path for GET /v1/security/audit-summary.
 * The route serves the file written here. It does not run `pnpm audit`.
 * Also invoked by `pnpm -F @maplespike/portal gen:security` and by the
 * API image build (`Dockerfile.api`). The CI `audit` job step
 * "Emit audit.json snapshot" writes raw `pnpm audit --json` into the same
 * gitignored path; it does not produce this normalized summary.
 *
 * pnpm / corepack / npx lookups use a few-second timeout (see
 * scripts/lib/command-probe.mjs). A hung or missing binary writes the
 * stub and exits 0. There is no scheduled job.
 *
 * Usage:
 *   node scripts/gen-security-audit.mjs
 *   pnpm -F @maplespike/portal gen:security
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePnpm } from "./lib/command-probe.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");
const OUTPUT_PATH = resolve(
  PROJECT_ROOT,
  "packages/portal/public/data/security/audit.json"
);

const ZERO_SUMMARY = {
  total: 0,
  critical: 0,
  high: 0,
  moderate: 0,
  low: 0,
  info: 0,
};

function normalize(raw) {
  // pnpm audit --json returns an object whose shape varies by version. Older
  // versions use `{ advisories: {…} }`, newer versions use `{ vulnerabilities: {…} }`.
  // We support both.
  const advisories = raw?.advisories ?? raw?.vulnerabilities ?? {};
  const out = { ...ZERO_SUMMARY };
  const top = [];

  for (const [id, adv] of Object.entries(advisories)) {
    const severityRaw = String(adv.severity ?? "info").toLowerCase();
    // "critical" / "high" / "moderate" / "low" / "info"
    const sev = ["critical", "high", "moderate", "low", "info"].includes(severityRaw)
      ? severityRaw
      : "info";
    out[sev] = (out[sev] ?? 0) + 1;
    out.total += 1;

    // Prefer the first finding path's package name for "top" view.
    const pkg = adv.findings?.[0]?.paths?.[0]?.split(">")[0]?.trim() ?? adv.module_name ?? id;
    top.push({
      id,
      package: pkg,
      severity: sev,
      title: adv.title ?? adv.description ?? id,
      url: adv.url ?? adv.recommendations?.[0] ?? "",
    });
  }

  // Severest first, then by package name for stable ordering.
  const sevRank = { critical: 0, high: 1, moderate: 2, low: 3, info: 4 };
  top.sort((a, b) => sevRank[a.severity] - sevRank[b.severity] || a.package.localeCompare(b.package));

  return { summary: out, top: top.slice(0, 20) };
}

function writeStub(reason) {
  const payload = {
    generatedAt: new Date().toISOString(),
    summary: ZERO_SUMMARY,
    top: [],
    note: reason,
  };
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2) + "\n");
  console.warn(`✗ pnpm audit unavailable — wrote stub (${reason})`);
}

const resolved = await resolvePnpm();
if (!resolved) {
  writeStub("pnpm probe failed or timed out (pnpm, corepack, and npx)");
  process.exit(0);
}

let raw;
try {
  raw = execFileSync(resolved.bin, ["audit", "--json"], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
  });
} catch (err) {
  // pnpm exited non-zero. It sometimes still writes a payload to stdout —
  // try to capture and parse it; otherwise write a stub.
  const stdout = err?.stdout?.toString?.() ?? "";
  if (stdout.trim().startsWith("{")) {
    raw = stdout;
  } else {
    writeStub(`pnpm audit exited ${err.status ?? "?"}: ${err.message?.split("\n")[0] ?? ""}`);
    process.exit(0); // don't fail the build — the dashboard handles missing data gracefully
  }
}

if (!existsSync(resolve(PROJECT_ROOT, "pnpm-lock.yaml"))) {
  writeStub("no pnpm-lock.yaml");
  process.exit(0);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (err) {
  writeStub(`could not parse pnpm audit JSON: ${err.message}`);
  process.exit(0);
}

const { summary, top } = normalize(parsed);
const payload = {
  generatedAt: new Date().toISOString(),
  summary,
  top,
};

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2) + "\n");
console.log(
  `✓ wrote ${OUTPUT_PATH.replace(PROJECT_ROOT + "/", "")} ` +
    `(${summary.total} advisories: ${summary.critical}C / ${summary.high}H / ${summary.moderate}M / ${summary.low}L)`
);
