// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'node:test';
import { toPersonnelRecord, parsePersonnelRecords, toProcurementRecord, parseProcurementRecords } from './parser.js';
import type { DndPersonnelRecord, DndProcurementRecord } from './types.js';

describe('defence parser', () => {
  describe('toPersonnelRecord', () => {
    it('should parse a valid personnel record', () => {
      const headers = ['year', 'month', 'rank', 'component', 'gender', 'count'];
      const cols = ['2023', '6', 'Officer', 'Regular Force', 'Male', '150'];

      const result = toPersonnelRecord(headers, cols);
      expect(result).not.toBeNull();
      expect(result?.year).toBe(2023);
      expect(result?.month).toBe(6);
      expect(result?.rank).toBe('Officer');
      expect(result?.component).toBe('Regular Force');
      expect(result?.gender).toBe('Male');
      expect(result?.count).toBe(150);
    });

    it('should return null for invalid count', () => {
      const headers = ['year', 'month', 'rank', 'component', 'count'];
      const cols = ['2023', '6', 'Officer', 'Regular Force', 'invalid'];

      expect(toPersonnelRecord(headers, cols)).toBeNull();
    });

    it('should return null for zero or negative count', () => {
      const headers = ['year', 'month', 'rank', 'component', 'count'];
      const cols = ['2023', '6', 'Officer', 'Regular Force', '0'];

      expect(toPersonnelRecord(headers, cols)).toBeNull();
    });

    it('should use default component when missing', () => {
      const headers = ['year', 'month', 'rank', 'count'];
      const cols = ['2023', '6', 'Officer', '100'];

      const result = toPersonnelRecord(headers, cols);
      expect(result?.component).toBe('Regular Force');
    });
  });

  describe('parsePersonnelRecords', () => {
    it('should parse multiple personnel records', () => {
      const csv = `year,month,rank,component,count
2023,1,Officer,Regular Force,120
2023,1,Sailor,Naval Reserve,50`;

      const results = parsePersonnelRecords(csv);
      expect(results).toHaveLength(2);
      expect(results[0].rank).toBe('Officer');
      expect(results[1].rank).toBe('Sailor');
    });

    it('should handle empty CSV', () => {
      expect(parsePersonnelRecords('')).toEqual([]);
    });

    it('should handle header-only CSV', () => {
      expect(parsePersonnelRecords('year,month,rank,count')).toEqual([]);
    });

    it('should filter out invalid records', () => {
      const csv = `year,month,rank,component,count
2023,1,Officer,Regular Force,100
2023,1,Invalid,Regular Force,invalid`;

      const results = parsePersonnelRecords(csv);
      expect(results).toHaveLength(1);
    });
  });

  describe('toProcurementRecord', () => {
    it('should parse a valid procurement record', () => {
      const headers = ['year', 'vendor', 'description', 'value'];
      const cols = ['2023', 'Acme Corp', 'Test Contract', '50000'];

      const result = toProcurementRecord(headers, cols);
      expect(result).not.toBeNull();
      expect(result?.year).toBe(2023);
      expect(result?.vendor).toBe('Acme Corp');
      expect(result?.description).toBe('Test Contract');
      expect(result?.value).toBe(50000);
    });

    it('should return null for invalid numeric value', () => {
      const headers = ['year', 'vendor', 'description', 'value'];
      const cols = ['2023', 'Acme Corp', 'Test Contract', 'invalid'];

      expect(toProcurementRecord(headers, cols)).toBeNull();
    });

    it('should handle monetary values with $ and commas', () => {
      const headers = ['year', 'vendor', 'description', 'amount'];
      const cols = ['2023', 'Acme Corp', 'Test Contract', '$50,000.00'];

      const result = toProcurementRecord(headers, cols);
      expect(result?.value).toBe(50000);
    });
  });

  describe('parseProcurementRecords', () => {
    it('should parse multiple procurement records', () => {
      const csv = `year,vendor,description,value
2023,Acme,Contract A,10000
2023,Beta Inc,Contract B,20000`;

      const results = parseProcurementRecords(csv);
      expect(results).toHaveLength(2);
      expect(results[0].vendor).toBe('Acme');
      expect(results[1].vendor).toBe('Beta Inc');
    });
  });
});