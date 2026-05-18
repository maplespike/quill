export { getDb, getRawDb, closeDb, runMigrations, createDb, getRawFromDb } from "./connection";
export type { DbClient, DbConfig } from "./connection";

export * from "./schema";

// Re-export Database namespace type from better-sqlite3 for consumers
export type Database = import("better-sqlite3").Database;
