import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { BunRouter, RouteContext } from "../router.js";
import { auth } from "../auth.js";
import {
  getApplication,
  getApplicationByHost,
  listApplications,
  type ProtectedApplication,
} from "../applications.js";
import { getRequestAuditMetadata, writeAuditEvent } from "../audit-log.js";
import { db } from "../db.js";
import { applicationUserGrants, user } from "../db/schema.js";
import { env } from "../env.js";
import { cleanHeader, isRecord } from "../http.js";
import { evaluatePolicy, type PolicySession } from "../policy.js";

function getClientIp(headers: Headers): string | null {
  for (const name of env.trustedIpHeaders) {
    const value = headers.get(name);
    if (value) return value.split(",")[0]?.trim() ?? null;
  }
  return null;
}

function forwardedPath(headers: Headers, fallback: string): string {
  const value =
    headers.get("x-forwarded-uri") ||
    headers.get("x-original-uri") ||
    headers.get("x-forwarded-path") ||
    fallback;

  try {
    return value.startsWith("http") ? new URL(value).pathname : value.split("?")[0] || "/";
  } catch {
    return "/";
  }
}

async function resolveRequestApplication(c: RouteContext): Promise<ProtectedApplication | null> {
  const explicit = c.req.query("application") || c.req.header("x-auth-application");
  if (explicit) return getApplication(explicit);

  const host = c.req.header("x-forwarded-host") || c.req.header("host");
  if (host) {
    const application = await getApplicationByHost(host);
    if (application) return application;
  }

  const registeredApplications = await listApplications();
  return registeredApplications.length === 1 ? registeredApplications[0] : null;
}

async function resolveApiKeySession(headers: Headers): Promise<PolicySession | null> {
  const authorization = headers.get("authorization") || "";
  const key =
    headers.get("x-api-key") ||
    (authorization.toLowerCase().startsWith("apikey ")
      ? authorization.slice(7).trim()
      : null);

  if (!key) return null;

  const result = await auth.api.verifyApiKey({ body: { key } });
  if (!result.valid || !result.key) return null;

  const [owner] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled,
    })
    .from(user)
    .where(eq(user.id, result.key.referenceId))
    .limit(1);
  if (!owner) return null;

  return {
    createdAt: result.key.createdAt,
    authMethod: "api-key",
    mfaVerifiedAt: null,
    user: {
      id: owner.id,
      name: owner.name,
      email: owner.email,
      role: owner.role,
      twoFactorEnabled: Boolean(owner.twoFactorEnabled),
    },
  };
}

function readSessionAssurance(value: unknown): {
  authMethod: string;
  mfaVerifiedAt: string | Date | null;
} {
  if (!isRecord(value)) return { authMethod: "session", mfaVerifiedAt: null };
  return {
    authMethod: typeof value.authMethod === "string" ? value.authMethod : "session",
    mfaVerifiedAt:
      typeof value.mfaVerifiedAt === "string" || value.mfaVerifiedAt instanceof Date
        ? value.mfaVerifiedAt
        : null,
  };
}

async function resolvePolicySession(
  headers: Headers,
): Promise<{ session: PolicySession | null; method: string | null }> {
  const current = await auth.api.getSession({ headers });
  if (current) {
    const assurance = readSessionAssurance(current.session);
    return {
      method: assurance.authMethod,
      session: {
        createdAt: current.session.createdAt,
        authMethod: assurance.authMethod,
        mfaVerifiedAt: assurance.mfaVerifiedAt,
        user: {
          id: current.user.id,
          name: current.user.name,
          email: current.user.email,
          role: current.user.role,
          twoFactorEnabled: current.user.twoFactorEnabled,
        },
      },
    };
  }

  const apiKeySession = await resolveApiKeySession(headers);
  return { session: apiKeySession, method: apiKeySession?.authMethod || null };
}

async function applyUserGrant(
  application: ProtectedApplication,
  session: PolicySession | null,
): Promise<{ application: ProtectedApplication; denied: boolean }> {
  if (!session) return { application, denied: false };

  const [grant] = await db
    .select({ effect: applicationUserGrants.effect })
    .from(applicationUserGrants)
    .where(
      and(
        eq(applicationUserGrants.applicationId, application.id),
        eq(applicationUserGrants.userId, session.user.id),
        or(
          isNull(applicationUserGrants.expiresAt),
          gt(applicationUserGrants.expiresAt, new Date()),
        ),
      ),
    )
    .limit(1);

  if (grant?.effect === "deny") return { application, denied: true };
  if (grant?.effect !== "allow") return { application, denied: false };

  return {
    application: {
      ...application,
      policy: {
        ...application.policy,
        allowedRoles: [],
        allowedEmailDomains: [],
      },
    },
    denied: false,
  };
}

export function registerVerifyRoutes(app: BunRouter): void {
  app.get("/api/verify", async (c) => {
    const application = await resolveRequestApplication(c);
    if (!application) return c.json({ error: "Unknown protected application" }, 404);

    const path = forwardedPath(c.req.raw.headers, c.req.query("path") || "/");
    const ipAddress = getClientIp(c.req.raw.headers);
    const identity = await resolvePolicySession(c.req.raw.headers);
    const grant = await applyUserGrant(application, identity.session);

    if (grant.denied) {
      await writeAuditEvent({
        actorUserId: identity.session?.user.id ?? null,
        action: "proxy.access_denied",
        targetType: "application",
        targetId: application.id,
        applicationId: application.id,
        outcome: "denied",
        severity: "warning",
        metadata: { reason: "explicit_user_deny", path, method: identity.method },
        ...getRequestAuditMetadata(c.req.raw.headers),
      });
      return new Response(null, {
        status: 403,
        headers: { "X-Auth-Reason": "explicit_user_deny", "Cache-Control": "no-store" },
      });
    }

    const decision = evaluatePolicy(grant.application, identity.session, { path, ipAddress });
    if (!decision.allowed) {
      await writeAuditEvent({
        actorUserId: identity.session?.user.id ?? null,
        action: "proxy.access_denied",
        targetType: "application",
        targetId: application.id,
        applicationId: application.id,
        outcome: "denied",
        severity: decision.status === 403 ? "warning" : "info",
        metadata: { reason: decision.reason, path, method: identity.method },
        ...getRequestAuditMetadata(c.req.raw.headers),
      });
      return new Response(null, {
        status: decision.status,
        headers: { "X-Auth-Reason": decision.reason, "Cache-Control": "no-store" },
      });
    }

    const responseHeaders = new Headers({
      "X-Auth-Application-Id": application.id,
      "X-Auth-Application-Slug": application.slug,
      "X-Auth-Method": identity.method || "public",
      "X-Auth-Public": String(decision.public),
      "Cache-Control": "no-store",
    });

    if (identity.session) {
      responseHeaders.set("X-Auth-User-Id", cleanHeader(identity.session.user.id));
      responseHeaders.set("X-Auth-User-Email", cleanHeader(identity.session.user.email));
      responseHeaders.set("X-Auth-User-Name", cleanHeader(identity.session.user.name));
      responseHeaders.set("X-Auth-User-Role", cleanHeader(identity.session.user.role || "user"));
      responseHeaders.set("X-Auth-MFA", String(Boolean(identity.session.mfaVerifiedAt)));
    }

    return new Response(null, { status: 200, headers: responseHeaders });
  });
}
