export { getDb, getRawDb, closeDb, runMigrations, createDb } from "./connection.js";
export type { DbClient, DbConfig } from "./connection.js";

export { migrateDomainTables, PG_DOMAIN_MIGRATION_SQL } from "./migrate-pg.js";
export { dropSediInsiderSqlite, dropSediInsiderPostgres } from "./migrations/003_drop_sedi_insider.js";
export type { DropSediResult, SqliteLike, PgQuery } from "./migrations/003_drop_sedi_insider.js";

export * from "./schema.js";

// Re-export Database namespace type from better-sqlite3 for consumers
export type Database = import("better-sqlite3").Database;