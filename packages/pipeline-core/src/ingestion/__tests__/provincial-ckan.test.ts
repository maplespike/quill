// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PROVINCIAL_CKAN_SOURCES, fetchProvincialCkan, fetchAllProvincialCkan } from '../provincial-ckan.js';

describe('provincial-ckan Module', () => {
  describe('PROVINCIAL_CKAN_SOURCES', () => {
    it('is a non-empty record with all 13 provinces/territories', () => {
      const codes = Object.keys(PROVINCIAL_CKAN_SOURCES);
      assert.ok(codes.length >= 13, `Expected 13+ provinces, got ${codes.length}`);
    });

    it('includes all major provinces', () => {
      const codes = Object.keys(PROVINCIAL_CKAN_SOURCES);
      for (const expected of ['ON', 'BC', 'AB', 'QC', 'SK', 'MB', 'NS']) {
        assert.ok(codes.includes(expected), `Missing ${expected}`);
      }
    });

    it('includes all territories', () => {
      const codes = Object.keys(PROVINCIAL_CKAN_SOURCES);
      for (const expected of ['YT', 'NT', 'NU']) {
        assert.ok(codes.includes(expected), `Missing territory ${expected}`);
      }
    });

    it('each source has required fields', () => {
      for (const [code, source] of Object.entries(PROVINCIAL_CKAN_SOURCES)) {
        assert.ok(typeof source.name === 'string' && source.name.length > 0, `Missing name for ${code}`);
        assert.ok(typeof source.endpoint === 'string' && source.endpoint.length > 0, `Missing endpoint for ${code}`);
        assert.ok(typeof source.jurisdiction === 'string', `Missing jurisdiction for ${code}`);
      }
    });

    it('each source has a valid endpoint URL', () => {
      for (const [code, source] of Object.entries(PROVINCIAL_CKAN_SOURCES)) {
        assert.ok(
          source.endpoint.startsWith('https://'),
          `${code} endpoint should start with https://, got ${source.endpoint}`,
        );
      }
    });

    it('big 4 provinces have detailed notes', () => {
      for (const code of ['ON', 'BC', 'AB', 'QC']) {
        const notes = PROVINCIAL_CKAN_SOURCES[code].notes;
        assert.ok(notes && notes.length > 10, `${code} should have detailed notes`);
      }
    });
  });

  describe('fetchProvincialCkan', () => {
    it('is a function', () => {
      assert.equal(typeof fetchProvincialCkan, 'function');
    });

    it('accepts provinceCode string and optional query', () => {
      assert.equal(fetchProvincialCkan.length, 2);
    });
  });

  describe('fetchAllProvincialCkan', () => {
    it('is a function', () => {
      assert.equal(typeof fetchAllProvincialCkan, 'function');
    });

    it('accepts optional query parameter', () => {
      assert.equal(fetchAllProvincialCkan.length, 1);
    });
  });
});
