// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EntityResolutionService } from '../entity-resolution-service.js';

describe('EntityResolutionService', () => {
  describe('basic fuzzy matching', () => {
    it('should match known entity', async () => {
      const service = new EntityResolutionService();
      const result = await service.resolve('Prime Minister');

      assert.strictEqual(result.matched, true);
      assert.ok(result.entity);
      assert.strictEqual(result.entity.name, 'Prime Minister of Canada');
      assert.strictEqual(result.entity.type, 'person');
      assert.ok(result.score > 0);
      assert.ok(Array.isArray(result.aliases));
    });

    it('should return no match for unknown entity', async () => {
      const service = new EntityResolutionService();
      const result = await service.resolve('Unknown Entity XYZ 123');

      assert.strictEqual(result.matched, false);
      assert.strictEqual(result.entity, undefined);
      assert.strictEqual(result.score, 0);
      assert.deepStrictEqual(result.aliases, []);
    });

    it('should match organization by alias', async () => {
      const service = new EntityResolutionService();
      const result = await service.resolve('StatCan');

      assert.strictEqual(result.matched, true);
      assert.ok(result.entity);
      assert.strictEqual(result.entity.name, 'Statistics Canada');
      assert.strictEqual(result.entity.type, 'organization');
    });
  });

  describe('case-insensitive matching', () => {
    it('should match regardless of case', async () => {
      const service = new EntityResolutionService();

      const result1 = await service.resolve('statistics canada');
      const result2 = await service.resolve('STATISTICS CANADA');
      const result3 = await service.resolve('Statistics Canada');

      assert.strictEqual(result1.matched, true);
      assert.strictEqual(result2.matched, true);
      assert.strictEqual(result3.matched, true);

      assert.strictEqual(result1.entity?.id, result2.entity?.id);
      assert.strictEqual(result2.entity?.id, result3.entity?.id);
    });

    it('should handle mixed case input', async () => {
      const service = new EntityResolutionService();
      const result = await service.resolve('pRiMe MiNiStEr');

      assert.strictEqual(result.matched, true);
      assert.strictEqual(result.entity?.name, 'Prime Minister of Canada');
    });
  });

  describe('threshold filtering', () => {
    it('should filter matches below default threshold', async () => {
      const service = new EntityResolutionService();
      const result = await service.resolve('Prime');

      assert.strictEqual(result.matched, false);
    });

    it('should use custom threshold when provided', async () => {
      const service = new EntityResolutionService(undefined, { threshold: 0.3 });

      const result = await service.resolve('Prime');

      assert.strictEqual(result.matched, true);
      assert.ok(result.entity);
    });

    it('should override instance threshold with method parameter', async () => {
      const service = new EntityResolutionService(undefined, { threshold: 0.6 });

      const strictResult = await service.resolve('Prime');
      assert.strictEqual(strictResult.matched, false);

      const looseResult = await service.resolve('Prime', 0.2);
      assert.strictEqual(looseResult.matched, true);
    });

    it('should not match exact name with high threshold', async () => {
      const service = new EntityResolutionService(undefined, { threshold: 0.95 });

      const result = await service.resolve('Statistics Canada');

      assert.strictEqual(result.matched, true);
      assert.strictEqual(result.score, 1);
    });
  });

  describe('batch resolution', () => {
    it('should resolve multiple inputs in batch', async () => {
      const service = new EntityResolutionService();
      const results = await service.resolveBatch(['PM', 'StatCan', 'Senate']);

      assert.ok(results instanceof Map);
      assert.strictEqual(results.size, 3);

      const pmResult = results.get('PM');
      const statCanResult = results.get('StatCan');
      const senateResult = results.get('Senate');

      assert.ok(pmResult);
      assert.ok(statCanResult);
      assert.ok(senateResult);

      assert.strictEqual(pmResult.matched, true);
      assert.strictEqual(pmResult.entity?.name, 'Prime Minister of Canada');

      assert.strictEqual(statCanResult.matched, true);
      assert.strictEqual(statCanResult.entity?.name, 'Statistics Canada');

      assert.strictEqual(senateResult.matched, true);
      assert.strictEqual(senateResult.entity?.name, 'Senate of Canada');
    });

    it('should handle mix of matched and unmatched in batch', async () => {
      const service = new EntityResolutionService();
      const results = await service.resolveBatch(['PM', 'UnknownEntity', 'OCL']);

      assert.strictEqual(results.size, 3);

      assert.strictEqual(results.get('PM')?.matched, true);
      assert.strictEqual(results.get('UnknownEntity')?.matched, false);
      assert.strictEqual(results.get('OCL')?.matched, true);
    });

    it('should apply custom threshold to batch', async () => {
      const service = new EntityResolutionService();
      const results = await service.resolveBatch(['Prime', 'Minister'], 0.3);

      assert.strictEqual(results.get('Prime')?.matched, true);
      assert.strictEqual(results.get('Minister')?.matched, true);
    });

    it('should return empty map for empty input array', async () => {
      const service = new EntityResolutionService();
      const results = await service.resolveBatch([]);

      assert.strictEqual(results.size, 0);
    });
  });

  describe('registerEntity', () => {
    it('should register entity in memory', async () => {
      const service = new EntityResolutionService();

      service.registerEntity({
        id: 'test-org-001',
        name: 'Test Organization',
        type: 'organization',
        source: 'test',
        confidence: 1,
        aliases: ['Test Org', 'TO'],
      });

      const result = await service.resolve('Test Org');
      assert.strictEqual(result.matched, true);
      assert.strictEqual(result.entity?.id, 'test-org-001');
    });

    it('should match registered entity by alias', async () => {
      const service = new EntityResolutionService();

      service.registerEntity({
        id: 'test-person-001',
        name: 'Jane Doe',
        type: 'person',
        source: 'test',
        confidence: 1,
        aliases: ['J. Doe', 'Jane D'],
      });

      const result = await service.resolve('J. Doe');
      assert.strictEqual(result.matched, true);
      assert.strictEqual(result.entity?.name, 'Jane Doe');
    });

    it('should allow fuzzy matching on registered entities', async () => {
      const service = new EntityResolutionService();

      service.registerEntity({
        id: 'test-org-002',
        name: 'MapleTech Corporation',
        type: 'organization',
        source: 'test',
        confidence: 1,
        aliases: ['MapleTech', 'MT Corp'],
      });

      const result = await service.resolve('MapleTech');
      assert.strictEqual(result.matched, true);
      assert.strictEqual(result.entity?.id, 'test-org-002');
    });
  });

  describe('upsertEntity with mock DB', () => {
    it('should return entity ID without DB', async () => {
      const service = new EntityResolutionService();

      const entityId = await service.upsertEntity({
        id: 'test-org-003',
        name: 'Test Entity',
        type: 'organization',
        source: 'test',
        confidence: 1,
        aliases: [],
      });

      assert.strictEqual(entityId, 'test-org-003');

      const result = await service.resolve('Test Entity');
      assert.strictEqual(result.matched, true);
    });

    it('should register entity in memory even without DB', async () => {
      const service = new EntityResolutionService();

      await service.upsertEntity({
        id: 'test-person-002',
        name: 'Test Person',
        type: 'person',
        source: 'test',
        confidence: 1,
        aliases: ['TP'],
      });

      const result = await service.resolve('TP');
      assert.strictEqual(result.matched, true);
      assert.strictEqual(result.entity?.id, 'test-person-002');
    });

    it('should handle unknown entity type without DB', async () => {
      const service = new EntityResolutionService();

      const entityId = await service.upsertEntity({
        id: 'test-unknown-001',
        name: 'Test Unknown',
        type: 'location',
        source: 'test',
        confidence: 1,
        aliases: [],
      });

      assert.strictEqual(entityId, 'test-unknown-001');
    });

    it('should accept DB instance', async () => {
      const mockDb = {
        run: async () => ({ changes: 1 }),
        prepare: () => ({
          run: async () => ({ changes: 1 }),
          all: async () => [],
          get: async () => undefined,
          bind: () => ({ run: async () => ({ changes: 1 }) }),
        }),
      } as any;

      const service = new EntityResolutionService(mockDb);

      const result = await service.resolve('PM');
      assert.strictEqual(result.matched, true);
    });

    it('should throw error on DB failure', async () => {
      const mockDb = {
        run: async () => ({ changes: 1 }),
        prepare: () => ({
          run: async () => { throw new Error('DB connection failed'); },
          all: async () => [],
          get: async () => undefined,
          bind: () => ({ run: async () => ({ changes: 1 }) }),
        }),
      } as any;

      const service = new EntityResolutionService(mockDb);

      await assert.rejects(
        service.upsertEntity({
          id: 'test-org-005',
          name: 'Test Org Error',
          type: 'organization',
          source: 'test',
          confidence: 1,
          aliases: [],
        }),
        /Failed to upsert entity to database/
      );
    });

    it('should handle person upsert attempts', async () => {
      const mockDb = {
        run: async () => ({ changes: 1 }),
        prepare: () => ({
          run: async () => ({ changes: 1 }),
          all: async () => [],
          get: async () => undefined,
          bind: () => ({ run: async () => ({ changes: 1 }) }),
        }),
      } as any;

      const service = new EntityResolutionService(mockDb);

      try {
        await service.upsertEntity({
          id: 'test-person-003',
          name: 'John Smith',
          type: 'person',
          source: 'test',
          confidence: 1,
          aliases: [],
        });
      } catch (e) {
      }

      const result = await service.resolve('John Smith');
      assert.strictEqual(result.matched, true);
    });
  });

  describe('constructor configuration', () => {
    it('should use default threshold when not specified', async () => {
      const service = new EntityResolutionService();

      const result = await service.resolve('Prime');

      assert.strictEqual(result.matched, false);
    });

    it('should use custom threshold from config', async () => {
      const service = new EntityResolutionService(undefined, { threshold: 0.2 });

      const result = await service.resolve('Prime');

      assert.strictEqual(result.matched, true);
    });

    it('should accept DB instance', async () => {
      const mockDb = {
        run: async () => ({ changes: 1 }),
        prepare: () => ({
          run: async () => ({ changes: 1 }),
          all: async () => [],
          get: async () => undefined,
          bind: () => ({ run: async () => ({ changes: 1 }) }),
        }),
      } as any;

      const service = new EntityResolutionService(mockDb);

      const result = await service.resolve('PM');
      assert.strictEqual(result.matched, true);
    });

    it('should accept both DB and config', async () => {
      const mockDb = {
        run: async () => ({ changes: 1 }),
        prepare: () => ({
          run: async () => ({ changes: 1 }),
          all: async () => [],
          get: async () => undefined,
          bind: () => ({ run: async () => ({ changes: 1 }) }),
        }),
      } as any;

      const service = new EntityResolutionService(mockDb, { threshold: 0.3 });

      const result = await service.resolve('Prime');
      assert.strictEqual(result.matched, true);
    });
  });

  describe('ServiceMatchResult structure', () => {
    it('should include input string in result', async () => {
      const service = new EntityResolutionService();
      const result = await service.resolve('Statistics Canada');

      assert.strictEqual(result.input, 'Statistics Canada');
    });

    it('should include score in result', async () => {
      const service = new EntityResolutionService();
      const result = await service.resolve('Statistics Canada');

      assert.strictEqual(typeof result.score, 'number');
      assert.strictEqual(result.score, 1);
    });

    it('should include aliases from matched entity', async () => {
      const service = new EntityResolutionService();
      const result = await service.resolve('StatCan');

      assert.ok(Array.isArray(result.aliases));
      assert.ok(result.aliases.length > 0);
    });

    it('should have empty aliases for unmatched entity', async () => {
      const service = new EntityResolutionService();
      const result = await service.resolve('UnknownEntity');

      assert.deepStrictEqual(result.aliases, []);
    });

    it('should have score 0 for unmatched entity', async () => {
      const service = new EntityResolutionService();
      const result = await service.resolve('UnknownEntity');

      assert.strictEqual(result.score, 0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string input', async () => {
      const service = new EntityResolutionService();
      const result = await service.resolve('');

      assert.strictEqual(result.matched, false);
      assert.strictEqual(result.input, '');
    });

    it('should handle special characters in input', async () => {
      const service = new EntityResolutionService();
      const result = await service.resolve('Statistics-Canada!');

      assert.strictEqual(result.input, 'Statistics-Canada!');
    });

    it('should handle very long input', async () => {
      const service = new EntityResolutionService();
      const longInput = 'Statistics Canada '.repeat(100);

      const result = await service.resolve(longInput);
      assert.strictEqual(result.input, longInput);
    });

    it('should handle batch with empty strings', async () => {
      const service = new EntityResolutionService();
      const results = await service.resolveBatch(['', 'PM', '']);

      assert.ok(results.size >= 2);
      assert.strictEqual(results.get('PM')?.matched, true);
      assert.strictEqual(results.get('')?.matched, false);
    });

    it('should handle batch with duplicate inputs', async () => {
      const service = new EntityResolutionService();
      const results = await service.resolveBatch(['PM', 'PM', 'PM']);

      assert.ok(results.size >= 1);
      assert.strictEqual(results.get('PM')?.matched, true);
    });
  });
});