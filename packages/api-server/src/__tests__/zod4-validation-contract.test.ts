import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  aiAskSchema,
  billingCheckoutSchema,
  registerSchema,
  validateBody,
} from '../validation.js';
import { registerHandler } from '../routes/register.js';
import { makeCtx } from './_helpers.js';

describe('Zod 4 API validation contract', () => {
  it('keeps the VALIDATION_ERROR envelope and field list', async () => {
    const resp = await registerHandler(
      new Request('http://localhost/v1/register', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      makeCtx() as never,
      {},
    );
    assert.equal(resp.status, 400);
    const body = await resp.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    const details = body.error.details as Array<{ field: string; message: string }>;
    assert.deepEqual(
      details.map((d) => d.field).sort(),
      ['email', 'name'],
    );
    assert.equal(
      details.find((d) => d.field === 'name')?.message,
      'Invalid input: expected string, received undefined',
    );
    assert.match(body.error.message, /^name: .+; email: .+$/);
  });

  it('trims an email before the format check', () => {
    const parsed = validateBody(registerSchema, { name: 'Ada', email: '  a@b.co  ' });
    assert.equal(parsed.success, true);
    if (parsed.success) assert.equal(parsed.data.email, 'a@b.co');
  });

  it('strips unknown keys at parse time', () => {
    const parsed = validateBody(registerSchema, {
      name: 'Ada',
      email: 'a@b.co',
      extra: true,
    });
    assert.equal(parsed.success, true);
    if (parsed.success) assert.equal('extra' in parsed.data, false);
  });

  it('keeps the request JSON Schema fields clients read', () => {
    const schema = z.toJSONSchema(registerSchema) as {
      type: string;
      required: string[];
      additionalProperties: boolean;
      properties: {
        name: { type: string; minLength: number; maxLength: number };
        email: { type: string; format: string };
      };
    };
    assert.equal(schema.type, 'object');
    assert.deepEqual(schema.required, ['name', 'email']);
    assert.equal(schema.properties.name.type, 'string');
    assert.equal(schema.properties.name.minLength, 1);
    assert.equal(schema.properties.name.maxLength, 200);
    assert.equal(schema.properties.email.type, 'string');
    assert.equal(schema.properties.email.format, 'email');
    // z.toJSONSchema() closes objects. safeParse still strips unknown keys.
    assert.equal(schema.additionalProperties, false);
  });

  it('keeps billing and ask schemas on the same accepted values', () => {
    assert.equal(
      billingCheckoutSchema.parse({ planId: 'pro', successUrl: ' https://ok.example ' }).successUrl,
      'https://ok.example',
    );
    assert.equal(billingCheckoutSchema.safeParse({ planId: 'gold' }).success, false);
    assert.equal(aiAskSchema.parse({ query: '  housing  ' }).query, 'housing');
    const empty = aiAskSchema.safeParse({ query: '' });
    assert.equal(empty.success, false);
    if (!empty.success) {
      assert.equal(empty.error.issues[0]?.path.join('.'), 'query');
      assert.equal('errors' in empty.error, false);
    }
  });
});
