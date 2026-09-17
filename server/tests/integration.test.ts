import { and, count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestPostgres, type TestPostgres } from "./postgres.js";
import type { createApp } from "../src/app.js";
import type { auth as authInstance } from "../src/auth.js";
import type { closeDatabase as closeDatabaseInstance, db as database } from "../src/db.js";
import { account, applicationUserGrants, session as sessionTable, user } from "../src/db/schema.js";
import type { AuditEvent } from "../src/audit-log.js";
import type { ProtectedApplication } from "../src/applications.js";

type TestApp = ReturnType<typeof createApp>;
type TestAuth = typeof authInstance;
type TestDatabase = typeof database;
type CloseDatabase = typeof closeDatabaseInstance;

type SessionRow = {
  id: string;
  userId: string;
  token?: never;
};

type TestResponseBody = {
  application: ProtectedApplication;
  capabilities: Record<string, boolean>;
  config: Record<string, unknown>;
  decision: { reason: string };
  metrics: { users: number };
  sessions: SessionRow[];
  user: { email: string };
  logs: AuditEvent[];
  users: Array<{ email: string }>;
};

let postgres: TestPostgres;
let app: TestApp;
let auth: TestAuth;
let db: TestDatabase;
let closeDatabase: CloseDatabase;
let applicationId: string;
let userId: string;
let userToken: string;
let adminToken: string;

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function request(input: string, init?: RequestInit) {
  const source = new URL(input);
  const target = new URL(`${source.pathname}${source.search}`, app.url);
  return fetch(target, init);
}

function assertPresent<T>(
  value: T | null | undefined,
  message: string,
): asserts value is T {
  if (value == null) throw new Error(message);
}

async function json<T = TestResponseBody>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

