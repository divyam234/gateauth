type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

type RoutedRequest = Request & {
  params?: Record<string, string>;
};

export type RouteHandler = (context: RouteContext) => Response | Promise<Response>;
export type ResponseFinalizer = (
  request: Request,
  response: Response,
) => Response | Promise<Response>;
export type RouteErrorHandler = (error: unknown, request: Request) => Response | Promise<Response>;

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

type BunRouteHandler = (request: RoutedRequest) => Response | Promise<Response>;
type BunMethodRoutes = Partial<Record<HttpMethod, BunRouteHandler>>;

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

export class BunRouter {
  readonly routes: Record<string, BunRouteHandler | BunMethodRoutes> = {};
  private finalizer: ResponseFinalizer = (_request, response) => response;
  private errorHandler: RouteErrorHandler = (error) => {
    console.error("[server] unhandled request error", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  };

  finalizeWith(finalizer: ResponseFinalizer): void {
    this.finalizer = finalizer;
  }

  onError(handler: RouteErrorHandler): void {
    this.errorHandler = handler;
  }

  get(path: string, handler: RouteHandler): void {
    this.register("GET", path, handler);
  }

  post(path: string, handler: RouteHandler): void {
    this.register("POST", path, handler);
  }

  put(path: string, handler: RouteHandler): void {
    this.register("PUT", path, handler);
  }

  patch(path: string, handler: RouteHandler): void {
    this.register("PATCH", path, handler);
  }

  delete(path: string, handler: RouteHandler): void {
    this.register("DELETE", path, handler);
  }

  options(path: string, handler: RouteHandler): void {
    this.register("OPTIONS", path, handler);
  }

  on(methods: HttpMethod[], path: string, handler: RouteHandler): void {
    for (const method of methods) this.register(method, path, handler);
  }

  private register(method: HttpMethod, path: string, handler: RouteHandler): void {
    const routePaths = path === "*" ? ["/", "/*"] : [path];
    const wrapped: BunRouteHandler = async (request) => {
      try {
        const response = await handler(createContext(request));
        return await this.finalizer(request, response);
      } catch (error) {
        const response = await this.errorHandler(error, request);
        return await this.finalizer(request, response);
      }
    };

    for (const routePath of routePaths) {
      const existing = this.routes[routePath];
      if (!existing || typeof existing === "function") {
        const methods: BunMethodRoutes = {};
        methods[method] = wrapped;
        this.routes[routePath] = methods;
        continue;
      }
      existing[method] = wrapped;
    }
  }
}
