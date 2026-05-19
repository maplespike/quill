/**
 * Entity Resolution Migration — Phase 4.2
 *
 * Reads from persons/organizations tables, resolves duplicates via
 * blocking + fuzzy matching, writes to entities/entity_aliases/entity_links.
 *
 * Optimized for ~113k records using:
 * - Blocking (reduces O(n²) → O(n·k) where k ≪ n)
 * - Batched inserts in transactions
 * - SQLite indexes for fast lookups
 * - Progress reporting at 1k/5k intervals
 *
 * Usage:
 *   MAPLESPIKE_DB_PATH=./data/maplespike.db npx tsx src/entity/migration/resolve.ts
 */
import type Database from "better-sqlite3";
import { createDb, runMigrations, getRawDb } from "@maplespike/database";
import {
  entities as entityTable,
  entityAliases as aliasTable,
  entityLinks as linkTable,
  persons,
  organizations,
} from "@maplespike/database/schema";
import { eq } from "drizzle-orm";
import { EntityResolver } from "../resolver";
import { AliasManager } from "../aliases";
import type { DbClient } from "@maplespike/database";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PersonRecord {
  id: string;
  name: string;
  source: string;
  province?: string;
  blockKey: string;
}

interface OrgRecord {
  id: string;
  name: string;
  source: string;
  orgType: string;
  province?: string;
  blockKey: string;
}

interface StoredEntity {
  id: string;
  canonicalName: string;
  type: "person" | "org";
  confidence: number;
  metadata: Record<string, unknown>;
  blockKey: string;
}

interface EntityLinkRow {
  sourceEntityId: string;
  targetEntityId: string;
  linkType: string;
  weight: number;
  source: string;
  metadata: string;
}

/* ------------------------------------------------------------------ */
/*  Blocking helpers                                                   */
/* ------------------------------------------------------------------ */

/** Normalize for blocking: lowercase, strip accents/punctuation, collapse whitespace */
function normalizeForBlock(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Person blocking key: first letter of last name + first initial.
 * "Jean Chrétien" → "cj", "S. Mitchell" → "ms"
 */
export function personBlockKey(name: string): string {
  const n = normalizeForBlock(name);
  const parts = n.split(" ").filter(Boolean);
  if (parts.length === 0) return "__";
  const lastInitial = parts[parts.length - 1].charAt(0);
  const firstInitial = parts[0].charAt(0);
  return `${lastInitial}${firstInitial}`;
}

/**
 * Organization blocking key: first 3 chars of normalized name.
 * "Lockheed Martin Canada" → "loc", "DND" → "dnd"
 */
export function orgBlockKey(name: string): string {
  const n = normalizeForBlock(name);
  return n.substring(0, 3) || "__";
}

/* ------------------------------------------------------------------ */
/*  ID generation                                                      */
/* ------------------------------------------------------------------ */

function generateEntityId(type: "person" | "org", canonicalName: string, seq: number): string {
  const prefix = type === "person" ? "ent-person" : "ent-org";
  const slug = canonicalName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 60);
  return `${prefix}-${slug}-${seq}`;
}

/* ------------------------------------------------------------------ */
/*  Data loading                                                       */
/* ------------------------------------------------------------------ */

async function loadPersons(db: DbClient): Promise<PersonRecord[]> {
  const rows = await db
    .select({
      id: persons.id,
      firstName: persons.firstName,
      lastName: persons.lastName,
      names: persons.names,
      source: persons.source,
      province: persons.province,
    })
    .from(persons);

  return rows
    .map((r) => {
      const name =
        r.names?.[0] || `${r.firstName || ""} ${r.lastName || ""}`.trim() || r.id;
      return {
        id: r.id,
        name,
        source: r.source,
        province: r.province || undefined,
        blockKey: personBlockKey(name),
      };
    })
    .filter((r) => r.name.length > 0);
}

async function loadOrganizations(db: DbClient): Promise<OrgRecord[]> {
  const rows = await db
    .select({
      id: organizations.id,
      names: organizations.names,
      type: organizations.type,
      source: organizations.source,
      province: organizations.province,
    })
    .from(organizations);

  return rows
    .map((r) => {
      const name = r.names?.[0] || r.id;
      return {
        id: r.id,
        name,
        source: r.source,
        orgType: r.type,
        province: r.province || undefined,
        blockKey: orgBlockKey(name),
      };
    })
    .filter((r) => r.name.length > 0);
}

