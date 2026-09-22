#!/usr/bin/env -S npx tsx
//
// scripts/discover-municipal-ids.ts
//
// Build-time ID discovery for Quill's municipal fetcher.
//
// For every (municipality, dataset) pair in MUNICIPAL_PORTALS, this script
// resolves the friendly slug to the real catalog ID the upstream CKAN or
// Socrata portal uses:
//
//   CKAN    — GET `${baseUrl}/api/3/action/package_search?q=<slug>&rows=1`
//             → first result.id
//   Socrata — GET `${baseUrl}/api/views.json?search=<slug>&limit=1`
//             → first result.id (handles flat / {results: [...]} /
//             {views: [...]} / {datasets: [...]} shapes)
//
// The discovered IDs are merged into a git-tracked JSON registry:
//   `packages/pipeline-core/data/municipal-discovered-ids.json`
//
// Merge semantics: ADDITIVE-PRESERVE. We only OVERWRITE an entry when this
// run successfully discovered a non-null id for that key. If this run fails
// to discover (404 / bot-block / timeout / parse error / non-2xx), we keep
// the previously-discovered value untouched. This makes the script robust
// against transient outages — a Cloudflare-bot-blocked run will not erase
// the registry.
//
// Output schema:
//
//   {
//     schemaVersion: 1,
//     generatedAt: "<ISO 8601>",
//     source: "discover-municipal-ids",
//     discoveries: number,
//     keptFromPrevious: number,
//     entries: {
//       [compositeKey: `${baseUrl}|${slug}`]: {
//         id: string,
//         portalType: "ckan" | "socrata",
//         discoveredAt: "<ISO 8601>"
//       }
//     }
//   }
//
// Exit codes:
//   0  — every portalType that exists was probed; JSON written.
//   1  — a portalType handler threw an unhandled error.
//   130 — SIGINT.
//
// Concurrency: a single in-flight Promise pool of 8 probes at once.
// 90 (city, dataset) pairs at 8-wide = ~12 batches of ~5s each = ~60s total
// when upstreams are healthy; gracefully degrades when they bot-block.

import fs from 'node:fs';
import path from 'node:path';

import { validateCandidate } from './lib/municipal-candidate-validation.js';

// Resolve the registry path relative to this file so it works both at
// the monorepo root (when invoked via `tsx scripts/discover-municipal-ids.ts`)
// and from inside CI's checkout-of-the-repo-on-self-hosted-runner setup.
const REGISTRY_PATH = path.resolve(
  process.cwd(),
  'packages/pipeline-core/data/municipal-discovered-ids.json',
);

// Inline-typed subset of the MUNICIPAL_PORTALS schema. We don't import
// from the compiled pipeline-core dist because that'd require the package
// to build first, and CI runs this script BEFORE the build. The shape is
// stable (constants.ts is append-only) — if it changes, this script breaks
// loudly with a TS error, which is what we want.
interface Portal {
  name: string;
  province: string;
  baseUrl: string;
  portalType: 'ckan' | 'socrata' | 'arcgis' | 'custom';
  datasets: string[];
}

interface PortalsFile {
  MUNICIPAL_PORTALS: Record<string, Portal>;
}

// Module body intentionally avoids top-level await — tsx respects it under
// the "module" output format but NOT under "cjs", which is the fallback
// when tsx's loader can't hook a particular entry invocation. Wrap the
// whole "constants import → run" sequence in an async main() that's called
// from the bottom of the file.
async function loadMunicipalPortals(): Promise<Record<string, Portal>> {
  const mod = (await import(
    path.resolve(
      process.cwd(),
      'packages/pipeline-core/src/ingestion/municipal/constants.ts',
    )
  )) as unknown as PortalsFile;
  return mod.MUNICIPAL_PORTALS;
}

interface RegistryEntry {
  id: string;
  portalType: 'ckan' | 'socrata';
  discoveredAt: string;
  /** Dataset name as returned by the portal — validation evidence (#872). */
  name?: string;
  /** Row count from the live $limit=1 probe (Socrata). -1 = probe failed. */
  rowsProbed?: number;
  /** true only when validateCandidate accepted this candidate. */
  validated?: boolean;
}

interface Registry {
  schemaVersion: 1;
  generatedAt: string;
  source: 'discover-municipal-ids';
  discoveries: number;
  keptFromPrevious: number;
  entries: Record<string, RegistryEntry>;
}

// Acceptance (#872): `--dry-run` performs the full probe + validation pass but
// never writes the registry.
const DRY_RUN = process.argv.includes('--dry-run');

