export { getDb, getRawDb, closeDb, runMigrations, createDb } from "./connection.js";
export type { DbClient, DbConfig } from "./connection.js";

export { migrateDomainTables, PG_DOMAIN_MIGRATION_SQL } from "./migrate-pg.js";
export {
  donationAmountBand,
  donationParty,
  aggregateDonationRows,
} from "./donation-aggregate.js";
export type { StoredDonationAggregate } from "./donation-aggregate.js";
export {
  applyPrivateNamesSqlite,
  applyPrivateNamesPostgres,
  applyPrivateNamesD1,
  applyPrivateNamesMemory,
} from "./private-names-migration.js";

export * from "./schema.js";

// Re-export Database namespace type from better-sqlite3 for consumers
export type Database = import("better-sqlite3").Database;