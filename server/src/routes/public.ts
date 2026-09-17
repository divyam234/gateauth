import { sql } from "drizzle-orm";
import type { BunRouter } from "../router.js";
import { auth } from "../auth.js";
import { getAllConfig, getRuntimeCapabilities } from "../config.js";
import { applicationDomainMatches, getApplication } from "../applications.js";
import { db } from "../db.js";

export function registerPublicRoutes(app: BunRouter): void {
  app.get("/api/public/capabilities", async (c) =>
    c.json({ capabilities: getRuntimeCapabilities(), config: await getAllConfig() }),
  );

  app.get("/api/public/redirect-target", async (c) => {
    const application = c.req.query("application");
    const redirect = c.req.query("redirect");
    if (!application || !redirect) return c.json({ error: "Missing redirect target" }, 400);

    const protectedApplication = await getApplication(application);
    if (!protectedApplication) return c.json({ error: "Unknown protected application" }, 404);

    try {
      const target = new URL(redirect);
      if (!["http:", "https:"].includes(target.protocol) || !applicationDomainMatches(protectedApplication, target.host)) {
        return c.json({ error: "Invalid redirect target" }, 400);
      }
      return c.json({ redirect: target.toString() });
    } catch {
      return c.json({ error: "Invalid redirect target" }, 400);
    }
  });

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
