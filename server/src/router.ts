import { env } from "./env.js";

type RoutedRequest = Request & {
  params?: Record<string, string>;
};

export type RouteHandler = (context: RouteContext) => Response | Promise<Response>;

export interface RouteRequest {
  readonly raw: Request;
  readonly url: string;
  query(name: string): string | undefined;
  header(name: string): string | undefined;
  param(name: string): string;
  json<T = unknown>(): Promise<T>;
}

export interface RouteContext {
  readonly req: RouteRequest;
  header(name: string, value: string): void;
  json(value: unknown, status?: number): Response;
  text(value: string, status?: number): Response;
  html(value: string, status?: number): Response;
  body(value: BodyInit | null, status?: number): Response;
}

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
    response.headers.set("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set(
      "access-control-allow-headers",
      "Content-Type, Authorization, X-API-Key, X-Request-ID, X-Captcha-Response",
    );
    response.headers.set("access-control-expose-headers", "X-Request-ID");
    addVary(response.headers, "Origin");
  }

  return response;
}

function createContext(request: RoutedRequest): RouteContext {
  const responseHeaders = new Headers();
  const url = new URL(request.url);

  const response = (body: BodyInit | null, status: number, contentType?: string) => {
    const headers = new Headers(responseHeaders);
    if (contentType && !headers.has("content-type")) headers.set("content-type", contentType);
    return new Response(body, { status, headers });
  };

  return {
    req: {
      raw: request,
      url: request.url,
      query(name) {
        return url.searchParams.get(name) ?? undefined;
      },
      header(name) {
        return request.headers.get(name) ?? undefined;
      },
      param(name) {
        return request.params?.[name] ?? "";
      },
      json<T>() {
        return request.json() as Promise<T>;
      },
    },
    header(name, value) {
      responseHeaders.set(name, value);
    },
    json(value, status = 200) {
      const headers = new Headers(responseHeaders);
      if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
      return Response.json(value, { status, headers });
    },
    text(value, status = 200) {
      return response(value, status, "text/plain; charset=utf-8");
    },
    html(value, status = 200) {
      return response(value, status, "text/html; charset=utf-8");
    },
    body(value, status = 200) {
      return response(value, status);
    },
  };
}

export function route(handler: RouteHandler) {
  return async (request: RoutedRequest): Promise<Response> => {
    try {
      return finalizeResponse(request, await handler(createContext(request)));
    } catch (error) {
      console.error("[server] unhandled request error", error);
      const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
      return finalizeResponse(
        request,
        Response.json(
          { error: "Internal server error", requestId },
          { status: 500, headers: { "x-request-id": requestId } },
        ),
      );
    }
  };
}

export function notFound(request: Request): Response {
  return finalizeResponse(request, Response.json({ error: "Not found" }, { status: 404 }));
}
