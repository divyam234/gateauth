import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { type ReactNode, Suspense } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GlobalSearch } from "@/features/admin/global-search"
import { UserDetailSheet } from "@/features/users/user-detail-sheet"
import type * as AdminApiModule from "@/lib/admin-api"
import { AdminApiKeysPage } from "../pages/admin/api-keys"
import { AdminApplicationsPage } from "../pages/admin/applications"
import { AdminConfigPage } from "../pages/admin/config"
import { AdminOverviewPage } from "../pages/admin/overview"
import { AdminSecurityPage } from "../pages/admin/security"
import { AdminSessionsPage } from "../pages/admin/sessions"

const mocks = vi.hoisted(() => ({
  simulatePolicy: vi.fn(),
  createApplication: vi.fn(),
  updateApplication: vi.fn(),
  deleteApplication: vi.fn(),
  checkApplicationHealth: vi.fn(),
  updateAdminConfig: vi.fn(),
  createApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
}))

const overview = {
  metrics: {
    users: 42,
    activeSessions: 17,
    signIns24h: 31,
    denied24h: 3,
    criticalEvents7d: 1,
    activeApiKeys: 6,
    expiringApiKeys: 2,
    mfaAdoption: 64,
    passkeyAdoption: 38,
    applications: { total: 2, healthy: 1, unhealthy: 1 },
  },
  trend: Array.from({ length: 14 }, (_, index) => ({
    day: `2026-06-${String(index + 1).padStart(2, "0")}`,
    signIns: index + 2,
    denied: index % 3,
  })),
  recentEvents: [
    {
      id: "event-1",
      actorUserId: "user-1",
      action: "proxy.access_denied",
      targetType: "application",
      targetId: "app-1",
      applicationId: "app-1",
      outcome: "denied",
      severity: "warning",
      requestId: "request-1",
      ipAddress: "127.0.0.1",
      userAgent: "Vitest",
      metadata: { reason: "role_not_allowed" },
      before: null,
      after: null,
      createdAt: "2026-06-15T06:00:00.000Z",
    },
  ],
}

const application = {
  id: "app-1",
  name: "Operations",
  slug: "operations",
  description: "Internal operations console",
  iconUrl: null,
  upstreamUrl: "http://operations:8080",
  enabled: true,
  healthCheckPath: "/health",
  lastHealthStatus: "healthy" as const,
  lastHealthCheckAt: "2026-06-15T05:00:00.000Z",
  lastHealthLatencyMs: 12,
  domains: ["ops.example.com"],
  publicPaths: ["/health"],
  policy: {
    id: "policy-1",
    name: "Default",
    enabled: true,
    priority: 100,
    allowedRoles: ["admin"],
    allowedEmailDomains: ["example.com"],
    allowedIpCidrs: [],
    requireMfa: true,
    sessionMaxAgeSeconds: 3600,
  },
  createdAt: "2026-06-14T00:00:00.000Z",
  updatedAt: "2026-06-15T00:00:00.000Z",
}

const config = {
  config: {
    brandingName: "GateAuth",
    environmentLabel: "Test",
    allowPublicSignup: true,
    defaultRequireMfa: false,
    defaultSessionMaxAgeSeconds: 86400,
    auditRetentionDays: 90,
  },
  capabilities: {
    emailPassword: true,
    emailOtp: true,
    magicLink: true,
    passkey: true,
    twoFactor: true,
    apiKeys: true,
    github: false,
    google: false,
    captcha: false,
    compromisedPasswordCheck: true,
  },
}

