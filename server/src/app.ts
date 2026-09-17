import { env } from "./env.js";
import { BunRouter } from "./router.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerPublicRoutes } from "./routes/public.js";
import { registerSpaRoutes } from "./routes/spa.js";
import { registerVerifyRoutes } from "./routes/verify.js";

const clientDistDir = Bun.fileURLToPath(new URL("../../client/dist/", import.meta.url));
const corsMethods = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const corsHeaders = "Content-Type, Authorization, X-API-Key, X-Request-ID, X-Captcha-Response";

function addVary(headers: Headers, value: string): void {
  const current = headers.get("vary");
  const values = new Set((current ?? "").split(",").map((item) => item.trim()).filter(Boolean));
  values.add(value);
  headers.set("vary", [...values].join(", "));
}

function finalizeResponse(request: Request, response: Response): Response {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith("/api/")) return response;

  const requestId =
    response.headers.get("x-request-id") || request.headers.get("x-request-id") || crypto.randomUUID();
  response.headers.set("x-request-id", requestId);
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");

  const origin = request.headers.get("origin");
  if (origin && env.corsOrigins.includes(origin)) {
    response.headers.set("access-control-allow-origin", origin);
    response.headers.set("access-control-allow-credentials", "true");
    response.headers.set("access-control-allow-methods", corsMethods);
    response.headers.set("access-control-allow-headers", corsHeaders);
    response.headers.set("access-control-expose-headers", "X-Request-ID");
    addVary(response.headers, "Origin");
  }

  return response;
}

export interface AppOptions {
  hostname?: string;
  port?: number;
}

export function createApp(options: AppOptions = {}) {
  const app = new BunRouter();
  app.finalizeWith(finalizeResponse);
  app.onError((error, request) => {
    console.error("[server] unhandled request error", error);
    const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
    return Response.json(
      { error: "Internal server error", requestId },
      { status: 500, headers: { "x-request-id": requestId } },
    );
  });

  app.options("/api/*", (c) => c.body(null, 204));
  registerPublicRoutes(app);
  registerVerifyRoutes(app);
  registerAdminRoutes(app);
  registerSpaRoutes(app, clientDistDir);

  return Bun.serve({
    hostname: options.hostname ?? "127.0.0.1",
    port: options.port ?? 0,
    routes: app.routes,
    fetch(request) {
      return finalizeResponse(
        request,
        Response.json({ error: "Not found" }, { status: 404 }),
      );
    },
  });
}
