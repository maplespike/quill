export interface Annotation {
  id: string;
  entityType: string;
  entityId: string;
  userId: string;
  annotationType: 'note' | 'override' | 'flag' | 'context';
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const store = new Map<string, Annotation>();

export function listAnnotations(entityType: string, entityId: string): Annotation[] {
  return Array.from(store.values()).filter(a => a.entityType === entityType && a.entityId === entityId);
}

export function createAnnotation(annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>): Annotation {
  const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const ann: Annotation = { ...annotation, id, createdAt: now, updatedAt: now };
  store.set(id, ann);
  return ann;
}

export function updateAnnotation(id: string, updates: Partial<Pick<Annotation, 'content' | 'annotationType' | 'metadata'>>): Annotation | null {
  const ann = store.get(id);
  if (!ann) return null;
  Object.assign(ann, updates, { updatedAt: new Date().toISOString() });
  return ann;
}

export function deleteAnnotation(id: string): boolean {
  return store.delete(id);
}

export function exportAnnotations(entityType: string, entityId: string, format: 'markdown' | 'html' = 'markdown'): string {
  const annotations = listAnnotations(entityType, entityId);
  if (annotations.length === 0) return '';
  if (format === 'html') {
    return `<div class="annotations">${annotations.map(a => `<div class="annotation annotation-${a.annotationType}"><strong>${a.annotationType}</strong><p>${a.content}</p><small>${a.createdAt}</small></div>`).join('')}</div>`;
  }
  return annotations.map(a => `## ${a.annotationType}\n\n${a.content}\n\n— ${a.createdAt}\n`).join('---\n');
}

export function resetStore(): void {
  store.clear();
}
