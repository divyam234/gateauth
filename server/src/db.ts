import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "./env.js";
import * as schema from "./db/schema.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseURL,
  max: env.databasePoolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: env.databaseStatementTimeoutMs,
  application_name: "gatehouse-auth",
});

pool.on("error", (error) => {
  console.error("[database] idle client error", error);
});

export const db = drizzle({ client: pool, schema, casing: "snake_case" });
export type Database = typeof db;
export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
