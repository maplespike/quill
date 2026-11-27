export { getDb, getRawDb, closeDb, checkpointIfPossible, runMigrations, createDb } from "./connection.js";
export type { DbClient, DbConfig } from "./connection.js";

export { migrateDomainTables, PG_DOMAIN_MIGRATION_SQL } from "./migrate-pg.js";

export * from "./schema.js";

// Re-export Database namespace type from better-sqlite3 for consumers
export type Database = import("better-sqlite3").Database;