// SPDX-License-Identifier: AGPL-3.0-only
/**
 * EntityResolutionService — Service class for entity resolution with DB integration.
 *
 * Wraps the entity-resolver module's fuzzy matching (Dice coefficient) and adds
 * optional persistence to the shared database. Supports both in-memory-only mode
 * (no DB) and database-backed mode for persisting resolved entities.
 */

import type { DB } from '../db/database.js';
import { resolveEntity as resolveEntityImpl, resolveBatch as resolveBatchImpl, registerEntity as registerEntityImpl } from './entity-resolver.js';
import type { ResolvedEntity, MatchResult } from './entity-resolver.js';

/**
 * Configuration options for EntityResolutionService.
 */
export interface EntityResolutionServiceConfig {
  /** Minimum Dice coefficient threshold for matches (default: 0.5) */
  threshold?: number;
}

/**
 * Extended match result that includes a simpler matched flag.
 */
export interface ServiceMatchResult {
  /** Whether a match was found above the threshold */
  matched: boolean;
  /** The resolved entity (if matched) */
  entity?: ResolvedEntity;
  /** The similarity score (0-1) */
  score: number;
  /** All aliases associated with the matched entity */
  aliases: string[];
  /** The input string that was matched */
  input: string;
}

/**
 * Service class for entity resolution with optional database persistence.
 *
 * This class wraps the entity-resolver module's fuzzy matching functionality
 * and provides a clean, configurable API. When a DB instance is provided,
 * resolved entities can be persisted to the shared database.
 *
 * @example
 * ```ts
 * // In-memory only (no persistence)
 * const service = new EntityResolutionService();
 *
 * // With database persistence
 * const db = getRawDb();
 * const service = new EntityResolutionService(db, { threshold: 0.6 });
 * ```
 */
export class EntityResolutionService {
  private db: DB | null;
  private defaultThreshold: number;

  /**
   * Creates a new EntityResolutionService instance.
   *
   * @param db - Optional database connection for persistence. If not provided, operates in-memory only.
   * @param config - Optional configuration including threshold and other settings.
   */
  constructor(db?: DB, config?: EntityResolutionServiceConfig) {
    this.db = db ?? null;
    this.defaultThreshold = config?.threshold ?? 0.5;
  }

  /**
   * Resolves a single entity name to the best match.
   *
   * Uses Dice coefficient fuzzy matching to find the best matching entity.
   * Returns the top match if it meets the threshold, otherwise returns no match.
   *
   * @param input - The entity name to resolve (e.g., "Prime Minister of Canada")
   * @param threshold - Optional override for the match threshold (defaults to instance threshold)
   * @returns A simplified match result with matched flag, entity (if matched), score, and aliases
   *
   * @example
   * ```ts
   * const result = await service.resolve('Prime Minister');
   * if (result.matched) {
   *   console.log(`Matched to ${result.entity!.name} with score ${result.score}`);
   * }
   * ```
   */
  async resolve(input: string, threshold?: number): Promise<ServiceMatchResult> {
    const effectiveThreshold = threshold ?? this.defaultThreshold;
    const result = resolveEntityImpl(input, effectiveThreshold);

    if (result.entity) {
      return {
        matched: true,
        entity: result.entity,
        score: result.matches[0]?.score ?? 0,
        aliases: result.entity.aliases,
        input: result.input,
      };
    }

    return {
      matched: false,
      score: 0,
      aliases: [],
      input: result.input,
    };
  }

  /**
   * Resolves multiple entity names in batch.
   *
   * Processes each input independently and returns a Map mapping each input
   * to its match result. This is more efficient than calling resolve() multiple
   * times when processing many entities.
   *
   * @param inputs - Array of entity names to resolve
   * @param threshold - Optional override for the match threshold (defaults to instance threshold)
   * @returns A Map from input string to match result
   *
   * @example
   * ```ts
   * const results = await service.resolveBatch(['PM', 'StatCan', 'OCL']);
   * for (const [input, result] of results) {
   *   console.log(`${input} -> ${result.matched ? result.entity!.name : 'no match'}`);
   * }
   * ```
   */
  async resolveBatch(inputs: string[], threshold?: number): Promise<Map<string, ServiceMatchResult>> {
    const effectiveThreshold = threshold ?? this.defaultThreshold;
    const results = resolveBatchImpl(inputs, effectiveThreshold);

    const resultMap = new Map<string, ServiceMatchResult>();
    for (const result of results) {
      if (result.entity) {
        resultMap.set(result.input, {
          matched: true,
          entity: result.entity,
          score: result.matches[0]?.score ?? 0,
          aliases: result.entity.aliases,
          input: result.input,
        });
      } else {
        resultMap.set(result.input, {
          matched: false,
          score: 0,
          aliases: [],
          input: result.input,
        });
      }
    }

    return resultMap;
  }

  /**
   * Registers an entity for fuzzy matching.
   *
   * Adds an entity to the in-memory index used for fuzzy matching.
   * This does NOT persist to the database. Use upsertEntity() for persistence.
   *
   * @param entity - The entity to register in the in-memory index
   *
   * @example
   * ```ts
   * service.registerEntity({
   *   id: 'person-001',
   *   name: 'John Smith',
   *   type: 'person',
   *   source: 'manual',
   *   confidence: 1,
   *   aliases: ['Johnny Smith', 'J. Smith'],
   * });
   * ```
   */
  registerEntity(entity: ResolvedEntity): void {
    registerEntityImpl(entity);
  }

  /**
   * Persists a resolved entity to the database.
   *
   * If a DB connection was provided during construction, this will upsert
   * the entity to the appropriate table (persons or organizations) in the
   * shared database. Also registers the entity in the in-memory index.
   *
   * If no DB connection was provided, only registers the entity in-memory
   * and returns the entity ID.
   *
   * @param entity - The resolved entity to persist
   * @returns The entity ID (either the provided ID or the DB-generated ID)
   * @throws Error if DB operation fails
   *
   * @example
   * ```ts
   * const entityId = await service.upsertEntity({
   *   id: 'org-001',
   *   name: 'Example Corp',
   *   type: 'organization',
   *   source: 'corporate-filings',
   *   confidence: 0.9,
   *   aliases: ['Example Corporation', 'Example Ltd'],
   * });
   * ```
   */
  async upsertEntity(entity: ResolvedEntity): Promise<string> {
    // Register in memory regardless of DB
    this.registerEntity(entity);

    // Persist to DB if available
    if (this.db) {
      try {
        if (entity.type === 'person') {
          const { upsertPerson } = await import('../shared-db.js');
          // Extract first name and last name from the name if available
          const nameParts = entity.name.split(' ');
          const firstName = nameParts.length > 1 ? nameParts[0] : undefined;
          const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : entity.name;

          return upsertPerson(entity.name, {
            firstName,
            lastName,
            source: entity.source,
            rawData: {
              entityId: entity.id,
              confidence: entity.confidence,
              aliases: entity.aliases,
            },
          });
        } else if (entity.type === 'organization') {
          const { upsertOrganization } = await import('../shared-db.js');
          return upsertOrganization(entity.name, {
            source: entity.source,
            rawData: {
              entityId: entity.id,
              confidence: entity.confidence,
              aliases: entity.aliases,
            },
          });
        } else {
          // Unknown entity type - just return the ID without DB persistence
          return entity.id;
        }
      } catch (error) {
        throw new Error(`Failed to upsert entity to database: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // No DB - just return the entity ID
    return entity.id;
  }
}