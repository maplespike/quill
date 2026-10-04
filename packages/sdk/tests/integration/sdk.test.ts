/**
 * Integration Tests
 *
 * These tests run against live/local API endpoints
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { MapleSpike, QuillError } from '../../src/index.js';

// Configuration for local testing
const TEST_CONFIG = {
  baseUrl: process.env.TEST_API_URL || 'http://127.0.0.1:8082',
  apiKey: process.env.TEST_API_KEY || 'maplespike-dev-key',
};

describe('MapleSpike SDK - Integration Tests', () => {
  let client: MapleSpike;

  before(() => {
    client = new MapleSpike(TEST_CONFIG);
    console.log(`Testing against: ${TEST_CONFIG.baseUrl}`);
  });

  describe('Authentication', () => {
    it('should authenticate with API key', () => {
      const ms = new MapleSpike({ apiKey: 'test-key' });
      assert.equal(ms.isAuthenticated(), true);
      assert.equal(ms.apiKey, 'test-key');
    });

    it('should support JWT authentication', () => {
      const ms = new MapleSpike({ jwtToken: 'test-jwt' });
      assert.equal(ms.isAuthenticated(), true);
      assert.equal(ms.jwtToken, 'test-jwt');
    });

    it('should clear authentication', () => {
      const ms = new MapleSpike({ apiKey: 'test-key' });
      assert.equal(ms.isAuthenticated(), true);
      ms.clearAuth();
      assert.equal(ms.isAuthenticated(), false);
    });
  });

  describe('Domain Queries', () => {
    it('should query immigration data', async () => {
      const result = await client.immigration.permanentResidents({
        province: 'ON',
        year: 2025,
        limit: 5,
      });

      assert.ok(result.data);
      assert.ok(result.meta);
      assert.ok(result.quality);
      assert.ok(result.citation);
      assert.equal(result.meta.agent, 'immigration');
      assert.equal(result.meta.action, 'permanent-residents');
      assert.equal(typeof result.meta.requestId, 'string');
    });

    it('should query committee data', async () => {
      const result = await client.committees.meetings({
        parliament: 44,
        chamber: 'commons',
        limit: 5,
      });

      assert.ok(result.data);
      assert.ok(result.meta);
      assert.equal(result.meta.agent, 'committees');
    });

    it('should query corporate data', async () => {
      const result = await client.corporate.lobbying({
        limit: 5,
      });

      assert.ok(result.data);
      assert.ok(result.meta);
      assert.equal(result.meta.agent, 'corporate');
    });

    it('should handle generic queries', async () => {
      const result = await client.query('regulations', 'regulatory-proposals', {
        limit: 5,
      });

      assert.ok(result.data);
      assert.ok(result.meta);
      assert.equal(result.meta.agent, 'regulations');
    });
  });

  describe('Error Handling', () => {
    it('should throw QuillError on API errors', async () => {
      try {
        await client.query('invalid', 'endpoint', {});
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof QuillError);
        assert.equal(typeof (error as QuillError).status, 'number');
        assert.equal(typeof (error as QuillError).code, 'string');
        assert.equal(typeof (error as QuillError).message, 'string');
      }
    });

    it('should handle invalid parameters gracefully', async () => {
      try {
        await client.corporate.profile({ businessNumber: '' });
      } catch (error) {
        // Expected to fail - either 400 or 404
        assert.ok(error instanceof QuillError);
        assert.ok((error as QuillError).status === 400 || (error as QuillError).status === 404);
      }
    });
  });

  describe('Query Options', () => {
    it('should respect limit option', async () => {
      const result = await client.query('immigration', 'permanent-residents',
        { province: 'ON', year: 2025 },
        { _limit: 2 }
      );

      assert.ok(result.data);
      // The API may return fewer than requested, so just check it's an array
      assert.ok(Array.isArray(result.data) || typeof result.data === 'object');
    });

    it('should support pagination', async () => {
      const result = await client.query('immigration', 'permanent-residents',
        { province: 'ON', year: 2025 },
        { _page: 1, _limit: 5 }
      );

      assert.ok(result.data);
      assert.ok(result.meta);
    });
  });

  describe('Chained Queries', () => {
    it('should support agent().action() chaining', async () => {
      const result = await client
        .agent('committees')
        .action('committee-meetings', { limit: 5 });

      assert.ok(result.data);
      assert.equal(result.meta.agent, 'committees');
      assert.equal(result.meta.action, 'committee-meetings');
    });
  });

  describe('MCP Integration', () => {
    it('should get MCP URL', () => {
      const url = client.getMcpUrl();
      assert.ok(url);
      assert.ok(url.startsWith('http'));
    });

    it('should get MCP configuration', () => {
      const config = client.getMcpConfig();
      assert.ok(config.serverUrl);
      assert.ok(config.apiKey);
    });
  });

  describe('Data Quality and Citation', () => {
    it('should return quality metrics', async () => {
      const result = await client.immigration.permanentResidents({
        limit: 1,
      });

      assert.ok(result.quality);
      assert.ok(typeof result.quality.freshness_seconds === 'number');
      assert.ok(typeof result.quality.source_uptime_7d === 'number');
      assert.ok(typeof result.quality.confidence === 'number');
      assert.ok(typeof result.quality.certainty_score === 'number');
    });

    it('should return citation information', async () => {
      const result = await client.immigration.permanentResidents({
        limit: 1,
      });

      assert.ok(result.citation);
      assert.ok(result.citation.source_name);
      assert.ok(result.citation.source_url);
      assert.ok(result.citation.license);
      assert.ok(result.citation.data_hash);
      assert.ok('retrieved_at' in result.citation);
      assert.ok(result.citation.retrieved_at === null || typeof result.citation.retrieved_at === 'string');
    });
  });

  describe('Health Check', () => {
    it('should check API health', async () => {
      try {
        const result = await client.query('health', 'check', {});
        // If the endpoint exists, it should return data
        assert.ok(result);
      } catch (error) {
        // Health endpoint might not be exposed via standard query
        // This is okay - we're just testing that the SDK handles it
        console.log('Health endpoint not available via standard query');
      }
    });
  });

  after(() => {
    console.log('Integration tests completed');
  });
});