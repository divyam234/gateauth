import { z } from "zod"
import { authClient } from "@/lib/auth-client"

export type AuthApiError = { message?: string; statusText?: string }
export type AdminUserRole = "user" | "admin"

export type AdminUser = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  role: string
  banned: boolean
  banReason?: string | null
  banExpires?: string | null
  createdAt: string
  image?: string | null
  twoFactorEnabled?: boolean
}

export type ListUsersResponse = { users: AdminUser[]; total: number; limit: number; offset: number }
export type AdminSession = {
  id: string
  userId: string
  userAgent?: string | null
  ipAddress?: string | null
  createdAt: string
  updatedAt: string
  expiresAt?: string | null
  authMethod?: string | null
  mfaVerifiedAt?: string | null
  isCurrent?: boolean
  isActive?: boolean
}

export type ApiKeyRecord = {
  id: string
  name: string
  prefix?: string | null
  start?: string | null
  key?: string
  createdAt: string
  lastRequest?: string | null
  expiresAt?: string | null
  enabled: boolean
  requestCount?: number
}

export type AuditOutcome = "success" | "failure" | "denied"
export type AuditSeverity = "info" | "warning" | "critical"
export type AuditEvent = {
  id: string
  actorUserId: string | null
  action: string
  targetType: string | null
  targetId: string | null
  applicationId: string | null
  outcome: AuditOutcome
  severity: AuditSeverity
  requestId: string | null
  ipAddress: string | null
  userAgent: string | null
  metadata: Record<string, unknown> | null
  before: unknown
  after: unknown
  createdAt: string
}
export type AuditLogResponse = { logs: AuditEvent[]; total: number }

export type AccessPolicy = {
  id: string
  name: string
  enabled: boolean
  priority: number
  allowedRoles: string[]
  allowedEmailDomains: string[]
  allowedIpCidrs: string[]
  requireMfa: boolean
  sessionMaxAgeSeconds: number | null
}

export type ProtectedApplication = {
  id: string
  name: string
  slug: string
  description: string | null
  iconUrl: string | null
  upstreamUrl: string
  enabled: boolean
  healthCheckPath: string
  lastHealthStatus: "unknown" | "healthy" | "unhealthy"
  lastHealthCheckAt: string | null
  lastHealthLatencyMs: number | null
  domains: string[]
  publicPaths: string[]
  policy: AccessPolicy
  createdAt: string
  updatedAt: string
}

export type ApplicationInput = {
  name: string
  slug: string
  description?: string | null
  iconUrl?: string | null
  upstreamUrl: string
  enabled?: boolean
  healthCheckPath?: string
  domains?: string[]
  publicPaths?: string[]
  policy?: Partial<Omit<AccessPolicy, "id">>
}

export type OverviewResponse = {
  metrics: {
    users: number
    activeSessions: number
    signIns24h: number
    denied24h: number
    criticalEvents7d: number
    activeApiKeys: number
    expiringApiKeys: number
    mfaAdoption: number
    passkeyAdoption: number
    applications: { total: number; healthy: number; unhealthy: number }
  }
  trend: Array<{ day: string; signIns: number; denied: number }>
  recentEvents: AuditEvent[]
}

export type ConfigValue = string | number | boolean | null | string[] | Record<string, unknown>
export type ConfigMap = Record<string, ConfigValue>
export type RuntimeCapabilities = Record<string, boolean>
export type ConfigResponse = { config: ConfigMap; capabilities: RuntimeCapabilities }

export type PolicySimulationInput = {
  applicationId: string
  path?: string
  ipAddress?: string | null
  user?: {
    id?: string
    email: string
    name?: string
    role?: string
    twoFactorEnabled?: boolean
  } | null
  sessionCreatedAt?: string
  mfaVerified?: boolean
}
export type PolicyDecision = { allowed: boolean; public: boolean; status: number; reason: string }
export type PolicySimulationResponse = {
  decision: PolicyDecision
  application: { id: string; name: string; slug: string }
}

export type GlobalSearchResponse = {
  users: Array<Pick<AdminUser, "id" | "name" | "email" | "role" | "banned">>
  applications: Array<
    Pick<ProtectedApplication, "id" | "name" | "slug" | "enabled" | "lastHealthStatus">
  >
  events: AuditEvent[]
}

