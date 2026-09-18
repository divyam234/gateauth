import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const timestampTz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const authSchema = pgSchema("auth");

// Better Auth tables. The physical table/column names intentionally preserve the
// existing GateAuth schema while the TypeScript keys match Better Auth's models.
export const user = authSchema.table("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestampTz("createdAt").notNull().defaultNow(),
  updatedAt: timestampTz("updatedAt").notNull().defaultNow(),
  twoFactorEnabled: boolean("twoFactorEnabled").default(false),
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("banReason"),
  banExpires: timestampTz("banExpires"),
});

export const session = authSchema.table(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestampTz("expiresAt").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestampTz("createdAt").notNull().defaultNow(),
    updatedAt: timestampTz("updatedAt").notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonatedBy"),
    authMethod: text("authMethod").notNull().default("unknown"),
    mfaVerifiedAt: timestampTz("mfaVerifiedAt"),
  },
  (table) => [
    index("session_userId_idx").on(table.userId),
    index("session_mfa_verified_at_idx")
      .on(table.mfaVerifiedAt)
      .where(sql`${table.mfaVerifiedAt} IS NOT NULL`),
  ],
);

export const account = authSchema.table(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestampTz("accessTokenExpiresAt"),
    refreshTokenExpiresAt: timestampTz("refreshTokenExpiresAt"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestampTz("createdAt").notNull().defaultNow(),
    updatedAt: timestampTz("updatedAt").notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = authSchema.table(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestampTz("expiresAt").notNull(),
    createdAt: timestampTz("createdAt").notNull().defaultNow(),
    updatedAt: timestampTz("updatedAt").notNull().defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const passkey = authSchema.table(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("publicKey").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credentialID").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("deviceType").notNull(),
    backedUp: boolean("backedUp").notNull(),
    transports: text("transports"),
    createdAt: timestampTz("createdAt"),
    aaguid: text("aaguid"),
  },
  (table) => [
    index("passkey_userId_idx").on(table.userId),
    index("passkey_credentialID_idx").on(table.credentialID),
  ],
);

export const twoFactor = authSchema.table(
  "twoFactor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backupCodes").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified"),

    failedVerificationCount: integer("failedVerificationCount").default(0),
    lockedUntil: timestampTz("lockedUntil"),
  },
  (table) => [
    index("twoFactor_secret_idx").on(table.secret),
    index("twoFactor_userId_idx").on(table.userId),
  ],
);

export const apikey = authSchema.table(
  "apikey",
  {
    id: text("id").primaryKey(),
    configId: text("configId").notNull(),
    name: text("name"),
    start: text("start"),
    referenceId: text("referenceId").notNull(),
    prefix: text("prefix"),
    key: text("key").notNull(),
    refillInterval: integer("refillInterval"),
    refillAmount: integer("refillAmount"),
    lastRefillAt: timestampTz("lastRefillAt"),
    enabled: boolean("enabled"),
    rateLimitEnabled: boolean("rateLimitEnabled"),
    rateLimitTimeWindow: integer("rateLimitTimeWindow"),
    rateLimitMax: integer("rateLimitMax"),
    requestCount: integer("requestCount"),
    remaining: integer("remaining"),
    lastRequest: timestampTz("lastRequest"),
    expiresAt: timestampTz("expiresAt"),
    createdAt: timestampTz("createdAt").notNull(),
    updatedAt: timestampTz("updatedAt").notNull(),
    permissions: text("permissions"),
    metadata: text("metadata"),
  },
  (table) => [
    index("apikey_configId_idx").on(table.configId),
    index("apikey_referenceId_idx").on(table.referenceId),
    index("apikey_key_idx").on(table.key),
  ],
);

export const rateLimit = authSchema.table("rateLimit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("lastRequest", { mode: "number" }).notNull(),
});

export const authSettings = authSchema.table("auth_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  isSecret: boolean("is_secret").notNull().default(false),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestampTz("updated_at").notNull().defaultNow(),
});

export const applications = authSchema.table(
  "applications",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    iconUrl: text("icon_url"),
    upstreamUrl: text("upstream_url").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    healthCheckPath: text("health_check_path").notNull().default("/"),
    lastHealthStatus: text("last_health_status")
      .$type<"unknown" | "healthy" | "unhealthy">()
      .notNull()
      .default("unknown"),
    lastHealthCheckAt: timestampTz("last_health_check_at"),
    lastHealthLatencyMs: integer("last_health_latency_ms"),
    createdAt: timestampTz("created_at").notNull().defaultNow(),
    updatedAt: timestampTz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("applications_slug_unique").on(table.slug),
    check(
      "applications_last_health_status_check",
      sql`${table.lastHealthStatus} IN ('unknown', 'healthy', 'unhealthy')`,
    ),
  ],
);