const SCHEMA_VERSION = 1 as const;
const SOURCE = 'discover-municipal-ids' as const;

function nowIso(): string {
  return new Date().toISOString();
}

function loadExistingRegistry(): Registry {
  if (!fs.existsSync(REGISTRY_PATH)) {
    return {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: nowIso(),
      source: SOURCE,
      discoveries: 0,
      keptFromPrevious: 0,
      entries: {},
    };
  }
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw) as Partial<Registry>;
    // Migrate anything pre-versioning to the current shape without
    // erasing entries — null-coalesce each field. Old files may have
    // been written by an earlier hand-crafted snippet.
    return {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: parsed.generatedAt ?? nowIso(),
      source: SOURCE,
      discoveries: 0,
      keptFromPrevious: 0,
      entries: parsed.entries ?? {},
    };
  } catch (err) {
    console.warn(
      `[discover-municipal-ids] existing registry at ${REGISTRY_PATH} failed to parse ` +
        `(${(err as Error).message}); starting from an empty registry`,
    );
    return {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: nowIso(),
      source: SOURCE,
      discoveries: 0,
      keptFromPrevious: 0,
      entries: {},
    };
  }
}

// ---------------------------------------------------------------------------
// Per-portal-type discovery implementations. Each returns the discovered id
// (string) OR null on any failure mode. Returning null PRESERVES last-known
// values in the registry (additive semantics).

interface Candidate {
  id: string;
  name: string;
}

async function discoverCkan(baseUrl: string, slug: string): Promise<Candidate[]> {
  const url = `${baseUrl}/api/3/action/package_search?q=${encodeURIComponent(slug)}&rows=5`;
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'MapleSpike-Municipal/1.0 (+discover-municipal-ids)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return [];
    const body = (await resp.json()) as {
      result?: {
        results?: Array<{
          id?: string;
          name?: string;
          title?: string;
          resources?: Array<{ format?: string; datastore_active?: boolean }>;
        }>;
      };
    };
    const results = body?.result?.results ?? [];
    return results
      .map((r) => {
        const id = r?.id ?? r?.name;
        if (!id) return null;
        // Acceptance (#872): a CKAN hit must expose a usable data resource —
        // an active datastore or a CSV/JSON resource — before it is considered.
        const hasData = (r?.resources ?? []).some(
          (res) => res?.datastore_active === true || /^(csv|json)$/i.test(res?.format ?? ''),
        );
        if (!hasData) return null;
        return { id, name: r?.title ?? r?.name ?? id };
      })
      .filter((c): c is Candidate => c !== null)
      .slice(0, 5);
  } catch {
    return [];
  }
}

/**
 * Socrata candidate discovery.
 *
 * PRIMARY: the global Socrata Discovery catalog
 *   https://api.us.socrata.com/api/catalog/v1?domains=<host>&q=<slug>&limit=10
 * The per-portal /api/views.json endpoint does NOT filter by its query
 * parameter — it returns the portal's default ordering, which is exactly how
 * "Map of Downtown Boundary" (2df6-k8j2) became the id for `permits` on
 * Winnipeg and a "Speed Check Sign" became `building-permits` on Edmonton
 * (#872). The Discovery catalog is query-capable and indexes every Socrata
 * portal, so it is the primary source; the per-portal endpoint stays only as a
 * fallback for portals the global catalog has not indexed.
 */
async function discoverSocrata(baseUrl: string, slug: string): Promise<Candidate[]> {
  // ── Primary: global Discovery catalog ────────────────────────────────
  let host = '';
  try {
    host = new URL(baseUrl).host;
  } catch {
    host = baseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  }
  if (host) {
    try {
      const url =
        `https://api.us.socrata.com/api/catalog/v1?domains=${encodeURIComponent(host)}` +
        `&q=${encodeURIComponent(slug)}&limit=10`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'MapleSpike-Municipal/1.0 (+discover-municipal-ids)', Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (resp.ok) {
        const body = (await resp.json()) as {
          results?: Array<{ resource?: { id?: string; name?: string } }>;
        };
        const candidates = (body.results ?? [])
          .map((r) => {
            const id = r?.resource?.id;
            return id ? { id, name: r?.resource?.name ?? id } : null;
          })
          .filter((c): c is Candidate => c !== null)
          .slice(0, 5);
        if (candidates.length > 0) return candidates;
      }
    } catch {
      // fall through to the per-portal endpoint
    }
  }

  // ── Fallback: the portal's own views endpoint ────────────────────────
  const url = `${baseUrl}/api/views.json?q=${encodeURIComponent(slug)}&limit=5`;
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'MapleSpike-Municipal/1.0 (+discover-municipal-ids)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return [];
    const body = await resp.json();
    const flat: unknown[] = Array.isArray(body)
      ? body
      : Array.isArray((body as { results?: unknown[] })?.results)
        ? (body as { results: unknown[] }).results
        : Array.isArray((body as { views?: unknown[] })?.views)
          ? (body as { views: unknown[] }).views
          : Array.isArray((body as { datasets?: unknown[] })?.datasets)
            ? (body as { datasets: unknown[] }).datasets
            : [];
    return flat
      .map((raw) => {
        const t = raw as { id?: string; name?: string; title?: string } | undefined;
        const id = t?.id ?? t?.name;
        return id ? { id, name: t?.name ?? t?.title ?? id } : null;
      })
      .filter((c): c is Candidate => c !== null)
      .slice(0, 5);
  } catch {
    return [];
  }
}

