import path from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerPublicRoutes } from "./routes/public.js";
import { registerSpaRoutes } from "./routes/spa.js";
import { registerVerifyRoutes } from "./routes/verify.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientDistDir = path.resolve(currentDirectory, "../../client/dist");

export function createApp(): Hono {
  const app = new Hono();

  app.use("/api/*", async (c, next) => {
    const requestId = c.req.header("x-request-id") || crypto.randomUUID();
    c.header("x-request-id", requestId);
    c.header("x-content-type-options", "nosniff");
    c.header("referrer-policy", "strict-origin-when-cross-origin");
    c.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
    await next();
  });

  app.use(
    "/api/*",
    cors({
      origin: env.corsOrigins,
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-API-Key",
        "X-Request-ID",
        "X-Captcha-Response",
      ],
      exposeHeaders: ["X-Request-ID"],
    }),
  );

  registerPublicRoutes(app);
  registerVerifyRoutes(app);
  registerAdminRoutes(app);
  registerSpaRoutes(app, clientDistDir);

  app.onError((error, c) => {
    console.error("[server] unhandled request error", error);
    return c.json(
      {
        error: "Internal server error",
        requestId: c.res.headers.get("x-request-id"),
      },
      500,
    );
  });

  return app;
}