vi.mock("@/lib/admin-api", async (importOriginal) => {
  const original = await importOriginal<typeof AdminApiModule>()
  return {
    ...original,
    fetchAdminOverview: vi.fn(async () => overview),
    listApplications: vi.fn(async () => [application]),
    fetchApplication: vi.fn(async () => application),
    createApplication: mocks.createApplication,
    updateApplication: mocks.updateApplication,
    deleteApplication: mocks.deleteApplication,
    checkApplicationHealth: mocks.checkApplicationHealth,
    simulatePolicy: mocks.simulatePolicy,
    fetchAdminConfig: vi.fn(async () => config),
    fetchGlobalSearch: vi.fn(async () => ({
      users: [
        {
          id: "user-1",
          name: "Alex Operator",
          email: "alex@example.com",
          role: "admin",
          banned: false,
        },
      ],
      applications: [
        {
          id: application.id,
          name: application.name,
          slug: application.slug,
          enabled: application.enabled,
          lastHealthStatus: application.lastHealthStatus,
        },
      ],
      events: overview.recentEvents,
    })),
    updateAdminConfig: mocks.updateAdminConfig,
    listApiKeys: vi.fn(async () => [
      {
        id: "key-1",
        name: "Deployment bot",
        prefix: "gh_live",
        createdAt: "2026-06-01T00:00:00.000Z",
        lastRequest: "2026-06-15T05:30:00.000Z",
        expiresAt: "2026-09-01T00:00:00.000Z",
        enabled: true,
        requestCount: 412,
      },
    ]),
    createApiKey: mocks.createApiKey,
    deleteApiKey: mocks.deleteApiKey,
    fetchUserDetails: vi.fn(async () => ({
      user: {
        id: "user-1",
        name: "Alex Operator",
        email: "alex@example.com",
        emailVerified: true,
        image: null,
        role: "admin",
        banned: false,
        banReason: null,
        banExpires: null,
        twoFactorEnabled: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-06-15T00:00:00.000Z",
      },
      sessions: [
        {
          id: "session-1",
          userId: "user-1",
          ipAddress: "203.0.113.4",
          userAgent: "Chrome on Linux",
          createdAt: "2026-06-15T00:00:00.000Z",
          updatedAt: "2026-06-15T06:00:00.000Z",
          expiresAt: "2026-06-16T00:00:00.000Z",
          authMethod: "google",
          mfaVerifiedAt: "2026-06-15T00:00:00.000Z",
        },
      ],
      accounts: [
        {
          id: "account-1",
          providerId: "google",
          accountId: "alex@example.com",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      passkeys: [
        {
          id: "passkey-1",
          name: "Laptop",
          deviceType: "multiDevice",
          backedUp: true,
          aaguid: null,
          createdAt: "2026-02-01T00:00:00.000Z",
        },
      ],
      apiKeys: [],
      grants: [
        {
          id: "grant-1",
          applicationId: "app-1",
          applicationName: "Operations",
          applicationSlug: "operations",
          effect: "allow",
          expiresAt: null,
          createdAt: "2026-03-01T00:00:00.000Z",
        },
      ],
      events: [overview.recentEvents[0]],
    })),
    fetchAllSessions: vi.fn(async () => [
      {
        id: "session-1",
        token: "token-1",
        userId: "user-1",
        ipAddress: "203.0.113.4",
        userAgent: "Mozilla/5.0 Chrome Linux",
        createdAt: "2026-06-15T00:00:00.000Z",
        updatedAt: "2026-06-15T06:00:00.000Z",
        expiresAt: "2026-06-16T00:00:00.000Z",
        user: { name: "Alex Operator", email: "alex@example.com" },
        active: true,
      },
    ]),
    revokeUserSession: vi.fn(async () => undefined),
  }
})

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}))

afterEach(() => {
  cleanup()
  document.body.style.overflow = ""
  vi.clearAllMocks()
})

