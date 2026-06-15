import ipaddr from "ipaddr.js";
import type { ProtectedApplication } from "./applications.js";

export interface PolicyUser {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  twoFactorEnabled?: boolean | null;
}

export interface PolicySession {
  createdAt?: string | Date | null;
  authMethod?: string | null;
  mfaVerifiedAt?: string | Date | null;
  user: PolicyUser;
}

export interface PolicyRequest {
  path: string;
  ipAddress: string | null;
}

export interface PolicyDecision {
  allowed: boolean;
  public: boolean;
  status: 200 | 401 | 403 | 404 | 503;
  reason:
    | "allowed"
    | "public_route"
    | "application_disabled"
    | "not_authenticated"
    | "role_denied"
    | "email_domain_denied"
    | "ip_denied"
    | "mfa_required"
    | "session_too_old";
}

export function pathMatches(pattern: string, path: string): boolean {
  const cleanPath = path.split("?")[0] || "/";
  if (pattern === "*") return true;
  if (pattern.endsWith("*")) return cleanPath.startsWith(pattern.slice(0, -1));
  return cleanPath === pattern;
}

function normalizeRoles(role: string | null | undefined): string[] {
  return (role || "user")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function ipMatchesAny(ip: string | null, cidrs: string[]): boolean {
  if (!cidrs.length) return true;
  if (!ip) return false;
  try {
    const address = ipaddr.parse(ip.replace(/^\[|\]$/g, ""));
    return cidrs.some((cidr) => {
      try {
        const [range, prefix] = ipaddr.parseCIDR(cidr);
        return address.kind() === range.kind() && address.match(range, prefix);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export function evaluatePolicy(
  application: ProtectedApplication,
  session: PolicySession | null,
  request: PolicyRequest,
  now = new Date(),
): PolicyDecision {
  if (!application.enabled) {
    return { allowed: false, public: false, status: 503, reason: "application_disabled" };
  }
  if (application.publicPaths.some((pattern) => pathMatches(pattern, request.path))) {
    return { allowed: true, public: true, status: 200, reason: "public_route" };
  }
  if (!session) {
    return { allowed: false, public: false, status: 401, reason: "not_authenticated" };
  }

  const policy = application.policy;
  if (policy.allowedRoles.length) {
    const roles = normalizeRoles(session.user.role);
    if (!policy.allowedRoles.some((role) => roles.includes(role.toLowerCase()))) {
      return { allowed: false, public: false, status: 403, reason: "role_denied" };
    }
  }

  if (policy.allowedEmailDomains.length) {
    const domain = session.user.email.split("@")[1]?.toLowerCase() || "";
    if (!policy.allowedEmailDomains.includes(domain)) {
      return { allowed: false, public: false, status: 403, reason: "email_domain_denied" };
    }
  }

  if (!ipMatchesAny(request.ipAddress, policy.allowedIpCidrs)) {
    return { allowed: false, public: false, status: 403, reason: "ip_denied" };
  }

  if (policy.requireMfa && !session.mfaVerifiedAt) {
    return { allowed: false, public: false, status: 403, reason: "mfa_required" };
  }

  if (policy.sessionMaxAgeSeconds && session.createdAt) {
    const ageSeconds = (now.getTime() - new Date(session.createdAt).getTime()) / 1000;
    if (ageSeconds > policy.sessionMaxAgeSeconds) {
      return { allowed: false, public: false, status: 401, reason: "session_too_old" };
    }
  }

  return { allowed: true, public: false, status: 200, reason: "allowed" };
}
