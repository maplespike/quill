// Database connection utilities — delegated to shared @maplespike/database package
export {
 createDb,
 runMigrations,
 getDb,
 getRawDb,
 closeDb,
 checkpointIfPossible,
} from '@maplespike/database';
export type { DbClient, DbConfig } from '@maplespike/database';

// Utility functions (moved from deprecated sources/types.ts)
export function generateId(): string {
 return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
 const r = (Math.random() * 16) | 0;
 const v = c === "x" ? r : (r & 0x3) | 0x8;
 return v.toString(16);
 });
}

export function nowISO(): string {
 return new Date().toISOString();
}
