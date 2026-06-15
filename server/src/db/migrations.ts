import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { pool } from "../db.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(moduleDirectory, "../../drizzle");
const migrationLockId = 7_381_402_117;

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  const migrationDb = drizzle({ client });

  try {
    await migrationDb.execute(sql`SELECT pg_advisory_lock(${migrationLockId})`);
    await migrate(migrationDb, { migrationsFolder });
  } finally {
    await migrationDb
      .execute(sql`SELECT pg_advisory_unlock(${migrationLockId})`)
      .catch(() => undefined);
    client.release();
  }
}
