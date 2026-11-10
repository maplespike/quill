// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

describe('Webhook Store (InMemory)', () => {
  let store: any;

  before(async () => {
    const mod = await import('../webhooks.js');
    store = new mod.InMemoryWebhookStore();
  });

  it('creates a webhook', () => {
    const wh = store.create({
      url: 'https://example.com/webhook',
      secret: 'test-secret',
      sourceFilter: ['*'],
      active: true,
      label: 'Test Webhook',
      maxRetries: 3,
      timeoutMs: 5000,
    });
    assert.ok(wh.id);
    assert.equal(wh.url, 'https://example.com/webhook');
    assert.equal(wh.label, 'Test Webhook');
    assert.equal(wh.maxRetries, 3);
  });

  it('lists all webhooks', () => {
    const list = store.list();
    assert.ok(list.length >= 1);
  });

  it('gets a webhook by id', () => {
    const all = store.list();
    const wh = store.get(all[0].id);
    assert.ok(wh);
    assert.equal(wh.id, all[0].id);
  });

  it('returns null for unknown id', () => {
    const wh = store.get('nonexistent');
    assert.equal(wh, null);
  });

  it('updates a webhook', () => {
    const all = store.list();
    const updated = store.update(all[0].id, { label: 'Updated Label', active: false });
    assert.ok(updated);
    assert.equal(updated.label, 'Updated Label');
    assert.equal(updated.active, false);
  });

  it('deletes a webhook', () => {
    const all = store.list();
    const deleted = store.delete(all[0].id);
    assert.ok(deleted);
    assert.equal(store.get(all[0].id), null);
  });

  it('logs and retrieves deliveries', () => {
    store.logDelivery({
      webhookId: 'wh-test',
      sourceId: 'committees',
      eventId: 'evt-1',
      attemptedAt: new Date().toISOString(),
      statusCode: 200,
      success: true,
      durationMs: 150,
    });
    const deliveries = store.getDeliveries('wh-test', 10);
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0].statusCode, 200);
    assert.equal(deliveries[0].success, true);
  });
});

describe('Webhook Filtering', () => {
  let store: any;

  before(async () => {
    const mod = await import('../webhooks.js');
    store = new mod.InMemoryWebhookStore();
  });

  it('filters webhooks by source ID', () => {
    store.create({
      url: 'https://example.com/committees',
      secret: '',
      sourceFilter: ['committees'],
      active: true,
      label: 'Committees Only',
      maxRetries: 2,
      timeoutMs: 5000,
    });
    store.create({
      url: 'https://example.com/all',
      secret: '',
      sourceFilter: ['*'],
      active: true,
      label: 'All Sources',
      maxRetries: 2,
      timeoutMs: 5000,
    });
    store.create({
      url: 'https://example.com/gazette',
      secret: '',
      sourceFilter: ['gazette'],
      active: true,
      label: 'Gazette Only',
      maxRetries: 2,
      timeoutMs: 5000,
    });

    // '*'' matches everything
    const wh1 = store.get(store.list()[1].id);
    assert.ok(wh1.sourceFilter.includes('*'));

    // Specific source filter
    const wh0 = store.get(store.list()[0].id);
    assert.ok(wh0.sourceFilter.includes('committees'));
  });
});

describe('Webhook Dispatch (module-level)', () => {
  let mod: any;

  before(async () => {
    mod = await import('../webhooks.js');
    mod.setWebhookStore(new mod.InMemoryWebhookStore());
  });

  after(() => {
    mod.setWebhookStore(new mod.InMemoryWebhookStore());
  });

  it('createWebhook creates and returns webhook', () => {
    const wh = mod.createWebhook({
      url: 'https://example.com/hook',
      secret: '',
      sourceFilter: ['*'],
      active: true,
      label: 'test',
      maxRetries: 1,
      timeoutMs: 5000,
    });
    assert.ok(wh.id);
    assert.equal(wh.url, 'https://example.com/hook');
    assert.ok(wh.created_at);
  });

  it('listWebhooks returns all webhooks', () => {
    const list = mod.listWebhooks();
    assert.ok(list.length >= 1);
  });

  it('getWebhook returns webhook by id', () => {
    const list = mod.listWebhooks();
    const wh = mod.getWebhook(list[0].id);
    assert.ok(wh);
    assert.equal(wh.id, list[0].id);
  });

  it('deleteWebhook removes webhook', () => {
    const list = mod.listWebhooks();
    const deleted = mod.deleteWebhook(list[0].id);
    assert.ok(deleted);
    assert.equal(mod.getWebhook(list[0].id), null);
  });

  it('notifyWebhooks returns empty array when no matching webhooks', async () => {
    // Clear the store first
    const store = mod.getWebhookStore();
    const all = store.list();
    all.forEach((w: any) => store.delete(w.id));

    const results = await mod.notifyWebhooks({
      sourceId: 'committees',
      sourceName: 'Test Committee',
      detectedAt: new Date().toISOString(),
      previousHash: '',
      currentHash: 'abc',
      changed: true,
      summary: 'test',
      recordCount: 1,
    });
    assert.ok(Array.isArray(results));
    assert.equal(results.length, 0);
  });
});