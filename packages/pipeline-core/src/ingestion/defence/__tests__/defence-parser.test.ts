// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toPersonnelRecord, parsePersonnelRecords, toProcurementRecord, parseProcurementRecords } from '../parser.js';

describe('defence parser', () => {
  describe('toPersonnelRecord', () => {
    it('should parse a valid personnel record', () => {
      const headers = ['year', 'month', 'rank', 'component', 'gender', 'count'];
      const cols = ['2023', '6', 'Officer', 'Regular Force', 'Male', '150'];

      const result = toPersonnelRecord(headers, cols);
      assert.notEqual(result, null);
      assert.equal(result?.year, 2023);
      assert.equal(result?.month, 6);
      assert.equal(result?.rank, 'Officer');
      assert.equal(result?.component, 'Regular Force');
      assert.equal(result?.gender, 'Male');
      assert.equal(result?.count, 150);
    });

    it('should return null for invalid count', () => {
      const headers = ['year', 'month', 'rank', 'component', 'count'];
      const cols = ['2023', '6', 'Officer', 'Regular Force', 'invalid'];

      assert.equal(toPersonnelRecord(headers, cols), null);
    });

    it('should return null for zero or negative count', () => {
      const headers = ['year', 'month', 'rank', 'component', 'count'];
      const cols = ['2023', '6', 'Officer', 'Regular Force', '0'];

      assert.equal(toPersonnelRecord(headers, cols), null);
    });

    it('should use default component when missing', () => {
      const headers = ['year', 'month', 'rank', 'count'];
      const cols = ['2023', '6', 'Officer', '100'];

      const result = toPersonnelRecord(headers, cols);
      assert.equal(result?.component, 'Regular Force');
    });
  });

  describe('parsePersonnelRecords', () => {
    it('should parse multiple personnel records', () => {
      const csv = `year,month,rank,component,count
2023,1,Officer,Regular Force,120
2023,1,Sailor,Naval Reserve,50`;

      const results = parsePersonnelRecords(csv);
      assert.equal(results.length, 2);
      assert.equal(results[0].rank, 'Officer');
      assert.equal(results[1].rank, 'Sailor');
    });

    it('should handle empty CSV', () => {
      assert.deepEqual(parsePersonnelRecords(''), []);
    });

    it('should handle header-only CSV', () => {
      assert.deepEqual(parsePersonnelRecords('year,month,rank,count'), []);
    });

    it('should filter out invalid records', () => {
      const csv = `year,month,rank,component,count
2023,1,Officer,Regular Force,100
2023,1,Invalid,Regular Force,invalid`;

      const results = parsePersonnelRecords(csv);
      assert.equal(results.length, 1);
    });
  });

  describe('toProcurementRecord', () => {
    it('should parse a valid procurement record', () => {
      const headers = ['year', 'vendor', 'description', 'value'];
      const cols = ['2023', 'Acme Corp', 'Test Contract', '50000'];

      const result = toProcurementRecord(headers, cols);
      assert.notEqual(result, null);
      assert.equal(result?.year, 2023);
      assert.equal(result?.vendor, 'Acme Corp');
      assert.equal(result?.description, 'Test Contract');
      assert.equal(result?.value, 50000);
    });

    it('should return null for invalid numeric value', () => {
      const headers = ['year', 'vendor', 'description', 'value'];
      const cols = ['2023', 'Acme Corp', 'Test Contract', 'invalid'];

      assert.equal(toProcurementRecord(headers, cols), null);
    });

    it('should handle monetary values with $ and commas', () => {
      const headers = ['year', 'vendor', 'description', 'amount'];
      const cols = ['2023', 'Acme Corp', 'Test Contract', '$50,000.00'];

      const result = toProcurementRecord(headers, cols);
      assert.equal(result?.value, 50000);
    });
  });

  describe('parseProcurementRecords', () => {
    it('should parse multiple procurement records', () => {
      const csv = `year,vendor,description,value
2023,Acme,Contract A,10000
2023,Beta Inc,Contract B,20000`;

      const results = parseProcurementRecords(csv);
      assert.equal(results.length, 2);
      assert.equal(results[0].vendor, 'Acme');
      assert.equal(results[1].vendor, 'Beta Inc');
    });
  });
});
