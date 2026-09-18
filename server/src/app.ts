import { route, notFound } from "./router.js";
import { adminRoutes } from "./routes/admin.js";
import { publicRoutes } from "./routes/public.js";
import { spaRoutes } from "./routes/spa.js";
import { verifyRoutes } from "./routes/verify.js";

const clientDistDir = Bun.fileURLToPath(new URL("../../client/dist/", import.meta.url));

export interface AppOptions {
  hostname?: string;
  port?: number;
}

export function createApp(options: AppOptions = {}) {
  return Bun.serve({
    hostname: options.hostname ?? "127.0.0.1",
    port: options.port ?? 0,
    routes: {
      "/api/*": {
        OPTIONS: route((c) => c.body(null, 204)),
      },
      ...publicRoutes,
      ...verifyRoutes,
      ...adminRoutes,
      ...spaRoutes(clientDistDir),
    },
    fetch: notFound,
  });
}
