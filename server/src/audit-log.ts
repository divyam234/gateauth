import { createAuthMiddleware } from "better-auth/api";
import { and, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { getConfig } from "./config.js";
import { db } from "./db.js";
import { auditEvents, type AuditEventRow } from "./db/schema.js";

export type AuditOutcome = "success" | "failure" | "denied";
export type AuditSeverity = "info" | "warning" | "critical";

type AuthSessionSummary = {
  user?: { id?: string; email?: string };
  session?: { id?: string };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readAuthSession(value: unknown): AuthSessionSummary | undefined {
  if (!isRecord(value)) return undefined;
  const user = isRecord(value.user)
    ? {
        id: typeof value.user.id === "string" ? value.user.id : undefined,
        email: typeof value.user.email === "string" ? value.user.email : undefined,
      }
    : undefined;
  const session = isRecord(value.session)
    ? { id: typeof value.session.id === "string" ? value.session.id : undefined }
    : undefined;
  return { user, session };
}

export interface AuditEventInput {
  actorUserId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  applicationId?: string | null;
  outcome?: AuditOutcome;
  severity?: AuditSeverity;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  before?: unknown;
  after?: unknown;
  createdAt?: Date;
}

export interface AuditEvent {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  applicationId: string | null;
  outcome: AuditOutcome;
  severity: AuditSeverity;
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  before: unknown;
  after: unknown;
  createdAt: string;
}

function requestMetadata(headers?: Headers | null) {
  return {
    requestId: headers?.get("x-request-id") || null,
    ipAddress:
      headers?.get("cf-connecting-ip") ||
      headers?.get("x-real-ip") ||
      headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null,
    userAgent: headers?.get("user-agent") || null,
  };
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!isRecord(value)) return value;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (/password|secret|token|key|code|otp/i.test(key)) output[key] = "[REDACTED]";
    else output[key] = redact(child);
  }
  return output;
}

export async function writeAuditEvent(input: AuditEventInput): Promise<AuditEvent> {
  const [row] = await db
    .insert(auditEvents)
    .values({
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      applicationId: input.applicationId ?? null,
      outcome: input.outcome ?? "success",
      severity: input.severity ?? "info",
      requestId: input.requestId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ? (redact(input.metadata) as Record<string, unknown>) : null,
      beforeData: input.before === undefined ? null : redact(input.before),
      afterData: input.after === undefined ? null : redact(input.after),
      createdAt: input.createdAt ?? new Date(),
    })
    .returning();
  if (!row) throw new Error("Failed to create audit event");
  return mapRow(row);
}

export interface AuditEventQuery {
  limit?: number;
  offset?: number;
  actorUserId?: string;
  action?: string;
  applicationId?: string;
  outcome?: AuditOutcome;
  severity?: AuditSeverity;
  search?: string;
  from?: string;
  to?: string;
}