const auditEventSchema: z.ZodType<AuditEvent> = z.object({
  id: z.string(),
  actorUserId: z.string().nullable(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  applicationId: z.string().nullable(),
  outcome: z.enum(["success", "failure", "denied"]),
  severity: z.enum(["info", "warning", "critical"]),
  requestId: z.string().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  before: z.unknown(),
  after: z.unknown(),
  createdAt: z.string(),
})

const accessPolicySchema: z.ZodType<AccessPolicy> = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  priority: z.number(),
  allowedRoles: z.array(z.string()),
  allowedEmailDomains: z.array(z.string()),
  allowedIpCidrs: z.array(z.string()),
  requireMfa: z.boolean(),
  sessionMaxAgeSeconds: z.number().nullable(),
})

const protectedApplicationSchema: z.ZodType<ProtectedApplication> = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  iconUrl: z.string().nullable(),
  upstreamUrl: z.string(),
  enabled: z.boolean(),
  healthCheckPath: z.string(),
  lastHealthStatus: z.enum(["unknown", "healthy", "unhealthy"]),
  lastHealthCheckAt: z.string().nullable(),
  lastHealthLatencyMs: z.number().nullable(),
  domains: z.array(z.string()),
  publicPaths: z.array(z.string()),
  policy: accessPolicySchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

const overviewResponseSchema: z.ZodType<OverviewResponse> = z.object({
  metrics: z.object({
    users: z.number(),
    activeSessions: z.number(),
    signIns24h: z.number(),
    denied24h: z.number(),
    criticalEvents7d: z.number(),
    activeApiKeys: z.number(),
    expiringApiKeys: z.number(),
    mfaAdoption: z.number(),
    passkeyAdoption: z.number(),
    applications: z.object({ total: z.number(), healthy: z.number(), unhealthy: z.number() }),
  }),
  trend: z.array(z.object({ day: z.string(), signIns: z.number(), denied: z.number() })),
  recentEvents: z.array(auditEventSchema),
})

const configValueSchema: z.ZodType<ConfigValue> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string()),
  z.record(z.string(), z.unknown()),
])

const configResponseSchema: z.ZodType<ConfigResponse> = z.object({
  config: z.record(z.string(), configValueSchema),
  capabilities: z.record(z.string(), z.boolean()),
})

const policySimulationResponseSchema: z.ZodType<PolicySimulationResponse> = z.object({
  decision: z.object({
    allowed: z.boolean(),
    public: z.boolean(),
    status: z.number(),
    reason: z.string(),
  }),
  application: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
})

const globalSearchResponseSchema: z.ZodType<GlobalSearchResponse> = z.object({
  users: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      role: z.string(),
      banned: z.boolean(),
    }),
  ),
  applications: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      enabled: z.boolean(),
      lastHealthStatus: z.enum(["unknown", "healthy", "unhealthy"]),
    }),
  ),
  events: z.array(auditEventSchema),
})

const adminSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userAgent: z.string().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string().nullable().optional(),
  authMethod: z.string().nullable().optional(),
  mfaVerifiedAt: z.string().nullable().optional(),
  isCurrent: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

const userDetailsResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    image: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    role: z.string(),
    banned: z.boolean(),
    banReason: z.string().nullable(),
    banExpires: z.string().nullable(),
    twoFactorEnabled: z.boolean(),
  }),
  sessions: z.array(
    z.object({
      id: z.string(),
      ipAddress: z.string().nullable(),
      userAgent: z.string().nullable(),
      createdAt: z.string(),
      updatedAt: z.string(),
      expiresAt: z.string(),
      authMethod: z.string().nullable(),
      mfaVerifiedAt: z.string().nullable(),
    }),
  ),
  accounts: z.array(
    z.object({
      id: z.string(),
      providerId: z.string(),
      accountId: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  passkeys: z.array(
    z.object({
      id: z.string(),
      name: z.string().nullable(),
      deviceType: z.string(),
      backedUp: z.boolean(),
      transports: z.string().nullable(),
      createdAt: z.string(),
      aaguid: z.string().nullable(),
    }),
  ),
  apiKeys: z.array(
    z.object({
      id: z.string(),
      name: z.string().nullable(),
      start: z.string().nullable(),
      prefix: z.string().nullable(),
      enabled: z.boolean(),
      requestCount: z.number(),
      lastRequest: z.string().nullable(),
      expiresAt: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
  grants: z.array(
    z.object({
      id: z.string(),
      applicationId: z.string(),
      userId: z.string(),
      effect: z.enum(["allow", "deny"]),
      expiresAt: z.string().nullable(),
      createdBy: z.string().nullable(),
      createdAt: z.string(),
      applicationName: z.string(),
      applicationSlug: z.string(),
    }),
  ),
  events: z.array(auditEventSchema),
})

export type UserDetailsResponse = z.infer<typeof userDetailsResponseSchema>

const allSessionsResponseSchema = z.object({
  sessions: z.array(
    adminSessionSchema.extend({
      user: z.object({ name: z.string(), email: z.string() }),
      active: z.boolean(),
    }),
  ),
})

function getErrorMessage(error: AuthApiError | null | undefined, fallback: string) {
  return error?.message || error?.statusText || fallback
}

export async function listAdminUsers(
  search: string,
  offset: number,
  limit: number,
): Promise<ListUsersResponse> {
  const result = await authClient.admin.listUsers({
    query: {
      limit,
      offset,
      ...(search ? { searchValue: search, searchField: "email" as const } : {}),
    },
  })
  if (result.error) throw new Error(getErrorMessage(result.error, "Failed to load users"))
  if (!result.data) throw new Error("Failed to load users")
  return {
    users: result.data.users.map((user) => ({
      ...user,
      role: user.role ?? "user",
      banned: user.banned ?? false,
      banReason: user.banReason ?? null,
      banExpires: user.banExpires ? new Date(user.banExpires).toISOString() : null,
      createdAt: new Date(user.createdAt).toISOString(),
      image: user.image ?? null,
      twoFactorEnabled: false,
    })),
    total: result.data.total,
    limit,
    offset,
  }
}
export async function createAdminUser(input: {
  name: string
  email: string
  password: string
  role: AdminUserRole
}) {
  const result = await authClient.admin.createUser(input)
  if (result.error) throw new Error(getErrorMessage(result.error, "Failed to create user"))
}
export async function updateAdminUser(userId: string, data: { name: string; role: AdminUserRole }) {
  const result = await authClient.admin.updateUser({ userId, data })
  if (result.error) throw new Error(getErrorMessage(result.error, "Failed to update user"))
}
export async function banAdminUser(userId: string, banReason?: string) {
  const result = await authClient.admin.banUser({ userId, banReason })
  if (result.error) throw new Error(getErrorMessage(result.error, "Failed to ban user"))
}
export async function unbanAdminUser(userId: string) {
  const result = await authClient.admin.unbanUser({ userId })
  if (result.error) throw new Error(getErrorMessage(result.error, "Failed to unban user"))
}
export async function removeAdminUser(userId: string) {
  const result = await authClient.admin.removeUser({ userId })
  if (result.error) throw new Error(getErrorMessage(result.error, "Failed to delete user"))
}
export async function impersonateAdminUser(userId: string) {
  const result = await authClient.admin.impersonateUser({ userId })
  if (result.error) throw new Error(getErrorMessage(result.error, "Failed to impersonate"))
}
export async function stopImpersonatingAdminUser() {
  const result = await authClient.admin.stopImpersonating()
  if (result.error) throw new Error(getErrorMessage(result.error, "Failed to stop impersonating"))
}
export async function revokeUserSession(sessionId: string) {
  await requestAdmin(`/api/admin/sessions/${encodeURIComponent(sessionId)}`, z.void(), {
    method: "DELETE",
  })
}
export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  const result = await authClient.apiKey.list()
  if (result.error) throw new Error(getErrorMessage(result.error, "Failed to load API keys"))
  return (result.data?.apiKeys ?? []).map((key) => ({
    ...key,
    name: key.name ?? "Unnamed key",
    createdAt: new Date(key.createdAt).toISOString(),
    lastRequest: key.lastRequest ? new Date(key.lastRequest).toISOString() : null,
    expiresAt: key.expiresAt ? new Date(key.expiresAt).toISOString() : null,
  }))
}
export async function createApiKey(input: { name: string; expiresIn: number }): Promise<string> {
  const result = await authClient.apiKey.create(input)
  if (result.error) throw new Error(getErrorMessage(result.error, "Failed to create API key"))
  if (!result.data?.key) throw new Error("The API key secret was not returned")
  return result.data.key
}
export async function deleteApiKey(id: string) {
  const result = await authClient.apiKey.delete({ keyId: id })
  if (result.error) throw new Error(getErrorMessage(result.error, "Failed to revoke API key"))
}

async function requestAdmin<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    let detail = ""
    try {
      const payload: unknown = await response.json()
      if (typeof payload === "object" && payload !== null && "error" in payload) {
        const error = payload.error
        detail = typeof error === "string" ? error : ""
      }
    } catch {
      // The status code still provides a useful fallback for non-JSON responses.
    }
    if (response.status === 401) throw new Error("Not authenticated. Please sign in again.")
    if (response.status === 403) throw new Error("Administrator access is required.")
    throw new Error(detail || `Request failed with HTTP ${response.status}`)
  }

  if (response.status === 204) return schema.parse(undefined)
  const payload: unknown = await response.json()
  return schema.parse(payload)
}

export const fetchAdminOverview = () => requestAdmin("/api/admin/overview", overviewResponseSchema)

export const listApplications = async () =>
  (
    await requestAdmin(
      "/api/admin/applications",
      z.object({ applications: z.array(protectedApplicationSchema) }),
    )
  ).applications

export const fetchApplication = async (id: string) =>
  (
    await requestAdmin(
      `/api/admin/applications/${encodeURIComponent(id)}`,
      z.object({ application: protectedApplicationSchema }),
    )
  ).application

export const createApplication = async (input: ApplicationInput) =>
  (
    await requestAdmin(
      "/api/admin/applications",
      z.object({ application: protectedApplicationSchema }),
      { method: "POST", body: JSON.stringify(input) },
    )
  ).application

export const updateApplication = async (id: string, input: ApplicationInput) =>
  (
    await requestAdmin(
      `/api/admin/applications/${encodeURIComponent(id)}`,
      z.object({ application: protectedApplicationSchema }),
      { method: "PUT", body: JSON.stringify(input) },
    )
  ).application

export const deleteApplication = (id: string) =>
  requestAdmin(`/api/admin/applications/${encodeURIComponent(id)}`, z.void(), {
    method: "DELETE",
  })

export const checkApplicationHealth = async (id: string) =>
  (
    await requestAdmin(
      `/api/admin/applications/${encodeURIComponent(id)}/check-health`,
      z.object({ application: protectedApplicationSchema }),
      { method: "POST" },
    )
  ).application

export const simulatePolicy = (input: PolicySimulationInput) =>
  requestAdmin("/api/admin/policy/simulate", policySimulationResponseSchema, {
    method: "POST",
    body: JSON.stringify(input),
  })

export type AuditFilters = {
  action?: string
  applicationId?: string
  outcome?: AuditOutcome
  severity?: AuditSeverity
  search?: string
  from?: string
  to?: string
}
export function fetchAuditLogs(
  page: number,
  filters: AuditFilters | string | null,
  pageSize: number,
): Promise<AuditLogResponse> {
  const params = new URLSearchParams({ limit: String(pageSize), offset: String(page * pageSize) })
  if (typeof filters === "string") {
    if (filters !== "all") params.set("action", filters)
  } else if (filters)
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
  return requestAdmin(
    `/api/admin/audit-logs?${params}`,
    z.object({ logs: z.array(auditEventSchema), total: z.number() }),
  )
}
export const fetchAdminConfig = () => requestAdmin("/api/admin/config", configResponseSchema)
export const updateAdminConfig = (config: Partial<ConfigMap>) =>
  requestAdmin("/api/admin/config", configResponseSchema, {
    method: "PUT",
    body: JSON.stringify(config),
  })
export const fetchGlobalSearch = (query: string) =>
  requestAdmin(`/api/admin/search?q=${encodeURIComponent(query)}`, globalSearchResponseSchema)
export const fetchAllSessions = async (limit = 100) =>
  (await requestAdmin(`/api/admin/sessions?limit=${limit}`, allSessionsResponseSchema)).sessions

export const fetchUserDetails = (userId: string, signal?: AbortSignal) =>
  requestAdmin(
    `/api/admin/users/${encodeURIComponent(userId)}/details`,
    userDetailsResponseSchema,
    { signal },
  )
