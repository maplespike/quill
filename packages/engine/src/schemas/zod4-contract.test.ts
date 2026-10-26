import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { BaseEntitySchema } from './base';
import { OrganizationSchema } from './organization';

const base = {
  id: '550e8400-e29b-41d4-c716-446655440000',
  source: 'manual' as const,
  rawData: { note: 'kept', empty: null },
  createdAt: '2020-01-01T00:00:00Z',
  updatedAt: '2020-01-01T00:00:00.123Z',
};

describe('Zod 4 entity schema contract', () => {
  it('accepts the UUID-shaped ids Zod 3 accepted', () => {
    const parsed = BaseEntitySchema.parse({ ...base, extra: true });
    expect(parsed.id).toBe(base.id);
    expect(parsed.rawData).toEqual(base.rawData);
    expect(parsed).not.toHaveProperty('extra');
  });

  it('rejects a datetime offset, same as Zod 3 z.string().datetime()', () => {
    const result = BaseEntitySchema.safeParse({
      ...base,
      createdAt: '2020-01-01T00:00:00+00:00',
    });
    expect(result.success).toBe(false);
  });

  it('keeps email and url checks on the organization schema', () => {
    const org = {
      ...base,
      id: '550e8400-e29b-41d4-a716-446655440000',
      names: ['Example'],
      type: 'corporation' as const,
      registrations: [],
      website: 'https://example.com',
    };
    expect(OrganizationSchema.parse(org).website).toBe('https://example.com');
    expect(OrganizationSchema.safeParse({ ...org, website: 'example.com' }).success).toBe(false);
  });

  it('emits a record JSON Schema with string keys', () => {
    const schema = z.toJSONSchema(z.record(z.string(), z.unknown()));
    expect(schema).toMatchObject({
      type: 'object',
      propertyNames: { type: 'string' },
      additionalProperties: {},
    });
  });
});