describe("PostgreSQL integration", () => {
  beforeAll(async () => {
    postgres = await startTestPostgres();
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = postgres.databaseURL;
    process.env.BETTER_AUTH_SECRET = "integration-test-secret-12345678901234567890";
    process.env.BETTER_AUTH_URL = "http://localhost:8080";
    process.env.SEED_DEFAULT_APPLICATION = "false";
    process.env.ENABLE_HIBP = "false";
    process.env.REQUIRE_EMAIL_VERIFICATION = "false";

    const migrations = await import("../src/db/migrations.js");
    await migrations.runMigrations();
    const config = await import("../src/config.js");
    await config.seedConfigIfEmpty();
    ({ db, closeDatabase } = await import("../src/db.js"));
    ({ auth } = await import("../src/auth.js"));
    const appModule = await import("../src/app.js");
    app = appModule.createApp();

    const adminSignup = await auth.api.signUpEmail({
      body: { name: "Admin", email: "admin@example.com", password: "AdminPassword123!" },
    });
    assertPresent(adminSignup.token, "Admin signup did not return a token");
    adminToken = adminSignup.token;
    await db.update(user).set({ role: "admin", emailVerified: true }).where(eq(user.id, adminSignup.user.id));

    const signup = await auth.api.signUpEmail({
      body: { name: "Test User", email: "user@example.com", password: "UserPassword123!" },
    });
    userId = signup.user.id;
    assertPresent(signup.token, "User signup did not return a token");
    userToken = signup.token;

    const create = await request("http://localhost/api/admin/applications", {
      method: "POST",
      headers: { "content-type": "application/json", ...bearer(adminToken) },
      body: JSON.stringify({
        name: "Test application",
        slug: "test-app",
        upstreamUrl: "http://127.0.0.1:9",
        domains: ["app.test"],
        publicPaths: ["/health", "/assets/*"],
        policy: { allowedEmailDomains: ["example.com"], allowedRoles: ["user", "admin"] },
      }),
    });
    expect(create.status).toBe(201);
    applicationId = (await json(create)).application.id;
  }, 120_000);

  afterAll(async () => {
    if (app) await app.stop();
    if (closeDatabase) await closeDatabase();
    if (postgres) await postgres.stop();
  }, 60_000);

  it("reports liveness and database readiness", async () => {
    expect((await request("http://localhost/api/health")).status).toBe(200);
    expect((await request("http://localhost/api/ready")).status).toBe(200);
  });

  it("publishes only enabled authentication capabilities", async () => {
    const response = await request("http://localhost/api/public/capabilities");
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.capabilities).toMatchObject({ emailPassword: true, passkey: true, twoFactor: true, github: false, google: false });
    expect(body.config.allowPublicSignup).toBe(true);
  });

  it("allows a public application route without authentication", async () => {
    const response = await request(`http://localhost/api/verify?application=${applicationId}&path=/health`);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-auth-public")).toBe("true");
  });

  it("rejects protected routes without authentication", async () => {
    const response = await request(`http://localhost/api/verify?application=${applicationId}&path=/private`);
    expect(response.status).toBe(401);
    expect(response.headers.get("x-auth-reason")).toBe("not_authenticated");
  });

  it("redirects unauthenticated forward-auth requests to login with a validated return URL", async () => {
    const response = await request(`http://localhost/api/verify?application=${applicationId}`, {
      headers: {
        "x-forwarded-host": "app.test",
        "x-forwarded-proto": "https",
        "x-forwarded-uri": "/private?tab=activity",
      },
      redirect: "manual",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("x-auth-reason")).toBe("not_authenticated");
    const location = response.headers.get("location");
    assertPresent(location, "Forward-auth redirect did not include a location");
    const login = new URL(location);
    expect(login.pathname).toBe("/login");
    expect(login.searchParams.get("application")).toBe("test-app");
    expect(login.searchParams.get("redirect")).toBe("https://app.test/private?tab=activity");
  });

  it("rejects unregistered public redirect targets", async () => {
    const response = await request(
      `http://localhost/api/public/redirect-target?application=${applicationId}&redirect=${encodeURIComponent("https://evil.example/private")}`,
    );
    expect(response.status).toBe(400);
  });

  it("authorizes bearer sessions and emits trusted identity headers", async () => {
    const response = await request(`http://localhost/api/verify?application=${applicationId}&path=/private`, {
      headers: bearer(userToken),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("x-auth-user-id")).toBe(userId);
    expect(response.headers.get("x-auth-user-email")).toBe("user@example.com");
    expect(response.headers.get("x-auth-application-id")).toBe(applicationId);
    expect(response.headers.get("x-auth-method")).toBe("password");
    expect(response.headers.get("x-auth-mfa")).toBe("false");
  });

  it("requires an MFA-verified session rather than enrollment alone", async () => {
    await db.update(user).set({ twoFactorEnabled: true }).where(eq(user.id, userId));
    const get = await request(`http://localhost/api/admin/applications/${applicationId}`, { headers: bearer(adminToken) });
    const current = (await json(get)).application;
    const enableMfa = await request(`http://localhost/api/admin/applications/${applicationId}`, {
      method: "PUT",
      headers: { "content-type": "application/json", ...bearer(adminToken) },
      body: JSON.stringify({ ...current, policy: { ...current.policy, requireMfa: true } }),
    });
    expect(enableMfa.status).toBe(200);

    const enrolledButUnverified = await request(`http://localhost/api/verify?application=${applicationId}&path=/private`, {
      headers: bearer(userToken),
    });
    expect(enrolledButUnverified.status).toBe(403);
    expect(enrolledButUnverified.headers.get("x-auth-reason")).toBe("mfa_required");

    await db.update(sessionTable).set({ authMethod: "mfa", mfaVerifiedAt: new Date() }).where(eq(sessionTable.token, userToken));
    const verified = await request(`http://localhost/api/verify?application=${applicationId}&path=/private`, {
      headers: bearer(userToken),
    });
    expect(verified.status).toBe(200);
    expect(verified.headers.get("x-auth-method")).toBe("mfa");
    expect(verified.headers.get("x-auth-mfa")).toBe("true");

    await db.update(sessionTable).set({ authMethod: "password", mfaVerifiedAt: null }).where(eq(sessionTable.token, userToken));
    await request(`http://localhost/api/admin/applications/${applicationId}`, {
      method: "PUT",
      headers: { "content-type": "application/json", ...bearer(adminToken) },
      body: JSON.stringify({ ...current, policy: { ...current.policy, requireMfa: false } }),
    });
  });

  it("enforces role policy changes immediately", async () => {
    const get = await request(`http://localhost/api/admin/applications/${applicationId}`, { headers: bearer(adminToken) });
    const current = (await json(get)).application;
    const update = await request(`http://localhost/api/admin/applications/${applicationId}`, {
      method: "PUT",
      headers: { "content-type": "application/json", ...bearer(adminToken) },
      body: JSON.stringify({ ...current, policy: { ...current.policy, allowedRoles: ["admin"] } }),
    });
    expect(update.status).toBe(200);

    const denied = await request(`http://localhost/api/verify?application=${applicationId}&path=/private`, { headers: bearer(userToken) });
    expect(denied.status).toBe(403);
    expect(denied.headers.get("x-auth-reason")).toBe("role_denied");

    await request(`http://localhost/api/admin/applications/${applicationId}`, {
      method: "PUT",
      headers: { "content-type": "application/json", ...bearer(adminToken) },
      body: JSON.stringify({ ...current, policy: { ...current.policy, allowedRoles: ["user", "admin"] } }),
    });
  });

  it("applies explicit per-user deny and allow grants", async () => {
    const adminSession = await auth.api.getSession({ headers: bearer(adminToken) });
    assertPresent(adminSession, "Admin session was not found");
    await db.insert(applicationUserGrants).values({
      id: crypto.randomUUID(),
      applicationId,
      userId,
      effect: "deny",
      createdBy: adminSession.user.id,
    });
    const denied = await request(`http://localhost/api/verify?application=${applicationId}&path=/private`, {
      headers: bearer(userToken),
    });
    expect(denied.status).toBe(403);
    expect(denied.headers.get("x-auth-reason")).toBe("explicit_user_deny");

    const get = await request(`http://localhost/api/admin/applications/${applicationId}`, { headers: bearer(adminToken) });
    const current = (await json(get)).application;
    await request(`http://localhost/api/admin/applications/${applicationId}`, {
      method: "PUT",
      headers: { "content-type": "application/json", ...bearer(adminToken) },
      body: JSON.stringify({ ...current, policy: { ...current.policy, allowedRoles: ["admin"] } }),
    });
    await db
      .update(applicationUserGrants)
      .set({ effect: "allow" })
      .where(
        and(
          eq(applicationUserGrants.applicationId, applicationId),
          eq(applicationUserGrants.userId, userId),
        ),
      );
    const allowed = await request(`http://localhost/api/verify?application=${applicationId}&path=/private`, {
      headers: bearer(userToken),
    });
    expect(allowed.status).toBe(200);

    await db
      .delete(applicationUserGrants)
      .where(
        and(
          eq(applicationUserGrants.applicationId, applicationId),
          eq(applicationUserGrants.userId, userId),
        ),
      );
    await request(`http://localhost/api/admin/applications/${applicationId}`, {
      method: "PUT",
      headers: { "content-type": "application/json", ...bearer(adminToken) },
      body: JSON.stringify({ ...current, policy: { ...current.policy, allowedRoles: ["user", "admin"] } }),
    });
  });

  it("simulates policy decisions without mutating policy", async () => {
    const response = await request("http://localhost/api/admin/policy/simulate", {
      method: "POST",
      headers: { "content-type": "application/json", ...bearer(adminToken) },
      body: JSON.stringify({
        applicationId,
        path: "/private",
        ipAddress: "10.0.0.2",
        user: { email: "blocked@other.test", role: "user", twoFactorEnabled: true },
      }),
    });
    expect(response.status).toBe(200);
    expect((await json(response)).decision.reason).toBe("email_domain_denied");
  });

  it("updates safe runtime configuration and rejects unknown keys", async () => {
    const update = await request("http://localhost/api/admin/config", {
      method: "PUT",
      headers: { "content-type": "application/json", ...bearer(adminToken) },
      body: JSON.stringify({ brandingName: "Secure Gate", auditRetentionDays: 120 }),
    });
    expect(update.status).toBe(200);
    expect((await json(update)).config.brandingName).toBe("Secure Gate");

    const invalid = await request("http://localhost/api/admin/config", {
      method: "PUT",
      headers: { "content-type": "application/json", ...bearer(adminToken) },
      body: JSON.stringify({ providerSecret: "must-not-be-stored" }),
    });
    expect(invalid.status).toBe(400);

    const invalidRetention = await request("http://localhost/api/admin/config", {
      method: "PUT",
      headers: { "content-type": "application/json", ...bearer(adminToken) },
      body: JSON.stringify({ auditRetentionDays: 0 }),
    });
    expect(invalidRetention.status).toBe(400);
  });

  it("blocks public registration globally while allowing administrator provisioning", async () => {
    const config = await import("../src/config.js");
    await config.setConfigMany({ allowPublicSignup: false });

    const blocked = await request("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Blocked User",
        email: "blocked-signup@example.com",
        password: "BlockedPassword123!",
      }),
    });
    expect(blocked.status).toBeGreaterThanOrEqual(400);
    const [blockedUsers] = await db
      .select({ value: count() })
      .from(user)
      .where(eq(user.email, "blocked-signup@example.com"));
    expect(blockedUsers?.value ?? 0).toBe(0);

    const provisioned = await request("http://localhost/api/auth/admin/create-user", {
      method: "POST",
      headers: { "content-type": "application/json", ...bearer(adminToken) },
      body: JSON.stringify({
        name: "Provisioned User",
        email: "provisioned@example.com",
        password: "ProvisionedPassword123!",
        role: "user",
      }),
    });
    expect(provisioned.status).toBe(200);

    await config.setConfigMany({ allowPublicSignup: true });
  });

  it("lists and safely unlinks an additional social account with an audit trail", async () => {
    const accountId = "integration-github-account";
    await db.insert(account).values({
      id: accountId,
      accountId: "github-user-123",
      providerId: "github",
      userId,
      scope: "read:user,user:email",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const accounts = await auth.api.listUserAccounts({ headers: bearer(userToken) });
    expect(accounts.some((account) => account.providerId === "github")).toBe(true);

    const response = await request("http://localhost/api/auth/unlink-account", {
      method: "POST",
      headers: { "content-type": "application/json", ...bearer(userToken) },
      body: JSON.stringify({ accountId }),
    });
    expect(response.status).toBe(200);

    const remaining = await auth.api.listUserAccounts({ headers: bearer(userToken) });
    expect(remaining.some((account) => account.providerId === "github")).toBe(false);

    const audit = await request(
      "http://localhost/api/admin/audit-logs?action=security.account_unlinked",
      { headers: bearer(adminToken) },
    );
    expect(audit.status).toBe(200);
    expect(
      (await json(audit)).logs.some(
        (event) => event.targetId === accountId && event.metadata?.providerId === "github",
      ),
    ).toBe(true);
  });

  it("returns overview, sessions and user security detail", async () => {
    const overview = await request("http://localhost/api/admin/overview", { headers: bearer(adminToken) });
    expect(overview.status).toBe(200);
    expect((await json(overview)).metrics.users).toBeGreaterThanOrEqual(2);

    const sessions = await request("http://localhost/api/admin/sessions", { headers: bearer(adminToken) });
    expect(sessions.status).toBe(200);
    const sessionRows = (await json(sessions)).sessions;
    expect(sessionRows.length).toBeGreaterThanOrEqual(2);
    expect(sessionRows.every((row) => !("token" in row))).toBe(true);

    const details = await request(`http://localhost/api/admin/users/${userId}/details`, { headers: bearer(adminToken) });
    expect(details.status).toBe(200);
    const detailBody = await json(details);
    expect(detailBody.user.email).toBe("user@example.com");
    expect(detailBody.sessions.length).toBeGreaterThan(0);
  });

  it("records and exports structured audit events", async () => {
    const response = await request("http://localhost/api/admin/audit-logs?limit=100", { headers: bearer(adminToken) });
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(body.logs.some((event) => event.action === "application.created")).toBe(true);
    expect(body.logs.some((event) => event.action === "proxy.access_denied")).toBe(true);

    const csv = await request("http://localhost/api/admin/audit-logs/export.csv", { headers: bearer(adminToken) });
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-type")).toContain("text/csv");
    expect(await csv.text()).toContain("application.created");
  });

  it("supports global administrative search", async () => {
    const response = await request("http://localhost/api/admin/search?q=user%40example", { headers: bearer(adminToken) });
    expect(response.status).toBe(200);
    expect((await json(response)).users[0].email).toBe("user@example.com");
  });

  it("uses a 90-day API-key lifetime and authenticates the key", async () => {
    const created = await auth.api.createApiKey({
      body: { name: "integration-key", userId },
    });
    assertPresent(created.expiresAt, "API key expiry was not returned");
    const lifetimeDays = (new Date(created.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(lifetimeDays).toBeGreaterThan(89.9);
    expect(lifetimeDays).toBeLessThan(90.1);

    const verified = await request(`http://localhost/api/verify?application=${applicationId}&path=/private`, {
      headers: { "x-api-key": created.key },
    });
    expect(verified.status).toBe(200);
    expect(verified.headers.get("x-auth-method")).toBe("api-key");
    expect(verified.headers.get("x-auth-user-id")).toBe(userId);
  });

  it("delivers email OTP through the configured mail adapter", async () => {
    const mailer = await import("../src/mailer.js");
    mailer.clearMemoryOutbox();
    await auth.api.sendVerificationOTP({
      body: { email: "user@example.com", type: "sign-in" },
    });
    const message = mailer.getMemoryOutbox().at(-1);
    expect(message).toMatchObject({ kind: "otp", to: "user@example.com" });
    expect(message?.text).toMatch(/expires in 5 minutes/i);
  });

  it("prunes audit history according to validated retention settings", async () => {
    const { writeAuditEvent, pruneAuditEvents, queryAuditEvents } = await import("../src/audit-log.js");
    await writeAuditEvent({
      action: "test.expired_audit_event",
      createdAt: new Date(Date.now() - 121 * 86_400_000),
    });
    expect((await queryAuditEvents({ action: "test.expired_audit_event" })).total).toBe(1);
    expect(await pruneAuditEvents()).toBeGreaterThanOrEqual(1);
    expect((await queryAuditEvents({ action: "test.expired_audit_event" })).total).toBe(0);
  });

  it("revokes a session by opaque id without exposing its token", async () => {
    const sessions = await request("http://localhost/api/admin/sessions", { headers: bearer(adminToken) });
    const rows = (await json(sessions)).sessions;
    const target = rows.find((row) => row.userId === userId);
    assertPresent(target, "User session was not found");
    expect(target.token).toBeUndefined();

    const revoke = await request(`http://localhost/api/admin/sessions/${target.id}`, {
      method: "DELETE",
      headers: bearer(adminToken),
    });
    expect(revoke.status).toBe(204);

    const denied = await request(`http://localhost/api/verify?application=${applicationId}&path=/private`, {
      headers: bearer(userToken),
    });
    expect(denied.status).toBe(401);
  });

});
