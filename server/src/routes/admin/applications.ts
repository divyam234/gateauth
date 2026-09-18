import { route } from "../../router.js";
import {
  checkApplicationHealth,
  createApplication,
  deleteApplication,
  getApplication,
  listApplications,
  updateApplication,
  type ApplicationInput,
} from "../../applications.js";
import { getRequestAuditMetadata, writeAuditEvent } from "../../audit-log.js";
import { isRecord, readJsonObject, requireAdmin } from "../../http.js";
import { getOverview } from "../../overview.js";
import { evaluatePolicy } from "../../policy.js";

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readOptionalString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}

function parseApplicationInput(body: Record<string, unknown>): ApplicationInput {
  const policy = isRecord(body.policy) ? body.policy : undefined;
  return {
    name: readString(body.name),
    slug: readString(body.slug),
    description: readOptionalString(body.description),
    iconUrl: readOptionalString(body.iconUrl),
    upstreamUrl: readString(body.upstreamUrl),
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    healthCheckPath:
      typeof body.healthCheckPath === "string" ? body.healthCheckPath : undefined,
    domains: readStringArray(body.domains),
    publicPaths: readStringArray(body.publicPaths),
    policy: policy
      ? {
          name: typeof policy.name === "string" ? policy.name : undefined,
          enabled: typeof policy.enabled === "boolean" ? policy.enabled : undefined,
          priority: typeof policy.priority === "number" ? policy.priority : undefined,
          allowedRoles: readStringArray(policy.allowedRoles),
          allowedEmailDomains: readStringArray(policy.allowedEmailDomains),
          allowedIpCidrs: readStringArray(policy.allowedIpCidrs),
          requireMfa: typeof policy.requireMfa === "boolean" ? policy.requireMfa : undefined,
          sessionMaxAgeSeconds:
            policy.sessionMaxAgeSeconds === null || typeof policy.sessionMaxAgeSeconds === "number"
              ? policy.sessionMaxAgeSeconds
              : undefined,
        }
      : undefined,
  };
}

function parsePolicySimulation(body: Record<string, unknown>) {
  const applicationId = readString(body.applicationId).trim();
  if (!applicationId) throw new Error("applicationId is required");

  let user: {
    id?: string;
    email: string;
    name?: string;
    role?: string;
    twoFactorEnabled?: boolean;
  } | null = null;

  if (body.user !== null && body.user !== undefined) {
    if (!isRecord(body.user)) throw new Error("user must be an object or null");
    const email = readString(body.user.email).trim();
    if (!email) throw new Error("user.email is required when simulating a user");
    user = {
      id: typeof body.user.id === "string" ? body.user.id : undefined,
      email,
      name: typeof body.user.name === "string" ? body.user.name : undefined,
      role: typeof body.user.role === "string" ? body.user.role : undefined,
      twoFactorEnabled:
        typeof body.user.twoFactorEnabled === "boolean"
          ? body.user.twoFactorEnabled
          : undefined,
    };
  }

  return {
    applicationId,
    path: typeof body.path === "string" ? body.path : "/",
    ipAddress: typeof body.ipAddress === "string" ? body.ipAddress : null,
    user,
    sessionCreatedAt:
      typeof body.sessionCreatedAt === "string" ? body.sessionCreatedAt : undefined,
    mfaVerified: body.mfaVerified === true,
  };
}

export const applicationAdminRoutes = {
  "/api/admin/overview": {
    GET: route(async (c) => {
    const session = await requireAdmin(c);
    if (session instanceof Response) return session;
    return c.json(await getOverview());
  }),
  },
  "/api/admin/applications": {
    GET: route(async (c) => {
    const session = await requireAdmin(c);
    if (session instanceof Response) return session;
    return c.json({ applications: await listApplications() });
  }),
    POST: route(async (c) => {
    const session = await requireAdmin(c);
    if (session instanceof Response) return session;
    const body = await readJsonObject(c);
    if (body instanceof Response) return body;

    try {
      const application = await createApplication(parseApplicationInput(body));
      await writeAuditEvent({
        actorUserId: session.user.id,
        action: "application.created",
        targetType: "application",
        targetId: application.id,
        applicationId: application.id,
        after: application,
        severity: "warning",
        ...getRequestAuditMetadata(c.req.raw.headers),
      });
      return c.json({ application }, 201);
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Invalid application" },
        400,
      );
    }
  }),
  },
  "/api/admin/applications/:id": {
    GET: route(async (c) => {
    const session = await requireAdmin(c);
    if (session instanceof Response) return session;
    const application = await getApplication(c.req.param("id"));
    return application ? c.json({ application }) : c.json({ error: "Not found" }, 404);
  }),
    PUT: route(async (c) => {
    const session = await requireAdmin(c);
    if (session instanceof Response) return session;
    const before = await getApplication(c.req.param("id"));
    if (!before) return c.json({ error: "Not found" }, 404);
    const body = await readJsonObject(c);
    if (body instanceof Response) return body;

    try {
      const application = await updateApplication(before.id, parseApplicationInput(body));
      await writeAuditEvent({
        actorUserId: session.user.id,
        action: "application.updated",
        targetType: "application",
        targetId: application.id,
        applicationId: application.id,
        before,
        after: application,
        severity: "warning",
        ...getRequestAuditMetadata(c.req.raw.headers),
      });
      return c.json({ application });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Invalid application" },
        400,
      );
    }
  }),
    DELETE: route(async (c) => {
    const session = await requireAdmin(c);
    if (session instanceof Response) return session;
    const before = await getApplication(c.req.param("id"));
    if (!before) return c.json({ error: "Not found" }, 404);

    await deleteApplication(before.id);
    await writeAuditEvent({
      actorUserId: session.user.id,
      action: "application.deleted",
      targetType: "application",
      targetId: before.id,
      outcome: "success",
      severity: "critical",
      before,
      ...getRequestAuditMetadata(c.req.raw.headers),
    });
    return c.body(null, 204);
  }),
  },
  "/api/admin/applications/:id/check-health": {
    POST: route(async (c) => {
    const session = await requireAdmin(c);
    if (session instanceof Response) return session;
    try {
      return c.json({ application: await checkApplicationHealth(c.req.param("id")) });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Health check failed" },
        404,
      );
    }
  }),
  },
  "/api/admin/policy/simulate": {
    POST: route(async (c) => {
    const session = await requireAdmin(c);
    if (session instanceof Response) return session;
    const body = await readJsonObject(c);
    if (body instanceof Response) return body;

    try {
      const input = parsePolicySimulation(body);
      const application = await getApplication(input.applicationId);
      if (!application) return c.json({ error: "Application not found" }, 404);

      const simulatedSession = input.user
        ? {
            createdAt: input.sessionCreatedAt || new Date().toISOString(),
            authMethod: input.mfaVerified ? "mfa" : "simulation",
            mfaVerifiedAt: input.mfaVerified ? new Date().toISOString() : null,
            user: {
              id: input.user.id || "simulation",
              email: input.user.email,
              name: input.user.name,
              role: input.user.role || "user",
              twoFactorEnabled: input.user.twoFactorEnabled || false,
            },
          }
        : null;
      const decision = evaluatePolicy(application, simulatedSession, {
        path: input.path,
        ipAddress: input.ipAddress,
      });
      return c.json({
        decision,
        application: {
          id: application.id,
          name: application.name,
          slug: application.slug,
        },
      });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Invalid policy simulation" },
        400,
      );
    }
  }),
  },
};