import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { sqlClient } from "../db.js";

const migrationsFolder = Bun.fileURLToPath(new URL("../../drizzle/", import.meta.url));
const migrationLockId = 7_381_402_117;

export async function runMigrations(): Promise<void> {
  const client = await sqlClient.reserve();
  const migrationDb = drizzle({ client });

  try {
    await client`SELECT pg_advisory_lock(${migrationLockId})`;
    await migrate(migrationDb, {
      migrationsFolder,
      migrationsSchema: "auth",
      migrationsTable: "migrations",
    });
  } finally {
    await client`SELECT pg_advisory_unlock(${migrationLockId})`.catch(() => undefined);
    client.release();
  }
}
