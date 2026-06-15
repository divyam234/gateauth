import type { Hono } from "hono";
import { getRequestAuditMetadata, writeAuditEvent } from "../../audit-log.js";
import { getAllConfig, getRuntimeCapabilities, setConfigMany } from "../../config.js";
import { readJsonObject, requireAdmin } from "../../http.js";

export function registerConfigAdminRoutes(app: Hono): void {
  app.get("/api/admin/config", async (c) => {
    const session = await requireAdmin(c);
    if (session instanceof Response) return session;
    return c.json({ config: await getAllConfig(), capabilities: getRuntimeCapabilities() });
  });

  app.put("/api/admin/config", async (c) => {
    const session = await requireAdmin(c);
    if (session instanceof Response) return session;
    const before = await getAllConfig();
    const body = await readJsonObject(c);
    if (body instanceof Response) return body;

    try {
      const config = await setConfigMany(body, session.user.id);
      await writeAuditEvent({
        actorUserId: session.user.id,
        action: "configuration.updated",
        targetType: "configuration",
        before,
        after: config,
        severity: "warning",
        ...getRequestAuditMetadata(c.req.raw.headers),
      });
      return c.json({ config, capabilities: getRuntimeCapabilities() });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Invalid configuration" },
        400,
      );
    }
  });
}
