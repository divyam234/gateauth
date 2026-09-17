import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { env } from "./env.js";
import * as schema from "./db/schema.js";

function databaseUrlWithSessionOptions(databaseURL: string): string {
  const url = new URL(databaseURL);
  url.searchParams.set("application_name", "gatehouse-auth");

  const existingOptions = url.searchParams.get("options")?.trim();
  const statementTimeout = `-c statement_timeout=${env.databaseStatementTimeoutMs}`;
  url.searchParams.set(
    "options",
    existingOptions ? `${existingOptions} ${statementTimeout}` : statementTimeout,
  );
  return url.toString();
}

export const sqlClient = new SQL({
  url: databaseUrlWithSessionOptions(env.databaseURL),
  max: env.databasePoolMax,
  idleTimeout: 30,
  connectionTimeout: 5,
});

export const db = drizzle({ client: sqlClient, schema, casing: "snake_case" });
export type Database = typeof db;
export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function closeDatabase(): Promise<void> {
  await sqlClient.close({ timeout: 5 });
}
