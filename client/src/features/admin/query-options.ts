import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import {
  type AuditFilters,
  fetchAdminConfig,
  fetchAdminOverview,
  fetchAllSessions,
  fetchApplication,
  fetchAuditLogs,
  fetchGlobalSearch,
  fetchUserDetails,
  listAdminUsers,
  listApiKeys,
  listApplications,
} from "@/lib/admin-api"

export const USERS_PAGE_SIZE = 25
export const AUDIT_PAGE_SIZE = 25

export const adminKeys = {
  root: ["admin"] as const,
  users: () => [...adminKeys.root, "users"] as const,
  usersList: (search: string, page: number) =>
    [...adminKeys.users(), "list", search, page] as const,
  userDetails: (userId: string) => [...adminKeys.users(), "details", userId] as const,
  applications: () => [...adminKeys.root, "applications"] as const,
  application: (applicationId: string) =>
    [...adminKeys.applications(), "detail", applicationId] as const,
  audit: () => [...adminKeys.root, "audit"] as const,
  auditList: (page: number, filters: AuditFilters) =>
    [...adminKeys.audit(), "list", page, filters] as const,
  overview: () => [...adminKeys.root, "overview"] as const,
  config: () => [...adminKeys.root, "config"] as const,
  sessions: () => [...adminKeys.root, "sessions"] as const,
  apiKeys: () => [...adminKeys.root, "api-keys"] as const,
  security: () => [...adminKeys.root, "security"] as const,
  search: (query: string) => [...adminKeys.root, "search", query] as const,
}

export const usersQueryOptions = (search: string, page: number) =>
  queryOptions({
    queryKey: adminKeys.usersList(search, page),
    queryFn: () => listAdminUsers(search, (page - 1) * USERS_PAGE_SIZE, USERS_PAGE_SIZE),
    placeholderData: keepPreviousData,
  })

export const userDetailsQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: adminKeys.userDetails(userId),
    queryFn: ({ signal }) => fetchUserDetails(userId, signal),
    enabled: Boolean(userId),
  })

export const applicationsQueryOptions = () =>
  queryOptions({ queryKey: adminKeys.applications(), queryFn: listApplications })

export const applicationQueryOptions = (applicationId: string) =>
  queryOptions({
    queryKey: adminKeys.application(applicationId),
    queryFn: () => fetchApplication(applicationId),
  })

export const auditLogQueryOptions = (page: number, filters: AuditFilters) =>
  queryOptions({
    queryKey: adminKeys.auditList(page, filters),
    queryFn: () => fetchAuditLogs(page - 1, filters, AUDIT_PAGE_SIZE),
    placeholderData: keepPreviousData,
  })

export const overviewQueryOptions = () =>
  queryOptions({
    queryKey: adminKeys.overview(),
    queryFn: fetchAdminOverview,
    staleTime: 30_000,
  })

export const configQueryOptions = () =>
  queryOptions({ queryKey: adminKeys.config(), queryFn: fetchAdminConfig })

export const sessionsQueryOptions = () =>
  queryOptions({
    queryKey: adminKeys.sessions(),
    queryFn: () => fetchAllSessions(200),
    staleTime: 15_000,
  })

export const apiKeysQueryOptions = () =>
  queryOptions({ queryKey: adminKeys.apiKeys(), queryFn: listApiKeys })

export const securityQueryOptions = () =>
  queryOptions({
    queryKey: adminKeys.security(),
    queryFn: () => Promise.all([fetchAdminOverview(), fetchAdminConfig()] as const),
  })

export const globalSearchQueryOptions = (query: string) =>
  queryOptions({
    queryKey: adminKeys.search(query),
    queryFn: () => fetchGlobalSearch(query),
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  })