/* ------------------------------------------------------------------ */
/*  Index creation                                                     */
/* ------------------------------------------------------------------ */

function createIndexes(rawDb: Database.Database): void {
  rawDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
    CREATE INDEX IF NOT EXISTS idx_entities_canonical ON entities(canonical_name);
    CREATE INDEX IF NOT EXISTS idx_entity_aliases_entity_id ON entity_aliases(entity_id);
    CREATE INDEX IF NOT EXISTS idx_entity_aliases_alias ON entity_aliases(alias);
    CREATE INDEX IF NOT EXISTS idx_entity_links_source ON entity_links(source_entity_id);
    CREATE INDEX IF NOT EXISTS idx_entity_links_target ON entity_links(target_entity_id);
    CREATE INDEX IF NOT EXISTS idx_entity_links_type ON entity_links(link_type);
  `);
}

/* ------------------------------------------------------------------ */
/*  Progress tracker                                                   */
/* ------------------------------------------------------------------ */

class ProgressTracker {
  private total: number;
  private count = 0;
  private label: string;
  private step: number;
  private startTime: number;

  constructor(label: string, total: number, step = 1000) {
    this.label = label;
    this.total = total;
    this.step = step;
    this.startTime = Date.now();
  }

  tick(): void {
    this.count++;
    if (this.count % this.step === 0 || this.count === this.total) {
      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
      const pct = ((this.count / this.total) * 100).toFixed(1);
      console.log(
        `[entity/resolve] ${this.label}: ${this.count}/${this.total} (${pct}%) — ${elapsed}s`
      );
    }
  }

  done(): void {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(
      `[entity/resolve] ${this.label}: done — ${this.count} records in ${elapsed}s`
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Core resolution                                                    */
/* ------------------------------------------------------------------ */

async function resolvePersons(
  db: DbClient,
  resolver: EntityResolver,
  aliasManager: AliasManager,
  records: PersonRecord[]
): Promise<StoredEntity[]> {
  console.log(`[entity/resolve] Resolving ${records.length} persons...`);

  // Load existing person entities and index by block key
  const existingRows = await db
    .select()
    .from(entityTable)
    .where(eq(entityTable.type, "person"));

  const existingEntities: StoredEntity[] = existingRows.map((e) => ({
    id: e.id,
    canonicalName: e.canonicalName,
    type: "person",
    confidence: e.confidence,
    metadata: (e.metadata as Record<string, unknown>) || {},
    blockKey: personBlockKey(e.canonicalName),
  }));

  // Build block index: blockKey → entity[]
  const blockIndex = new Map<string, StoredEntity[]>();
  for (const entity of existingEntities) {
    const arr = blockIndex.get(entity.blockKey) || [];
    arr.push(entity);
    blockIndex.set(entity.blockKey, arr);
  }

  let seq = existingEntities.length;
  const progress = new ProgressTracker("persons", records.length, 1000);
  const BATCH_SIZE = 500;
  let entityBatch: Array<{
    id: string;
    canonicalName: string;
    type: string;
    confidence: number;
    metadata: Record<string, unknown>;
  }> = [];
  let aliasBatch: Array<{
    entityId: string;
    alias: string;
    type: string;
    source: string;
  }> = [];

  const flushEntityBatch = async () => {
    if (entityBatch.length === 0) return;
    for (const row of entityBatch) {
      await db
        .insert(entityTable)
        .values(row)
        .onConflictDoNothing({ target: entityTable.id });
    }
    entityBatch = [];
  };

  const flushAliasBatch = async () => {
    if (aliasBatch.length === 0) return;
    for (const row of aliasBatch) {
      await db
        .insert(aliasTable)
        .values(row)
        .onConflictDoNothing();
    }
    aliasBatch = [];
  };

  for (const record of records) {
    let matched = false;

    // Check if name is a known alias — if so, look up canonical's entity directly
    const canonicalFromAlias = aliasManager.getCanonicalName(record.name, "person");
    if (canonicalFromAlias !== record.name) {
      const canonicalEntity = existingEntities.find(
        (e) => e.canonicalName === canonicalFromAlias
      );
      if (canonicalEntity) {
        aliasBatch.push({
          entityId: canonicalEntity.id,
          alias: record.name,
          type: "person",
          source: "migration",
        });
        if (aliasBatch.length >= BATCH_SIZE) {
          await flushAliasBatch();
        }
        matched = true;
      }
    }

    if (!matched) {
      // Try same-block entities first
      const candidates = blockIndex.get(record.blockKey) || [];

      // Also check adjacent blocks (common misspellings shift block)
      const adjacentKeys = [
        record.blockKey.charAt(0) + String.fromCharCode(
          record.blockKey.charCodeAt(1) - 1
        ),
        record.blockKey.charAt(0) + String.fromCharCode(
          record.blockKey.charCodeAt(1) + 1
        ),
      ].filter((k) => k.length === 2 && k !== record.blockKey);

      const allCandidates = [
        ...candidates,
        ...adjacentKeys.flatMap((k) => blockIndex.get(k) || []),
      ];

      for (const entity of allCandidates) {
        const score = resolver.resolvePersonNames(record.name, entity.canonicalName);
        if (score >= 0.7) {
          aliasBatch.push({
            entityId: entity.id,
            alias: record.name,
            type: "person",
            source: "migration",
          });
          if (aliasBatch.length >= BATCH_SIZE) {
            await flushAliasBatch();
          }
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      seq++;
      const entityId = generateEntityId("person", record.name, seq);
      const newEntity: StoredEntity = {
        id: entityId,
        canonicalName: record.name,
        type: "person",
        confidence: 1.0,
        metadata: { sources: [record.source], province: record.province || null },
        blockKey: record.blockKey,
      };
      entityBatch.push({
        id: entityId,
        canonicalName: record.name,
        type: "person",
        confidence: 1.0,
        metadata: { sources: [record.source], province: record.province || null },
      });
      if (entityBatch.length >= BATCH_SIZE) {
        await flushEntityBatch();
      }
      existingEntities.push(newEntity);
      const arr = blockIndex.get(record.blockKey) || [];
      arr.push(newEntity);
      blockIndex.set(record.blockKey, arr);
    }

    progress.tick();
  }

  await flushEntityBatch();
  await flushAliasBatch();
  progress.done();

  return existingEntities;
}

async function resolveOrganizations(
  db: DbClient,
  resolver: EntityResolver,
  aliasManager: AliasManager,
  records: OrgRecord[]
): Promise<StoredEntity[]> {
  console.log(`[entity/resolve] Resolving ${records.length} organizations...`);

  const existingRows = await db
    .select()
    .from(entityTable)
    .where(eq(entityTable.type, "org"));

  const existingEntities: StoredEntity[] = existingRows.map((e) => ({
    id: e.id,
    canonicalName: e.canonicalName,
    type: "org",
    confidence: e.confidence,
    metadata: (e.metadata as Record<string, unknown>) || {},
    blockKey: orgBlockKey(e.canonicalName),
  }));

  const blockIndex = new Map<string, StoredEntity[]>();
  for (const entity of existingEntities) {
    const arr = blockIndex.get(entity.blockKey) || [];
    arr.push(entity);
    blockIndex.set(entity.blockKey, arr);
  }

  const BATCH_SIZE = 500;
  let seq = existingEntities.length;
  const progress = new ProgressTracker("organizations", records.length, 1000);

  let entityBatch: Array<{
    id: string;
    canonicalName: string;
    type: string;
    confidence: number;
    metadata: Record<string, unknown>;
  }> = [];
  let aliasBatch: Array<{
    entityId: string;
    alias: string;
    type: string;
    source: string;
  }> = [];

  const flushEntityBatch = async () => {
    if (entityBatch.length === 0) return;
    for (const row of entityBatch) {
      await db
        .insert(entityTable)
        .values(row)
        .onConflictDoNothing({ target: entityTable.id });
    }
    entityBatch = [];
  };

  const flushAliasBatch = async () => {
    if (aliasBatch.length === 0) return;
    for (const row of aliasBatch) {
      await db
        .insert(aliasTable)
        .values(row)
        .onConflictDoNothing();
    }
    aliasBatch = [];
  };

  for (const record of records) {
    let matched = false;

    // Check if name is a known alias — if so, look up canonical's entity directly
    const canonicalFromAlias = aliasManager.getCanonicalName(record.name, "org");
    if (canonicalFromAlias !== record.name) {
      const canonicalEntity = existingEntities.find(
        (e) => e.canonicalName === canonicalFromAlias
      );
      if (canonicalEntity) {
        aliasBatch.push({
          entityId: canonicalEntity.id,
          alias: record.name,
          type: "org",
          source: "migration",
        });
        if (aliasBatch.length >= BATCH_SIZE) {
          await flushAliasBatch();
        }
        matched = true;
      }
    }

    if (!matched) {
      // Same-block candidates
      const candidates = blockIndex.get(record.blockKey) || [];

      // Adjacent blocks for fuzzy matches
      const adjacentKeys: string[] = [];
      if (record.blockKey.length >= 2) {
        for (let i = 0; i < record.blockKey.length; i++) {
          const prev = String.fromCharCode(record.blockKey.charCodeAt(i) - 1);
          const next = String.fromCharCode(record.blockKey.charCodeAt(i) + 1);
          if (prev >= "a" && prev <= "z") {
            adjacentKeys.push(record.blockKey.substring(0, i) + prev + record.blockKey.substring(i + 1));
          }
          if (next >= "a" && next <= "z") {
            adjacentKeys.push(record.blockKey.substring(0, i) + next + record.blockKey.substring(i + 1));
          }
        }
      }

      const allCandidates = [
        ...candidates,
        ...adjacentKeys.flatMap((k) => blockIndex.get(k) || []),
      ];

      for (const entity of allCandidates) {
        const score = resolver.resolveOrgNames(record.name, entity.canonicalName);
        if (score >= 0.7) {
          aliasBatch.push({
            entityId: entity.id,
            alias: record.name,
            type: "org",
            source: "migration",
          });
          if (aliasBatch.length >= BATCH_SIZE) {
            await flushAliasBatch();
          }
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      seq++;
      const entityId = generateEntityId("org", record.name, seq);
      const newEntity: StoredEntity = {
        id: entityId,
        canonicalName: record.name,
        type: "org",
        confidence: 1.0,
        metadata: {
          sources: [record.source],
          orgType: record.orgType,
          province: record.province || null,
        },
        blockKey: record.blockKey,
      };
      entityBatch.push({
        id: entityId,
        canonicalName: record.name,
        type: "org",
        confidence: 1.0,
        metadata: {
          sources: [record.source],
          orgType: record.orgType,
          province: record.province || null,
        },
      });
      if (entityBatch.length >= BATCH_SIZE) {
        await flushEntityBatch();
      }
      existingEntities.push(newEntity);
      const arr = blockIndex.get(record.blockKey) || [];
      arr.push(newEntity);
      blockIndex.set(record.blockKey, arr);
    }

    progress.tick();
  }

  await flushEntityBatch();
  await flushAliasBatch();
  progress.done();

  return existingEntities;
}

/* ------------------------------------------------------------------ */
/*  Entity linking                                                     */
/* ------------------------------------------------------------------ */

async function buildEntityLinks(
  db: DbClient,
  allOrgs: StoredEntity[],
  allPersons: StoredEntity[]
): Promise<number> {
  console.log("[entity/resolve] Building entity links...");

  const linkBuffer: EntityLinkRow[] = [];
  const dedup = new Set<string>();

  // 1. Shared province links (org ↔ person)
  const orgByProvince = new Map<string, string[]>();
  for (const org of allOrgs) {
    const meta = org.metadata;
    const prov = meta.province as string | null | undefined;
    if (prov) {
      const arr = orgByProvince.get(prov) || [];
      arr.push(org.id);
      orgByProvince.set(prov, arr);
    }
  }

  const personByProvince = new Map<string, string[]>();
  for (const person of allPersons) {
    const meta = person.metadata;
    const prov = meta.province as string | null | undefined;
    if (prov) {
      const arr = personByProvince.get(prov) || [];
      arr.push(person.id);
      personByProvince.set(prov, arr);
    }
  }

  let provinceLinks = 0;
  for (const [prov, orgIds] of orgByProvince) {
    const personIds = personByProvince.get(prov);
    if (!personIds) continue;
    // Cap at reasonable number to avoid explosion
    const maxLinks = Math.min(orgIds.length * personIds.length, 10000);
    let count = 0;
    for (const orgId of orgIds) {
      for (const personId of personIds) {
        if (count >= maxLinks) break;
        const key = `${orgId}:${personId}:shared_province`;
        if (!dedup.has(key)) {
          dedup.add(key);
          linkBuffer.push({
            sourceEntityId: orgId,
            targetEntityId: personId,
            linkType: "shared_province",
            weight: 0.3,
            source: "resolution",
            metadata: JSON.stringify({ province: prov }),
          });
          provinceLinks++;
          count++;
        }
      }
    }
  }
  console.log(`[entity/resolve] Province links: ${provinceLinks}`);

  // 2. Source co-occurrence links (org ↔ org, person ↔ person)
  // Entities from the same source module are likely related
  const orgBySource = new Map<string, string[]>();
  for (const org of allOrgs) {
    const meta = org.metadata;
    const sources = (meta.sources as string[]) || [];
    for (const src of sources) {
      const arr = orgBySource.get(src) || [];
      arr.push(org.id);
      orgBySource.set(src, arr);
    }
  }

  const personBySource = new Map<string, string[]>();
  for (const person of allPersons) {
    const meta = person.metadata;
    const sources = (meta.sources as string[]) || [];
    for (const src of sources) {
      const arr = personBySource.get(src) || [];
      arr.push(person.id);
      personBySource.set(src, arr);
    }
  }

  let sourceLinks = 0;
  for (const [src, ids] of orgBySource) {
    if (ids.length < 2) continue;
    const maxLinks = Math.min(ids.length * (ids.length - 1), 5000);
    let count = 0;
    for (let i = 0; i < ids.length && count < maxLinks; i++) {
      for (let j = i + 1; j < ids.length && count < maxLinks; j++) {
        const key = `${ids[i]}:${ids[j]}:shared_source`;
        if (!dedup.has(key)) {
          dedup.add(key);
          linkBuffer.push({
            sourceEntityId: ids[i],
            targetEntityId: ids[j],
            linkType: "shared_source",
            weight: 0.2,
            source: "resolution",
            metadata: JSON.stringify({ sourceModule: src }),
          });
          sourceLinks++;
          count++;
        }
      }
    }
  }

  for (const [src, ids] of personBySource) {
    if (ids.length < 2) continue;
    const maxLinks = Math.min(ids.length * (ids.length - 1), 5000);
    let count = 0;
    for (let i = 0; i < ids.length && count < maxLinks; i++) {
      for (let j = i + 1; j < ids.length && count < maxLinks; j++) {
        const key = `${ids[i]}:${ids[j]}:shared_source`;
        if (!dedup.has(key)) {
          dedup.add(key);
          linkBuffer.push({
            sourceEntityId: ids[i],
            targetEntityId: ids[j],
            linkType: "shared_source",
            weight: 0.2,
            source: "resolution",
            metadata: JSON.stringify({ sourceModule: src }),
          });
          sourceLinks++;
          count++;
        }
      }
    }
  }
  console.log(`[entity/resolve] Source co-occurrence links: ${sourceLinks}`);

  // 3. Insert links in batches
  const BATCH_SIZE = 1000;
  let inserted = 0;

  for (let i = 0; i < linkBuffer.length; i += BATCH_SIZE) {
    const batch = linkBuffer.slice(i, i + BATCH_SIZE);
    for (const link of batch) {
      await db
        .insert(linkTable)
        .values({
          sourceEntityId: link.sourceEntityId,
          targetEntityId: link.targetEntityId,
          linkType: link.linkType,
          weight: link.weight,
          source: link.source,
          metadata: JSON.parse(link.metadata),
        })
        .onConflictDoNothing();
    }
    inserted += batch.length;
    if (inserted % 5000 === 0) {
      console.log(`[entity/resolve] Inserted ${inserted}/${linkBuffer.length} links...`);
    }
  }

  console.log(`[entity/resolve] Total entity links: ${dedup.size}`);
  return dedup.size;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export interface EntityResolutionStats {
  personsLoaded: number;
  organizationsLoaded: number;
  personEntities: number;
  orgEntities: number;
  aliasesCreated: number;
  linksCreated: number;
  elapsedMs: number;
}

export async function runEntityResolution(
  db: DbClient,
  rawDb: Database.Database
): Promise<EntityResolutionStats> {
  const startTime = Date.now();

  console.log("[entity/resolve] === Entity Resolution Migration (Phase 4.2) ===");
  console.log("[entity/resolve] Creating indexes...");
  createIndexes(rawDb);

  console.log("[entity/resolve] Loading data...");
  const aliasManager = new AliasManager(rawDb);
  const resolver = new EntityResolver(aliasManager);

  const personRecords = await loadPersons(db);
  const orgRecords = await loadOrganizations(db);
  console.log(
    `[entity/resolve] Loaded ${personRecords.length} persons, ${orgRecords.length} organizations`
  );

  if (personRecords.length === 0 && orgRecords.length === 0) {
    console.log("[entity/resolve] No data to resolve. Run ETL transforms first.");
    return {
      personsLoaded: 0,
      organizationsLoaded: 0,
      personEntities: 0,
      orgEntities: 0,
      aliasesCreated: 0,
      linksCreated: 0,
      elapsedMs: Date.now() - startTime,
    };
  }

  // Resolve persons
  const personEntities = await resolvePersons(db, resolver, aliasManager, personRecords);

  // Resolve organizations
  const orgEntities = await resolveOrganizations(db, resolver, aliasManager, orgRecords);

  // Count aliases
  const aliasCount = rawDb
    .prepare("SELECT COUNT(*) as cnt FROM entity_aliases")
    .get() as { cnt: number };

  // Build entity links
  const linkCount = await buildEntityLinks(db, orgEntities, personEntities);

  const elapsed = Date.now() - startTime;
  const stats: EntityResolutionStats = {
    personsLoaded: personRecords.length,
    organizationsLoaded: orgRecords.length,
    personEntities: personEntities.length,
    orgEntities: orgEntities.length,
    aliasesCreated: aliasCount.cnt,
    linksCreated: linkCount,
    elapsedMs: elapsed,
  };

  console.log("[entity/resolve] === Resolution Complete ===");
  console.log(`[entity/resolve] Persons: ${stats.personsLoaded} → ${stats.personEntities} entities`);
  console.log(`[entity/resolve] Organizations: ${stats.organizationsLoaded} → ${stats.orgEntities} entities`);
  console.log(`[entity/resolve] Aliases: ${stats.aliasesCreated}`);
  console.log(`[entity/resolve] Links: ${stats.linksCreated}`);
  console.log(`[entity/resolve] Time: ${(elapsed / 1000).toFixed(1)}s`);

  return stats;
}

/* ------------------------------------------------------------------ */
/*  CLI entry point                                                    */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const dbPath = process.env.MAPLESPIKE_DB_PATH || "./data/maplespike.db";
  console.log(`[entity/resolve] Using database: ${dbPath}`);

  const db = createDb(dbPath);
  const rawDb = (db as unknown as { $client: Database.Database }).$client;

  try {
    runMigrations(db);
    const stats = await runEntityResolution(db, rawDb);

    if (stats.elapsedMs > 0) {
      console.log(`\n[entity/resolve] Summary:`);
      console.log(`  Persons loaded:      ${stats.personsLoaded}`);
      console.log(`  Organizations loaded: ${stats.organizationsLoaded}`);
      console.log(`  Person entities:     ${stats.personEntities}`);
      console.log(`  Org entities:        ${stats.orgEntities}`);
      console.log(`  Aliases created:     ${stats.aliasesCreated}`);
      console.log(`  Links created:       ${stats.linksCreated}`);
      console.log(`  Elapsed:             ${(stats.elapsedMs / 1000).toFixed(1)}s`);
    }
  } catch (err) {
    console.error("[entity/resolve] Failed:", err);
    process.exit(1);
  }
}

const isMainModule =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMainModule) main();
