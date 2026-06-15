import { describe, expect, it } from "vitest";
import { evaluatePolicy, ipMatchesAny, pathMatches } from "../src/policy.js";
import type { ProtectedApplication } from "../src/applications.js";

const application: ProtectedApplication = {
  id: "app-1",
  name: "Docs",
  slug: "docs",
  description: null,
  iconUrl: null,
  upstreamUrl: "http://docs:3000",
  enabled: true,
  healthCheckPath: "/health",
  lastHealthStatus: "unknown",
  lastHealthCheckAt: null,
  lastHealthLatencyMs: null,
  domains: ["docs.example.com"],
  publicPaths: ["/health", "/assets/*"],
  policy: {
    id: "policy-1",
    name: "Staff",
    enabled: true,
    priority: 100,
    allowedRoles: ["admin", "staff"],
    allowedEmailDomains: ["example.com"],
    allowedIpCidrs: ["10.0.0.0/8", "2001:db8::/32"],
    requireMfa: true,
    sessionMaxAgeSeconds: 3600,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const validSession = {
  createdAt: new Date("2026-06-15T05:30:00Z"),
  authMethod: "mfa",
  mfaVerifiedAt: new Date("2026-06-15T05:30:30Z"),
  user: {
    id: "user-1",
    email: "admin@example.com",
    name: "Admin",
    role: "admin",
    twoFactorEnabled: true,
  },
};

describe("policy evaluation", () => {
  it("supports exact and prefix public paths", () => {
    expect(pathMatches("/health", "/health?full=1")).toBe(true);
    expect(pathMatches("/assets/*", "/assets/app.js")).toBe(true);
    expect(pathMatches("/assets/*", "/api/assets/app.js")).toBe(false);
  });

  it("matches IPv4 and IPv6 CIDRs", () => {
    expect(ipMatchesAny("10.20.30.40", ["10.0.0.0/8"])).toBe(true);
    expect(ipMatchesAny("192.168.1.1", ["10.0.0.0/8"])).toBe(false);
    expect(ipMatchesAny("2001:db8::1", ["2001:db8::/32"])).toBe(true);
  });

  it("allows public routes without a session", () => {
    expect(evaluatePolicy(application, null, { path: "/assets/app.js", ipAddress: null }).reason).toBe("public_route");
  });

  it("rejects anonymous access to protected routes", () => {
    expect(evaluatePolicy(application, null, { path: "/", ipAddress: "10.0.0.2" }).status).toBe(401);
  });

  it("allows a matching role, domain, CIDR and MFA session", () => {
    expect(
      evaluatePolicy(application, validSession, { path: "/", ipAddress: "10.0.0.2" }, new Date("2026-06-15T06:00:00Z")),
    ).toMatchObject({ allowed: true, reason: "allowed" });
  });

  it.each([
    [{ ...validSession, user: { ...validSession.user, role: "user" } }, "10.0.0.2", "role_denied"],
    [{ ...validSession, user: { ...validSession.user, email: "admin@other.com" } }, "10.0.0.2", "email_domain_denied"],
    [validSession, "192.168.1.2", "ip_denied"],
    [{ ...validSession, mfaVerifiedAt: null }, "10.0.0.2", "mfa_required"],
  ])("denies a mismatching policy dimension", (session, ip, reason) => {
    expect(evaluatePolicy(application, session, { path: "/", ipAddress: ip }, new Date("2026-06-15T06:00:00Z")).reason).toBe(reason);
  });

  it("rejects sessions older than the configured freshness", () => {
    expect(
      evaluatePolicy(application, validSession, { path: "/", ipAddress: "10.0.0.2" }, new Date("2026-06-15T08:00:00Z")),
    ).toMatchObject({ allowed: false, reason: "session_too_old", status: 401 });
  });
});
