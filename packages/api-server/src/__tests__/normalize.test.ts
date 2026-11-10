// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFields, normalizeFieldName, convertUnit, convertUnits } from '../utils/normalize.js';

describe('normalizeFieldName', () => {
  it('leaves camelCase unchanged', () => {
    assert.equal(normalizeFieldName('communicationDate'), 'communicationDate');
  });

  it('converts snake_case to camelCase', () => {
    assert.equal(normalizeFieldName('communication_date'), 'communicationDate');
    assert.equal(normalizeFieldName('start_date'), 'startDate');
    assert.equal(normalizeFieldName('organization_name'), 'organizationName');
  });

  it('converts PascalCase to camelCase', () => {
    assert.equal(normalizeFieldName('CommunicationDate'), 'communicationDate');
    assert.equal(normalizeFieldName('LobbyingCost'), 'lobbyingCost');
  });
});

describe('normalizeFields', () => {
  it('normalizes flat objects', () => {
    const input = { communication_date: '2026-01-15', start_date: '2026-01-01' };
    const expected = { communicationDate: '2026-01-15', startDate: '2026-01-01' };
    assert.deepEqual(normalizeFields(input), expected);
  });

  it('normalizes nested objects', () => {
    const input = {
      organization_name: 'ACME',
      contact: { email_address: 'a@b.com', phone_number: '555' },
    };
    const expected = {
      organizationName: 'ACME',
      contact: { emailAddress: 'a@b.com', phoneNumber: '555' },
    };
    assert.deepEqual(normalizeFields(input), expected);
  });

  it('normalizes arrays of objects', () => {
    const input = [{ record_id: 1 }, { record_id: 2 }];
    const expected = [{ recordId: 1 }, { recordId: 2 }];
    assert.deepEqual(normalizeFields(input), expected);
  });

  it('uses FIELD_ALIASES mappings', () => {
    assert.deepEqual(normalizeFields({ RegistrationId: 'ABC' }), { registryId: 'ABC' });
  });

  it('handles null and primitives', () => {
    assert.equal(normalizeFields(null), null);
    assert.equal(normalizeFields(42), 42);
    assert.equal(normalizeFields('hello'), 'hello');
  });
});

describe('convertUnit', () => {
  it('converts CAD to USD (metric→imperial currency)', () => {
    assert.equal(convertUnit(100, 'currency', 'imperial'), 75);
  });

  it('converts USD to CAD (imperial→metric currency)', () => {
    assert.equal(convertUnit(75, 'currency', 'metric'), 100);
  });

  it('converts km to mi', () => {
    const result = convertUnit(100, 'distance', 'imperial', 'metric');
    assert.equal(result, 62.14);
  });

  it('converts mi to km', () => {
    const result = convertUnit(62.14, 'distance', 'metric', 'imperial');
    assert.equal(result, 100.0);
  });

  it('converts kg to lb', () => {
    const result = convertUnit(10, 'weight', 'imperial', 'metric');
    assert.equal(result, 22.05);
  });

  it('converts Celsius to Fahrenheit', () => {
    const result = convertUnit(0, 'temperature', 'imperial', 'metric');
    assert.equal(result, 32);
  });

  it('converts Fahrenheit to Celsius', () => {
    const result = convertUnit(32, 'temperature', 'metric', 'imperial');
    assert.equal(result, 0);
  });

  it('returns unchanged for unknown unit type', () => {
    assert.equal(convertUnit(42, null, 'imperial'), 42);
  });
});

describe('convertUnits', () => {
  it('no-ops when target is metric', () => {
    const input = { cost: 100 };
    assert.deepEqual(convertUnits(input, 'metric'), input);
  });

  it('converts currency fields to imperial', () => {
    const input = { lobbying_cost_cad: 50000, name: 'test' };
    const result = convertUnits(input, 'imperial');
    assert.equal(result.lobbying_cost_cad, 37500);
    assert.equal(result.name, 'test');
  });

  it('recurses into nested objects', () => {
    const input = {
      details: { budget_cad: 100000, description: 'project' },
    };
    const result = convertUnits(input, 'imperial');
    assert.equal(result.details.budget_cad, 75000);
  });

  it('handles null/primitive values', () => {
    assert.equal(convertUnits(null, 'imperial'), null);
    assert.equal(convertUnits(42, 'imperial'), 42);
  });
});
