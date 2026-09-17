import { and, asc, desc, eq, inArray, like, or } from "drizzle-orm";
import { db, type DatabaseTransaction } from "./db.js";
import {
  accessPolicies,
  applicationDomains,
  applicationRoutes,
  applications,
  type AccessPolicyRow,
  type ApplicationRow,
} from "./db/schema.js";

export interface AccessPolicy {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  allowedRoles: string[];
  allowedEmailDomains: string[];
  allowedIpCidrs: string[];
  requireMfa: boolean;
  sessionMaxAgeSeconds: number | null;
}

export interface ProtectedApplication {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  upstreamUrl: string;
  enabled: boolean;
  healthCheckPath: string;
  lastHealthStatus: "unknown" | "healthy" | "unhealthy";
  lastHealthCheckAt: string | null;
  lastHealthLatencyMs: number | null;
  domains: string[];
  publicPaths: string[];
  policy: AccessPolicy;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationInput {
  name: string;
  slug: string;
  description?: string | null;
  iconUrl?: string | null;
  upstreamUrl: string;
  enabled?: boolean;
  healthCheckPath?: string;
  domains?: string[];
  publicPaths?: string[];
  policy?: Partial<Omit<AccessPolicy, "id">>;
}

type NormalizedInput = ReturnType<typeof normalizeInput>;

type ApplicationChildren = {
  domains: string[];
  publicPaths: string[];
  policy?: AccessPolicyRow;
};

function normalizeInput(input: ApplicationInput) {
  const name = input.name?.trim();
  const slug = input.slug?.trim().toLowerCase();
  if (!name || name.length > 120) {
    throw new Error("Application name is required and must be 120 characters or fewer");
  }
  if (!slug || !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) {
    throw new Error("Slug must be 3-64 lowercase letters, numbers, or hyphens");
  }

  let upstream: URL;
  try {
    upstream = new URL(input.upstreamUrl);
  } catch {
    throw new Error("Upstream URL is invalid");
  }
  if (!["http:", "https:"].includes(upstream.protocol)) {
    throw new Error("Upstream URL must use http or https");
  }

  const domains = [
    ...new Set((input.domains ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean)),
  ];
  for (const domain of domains) {
    if (!/^(\*\.)?[a-z0-9.-]+(?::\d+)?$/.test(domain)) {
      throw new Error(`Invalid application domain: ${domain}`);
    }
  }

  const policy = input.policy ?? {};
  return {
    name,
    slug,
    description: input.description?.trim() || null,
    iconUrl: input.iconUrl?.trim() || null,
    upstreamUrl: upstream.toString().replace(/\/$/, ""),
    enabled: input.enabled ?? true,
    healthCheckPath: normalizePath(input.healthCheckPath || "/"),
    domains,
    publicPaths: [...new Set((input.publicPaths ?? []).map(normalizePath))],
    policy: {
      name: policy.name?.trim() || "Default access policy",
      enabled: policy.enabled ?? true,
      priority: policy.priority ?? 100,
      allowedRoles: uniqueLower(policy.allowedRoles ?? []),
      allowedEmailDomains: uniqueLower(policy.allowedEmailDomains ?? []),
      allowedIpCidrs: [...new Set(policy.allowedIpCidrs ?? [])],
      requireMfa: policy.requireMfa ?? false,
      sessionMaxAgeSeconds:
        policy.sessionMaxAgeSeconds == null
          ? null
          : Math.max(60, Number(policy.sessionMaxAgeSeconds)),
    },
  };
}

function uniqueLower(values: string[]) {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

function normalizePath(value: string) {
  const normalized = value.trim() || "/";
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

async function replaceChildren(
  tx: DatabaseTransaction,
  applicationId: string,
  input: NormalizedInput,
): Promise<void> {
  await Promise.all([
    tx.delete(applicationDomains).where(eq(applicationDomains.applicationId, applicationId)),
    tx.delete(applicationRoutes).where(eq(applicationRoutes.applicationId, applicationId)),
    tx.delete(accessPolicies).where(eq(accessPolicies.applicationId, applicationId)),
  ]);

  if (input.domains.length) {
    await tx.insert(applicationDomains).values(
      input.domains.map((hostname, index) => ({
        id: crypto.randomUUID(),
        applicationId,
        hostname,
        isPrimary: index === 0,
      })),
    );
  }

  if (input.publicPaths.length) {
    await tx.insert(applicationRoutes).values(
      input.publicPaths.map((pathPattern) => ({
        id: crypto.randomUUID(),
        applicationId,
        pathPattern,
        isPublic: true,
      })),
    );
  }

  await tx.insert(accessPolicies).values({
    id: crypto.randomUUID(),
    applicationId,
    ...input.policy,
  });
}

export async function createApplication(input: ApplicationInput): Promise<ProtectedApplication> {
  const normalized = normalizeInput(input);
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(applications).values({
      id,
      name: normalized.name,
      slug: normalized.slug,
      description: normalized.description,
      iconUrl: normalized.iconUrl,
      upstreamUrl: normalized.upstreamUrl,
      enabled: normalized.enabled,
      healthCheckPath: normalized.healthCheckPath,
    });
    await replaceChildren(tx, id, normalized);
  });
  return requireApplication(id);
}

export async function updateApplication(
  id: string,
  input: ApplicationInput,
): Promise<ProtectedApplication> {
  const normalized = normalizeInput(input);
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(applications)
      .set({
        name: normalized.name,
        slug: normalized.slug,
        description: normalized.description,
        iconUrl: normalized.iconUrl,
        upstreamUrl: normalized.upstreamUrl,
        enabled: normalized.enabled,
        healthCheckPath: normalized.healthCheckPath,
        updatedAt: new Date(),
      })
      .where(eq(applications.id, id))
      .returning({ id: applications.id });
    if (!updated) throw new Error("Application not found");
    await replaceChildren(tx, id, normalized);
  });
  return requireApplication(id);
}