export const applicationDomains = authSchema.table(
  "application_domains",
  {
    id: text("id").primaryKey(),
    applicationId: text("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    hostname: text("hostname").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestampTz("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("application_domains_hostname_unique").on(table.hostname),
    index("application_domains_application_id_idx").on(table.applicationId),
  ],
);

export const applicationRoutes = authSchema.table(
  "application_routes",
  {
    id: text("id").primaryKey(),
    applicationId: text("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    pathPattern: text("path_pattern").notNull(),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestampTz("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("application_routes_application_id_path_pattern_unique").on(
      table.applicationId,
      table.pathPattern,
    ),
    index("application_routes_application_id_idx").on(table.applicationId),
  ],
);

export const accessPolicies = authSchema.table(
  "access_policies",
  {
    id: text("id").primaryKey(),
    applicationId: text("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    priority: integer("priority").notNull().default(100),
    allowedRoles: text("allowed_roles").array().notNull().default(sql`'{}'::text[]`),
    allowedEmailDomains: text("allowed_email_domains").array().notNull().default(sql`'{}'::text[]`),
    allowedIpCidrs: text("allowed_ip_cidrs").array().notNull().default(sql`'{}'::text[]`),
    requireMfa: boolean("require_mfa").notNull().default(false),
    sessionMaxAgeSeconds: integer("session_max_age_seconds"),
    createdAt: timestampTz("created_at").notNull().defaultNow(),
    updatedAt: timestampTz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("access_policies_application_id_priority_idx").on(
      table.applicationId,
      table.enabled,
      table.priority,
    ),
    check(
      "access_policies_session_max_age_seconds_check",
      sql`${table.sessionMaxAgeSeconds} IS NULL OR ${table.sessionMaxAgeSeconds} >= 60`,
    ),
  ],
);

export const applicationUserGrants = authSchema.table(
  "application_user_grants",
  {
    id: text("id").primaryKey(),
    applicationId: text("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    effect: text("effect").$type<"allow" | "deny">().notNull(),
    expiresAt: timestampTz("expires_at"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestampTz("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("application_user_grants_application_id_user_id_unique").on(
      table.applicationId,
      table.userId,
    ),
    index("application_user_grants_user_id_idx").on(table.userId),
    check("application_user_grants_effect_check", sql`${table.effect} IN ('allow', 'deny')`),
  ],
);

export const auditEvents = authSchema.table(
  "audit_events",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    applicationId: text("application_id").references(() => applications.id, {
      onDelete: "set null",
    }),
    outcome: text("outcome").$type<"success" | "failure" | "denied">().notNull().default("success"),
    severity: text("severity").$type<"info" | "warning" | "critical">().notNull().default("info"),
    requestId: text("request_id"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    beforeData: jsonb("before_data").$type<unknown>(),
    afterData: jsonb("after_data").$type<unknown>(),
    createdAt: timestampTz("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_created_at_idx").on(table.createdAt.desc()),
    index("audit_events_actor_user_id_idx").on(table.actorUserId),
    index("audit_events_application_id_idx").on(table.applicationId),
    index("audit_events_action_idx").on(table.action),
    index("audit_events_outcome_severity_idx").on(table.outcome, table.severity),
    index("audit_events_metadata_gin_idx").using("gin", table.metadata),
    check("audit_events_outcome_check", sql`${table.outcome} IN ('success', 'failure', 'denied')`),
    check("audit_events_severity_check", sql`${table.severity} IN ('info', 'warning', 'critical')`),
  ],
);

export const webhooks = authSchema.table("webhooks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  secretCiphertext: text("secret_ciphertext"),
  enabled: boolean("enabled").notNull().default(true),
  events: text("events").array().notNull().default(sql`'{}'::text[]`),
  createdAt: timestampTz("created_at").notNull().defaultNow(),
  updatedAt: timestampTz("updated_at").notNull().defaultNow(),
});

export const webhookDeliveries = authSchema.table(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    auditEventId: text("audit_event_id").references(() => auditEvents.id, {
      onDelete: "set null",
    }),
    attempt: integer("attempt").notNull().default(1),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    deliveredAt: timestampTz("delivered_at"),
    nextAttemptAt: timestampTz("next_attempt_at"),
    createdAt: timestampTz("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("webhook_deliveries_retry_idx")
      .on(table.nextAttemptAt)
      .where(sql`${table.deliveredAt} IS NULL`),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  passkeys: many(passkey),
  twoFactors: many(twoFactor),
  grants: many(applicationUserGrants),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const applicationRelations = relations(applications, ({ many }) => ({
  domains: many(applicationDomains),
  routes: many(applicationRoutes),
  policies: many(accessPolicies),
  grants: many(applicationUserGrants),
}));

export const applicationDomainRelations = relations(applicationDomains, ({ one }) => ({
  application: one(applications, {
    fields: [applicationDomains.applicationId],
    references: [applications.id],
  }),
}));

export const applicationRouteRelations = relations(applicationRoutes, ({ one }) => ({
  application: one(applications, {
    fields: [applicationRoutes.applicationId],
    references: [applications.id],
  }),
}));

export const accessPolicyRelations = relations(accessPolicies, ({ one }) => ({
  application: one(applications, {
    fields: [accessPolicies.applicationId],
    references: [applications.id],
  }),
}));

export const applicationUserGrantRelations = relations(applicationUserGrants, ({ one }) => ({
  application: one(applications, {
    fields: [applicationUserGrants.applicationId],
    references: [applications.id],
  }),
  user: one(user, { fields: [applicationUserGrants.userId], references: [user.id] }),
}));

export type UserRow = typeof user.$inferSelect;
export type SessionRow = typeof session.$inferSelect;
export type ApplicationRow = typeof applications.$inferSelect;
export type AccessPolicyRow = typeof accessPolicies.$inferSelect;
export type AuditEventRow = typeof auditEvents.$inferSelect;
