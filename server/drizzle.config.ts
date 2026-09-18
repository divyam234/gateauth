import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  migrations: {
    schema: "auth",
    table: "migrations",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/gateauth",
  },
  strict: true,
  verbose: true,
});
