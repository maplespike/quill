export { getDb, getRawDb, closeDb, runMigrations, createDb } from "./connection.js";
export type { DbClient, DbConfig } from "./connection.js";

export { migrateDomainTables, PG_DOMAIN_MIGRATION_SQL } from "./migrate-pg.js";
export {
  applyMediaRssMetadataSqlite,
  applyMediaRssMetadataPostgres,
  applyMediaRssMetadataD1,
  applyMediaRssMetadataMemory,
} from "./media-rss-migration.js";
export type { SqliteLike, PgLike, D1Like } from "./media-rss-migration.js";

export * from "./schema.js";

// Re-export Database namespace type from better-sqlite3 for consumers
export type Database = import("better-sqlite3").Database;