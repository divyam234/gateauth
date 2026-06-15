import "dotenv/config";
import { closeDatabase } from "./db.js";
import { runMigrations } from "./db/migrations.js";

try {
  await runMigrations();
} finally {
  await closeDatabase();
}
