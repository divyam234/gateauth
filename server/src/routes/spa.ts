import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";

export function registerSpaRoutes(app: Hono, clientDistDir: string): void {
  if (existsSync(clientDistDir)) {
    app.get("/assets/*", serveStatic({ root: clientDistDir }));
  }

  app.get("*", async (c) => {
    if (new URL(c.req.url).pathname.startsWith("/api/")) {
      return c.json({ error: "Not found" }, 404);
    }

    try {
      const content = await readFile(path.join(clientDistDir, "index.html"), "utf8");
      return c.html(content);
    } catch {
      return c.text("Client build not found", 404);
    }
  });
}