async function renderPage(Component: () => ReactNode) {
  const root = createRootRoute()
  const page = createRoute({ getParentRoute: () => root, path: "/", component: Component })
  const router = createRouter({
    routeTree: root.addChildren([page]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await router.load()
  return render(
    <QueryClientProvider client={client}>
      <Suspense fallback={<div>Loading test page</div>}>
        <RouterProvider router={router} />
      </Suspense>
    </QueryClientProvider>,
  )
}

describe("admin control plane", () => {
  it("renders API-backed results in the shadcn command palette", async () => {
    const user = userEvent.setup()
    await renderPage(() => <GlobalSearch open onOpenChange={vi.fn()} />)

    await user.type(screen.getByPlaceholderText("Search users, apps, or events…"), "alex")

    expect(await screen.findByText("Alex Operator")).toBeInTheDocument()
    expect(screen.getByText("Operations")).toBeInTheDocument()
    expect(screen.getByText("proxy.access_denied")).toBeInTheDocument()
  })
  it("renders operational metrics and recent policy events", async () => {
    await renderPage(AdminOverviewPage)
    expect(await screen.findByText("Every application. One policy surface.")).toBeInTheDocument()
    expect(screen.getByText("42")).toBeInTheDocument()
    expect(screen.getByText("proxy · access_denied")).toBeInTheDocument()
  })

  it("renders protected applications and policy posture", async () => {
    await renderPage(AdminApplicationsPage)
    expect((await screen.findAllByText("Operations"))[0]).toBeInTheDocument()
    expect(screen.getByText("Healthy")).toBeInTheDocument()
    expect(screen.getByText("Policy lab")).toBeInTheDocument()
    expect(screen.getAllByText("MFA").length).toBeGreaterThan(0)
  })

  it("loads fresh application details before editing", async () => {
    const user = userEvent.setup()
    const adminApi = await import("@/lib/admin-api")
    await renderPage(AdminApplicationsPage)

    await user.click(await screen.findByRole("button", { name: "Configure" }))

    expect(adminApi.fetchApplication).toHaveBeenCalledWith("app-1")
    expect(await screen.findByText("Edit Operations")).toBeInTheDocument()
  })

  it("opens the application editor", async () => {
    const user = userEvent.setup()
    await renderPage(AdminApplicationsPage)
    await user.click(await screen.findByRole("button", { name: /protect application/i }))
    expect(await screen.findByText("Protect an application")).toBeInTheDocument()
    expect(screen.getByLabelText("Upstream URL")).toBeInTheDocument()
    expect(screen.getByText("Access policy")).toBeInTheDocument()
  })

  it("simulates an application access decision", async () => {
    mocks.simulatePolicy.mockResolvedValue({
      decision: { allowed: true, public: false, status: 200, reason: "allowed" },
      application: { id: "app-1", name: "Operations", slug: "operations" },
    })
    const user = userEvent.setup()
    await renderPage(AdminApplicationsPage)
    await user.click(await screen.findByRole("button", { name: /evaluate request/i }))
    expect(mocks.simulatePolicy).toHaveBeenCalledWith(
      expect.objectContaining({ applicationId: "app-1", path: "/" }),
    )
    expect(await screen.findByText(/ALLOW · 200 · allowed/)).toBeInTheDocument()
  })

  it("shows safe runtime settings and deployment capabilities", async () => {
    await renderPage(AdminConfigPage)
    expect(await screen.findByDisplayValue("GateAuth")).toBeInTheDocument()
    expect(screen.getByText("Runtime capabilities")).toBeInTheDocument()
    expect(screen.getByText(/Provider credentials remain server-side/)).toBeInTheDocument()
  })

  it("summarizes security posture", async () => {
    await renderPage(AdminSecurityPage)
    expect(await screen.findByText("Identity posture")).toBeInTheDocument()
    expect(screen.getByText("Passkey authentication")).toBeInTheDocument()
    expect(screen.getByText("Recommended production hardening remains")).toBeInTheDocument()
  })

  it("creates an expiring API key through the Better Auth client integration", async () => {
    mocks.createApiKey.mockResolvedValue("gh_secret_value")
    const user = userEvent.setup()
    await renderPage(AdminApiKeysPage)

    expect(await screen.findByText("Deployment bot")).toBeInTheDocument()
    expect(screen.getByText("412")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /create key/i }))
    await user.type(screen.getByLabelText("Key name"), "Release automation")
    await user.click(screen.getByRole("button", { name: /^create key$/i }))

    expect(mocks.createApiKey).toHaveBeenCalledWith({
      name: "Release automation",
      expiresIn: 90 * 24 * 60 * 60,
    })
    expect(await screen.findByText("gh_secret_value")).toBeInTheDocument()
  })

  it("loads the complete user inspector from the details API", async () => {
    await renderPage(() => <UserDetailSheet userId="user-1" onOpenChange={vi.fn()} />)

    expect(await screen.findByText("Alex Operator")).toBeInTheDocument()
    expect(screen.getAllByText("alex@example.com")).toHaveLength(2)
    expect(screen.getByText("Google", { exact: false })).toBeInTheDocument()
    expect(screen.getByText("Laptop")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /sessions \(1\)/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /access \(1\)/i })).toBeInTheDocument()
  })

  it("lists active sessions across all users", async () => {
    await renderPage(AdminSessionsPage)
    expect(await screen.findByText("Alex Operator")).toBeInTheDocument()
    expect(screen.getByText("Chrome on Linux")).toBeInTheDocument()
    expect(screen.getByText("203.0.113.4")).toBeInTheDocument()
  })
})