/**
 * Live row probe (Socrata only) — issue #872 requires that an id actually
 * returns rows before it is written to the registry. Returns the row count for
 * a `?$limit=1` query, or -1 when the probe itself could not complete.
 */
async function probeSocrataRows(baseUrl: string, id: string): Promise<number> {
  try {
    const resp = await fetch(`${baseUrl}/resource/${id}.json?$limit=1`, {
      headers: {
        'User-Agent': 'MapleSpike-Municipal/1.0 (+discover-municipal-ids)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return -1;
    const body = await resp.json();
    return Array.isArray(body) ? body.length : -1;
  } catch {
    return -1;
  }
}

// ---------------------------------------------------------------------------
// Bounded-concurrency probe pool. 8-wide keeps us under most portals'
// rate limits (every CKAN/Socrata portal we've seen is happy at 5/s).
//
// Why not just use httpGet from the package? That'd add the @maplespike
// package as a self-import (which pnpm doesn't allow) AND give us retries
// on transient 5xx — undesirable for a discovery script where a 404 /
// bot-block SHOULD be the immediate end of the probe, not a 30s backoff.

async function runWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function pump(): Promise<void> {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx]!);
    }
  }
  const pumps: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) pumps.push(pump());
  await Promise.all(pumps);
  return results;
}

interface Job {
  municipalityId: string;
  dataset: string;
  portalType: 'ckan' | 'socrata';
  baseUrl: string;
}

