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
}

interface Registry {
  schemaVersion: 1;
  generatedAt: string;
  source: 'discover-municipal-ids';
  discoveries: number;
  keptFromPrevious: number;
  entries: Record<string, RegistryEntry>;
}

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

async function discoverCkan(baseUrl: string, slug: string): Promise<string | null> {
  const url = `${baseUrl}/api/3/action/package_search?q=${encodeURIComponent(slug)}&rows=1`;
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'MapleSpike-Municipal/1.0 (+discover-municipal-ids)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return null;
    const body = (await resp.json()) as {
      result?: { results?: Array<{ id?: string; name?: string }> };
    };
    return body?.result?.results?.[0]?.id ?? body?.result?.results?.[0]?.name ?? null;
  } catch {
    return null;
  }
}

async function discoverSocrata(baseUrl: string, slug: string): Promise<string | null> {
  const url = `${baseUrl}/api/views.json?search=${encodeURIComponent(slug)}&limit=1`;
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'MapleSpike-Municipal/1.0 (+discover-municipal-ids)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return null;
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
    const top = flat[0] as { id?: string; name?: string } | undefined;
    return top?.id ?? top?.name ?? null;
  } catch {
    return null;
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

  await runWithConcurrency(
    jobs,
    async (job) => {
      const compositeKey = `${job.baseUrl}|${job.dataset}`;
      const id =
        job.portalType === 'ckan'
          ? await discoverCkan(job.baseUrl, job.dataset)
          : await discoverSocrata(job.baseUrl, job.dataset);
      if (id) {
        discovered.push({
          key: compositeKey,
          entry: {
            id,
            portalType: job.portalType,
            discoveredAt: nowIso(),
          },
        });
      } else {
        // null result: keep whatever was there before (or skip if absent).
        const existing = registry.entries[compositeKey];
        if (existing) {
          discovered.push({ key: compositeKey, kept: true });
        }
        // If no prior value and the probe returns null, we add NOTHING.
        // The next successful run can still discover it then.
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

  registry.generatedAt = nowIso();
  registry.discoveries = newDiscoveries;
  registry.keptFromPrevious = kept;

  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n', 'utf8');

  console.log('');
  console.log('────────────── SUMMARY ──────────────');
  console.log(`[discover-municipal-ids] wrote registry to ${REGISTRY_PATH}`);
  console.log(`[discover-municipal-ids] new discoveries  : ${newDiscoveries}`);
  console.log(`[discover-municipal-ids] kept from previous: ${kept}`);
  console.log(`[discover-municipal-ids] total entries now : ${Object.keys(registry.entries).length}`);
  console.log(`[discover-municipal-ids] jobs probed       : ${jobs.length}`);
  console.log('─────────────────────────────────────');
};

main().catch((e: unknown) => {
  console.error(
    `[discover-municipal-ids] unhandled error: ${e instanceof Error ? e.message : String(e)}`,
  );
  process.exit(1);
});
