/**
 * Audit Logging — Quill
 *
 * Immutable audit trail for every AI decision made by the pipeline.
 * This is **new code** — the original MapleSpike Worker had no audit logging.
 *
 * Supports structured logging for provenance tracking,
 * enabling traceability of model inputs, outputs, confidence scores, and decisions.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface AuditEntry {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Operation type */
  operation: 'curation' | 'insights' | 'bias_analysis' | 'citation_hash' | 'gov_data_sync' | 'ingestion';
  /** AI model used (or 'none' for non-AI operations) */
  model: string;
  /** Truncated input to the model (for debugging, not full content) */
  inputPreview: string;
  /** Short summary of the output/result */
  outputSummary: string;
  /** Confidence score 0-100, or null for non-scored operations */
  confidence: number | null;
  /** Whether the operation was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Associated article ID, if applicable */
  articleId?: number;
  /** Duration in milliseconds */
  durationMs: number;
}

export interface AuditQueryFilter {
  operation?: AuditEntry['operation'];
  success?: boolean;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

/* ------------------------------------------------------------------ */
/*  Logger Interface                                                   */
/* ------------------------------------------------------------------ */

/**
 * Abstract audit logger.
 * Implementations can write to D1, PostgreSQL, SQLite, or stdout.
 */
export interface AuditLogger {
  log(entry: Omit<AuditEntry, 'timestamp'>): Promise<void>;
  query(filter: AuditQueryFilter): Promise<AuditEntry[]>;
}

/* ------------------------------------------------------------------ */
/*  Console Logger (dev default)                                       */
/* ------------------------------------------------------------------ */

export class ConsoleAuditLogger implements AuditLogger {
  private entries: AuditEntry[] = [];

  async log(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
    const full: AuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };
    this.entries.push(full);
    console.log(`[AUDIT] ${full.operation} | ${full.success ? 'OK' : 'FAIL'} | ${full.model} | ${full.outputSummary}`);
  }

  async query(filter: AuditQueryFilter = {}): Promise<AuditEntry[]> {
    let results = [...this.entries];

    if (filter.operation) results = results.filter((e) => e.operation === filter.operation);
    if (filter.success !== undefined) results = results.filter((e) => e.success === filter.success);
    if (filter.since) results = results.filter((e) => e.timestamp >= filter.since!);
    if (filter.until) results = results.filter((e) => e.timestamp <= filter.until!);

    const offset = filter.offset || 0;
    const limit = filter.limit || 100;
    return results.slice(offset, offset + limit);
  }
}

/* ------------------------------------------------------------------ */
/*  SQL-based Logger (for D1 / PostgreSQL)                             */
/* ------------------------------------------------------------------ */

export interface DatabaseClient {
  prepare(sql: string): {
    bind(...params: unknown[]): {
      run(): Promise<unknown>;
      all(): Promise<{ results?: AuditEntry[] }>;
      first(): Promise<AuditEntry | null>;
    };
  };
}

/**
 * Audit logger backed by a D1-compatible SQL database.
 */
export class SQLAuditLogger implements AuditLogger {
  private db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  async log(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
    const timestamp = new Date().toISOString();

    await this.db.prepare(`
      INSERT INTO audit_log (timestamp, operation, model, input_preview, output_summary, confidence, success, error, article_id, duration_ms)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
    `).bind(
      timestamp,
      entry.operation,
      entry.model,
      entry.inputPreview.slice(0, 500),
      entry.outputSummary.slice(0, 500),
      entry.confidence,
      entry.success ? 1 : 0,
      entry.error || null,
      entry.articleId || null,
      entry.durationMs,
    ).run();
  }

  async query(filter: AuditQueryFilter = {}): Promise<AuditEntry[]> {
    let sql = 'SELECT * FROM audit_log WHERE 1=1';
    const params: unknown[] = [];

    if (filter.operation) {
      sql += ' AND operation = ?';
      params.push(filter.operation);
    }
    if (filter.success !== undefined) {
      sql += ' AND success = ?';
      params.push(filter.success ? 1 : 0);
    }
    if (filter.since) {
      sql += ' AND timestamp >= ?';
      params.push(filter.since);
    }
    if (filter.until) {
      sql += ' AND timestamp <= ?';
      params.push(filter.until);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(filter.limit || 100, filter.offset || 0);

    const result = await this.db.prepare(sql).bind(...params).all();
    return (result.results || []) as AuditEntry[];
  }
}