const main = async (): Promise<void> => {
  process.on('SIGINT', () => {
    console.error('\n⏹ interrupted while running discoveries');
    process.exit(130);
  });

  // Load MUNICIPAL_PORTALS at *function* scope so the top-level module
  // body stays synchronous. tsx under "module" output supports top-level
  // await but the "cjs" fallback does not — and we don't want the script
  // to fail mysteriously when a future Node upgrade flips the default.
  const MUNICIPAL_PORTALS = await loadMunicipalPortals();

  const registry = loadExistingRegistry();
  const beforeKeys = new Set(Object.keys(registry.entries));

  console.log(
    `[discover-municipal-ids] loaded existing registry with ${beforeKeys.size} entries from ${REGISTRY_PATH}`,
  );

  const jobs: Job[] = [];
  for (const [municipalityId, portal] of Object.entries(MUNICIPAL_PORTALS)) {
    if (portal.portalType !== 'ckan' && portal.portalType !== 'socrata') continue;
    for (const dataset of portal.datasets) {
      jobs.push({
        municipalityId,
        dataset,
        portalType: portal.portalType,
        baseUrl: portal.baseUrl,
      });
    }
  }
  console.log(`[discover-municipal-ids] probing ${jobs.length} (city, dataset) pairs at concurrency=8`);

  // Track which slots actually got discovered vs kept from previous run.
  const discovered: Array<{ key: string; entry: RegistryEntry } | { key: string; kept: true }> = [];
  // Candidates rejected by validation (#872) — surfaced in the summary so a
  // silent "kept previous value" is never mistaken for a clean run.
  const rejections: Array<{ key: string; name: string; reason: string }> = [];
  // Legacy entries written before validation existed are dropped when nothing
  // validates — "keep previous" must never preserve known-garbage (#872).
  const purged: string[] = [];

  await runWithConcurrency(
    jobs,
    async (job) => {
      const compositeKey = `${job.baseUrl}|${job.dataset}`;
      const candidates =
        job.portalType === 'ckan'
          ? await discoverCkan(job.baseUrl, job.dataset)
          : await discoverSocrata(job.baseUrl, job.dataset);

      // Walk the top candidates and take the FIRST one that validates
      // (#872): topic fit, plus live row presence on Socrata.
      let accepted: { candidate: Candidate; rowsProbed: number | null } | null = null;
      for (const candidate of candidates) {
        const rowsProbed =
          job.portalType === 'socrata' ? await probeSocrataRows(job.baseUrl, candidate.id) : null;
        const verdict = validateCandidate(job.dataset, candidate, rowsProbed, job.portalType);
        if (verdict.ok) {
          accepted = { candidate, rowsProbed };
          break;
        }
        rejections.push({ key: compositeKey, name: candidate.name, reason: verdict.reason });
        console.warn(
          `[discover-municipal-ids] REJECTED ${compositeKey} -> ${candidate.id} "${candidate.name}" (${verdict.reason})`,
        );
      }

      if (accepted) {
        discovered.push({
          key: compositeKey,
          entry: {
            id: accepted.candidate.id,
            portalType: job.portalType,
            discoveredAt: nowIso(),
            name: accepted.candidate.name,
            ...(accepted.rowsProbed === null ? {} : { rowsProbed: accepted.rowsProbed }),
            validated: true,
          },
        });
        return;
      }

      // Nothing validated: keep a previously-VALIDATED value, drop legacy
      // unvalidated entries so bad ids cannot survive a refresh.
      const existing = registry.entries[compositeKey];
      if (existing?.validated === true) {
        discovered.push({ key: compositeKey, kept: true });
      } else if (existing) {
        purged.push(compositeKey);
        console.warn(`[discover-municipal-ids] PURGED unvalidated legacy entry ${compositeKey} -> ${existing.id}`);
      }
    },
    8,
  );

  // Apply discoveries in a deterministic order.
  let newDiscoveries = 0;
  let kept = 0;
  for (const d of discovered) {
    if ('entry' in d) {
      registry.entries[d.key] = d.entry;
      newDiscoveries++;
    } else {
      kept++;
    }
  }

  for (const key of purged) {
    delete registry.entries[key];
  }

  registry.generatedAt = nowIso();
  registry.discoveries = newDiscoveries;
  registry.keptFromPrevious = kept;

  if (DRY_RUN) {
    console.log('[discover-municipal-ids] --dry-run: registry NOT written');
  } else {
    // Fail closed (#872 follow-up, 2026-09-22): a refresh must never replace a
    // good registry with one the gate would reject. The 21:06 run wrote 10
    // entries and THEN reported "registry validation: FAILED" — the file was
    // already overwritten. Now: write a temp candidate, run the SAME oracle the
    // gate runs, and only then move it into place.
    fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
    const tmp = `${REGISTRY_PATH}.candidate`;
    fs.writeFileSync(tmp, JSON.stringify(registry, null, 2) + '\n', 'utf8');
    const { spawnSync } = await import('node:child_process');
    const { fileURLToPath } = await import('node:url');
    const oracle = path.join(path.dirname(fileURLToPath(import.meta.url)), 'gates', 'check-registry.mjs');
    const verdict = spawnSync(process.execPath, [oracle, tmp], { encoding: 'utf8' });
    process.stdout.write(verdict.stdout ?? '');
    process.stderr.write(verdict.stderr ?? '');
    if (verdict.status !== 0) {
      fs.rmSync(tmp, { force: true });
      console.error(
        '[discover-municipal-ids] REFUSING to write: the refreshed registry failed the oracle — existing registry left unchanged',
      );
      process.exit(1);
    }
    fs.renameSync(tmp, REGISTRY_PATH);
  }

  console.log('');
  console.log('────────────── SUMMARY ──────────────');
  console.log(`[discover-municipal-ids] ${DRY_RUN ? 'DRY RUN — would write' : 'wrote registry to'} ${REGISTRY_PATH}`);
  console.log(`[discover-municipal-ids] new discoveries  : ${newDiscoveries}`);
  console.log(`[discover-municipal-ids] kept from previous: ${kept}`);
  console.log(`[discover-municipal-ids] total entries now : ${Object.keys(registry.entries).length}`);
  console.log(`[discover-municipal-ids] rejected candidates: ${rejections.length}`);
  console.log(`[discover-municipal-ids] purged legacy entries: ${purged.length}`);
  for (const r of rejections.slice(0, 20)) {
    console.log(`   - ${r.key} -> "${r.name}" (${r.reason})`);
  }
  console.log(`[discover-municipal-ids] jobs probed       : ${jobs.length}`);
  console.log('─────────────────────────────────────');
};

main().catch((e: unknown) => {
  console.error(
    `[discover-municipal-ids] unhandled error: ${e instanceof Error ? e.message : String(e)}`,
  );
  process.exit(1);
});
