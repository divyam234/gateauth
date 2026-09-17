import { sql } from "drizzle-orm";
import type { BunRouter } from "../router.js";
import { auth } from "../auth.js";
import { getAllConfig, getRuntimeCapabilities } from "../config.js";
import { db } from "../db.js";

export function registerPublicRoutes(app: BunRouter): void {
  app.get("/api/public/capabilities", async (c) =>
    c.json({ capabilities: getRuntimeCapabilities(), config: await getAllConfig() }),
  );

  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

  app.get("/api/health", (c) => c.json({ status: "ok", version: "1" }));
  app.get("/api/ready", async (c) => {
    try {
      await db.execute(sql`SELECT 1`);
      return c.json({ status: "ready" });
    } catch {
      return c.json({ status: "not-ready" }, 503);
    }
  });
}
