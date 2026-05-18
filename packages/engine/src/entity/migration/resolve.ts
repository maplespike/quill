/** Entity resolution migration - reads persons/orgs, resolves, writes entities/aliases/links */
import type Database from "better-sqlite3";
import { createDb, runMigrations, getRawDb } from '@maplespike/database';
import { entities as entityTable, entityAliases as aliasTable, entityLinks as linkTable, persons, organizations } from '@maplespike/database/schema';
import { eq } from 'drizzle-orm';
import { EntityResolver } from '../resolver';
import { AliasManager } from '../aliases';
import type { DbClient } from '@maplespike/database';

interface PersonRecord {
  id: string;
  name: string;
  source: string;
  province?: string;
}

interface OrgRecord {
  id: string;
  name: string;
  source: string;
  orgType: string;
  province?: string;
}

interface EntityLink {
  sourceEntityId: string;
  targetEntityId: string;
  linkType: string;
  weight: number;
  source: string;
  metadata: Record<string, unknown>;
}

async function loadPersons(db: DbClient): Promise<PersonRecord[]> {
  const rows = await db.select({
    id: persons.id,
    firstName: persons.firstName,
    lastName: persons.lastName,
    names: persons.names,
    source: persons.source,
    province: persons.province,
  }).from(persons);

  return rows.map((r) => ({
    id: r.id,
    name: r.names?.[0] || `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.id,
    source: r.source,
    province: r.province || undefined,
  })).filter((r) => r.name.length > 0);
}

async function loadOrganizations(db: DbClient): Promise<OrgRecord[]> {
  const rows = await db.select({
    id: organizations.id,
    names: organizations.names,
    type: organizations.type,
    source: organizations.source,
    province: organizations.province,
  }).from(organizations);

  return rows.map((r) => ({
    id: r.id,
    name: r.names?.[0] || r.id,
    source: r.source,
    orgType: r.type,
    province: r.province || undefined,
  })).filter((r) => r.name.length > 0);
}

function generateEntityId(type: 'person' | 'org', canonicalName: string): string {
  const prefix = type === 'person' ? 'ent-person' : 'ent-org';
  const slug = canonicalName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${prefix}-${slug}`;
}

export async function runEntityResolution(db: DbClient, rawDb: Database.Database): Promise<void> {
  console.log('[entity/resolve] Loading data...');

  const aliasManager = new AliasManager(rawDb);
  const resolver = new EntityResolver(aliasManager);

  const personRecords = await loadPersons(db);
  const orgRecords = await loadOrganizations(db);
  console.log(`[entity/resolve] Loaded ${personRecords.length} persons, ${orgRecords.length} organizations`);

  const linkBuffer: EntityLink[] = [];

  {
    console.log('[entity/resolve] Resolving persons...');
    const existingPersons = await db.select()
      .from(entityTable)
      .where(eq(entityTable.type, 'person'));
    const personEntities = [...existingPersons];
    for (const person of personRecords) {
      let matched = false;
      for (const entity of personEntities) {
        const score = resolver.resolvePersonNames(person.name, entity.canonicalName);
        if (score >= 0.7) {
          await db.insert(aliasTable).values({
            entityId: entity.id,
            alias: person.name,
            type: 'person',
            source: 'migration',
          }).onConflictDoNothing({ target: aliasTable.id });
          matched = true;
          break;
        }
      }
      if (!matched) {
        const entityId = generateEntityId('person', person.name);
        await db.insert(entityTable).values({
          id: entityId,
          canonicalName: person.name,
          type: 'person',
          confidence: 1.0,
          metadata: { sources: [person.source], province: person.province || null },
        }).onConflictDoNothing({ target: entityTable.id });
        personEntities.push({ id: entityId, canonicalName: person.name, type: 'person', confidence: 1.0, metadata: {}, createdAt: '', updatedAt: '' });
      }
    }
  }

  {
    console.log('[entity/resolve] Resolving organizations...');
    const existingOrgs = await db.select()
      .from(entityTable)
      .where(eq(entityTable.type, 'org'));
    const orgEntities = [...existingOrgs];
    for (const org of orgRecords) {
      let matched = false;
      for (const entity of orgEntities) {
        const score = resolver.resolveOrgNames(org.name, entity.canonicalName);
        if (score >= 0.7) {
          await db.insert(aliasTable).values({
            entityId: entity.id,
            alias: org.name,
            type: 'org',
            source: 'migration',
          }).onConflictDoNothing({ target: aliasTable.id });
          matched = true;
          break;
        }
      }
      if (!matched) {
        const entityId = generateEntityId('org', org.name);
        await db.insert(entityTable).values({
          id: entityId,
          canonicalName: org.name,
          type: 'org',
          confidence: 1.0,
          metadata: { sources: [org.source], orgType: org.orgType, province: org.province || null },
        }).onConflictDoNothing({ target: entityTable.id });
        orgEntities.push({ id: entityId, canonicalName: org.name, type: 'org', confidence: 1.0, metadata: {}, createdAt: '', updatedAt: '' });
      }
    }
  }

  {
    console.log('[entity/resolve] Building entity links...');
    const allOrgs = await db.select()
      .from(entityTable)
      .where(eq(entityTable.type, 'org'));

    const allPersons = await db.select()
      .from(entityTable)
      .where(eq(entityTable.type, 'person'));

    for (const org of allOrgs) {
      const orgMeta = org.metadata as Record<string, unknown>;
      for (const person of allPersons) {
        const personMeta = person.metadata as Record<string, unknown>;
        if (orgMeta.province && personMeta.province && orgMeta.province === personMeta.province) {
          linkBuffer.push({
            sourceEntityId: org.id,
            targetEntityId: person.id,
            linkType: 'shared_province',
            weight: 0.3,
            source: 'resolution',
            metadata: { province: orgMeta.province },
          });
        }
      }
    }

    const dedup = new Map<string, EntityLink>();
    for (const link of linkBuffer) {
      const key = `${link.sourceEntityId}:${link.targetEntityId}:${link.linkType}`;
      if (!dedup.has(key)) dedup.set(key, link);
    }

    for (const link of dedup.values()) {
      await db.insert(linkTable).values({
        sourceEntityId: link.sourceEntityId,
        targetEntityId: link.targetEntityId,
        linkType: link.linkType,
        weight: link.weight,
        source: link.source,
        metadata: link.metadata,
      }).onConflictDoNothing({ target: linkTable.id });
    }

    console.log(`[entity/resolve] Created ${dedup.size} entity links`);
  }

  console.log('[entity/resolve] Resolution complete.');
}

async function main(): Promise<void> {
  const dbPath = process.env.MAPLESPIKE_DB_PATH || './data/maplespike.db';
  console.log(`[entity/resolve] Using database: ${dbPath}`);

  const db = createDb(dbPath);
  const rawDb = getRawDb();

  try {
    runMigrations(db);
    await runEntityResolution(db, rawDb);
  } catch (err) {
    console.error('[entity/resolve] Failed:', err);
    process.exit(1);
  }
}

// Only run when executed directly (not when imported in tests)
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMainModule) main();