export async function queryAuditEvents(
  query: AuditEventQuery = {},
): Promise<{ logs: AuditEvent[]; total: number }> {
  const limit = Math.max(1, Math.min(query.limit ?? 50, 500));
  const offset = Math.max(0, query.offset ?? 0);
  const conditions: SQL[] = [];

  if (query.actorUserId) conditions.push(eq(auditEvents.actorUserId, query.actorUserId));
  if (query.action) conditions.push(eq(auditEvents.action, query.action));
  if (query.applicationId) conditions.push(eq(auditEvents.applicationId, query.applicationId));
  if (query.outcome) conditions.push(eq(auditEvents.outcome, query.outcome));
  if (query.severity) conditions.push(eq(auditEvents.severity, query.severity));
  if (query.from) conditions.push(gte(auditEvents.createdAt, new Date(query.from)));
  if (query.to) conditions.push(lte(auditEvents.createdAt, new Date(query.to)));
  if (query.search) {
    const pattern = `%${query.search}%`;
    const searchCondition = or(
      ilike(auditEvents.action, pattern),
      ilike(auditEvents.targetId, pattern),
      sql`${auditEvents.metadata}::text ILIKE ${pattern}`,
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const where = conditions.length ? and(...conditions) : undefined;
  const [[totalRow], rows] = await Promise.all([
    db.select({ value: count() }).from(auditEvents).where(where),
    db
      .select()
      .from(auditEvents)
      .where(where)
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit)
      .offset(offset),
  ]);
  return { logs: rows.map(mapRow), total: totalRow?.value ?? 0 };
}

function mapRow(row: AuditEventRow): AuditEvent {
  return {
    id: row.id,
    actorUserId: row.actorUserId,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    applicationId: row.applicationId,
    outcome: row.outcome,
    severity: row.severity,
    requestId: row.requestId,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    metadata: row.metadata,
    before: row.beforeData,
    after: row.afterData,
    createdAt: row.createdAt.toISOString(),
  };
}

const actionByPath: Record<string, { action: string; targetType?: string; severity?: AuditSeverity }> = {
  "/sign-up/email": { action: "auth.sign_up", targetType: "user" },
  "/sign-in/email": { action: "auth.sign_in", targetType: "session" },
  "/sign-in/social": { action: "auth.sign_in_social", targetType: "session" },
  "/link-social": { action: "security.account_link_started", targetType: "account", severity: "warning" },
  "/sign-in/passkey": { action: "auth.sign_in_passkey", targetType: "session" },
  "/sign-in/magic-link": { action: "auth.magic_link_requested", targetType: "user" },
  "/email-otp/send-verification-otp": { action: "auth.otp_requested", targetType: "user" },
  "/sign-out": { action: "auth.sign_out", targetType: "session" },
  "/two-factor/enable": { action: "security.mfa_enabled", targetType: "user", severity: "warning" },
  "/two-factor/disable": { action: "security.mfa_disabled", targetType: "user", severity: "warning" },
  "/two-factor/send-otp": { action: "security.mfa_otp_requested", targetType: "user" },
  "/two-factor/verify-totp": { action: "security.mfa_verified", targetType: "session" },
  "/two-factor/verify-otp": { action: "security.mfa_verified", targetType: "session" },
  "/two-factor/verify-backup-code": { action: "security.mfa_backup_code_used", targetType: "session", severity: "warning" },
  "/two-factor/generate-backup-codes": { action: "security.mfa_backup_codes_rotated", targetType: "user", severity: "warning" },
  "/passkey/add-passkey": { action: "security.passkey_added", targetType: "passkey" },
  "/passkey/delete-passkey": { action: "security.passkey_removed", targetType: "passkey", severity: "warning" },
  "/api-key/create": { action: "api_key.created", targetType: "api_key", severity: "warning" },
  "/api-key/delete": { action: "api_key.revoked", targetType: "api_key", severity: "warning" },
  "/admin/create-user": { action: "admin.user_created", targetType: "user" },
  "/admin/remove-user": { action: "admin.user_deleted", targetType: "user", severity: "critical" },
  "/admin/ban-user": { action: "admin.user_banned", targetType: "user", severity: "warning" },
  "/admin/unban-user": { action: "admin.user_unbanned", targetType: "user", severity: "warning" },
  "/admin/set-role": { action: "admin.role_changed", targetType: "user", severity: "warning" },
  "/admin/revoke-user-session": { action: "admin.session_revoked", targetType: "session", severity: "warning" },
  "/admin/revoke-user-sessions": { action: "admin.sessions_revoked", targetType: "user", severity: "warning" },
  "/admin/impersonate-user": { action: "admin.impersonation_started", targetType: "user", severity: "critical" },
  "/admin/stop-impersonating": { action: "admin.impersonation_stopped", targetType: "user", severity: "warning" },
};

export const auditLogHook = createAuthMiddleware(async (ctx) => {
  const descriptor = actionByPath[ctx.path];
  if (!descriptor) return;

  const contextRecord: Record<string, unknown> = isRecord(ctx.context)
    ? ctx.context
    : {};
  const middlewareRecord: Record<string, unknown> = isRecord(ctx) ? ctx : {};
  const newSession = readAuthSession(contextRecord.newSession);
  const currentSession = readAuthSession(contextRecord.session);
  const body = redact(middlewareRecord.body ?? {});
  const targetIdFromBody =
    isRecord(body) && typeof body.userId === "string" ? body.userId : null;
  const targetId = newSession?.user?.id ?? targetIdFromBody;

  await writeAuditEvent({
    actorUserId: currentSession?.user?.id || newSession?.user?.id || null,
    action: descriptor.action,
    targetType: descriptor.targetType ?? null,
    targetId,
    outcome: "success",
    severity: descriptor.severity ?? "info",
    metadata: {
      path: ctx.path,
      body,
      email: newSession?.user?.email,
      sessionId: newSession?.session?.id,
    },
    ...requestMetadata(ctx.headers),
  }).catch((error) => console.error("[audit] failed to persist auth event", error));
});


export async function pruneAuditEvents(): Promise<number> {
  const retentionDays = await getConfig("auditRetentionDays", 90);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(auditEvents)
    .where(lte(auditEvents.createdAt, cutoff))
    .returning({ id: auditEvents.id });
  return deleted.length;
}

export function getRequestAuditMetadata(headers: Headers) {
  return requestMetadata(headers);
}
