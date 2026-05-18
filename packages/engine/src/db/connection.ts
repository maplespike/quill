// Database connection utilities — delegated to shared @maplespike/database package
export {
  createDb,
  runMigrations,
  getDb,
  getRawDb,
  closeDb,
} from '@maplespike/database';
export type { DbClient, DbConfig } from '@maplespike/database';