export async function deleteApplication(id: string): Promise<boolean> {
  const rows = await db
    .delete(applications)
    .where(eq(applications.id, id))
    .returning({ id: applications.id });
  return rows.length > 0;
}

export async function listApplications(): Promise<ProtectedApplication[]> {
  const rows = await db.select().from(applications).orderBy(asc(applications.name));
  const children = await loadChildren(rows.map((row) => row.id));
  return rows.map((row) => hydrateApplication(row, children.get(row.id)));
}

export async function getApplication(idOrSlug: string): Promise<ProtectedApplication | null> {
  const [row] = await db
    .select()
    .from(applications)
    .where(or(eq(applications.id, idOrSlug), eq(applications.slug, idOrSlug)))
    .limit(1);
  if (!row) return null;
  const children = await loadChildren([row.id]);
  return hydrateApplication(row, children.get(row.id));
}

async function requireApplication(idOrSlug: string): Promise<ProtectedApplication> {
  const application = await getApplication(idOrSlug);
  if (!application) throw new Error("Application not found");
  return application;
}

export async function getApplicationByHost(host: string): Promise<ProtectedApplication | null> {
  const normalized = host.toLowerCase().split(",")[0]?.trim() ?? "";
  const [exact] = await db
    .select({ application: applications })
    .from(applications)
    .innerJoin(applicationDomains, eq(applicationDomains.applicationId, applications.id))
    .where(eq(applicationDomains.hostname, normalized))
    .orderBy(desc(applicationDomains.isPrimary))
    .limit(1);

  if (exact) {
    const children = await loadChildren([exact.application.id]);
    return hydrateApplication(exact.application, children.get(exact.application.id));
  }

  const wildcardRows = await db
    .select({ application: applications, hostname: applicationDomains.hostname })
    .from(applications)
    .innerJoin(applicationDomains, eq(applicationDomains.applicationId, applications.id))
    .where(like(applicationDomains.hostname, "*.%"));
  const wildcard = wildcardRows.find((row) => normalized.endsWith(row.hostname.slice(1)));
  if (!wildcard) return null;
  const children = await loadChildren([wildcard.application.id]);
  return hydrateApplication(wildcard.application, children.get(wildcard.application.id));
}

async function loadChildren(ids: string[]): Promise<Map<string, ApplicationChildren>> {
  const result = new Map<string, ApplicationChildren>();
  if (!ids.length) return result;
  for (const id of ids) result.set(id, { domains: [], publicPaths: [] });

  const [domains, routes, policies] = await Promise.all([
    db
      .select()
      .from(applicationDomains)
      .where(inArray(applicationDomains.applicationId, ids))
      .orderBy(desc(applicationDomains.isPrimary), applicationDomains.hostname),
    db
      .select()
      .from(applicationRoutes)
      .where(
        and(
          inArray(applicationRoutes.applicationId, ids),
          eq(applicationRoutes.isPublic, true),
        ),
      )
      .orderBy(applicationRoutes.pathPattern),
    db
      .select()
      .from(accessPolicies)
      .where(and(inArray(accessPolicies.applicationId, ids), eq(accessPolicies.enabled, true)))
      .orderBy(asc(accessPolicies.priority)),
  ]);

  for (const domain of domains) result.get(domain.applicationId)?.domains.push(domain.hostname);
  for (const route of routes) result.get(route.applicationId)?.publicPaths.push(route.pathPattern);
  for (const policy of policies) {
    const children = result.get(policy.applicationId);
    if (children && !children.policy) children.policy = policy;
  }
  return result;
}

function hydrateApplication(
  row: ApplicationRow,
  children: ApplicationChildren = { domains: [], publicPaths: [] },
): ProtectedApplication {
  const policy = children.policy;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    iconUrl: row.iconUrl,
    upstreamUrl: row.upstreamUrl,
    enabled: row.enabled,
    healthCheckPath: row.healthCheckPath,
    lastHealthStatus: row.lastHealthStatus,
    lastHealthCheckAt: row.lastHealthCheckAt?.toISOString() ?? null,
    lastHealthLatencyMs: row.lastHealthLatencyMs,
    domains: children.domains,
    publicPaths: children.publicPaths,
    policy: {
      id: policy?.id ?? "",
      name: policy?.name ?? "Default access policy",
      enabled: policy?.enabled ?? true,
      priority: policy?.priority ?? 100,
      allowedRoles: policy?.allowedRoles ?? [],
      allowedEmailDomains: policy?.allowedEmailDomains ?? [],
      allowedIpCidrs: policy?.allowedIpCidrs ?? [],
      requireMfa: policy?.requireMfa ?? false,
      sessionMaxAgeSeconds: policy?.sessionMaxAgeSeconds ?? null,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function checkApplicationHealth(id: string): Promise<ProtectedApplication> {
  const application = await getApplication(id);
  if (!application) throw new Error("Application not found");

  const target = new URL(application.healthCheckPath, `${application.upstreamUrl}/`);
  const started = performance.now();
  let status: "healthy" | "unhealthy" = "unhealthy";
  try {
    const response = await fetch(target, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
    });
    status = response.status < 500 ? "healthy" : "unhealthy";
  } catch {
    status = "unhealthy";
  }

  await db
    .update(applications)
    .set({
      lastHealthStatus: status,
      lastHealthCheckAt: new Date(),
      lastHealthLatencyMs: Math.round(performance.now() - started),
      updatedAt: new Date(),
    })
    .where(eq(applications.id, id));
  return requireApplication(id);
}
