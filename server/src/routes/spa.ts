import { route } from "../router.js";

function assetPath(clientDistDir: string, requestUrl: string): string | null {
  const pathname = new URL(requestUrl).pathname;
  const rawPath = pathname.startsWith("/assets/") ? pathname.slice("/assets/".length) : "";

  try {
    const decoded = decodeURIComponent(rawPath);
    if (!decoded || decoded.includes("\\")) return null;
    if (decoded.split("/").some((segment) => segment === "." || segment === "..")) return null;
    return `${clientDistDir}/assets/${decoded}`;
  } catch {
    return null;
  }
}

export function spaRoutes(clientDistDir: string) {
  return {
    "/assets/*": {
      GET: route(async (c) => {
        const path = assetPath(clientDistDir, c.req.url);
        if (!path) return c.text("Not found", 404);

        const file = Bun.file(path);
        if (!(await file.exists())) return c.text("Not found", 404);
        return new Response(file);
      }),
    },
    "/*": {
      GET: route(async (c) => {
        if (new URL(c.req.url).pathname.startsWith("/api/")) {
          return c.json({ error: "Not found" }, 404);
        }

        const file = Bun.file(`${clientDistDir}/index.html`);
        if (!(await file.exists())) return c.text("Client build not found", 404);
        return new Response(file);
      }),
    },
  };
}
