/** Graph builder migration — reads entities from DB, builds graph, persists to graph_nodes/graph_edges */
import { createDb, runMigrations, getRawFromDb } from '@maplespike/database';
import { entities, entityAliases, graphNodes, graphEdges, intelligenceThreads, briefs } from '@maplespike/database/schema';
import { eq } from 'drizzle-orm';
import Database from 'better-sqlite3';
import { AliasManager } from '../../entity/aliases';
import { GraphBuilder } from '../builder';
import { runAllDetectors } from '../signals';
import { BriefGenerator } from '../../briefs/generator';
import type { DbClient } from '@maplespike/database';

function generateId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return 'g-' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function buildAndPersistGraph(db: DbClient, rawDb: Database.Database): Promise<void> {
  console.log('[graph/migration] Loading entities...');

  const aliasManager = new AliasManager(rawDb);
  const builder = new GraphBuilder(aliasManager);
  const briefGen = new BriefGenerator();

  // Load all entities from DB
  const allEntities = await db.select().from(entities);
  const allAliases = await db.select().from(entityAliases);
  console.log(`[graph/migration] Loaded ${allEntities.length} entities, ${allAliases.length} aliases`);

  // Build nodes from entities
  let nodeCount = 0;
  for (const entity of allEntities) {
    const meta = entity.metadata as Record<string, unknown>;
    builder.addNode({
      id: entity.id,
      type: entity.type === 'person' ? 'person' : 'organization',
      label: entity.canonicalName,
      properties: {
        canonicalName: entity.canonicalName,
        sources: meta.sources,
        province: meta.province,
        confidence: entity.confidence,
        aliases: allAliases
          .filter(a => a.entityId === entity.id)
          .map(a => a.alias),
      },
    });
    nodeCount++;
  }

  // Build edges from shared provinces — group by province to avoid O(N*M)
  const allOrgs = allEntities.filter(e => e.type === 'org');
  const allPersons = allEntities.filter(e => e.type === 'person');
  let edgeCount = 0;

  const orgsByProvince = new Map<string, typeof allOrgs>();
  for (const org of allOrgs) {
    const prov = ((org.metadata as Record<string, unknown>).province as string) || '';
    if (!prov) continue;
    if (!orgsByProvince.has(prov)) orgsByProvince.set(prov, []);
    orgsByProvince.get(prov)!.push(org);
  }

  const personsByProvince = new Map<string, typeof allPersons>();
  for (const person of allPersons) {
    const prov = ((person.metadata as Record<string, unknown>).province as string) || '';
    if (!prov) continue;
    if (!personsByProvince.has(prov)) personsByProvince.set(prov, []);
    personsByProvince.get(prov)!.push(person);
  }

  for (const [province, orgs] of orgsByProvince) {
    const persons = personsByProvince.get(province);
    if (!persons) continue;
    for (const org of orgs) {
      for (const person of persons) {
        builder.addEdge({
          id: generateId(),
          source: org.id,
          target: person.id,
          type: 'partnered_with',
          weight: 0.3,
          properties: { province, method: 'shared_province' },
          sourceRef: 'resolution',
        });
        edgeCount++;
      }
    }
  }

  console.log(`[graph/migration] Built ${nodeCount} nodes, ${edgeCount} edges`);

  // Persist nodes to DB
  const graphData = builder.getGraphData();
  console.log(`[graph/migration] Persisting ${graphData.nodes.length} nodes...`);
  for (const node of graphData.nodes) {
    await db.insert(graphNodes).values({
      id: node.id,
      type: node.type,
      label: node.label,
      properties: node.properties,
    }).onConflictDoNothing({ target: graphNodes.id });
  }

  console.log(`[graph/migration] Persisting ${graphData.edges.length} edges...`);
  for (const edge of graphData.edges) {
    await db.insert(graphEdges).values({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      weight: edge.weight,
      properties: edge.properties,
      sourceRef: edge.sourceRef,
    }).onConflictDoNothing({ target: graphEdges.id });
  }

  // Run signal detectors — use in-memory data since contract/filing APIs need pipeline data
  console.log('[graph/migration] Running signal detectors...');

  const threads = runAllDetectors([], [], [], [], [], [], [], [], aliasManager);
  console.log(`[graph/migration] Generated ${threads.length} signals`);

  // Persist intelligence threads
  for (const thread of threads) {
    await db.insert(intelligenceThreads).values({
      id: thread.id,
      title: thread.title,
      description: thread.description,
      signalType: thread.signalType,
      confidence: thread.confidence,
      nodes: thread.nodes,
      edges: thread.edges,
      sources: thread.sources,
    }).onConflictDoNothing({ target: intelligenceThreads.id });
  }

  // Generate and persist daily brief
  console.log('[graph/migration] Generating daily brief...');
  const dailyBrief = briefGen.generateDailyBrief(threads, graphData);

  await db.insert(briefs).values({
    id: dailyBrief.id,
    title: dailyBrief.title,
    summary: dailyBrief.summary,
    sections: dailyBrief.sections,
    entityIds: dailyBrief.entityIds,
    confidence: dailyBrief.confidence,
    generatedAt: dailyBrief.generatedAt,
    expiresAt: dailyBrief.expiresAt,
  }).onConflictDoNothing({ target: briefs.id });

  console.log(`[graph/migration] Brief: "${dailyBrief.title}" — ${dailyBrief.summary}`);
  console.log('[graph/migration] Graph build complete.');
}

async function main(): Promise<void> {
  const dbPath = process.env.MAPLESPIKE_DB_PATH || './data/maplespike.db';
  console.log(`[graph/migration] Using database: ${dbPath}`);

  const db = createDb(dbPath);
  const rawDb = getRawFromDb(db);
  runMigrations(db);

  await buildAndPersistGraph(db, rawDb);
}

const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMainModule) main();
