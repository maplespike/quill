import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('AnnotationService', () => {
  it('creates and lists annotations', async () => {
    const { createAnnotation, listAnnotations, resetStore } = await import('../annotationService.js');
    resetStore?.();
    const ann = createAnnotation({ entityType: 'test-entity', entityId: '123', userId: 'user1', annotationType: 'note', content: 'Test note' });
    assert.ok(ann.id);
    assert.equal(ann.entityType, 'test-entity');
    assert.equal(ann.entityId, '123');
    assert.equal(ann.content, 'Test note');
    const list = listAnnotations('test-entity', '123');
    assert.equal(list.length, 1);
    assert.equal(list[0].id, ann.id);
  });

  it('updates annotations', async () => {
    const { createAnnotation, updateAnnotation, resetStore } = await import('../annotationService.js');
    resetStore?.();
    const ann = createAnnotation({ entityType: 'test', entityId: '1', userId: 'u1', annotationType: 'note', content: 'Original' });
    const updated = updateAnnotation(ann.id, { content: 'Updated' });
    assert.ok(updated);
    assert.equal(updated.content, 'Updated');
  });

  it('deletes annotations', async () => {
    const { createAnnotation, deleteAnnotation, listAnnotations, resetStore } = await import('../annotationService.js');
    resetStore?.();
    const ann = createAnnotation({ entityType: 'test', entityId: '1', userId: 'u1', annotationType: 'flag', content: 'Flag' });
    const deleted = deleteAnnotation(ann.id);
    assert.ok(deleted);
    const list = listAnnotations('test', '1');
    assert.equal(list.length, 0);
  });

  it('exportAnnotations formats correctly', async () => {
    const { createAnnotation, exportAnnotations, resetStore } = await import('../annotationService.js');
    resetStore?.();
    createAnnotation({ entityType: 'test', entityId: '1', userId: 'u1', annotationType: 'note', content: 'Exported note' });
    const md = exportAnnotations('test', '1', 'markdown');
    assert.ok(md.includes('Exported note'));
    const html = exportAnnotations('test', '1', 'html');
    assert.ok(html.includes('Exported note'));
  });
});
