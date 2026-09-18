import { asc, desc, eq, ilike, or } from "drizzle-orm";
import { route } from "../../router.js";
import { getRequestAuditMetadata, queryAuditEvents, writeAuditEvent } from "../../audit-log.js";
import { db } from "../../db.js";
import {
  account,
  apikey as apiKey,
  applicationUserGrants,
  applications,
  passkey,
  session,
  user,
} from "../../db/schema.js";
import { parseBoundedInteger, requireAdmin } from "../../http.js";

export const identityAdminRoutes = {
  "/api/admin/sessions": {
    GET: route(async (c) => {
    const adminSession = await requireAdmin(c);
    if (adminSession instanceof Response) return adminSession;

    const limit = parseBoundedInteger(c.req.query("limit"), 100, 1, 200);
    const rows = await db
      .select({
        id: session.id,
        userId: session.userId,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        expiresAt: session.expiresAt,
        authMethod: session.authMethod,
        mfaVerifiedAt: session.mfaVerifiedAt,
        userName: user.name,
        userEmail: user.email,
      })
      .from(session)
      .innerJoin(user, eq(user.id, session.userId))
      .orderBy(desc(session.updatedAt))
      .limit(limit);

    return c.json({
      sessions: rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        expiresAt: row.expiresAt,
        authMethod: row.authMethod,
        mfaVerifiedAt: row.mfaVerifiedAt,
        user: { name: row.userName, email: row.userEmail },
        active: row.expiresAt.getTime() > Date.now(),
      })),
    });
  }),
  },
  "/api/admin/sessions/:id": {
    DELETE: route(async (c) => {
    const adminSession = await requireAdmin(c);
    if (adminSession instanceof Response) return adminSession;

    const [deleted] = await db
      .delete(session)
      .where(eq(session.id, c.req.param("id")))
      .returning({ userId: session.userId });
    if (!deleted) return c.json({ error: "Session not found" }, 404);

    await writeAuditEvent({
      actorUserId: adminSession.user.id,
      action: "admin.session_revoked",
      targetType: "session",
      targetId: c.req.param("id"),
      metadata: { userId: deleted.userId },
      severity: "warning",
      ...getRequestAuditMetadata(c.req.raw.headers),
    });
    return c.body(null, 204);
  }),
  },
  "/api/admin/users/:id/details": {
    GET: route(async (c) => {
    const adminSession = await requireAdmin(c);
    if (adminSession instanceof Response) return adminSession;

    const id = c.req.param("id");
    const [users, sessions, accounts, passkeys, apiKeys, grants, events] = await Promise.all([
      db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          image: user.image,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          role: user.role,
          banned: user.banned,
          banReason: user.banReason,
          banExpires: user.banExpires,
          twoFactorEnabled: user.twoFactorEnabled,
        })
        .from(user)
        .where(eq(user.id, id))
        .limit(1),
      db
        .select({
          id: session.id,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          expiresAt: session.expiresAt,
          authMethod: session.authMethod,
          mfaVerifiedAt: session.mfaVerifiedAt,
        })
        .from(session)
        .where(eq(session.userId, id))
        .orderBy(desc(session.updatedAt)),
      db
        .select({
          id: account.id,
          providerId: account.providerId,
          accountId: account.accountId,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        })
        .from(account)
        .where(eq(account.userId, id))
        .orderBy(desc(account.createdAt)),
      db
        .select({
          id: passkey.id,
          name: passkey.name,
          deviceType: passkey.deviceType,
          backedUp: passkey.backedUp,
          transports: passkey.transports,
          createdAt: passkey.createdAt,
          aaguid: passkey.aaguid,
        })
        .from(passkey)
        .where(eq(passkey.userId, id))
        .orderBy(desc(passkey.createdAt)),
      db
        .select({
          id: apiKey.id,
          name: apiKey.name,
          start: apiKey.start,
          prefix: apiKey.prefix,
          enabled: apiKey.enabled,
          requestCount: apiKey.requestCount,
          lastRequest: apiKey.lastRequest,
          expiresAt: apiKey.expiresAt,
          createdAt: apiKey.createdAt,
        })
        .from(apiKey)
        .where(eq(apiKey.referenceId, id))
        .orderBy(desc(apiKey.createdAt)),
      db
        .select({
          id: applicationUserGrants.id,
          applicationId: applicationUserGrants.applicationId,
          userId: applicationUserGrants.userId,
          effect: applicationUserGrants.effect,
          expiresAt: applicationUserGrants.expiresAt,
          createdBy: applicationUserGrants.createdBy,
          createdAt: applicationUserGrants.createdAt,
          applicationName: applications.name,
          applicationSlug: applications.slug,
        })
        .from(applicationUserGrants)
        .innerJoin(applications, eq(applications.id, applicationUserGrants.applicationId))
        .where(eq(applicationUserGrants.userId, id))
        .orderBy(desc(applicationUserGrants.createdAt)),
      queryAuditEvents({ actorUserId: id, limit: 50 }),
    ]);

    if (!users[0]) return c.json({ error: "User not found" }, 404);
    return c.json({
      user: users[0],
      sessions,
      accounts,
      passkeys,
      apiKeys: apiKeys.map((key) => ({
        ...key,
        enabled: key.enabled ?? true,
        requestCount: key.requestCount ?? 0,
      })),
      grants,
      events: events.logs,
    });
  }),
  },
  "/api/admin/search": {
    GET: route(async (c) => {
    const adminSession = await requireAdmin(c);
    if (adminSession instanceof Response) return adminSession;

    const query = (c.req.query("q") || "").trim();
    if (query.length < 2) return c.json({ users: [], applications: [], events: [] });

    const pattern = `%${query}%`;
    const [users, matchingApplications, events] = await Promise.all([
      db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          banned: user.banned,
        })
        .from(user)
        .where(or(ilike(user.name, pattern), ilike(user.email, pattern)))
        .orderBy(asc(user.name))
        .limit(8),
      db
        .select({
          id: applications.id,
          name: applications.name,
          slug: applications.slug,
          enabled: applications.enabled,
          lastHealthStatus: applications.lastHealthStatus,
        })
        .from(applications)
        .where(or(ilike(applications.name, pattern), ilike(applications.slug, pattern)))
        .orderBy(asc(applications.name))
        .limit(8),
      queryAuditEvents({ search: query, limit: 8 }),
    ]);

    return c.json({
      users: users.map((row) => ({
        ...row,
        role: row.role || "user",
        banned: Boolean(row.banned),
      })),
      applications: matchingApplications,
      events: events.logs,
    });
  }),
  },
};