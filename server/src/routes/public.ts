import { sql } from "drizzle-orm";
import { auth } from "../auth.js";
import { getAllConfig, getRuntimeCapabilities } from "../config.js";
import { applicationDomainMatches, getApplication } from "../applications.js";
import { db } from "../db.js";
import { route } from "../router.js";

export const publicRoutes = {
  "/api/public/capabilities": {
    GET: route(async (c) =>
      c.json({ capabilities: getRuntimeCapabilities(), config: await getAllConfig() }),
    ),
  },
  "/api/public/redirect-target": {
    GET: route(async (c) => {
      const application = c.req.query("application");
      const redirect = c.req.query("redirect");
      if (!application || !redirect) return c.json({ error: "Missing redirect target" }, 400);

      const protectedApplication = await getApplication(application);
      if (!protectedApplication) return c.json({ error: "Unknown protected application" }, 404);

      try {
        const target = new URL(redirect);
        if (
          !["http:", "https:"].includes(target.protocol) ||
          !applicationDomainMatches(protectedApplication, target.host)
        ) {
          return c.json({ error: "Invalid redirect target" }, 400);
        }
        return c.json({ redirect: target.toString() });
      } catch {
        return c.json({ error: "Invalid redirect target" }, 400);
      }
    }),
  },
  "/api/auth/*": {
    GET: route((c) => auth.handler(c.req.raw)),
    POST: route((c) => auth.handler(c.req.raw)),
  },
  "/api/health": {
    GET: route((c) => c.json({ status: "ok", version: "1" })),
  },
  "/api/ready": {
    GET: route(async (c) => {
      try {
        await db.execute(sql`SELECT 1`);
        return c.json({ status: "ready" });
      } catch {
        return c.json({ status: "not-ready" }, 503);
      }
    }),
  },
};
