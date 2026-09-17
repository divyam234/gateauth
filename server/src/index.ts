import { createApp } from "./app.js";
import { pruneAuditEvents } from "./audit-log.js";
import { bootstrapData } from "./bootstrap.js";
import { seedConfigIfEmpty } from "./config.js";
import { closeDatabase } from "./db.js";
import { runMigrations } from "./db/migrations.js";
import { env } from "./env.js";

if (env.runMigrations) await runMigrations();
await seedConfigIfEmpty();
await bootstrapData();
await pruneAuditEvents();

const auditPruneTimer = setInterval(() => {
  void pruneAuditEvents().catch((error) =>
    console.error("[audit] retention cleanup failed", error),
  );
}, 24 * 60 * 60 * 1000);
auditPruneTimer.unref();

const app = createApp({ hostname: "0.0.0.0", port: env.port });
console.info(`[server] ${env.appName} listening on ${app.url}`);

let shutdownPromise: Promise<void> | null = null;

async function shutdown(signal: string): Promise<void> {
  if (shutdownPromise) return shutdownPromise;

  shutdownPromise = (async () => {
    clearInterval(auditPruneTimer);
    console.info(`[server] received ${signal}, shutting down`);

    const forceExitTimer = setTimeout(() => {
      console.error("[server] graceful shutdown timed out");
      process.exit(1);
    }, 10_000);
    forceExitTimer.unref();

    try {
      await app.stop();
      await closeDatabase();
      clearTimeout(forceExitTimer);
    } catch (error) {
      clearTimeout(forceExitTimer);
      console.error("[server] shutdown failed", error);
      process.exitCode = 1;
    }
  })();

  return shutdownPromise;
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

export { app };
