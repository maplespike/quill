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

interface AnnotationStore {
  list(entityType: string, entityId: string): Annotation[];
  create(annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>): Annotation;
  update(id: string, updates: Partial<Pick<Annotation, 'content' | 'annotationType' | 'metadata'>>): Annotation | null;
  delete(id: string): boolean;
  clear(): void;
}

// ── In-memory store (fallback) ─────────────────────────────────────

class InMemoryAnnotationStore implements AnnotationStore {
  private store = new Map<string, Annotation>();

  list(entityType: string, entityId: string): Annotation[] {
    return Array.from(this.store.values()).filter(a => a.entityType === entityType && a.entityId === entityId);
  }

  create(annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>): Annotation {
    const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const ann: Annotation = { ...annotation, id, createdAt: now, updatedAt: now };
    this.store.set(id, ann);
    return ann;
  }

  update(id: string, updates: Partial<Pick<Annotation, 'content' | 'annotationType' | 'metadata'>>): Annotation | null {
    const ann = this.store.get(id);
    if (!ann) return null;
    Object.assign(ann, updates, { updatedAt: new Date().toISOString() });
    return ann;
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  clear(): void { this.store.clear(); }
}

// ── SQLite store (persistent) ──────────────────────────────────────

class D1AnnotationStore implements AnnotationStore {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  list(entityType: string, entityId: string): Annotation[] {
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM annotations WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC',
      );
      const rows = stmt.all(entityType, entityId);
      return rows.map(this.rowToAnnotation);
    } catch (err) {
      console.warn(`[AnnotationService] list failed: ${(err as Error).message}`);
      return [];
    }
  }

  create(annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>): Annotation {
    const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const ann: Annotation = { ...annotation, id, createdAt: now, updatedAt: now };
    try {
      const stmt = this.db.prepare(`
        INSERT INTO annotations (id, entity_type, entity_id, user_id, annotation_type, content, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.bind(id, ann.entityType, ann.entityId, ann.userId, ann.annotationType, ann.content,
        ann.metadata ? JSON.stringify(ann.metadata) : null, now, now).run();
    } catch (err) {
      console.warn(`[AnnotationService] Failed to create annotation: ${(err as Error).message}`);
    }
    return ann;
  }

  update(id: string, updates: Partial<Pick<Annotation, 'content' | 'annotationType' | 'metadata'>>): Annotation | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM annotations WHERE id = ?');
      const existing = stmt.get(id);
      if (!existing) return null;
      const now = new Date().toISOString();
      const content = updates.content ?? existing.content;
      const annotationType = updates.annotationType ?? existing.annotation_type;
      const metadata = updates.metadata !== undefined
        ? (updates.metadata ? JSON.stringify(updates.metadata) : null)
        : existing.metadata;
      const updateStmt = this.db.prepare(
        'UPDATE annotations SET content = ?, annotation_type = ?, metadata = ?, updated_at = ? WHERE id = ?',
      );
      updateStmt.bind(content, annotationType, metadata, now, id).run();
      return this.rowToAnnotation({ ...existing, content, annotation_type: annotationType, metadata, updated_at: now });
    } catch (err) {
      console.warn(`[AnnotationService] update failed: ${(err as Error).message}`);
      return null;
    }
  }

  delete(id: string): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM annotations WHERE id = ?');
      const result = stmt.bind(id).run();
      return result.meta?.changes > 0 || result.changes > 0;
    } catch (err) {
      console.warn(`[AnnotationService] delete failed: ${(err as Error).message}`);
      return false;
    }
  }

  clear(): void {
    try {
      const stmt = this.db.prepare('DELETE FROM annotations');
      stmt.bind().run();
    } catch (err) {
      console.warn(`[AnnotationService] clear failed: ${(err as Error).message}`);
    }
  }

  private rowToAnnotation(row: any): Annotation {
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      userId: row.user_id,
      annotationType: row.annotation_type,
      content: row.content,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

class SqliteAnnotationStore implements AnnotationStore {
  private db: any;

  constructor(dbPath: string) {
    const path = dbPath;
    const mod = require('better-sqlite3');
    this.db = new (mod.default || mod)(path);
  }

  list(entityType: string, entityId: string): Annotation[] {
    try {
      const rows = this.db.prepare(
        'SELECT * FROM annotations WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC',
      ).all(entityType, entityId);
      return rows.map(this.rowToAnnotation);
    } catch (err) {
      console.warn(`[AnnotationService] list failed: ${(err as Error).message}`);
      return [];
    }
  }

  create(annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>): Annotation {
    const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const ann: Annotation = { ...annotation, id, createdAt: now, updatedAt: now };
    try {
      this.db.prepare(`
        INSERT INTO annotations (id, entity_type, entity_id, user_id, annotation_type, content, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, ann.entityType, ann.entityId, ann.userId, ann.annotationType, ann.content,
        ann.metadata ? JSON.stringify(ann.metadata) : null, now, now);
    } catch (err) {
      console.warn(`[AnnotationService] Failed to create annotation: ${(err as Error).message}`);
    }
    return ann;
  }

  update(id: string, updates: Partial<Pick<Annotation, 'content' | 'annotationType' | 'metadata'>>): Annotation | null {
    try {
      const existing = this.db.prepare('SELECT * FROM annotations WHERE id = ?').get(id);
      if (!existing) return null;
      const now = new Date().toISOString();
      const content = updates.content ?? existing.content;
      const annotationType = updates.annotationType ?? existing.annotation_type;
      const metadata = updates.metadata !== undefined
        ? (updates.metadata ? JSON.stringify(updates.metadata) : null)
        : existing.metadata;
      this.db.prepare(
        'UPDATE annotations SET content = ?, annotation_type = ?, metadata = ?, updated_at = ? WHERE id = ?',
      ).run(content, annotationType, metadata, now, id);
      return this.rowToAnnotation({ ...existing, content, annotation_type: annotationType, metadata, updated_at: now });
    } catch (err) {
      console.warn(`[AnnotationService] update failed: ${(err as Error).message}`);
      return null;
    }
  }

  delete(id: string): boolean {
    try {
      const result = this.db.prepare('DELETE FROM annotations WHERE id = ?').run(id);
      return result.changes > 0;
    } catch (err) {
      console.warn(`[AnnotationService] delete failed: ${(err as Error).message}`);
      return false;
    }
  }

  clear(): void {
    try { this.db.exec('DELETE FROM annotations'); } catch (err) {
      console.warn(`[AnnotationService] clear failed: ${(err as Error).message}`);
    }
  }

  private rowToAnnotation(row: any): Annotation {
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      userId: row.user_id,
      annotationType: row.annotation_type,
      content: row.content,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// ── Active store ───────────────────────────────────────────────────

let activeStore: AnnotationStore = new InMemoryAnnotationStore();

export function initAnnotationStore(db?: any, dbPath?: string): void {
  if (db) {
    try {
      activeStore = new D1AnnotationStore(db);
    } catch (err) {
      console.warn(`[AnnotationService] D1 store init failed: ${(err as Error).message}`);
      activeStore = new InMemoryAnnotationStore();
    }
  } else if (dbPath || process.env.QUILL_DB_PATH) {
    try {
      const path = dbPath || process.env.QUILL_DB_PATH || './quill.db';
      const mod = require('better-sqlite3');
      const sqliteDb = new (mod.default || mod)(path);
      sqliteDb.pragma('journal_mode = WAL');
      sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS annotations (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          annotation_type TEXT NOT NULL CHECK(annotation_type IN ('note','override','flag','context')),
          content TEXT NOT NULL,
          metadata TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_annotations_entity ON annotations(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_annotations_user ON annotations(user_id);
      `);
      activeStore = new SqliteAnnotationStore(path);
    } catch (err) {
      console.warn(`[AnnotationService] SQLite store init failed: ${(err as Error).message}`);
      activeStore = new InMemoryAnnotationStore();
    }
  } else {
    activeStore = new InMemoryAnnotationStore();
  }
}

export function listAnnotations(entityType: string, entityId: string): Annotation[] {
  return activeStore.list(entityType, entityId);
}

export function createAnnotation(annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>): Annotation {
  return activeStore.create(annotation);
}

export function updateAnnotation(id: string, updates: Partial<Pick<Annotation, 'content' | 'annotationType' | 'metadata'>>): Annotation | null {
  return activeStore.update(id, updates);
}

export function deleteAnnotation(id: string): boolean {
  return activeStore.delete(id);
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
  activeStore.clear();
}
