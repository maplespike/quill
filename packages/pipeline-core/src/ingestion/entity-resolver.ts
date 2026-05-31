/**
 * Automated Entity Resolution — Links people and organizations across data sources during ingestion.
 *
 * Uses fuzzy name matching against known entities from committees, lobbying, GIC,
 * corporate filings, and procurement data.
 */

export interface ResolvedEntity {
  id: string;
  name: string;
  type: 'person' | 'organization';
  source: string;
  confidence: number;
  aliases: string[];
}

export interface MatchResult {
  entity: ResolvedEntity | null;
  input: string;
  matches: Array<{ entity: ResolvedEntity; score: number }>;
}

const KNOWN_ENTITIES: ResolvedEntity[] = [];
const entityIndex = new Map<string, ResolvedEntity[]>();

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim();
}

function tokenize(name: string): string[] {
  return normalize(name).split(/\s+/).filter(Boolean);
}

function diceSimilarity(a: string, b: string): number {
  const aTokens = new Set(tokenize(a));
  const bTokens = tokenize(b);
  if (aTokens.size === 0 || bTokens.length === 0) return 0;
  let intersection = 0;
  for (const t of bTokens) { if (aTokens.has(t)) intersection++; }
  return (2 * intersection) / (aTokens.size + bTokens.length);
}

export function registerEntity(entity: ResolvedEntity): void {
  KNOWN_ENTITIES.push(entity);
  const key = normalize(entity.name);
  if (!entityIndex.has(key)) entityIndex.set(key, []);
  entityIndex.get(key)!.push(entity);
  for (const alias of entity.aliases) {
    const aliasKey = normalize(alias);
    if (!entityIndex.has(aliasKey)) entityIndex.set(aliasKey, []);
    entityIndex.get(aliasKey)!.push(entity);
  }
}

export function seedKnownEntities(): void {
  const seedData: ResolvedEntity[] = [
    { id: 'org-lobbycanada', name: 'LobbyCanada', type: 'organization', source: 'registry', confidence: 1, aliases: ['lobbycanada.gc.ca', 'OCL'] },
    { id: 'org-opencanada', name: 'open.canada.ca', type: 'organization', source: 'registry', confidence: 1, aliases: ['ouvert.canada.ca', 'Open Data Portal'] },
    { id: 'org-canadabuys', name: 'CanadaBuys', type: 'organization', source: 'registry', confidence: 1, aliases: ['canadabuys.canada.ca', 'BuyAndSell'] },
    { id: 'org-statcan', name: 'Statistics Canada', type: 'organization', source: 'registry', confidence: 1, aliases: ['StatCan', 'statcan.gc.ca'] },
    { id: 'org-ourcommons', name: 'House of Commons', type: 'organization', source: 'registry', confidence: 1, aliases: ['ourcommons.ca', 'Parliament'] },
    { id: 'org-sencanada', name: 'Senate of Canada', type: 'organization', source: 'registry', confidence: 1, aliases: ['sencanada.ca', 'Senate'] },
    { id: 'org-canlii', name: 'CanLII', type: 'organization', source: 'registry', confidence: 1, aliases: ['canlii.org', 'Canadian Legal Information Institute'] },
    { id: 'org-gazette', name: 'Canada Gazette', type: 'organization', source: 'registry', confidence: 1, aliases: ['gazette.gc.ca'] },
    { id: 'person-pm', name: 'Prime Minister of Canada', type: 'person', source: 'registry', confidence: 1, aliases: ['PM', 'Premier ministre'] },
  ];
  for (const e of seedData) registerEntity(e);
}

// Auto-seed on import
seedKnownEntities();

export function resolveEntity(input: string, threshold = 0.4): MatchResult {
  const inputKey = normalize(input);
  const candidates: Array<{ entity: ResolvedEntity; score: number }> = [];

  // Direct index lookup
  const exact = entityIndex.get(inputKey);
  if (exact) {
    for (const e of exact) candidates.push({ entity: e, score: 1 });
  }

  // Fuzzy match against all entities
  for (const entity of KNOWN_ENTITIES) {
    if (candidates.some(c => c.entity.id === entity.id)) continue;
    const score = diceSimilarity(input, entity.name);
    if (score >= threshold) candidates.push({ entity, score });
    for (const alias of entity.aliases) {
      const aliasScore = diceSimilarity(input, alias);
      if (aliasScore >= threshold && !candidates.some(c => c.entity.id === entity.id)) {
        candidates.push({ entity, score: aliasScore });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return {
    entity: candidates.length > 0 ? candidates[0].entity : null,
    input,
    matches: candidates.slice(0, 5),
  };
}

export function resolveBatch(inputs: string[], threshold = 0.4): MatchResult[] {
  return inputs.map(i => resolveEntity(i, threshold));
}
