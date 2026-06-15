import type { Context } from "hono";
import { auth } from "./auth.js";

export type AdminSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isAdminRole(role: unknown): boolean {
  return String(role ?? "user")
    .split(",")
    .map((value) => value.trim())
    .includes("admin");
}

export async function requireAdmin(c: Context): Promise<AdminSession | Response> {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  if (!isAdminRole(session.user.role)) return c.json({ error: "Forbidden" }, 403);
  return session;
}

export async function readJsonObject(c: Context): Promise<Record<string, unknown> | Response> {
  try {
    const body: unknown = await c.req.json();
    return isRecord(body) ? body : c.json({ error: "JSON body must be an object" }, 400);
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
}

export function cleanHeader(value: unknown): string {
  return String(value ?? "").replace(/[\r\n]/g, " ").slice(0, 4096);
}

export function parseBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}
