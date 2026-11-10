// SPDX-License-Identifier: AGPL-3.0-only
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const TEST_DB = '/tmp/test-annotations.db';

describe('AnnotationService', () => {
  after(() => {
    try { fs.unlinkSync(TEST_DB); } catch { /* ignore cleanup errors */ }
  });

  it('creates and lists annotations', async () => {
    const mod = await import('../annotationService.js');
    mod.resetStore();
    const ann = mod.createAnnotation({ entityType: 'test-entity', entityId: '123', userId: 'user1', annotationType: 'note', content: 'Test note' });
    assert.ok(ann.id);
    assert.equal(ann.entityType, 'test-entity');
    assert.equal(ann.entityId, '123');
    assert.equal(ann.content, 'Test note');
    assert.equal(mod.listAnnotations('test-entity', '123').length, 1);
  });

  it('returns empty list for non-existent entity', async () => {
    const mod = await import('../annotationService.js');
    mod.resetStore();
    assert.equal(mod.listAnnotations('nonexistent', '0').length, 0);
  });

  it('updates annotations', async () => {
    const mod = await import('../annotationService.js');
    mod.resetStore();
    const ann = mod.createAnnotation({ entityType: 'test', entityId: '1', userId: 'u1', annotationType: 'note', content: 'Original' });
    const updated = mod.updateAnnotation(ann.id, { content: 'Updated' });
    assert.ok(updated);
    assert.equal(updated.content, 'Updated');
  });

  it('returns null for update of non-existent', async () => {
    const mod = await import('../annotationService.js');
    mod.resetStore();
    assert.equal(mod.updateAnnotation('nonexistent', { content: 'test' }), null);
  });

  it('deletes annotations', async () => {
    const mod = await import('../annotationService.js');
    mod.resetStore();
    const ann = mod.createAnnotation({ entityType: 'test', entityId: '1', userId: 'u1', annotationType: 'flag', content: 'Flag' });
    assert.ok(mod.deleteAnnotation(ann.id));
    assert.equal(mod.listAnnotations('test', '1').length, 0);
  });

  it('returns false for delete of non-existent', async () => {
    const mod = await import('../annotationService.js');
    mod.resetStore();
    assert.equal(mod.deleteAnnotation('nonexistent'), false);
  });

  it('exportAnnotations formats markdown', async () => {
    const mod = await import('../annotationService.js');
    mod.resetStore();
    mod.createAnnotation({ entityType: 'test', entityId: '1', userId: 'u1', annotationType: 'note', content: 'MD note' });
    assert.ok(mod.exportAnnotations('test', '1', 'markdown').includes('MD note'));
  });

  it('exportAnnotations formats html', async () => {
    const mod = await import('../annotationService.js');
    mod.resetStore();
    mod.createAnnotation({ entityType: 'test', entityId: '1', userId: 'u1', annotationType: 'note', content: 'HTML note' });
    const html = mod.exportAnnotations('test', '1', 'html');
    assert.ok(html.includes('HTML note'));
    assert.ok(html.includes('annotation'));
  });
});
