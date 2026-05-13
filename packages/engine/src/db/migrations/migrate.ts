import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface MigrationFile {
  sequence: number;
  name: string;
  sql: string;
}

function getMigrations(): MigrationFile[] {
  const files = readdirSync(__dirname)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  return files.map((file) => {
    const match = file.match(/^(\d+)_/);
    if (!match) {
      throw new Error(
        `Migration file "${file}" does not start with a numeric sequence prefix (e.g., 001_)`
      );
    }
    const sequence = parseInt(match[1], 10);
    const sql = readFileSync(resolve(__dirname, file), "utf-8");
    return { sequence, name: file, sql };
  });
}

async function main(): Promise<void> {
  const pool = new pg.Pool({
    host: process.env.PGHOST || "localhost",
    port: parseInt(process.env.PGPORT || "5432", 10),
    database: process.env.PGDATABASE || "civint",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "postgres",
  });

  const client = await pool.connect();

  try {
    const migrations = getMigrations();

    if (migrations.length === 0) {
      console.log("No migration files found.");
      return;
    }

    console.log(`Found ${migrations.length} migration(s) to apply.`);

    for (const migration of migrations) {
      console.log(`Applying: ${migration.name} ...`);
      await client.query(migration.sql);
      console.log(`  OK: ${migration.name}`);
    }

    console.log("\nAll migrations applied successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
