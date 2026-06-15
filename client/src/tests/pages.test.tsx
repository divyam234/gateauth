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
import { afterEach, describe, expect, it, vi } from "vitest"
import LoginPage from "../pages/login"

const publicAuthState = vi.hoisted(() => ({
  allowPublicSignup: true,
  github: true,
  google: true,
}))

vi.mock("@/lib/public-api", () => ({
  usePublicAuthConfig: () => ({
    data: {
      capabilities: {
        emailPassword: true,
        emailOtp: true,
        magicLink: true,
        passkey: true,
        twoFactor: true,
        apiKeys: true,
        github: publicAuthState.github,
        google: publicAuthState.google,
        captcha: false,
        compromisedPasswordCheck: false,
      },
      config: { allowPublicSignup: publicAuthState.allowPublicSignup },
    },
  }),
}))

// ── Test wrapper ──────────────────────────────────────
const rootRoute = createRootRoute()
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
})
const routeTree = rootRoute.addChildren([loginRoute])

let qc: QueryClient
async function renderLogin() {
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/login"] }),
  })
  await router.load()
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  publicAuthState.allowPublicSignup = true
  publicAuthState.github = true
  publicAuthState.google = true
})

// Mock better-auth/react
vi.mock("better-auth/react", () => ({
  createAuthClient: vi.fn(() => ({
    signUp: { email: vi.fn() },
    signIn: { email: vi.fn(), passkey: vi.fn(), magicLink: vi.fn(), social: vi.fn() },
    signOut: vi.fn(),
    useSession: vi.fn(() => ({ data: null, isPending: false, error: null })),
    useListPasskeys: vi.fn(() => ({ data: [], refetch: vi.fn() })),
    listSessions: vi.fn(async () => ({ data: [], error: null })),
    passkey: { addPasskey: vi.fn(), deletePasskey: vi.fn() },
    emailOtp: { sendVerificationOtp: vi.fn() },
    admin: {},
    apiKey: {},
    useListDevices: vi.fn(() => ({ data: [] })),
    useListDeviceSessions: vi.fn(() => ({ data: [] })),
    useListOrganizations: vi.fn(() => ({ data: [] })),
    addPasskey: vi.fn(),
    twoFactor: {},
    sendVerificationOtp: vi.fn(),
    verifyEmail: vi.fn(),
    revokeSession: vi.fn(),
    revokeDeviceSession: vi.fn(),
    revokePasskey: vi.fn(),
    deleteUser: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    linkSocial: vi.fn(),
    listAccounts: vi.fn(async () => ({ data: [], error: null })),
    unlinkAccount: vi.fn(),
    updateUser: vi.fn(),
    changeEmail: vi.fn(),
    changePassword: vi.fn(),
  })),
}))

// Mock sonner toast
vi.mock("sonner", () => ({
  Toaster: () => null,
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe("LoginPage", () => {
  it("renders the sign-in form with email/password fields", async () => {
    await renderLogin()
    expect(await screen.findByText("Welcome back")).toBeInTheDocument()
    expect(screen.getByText("Email address")).toBeInTheDocument()
    expect(screen.getByText("Password")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /sign in/i }).length).toBeGreaterThan(0)
  })

  it("has a passkey sign-in button", async () => {
    await renderLogin()
    expect(await screen.findByRole("button", { name: /sign in with passkey/i })).toBeInTheDocument()
  })

  it("has social auth buttons", async () => {
    await renderLogin()
    expect(await screen.findByText("GitHub")).toBeInTheDocument()
    expect(screen.getByText("Google")).toBeInTheDocument()
  })

  it("switches to sign-up mode", async () => {
    const user = userEvent.setup()
    await renderLogin()
    await user.click(await screen.findByText("Sign Up"))
    expect(screen.getByText("Create an account")).toBeInTheDocument()
    expect(screen.getByText("Full name")).toBeInTheDocument()
  })

  it("hides providers that are not configured", async () => {
    publicAuthState.github = false
    await renderLogin()
    expect(screen.queryByText("GitHub")).not.toBeInTheDocument()
    expect(await screen.findByText("Google")).toBeInTheDocument()
  })

  it("hides public sign-up when account creation is disabled", async () => {
    publicAuthState.allowPublicSignup = false
    await renderLogin()
    expect(await screen.findByText(/invitation-only/i)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Sign Up" })).not.toBeInTheDocument()
  })

  it("shows magic link option", async () => {
    const user = userEvent.setup()
    await renderLogin()
    await user.click(await screen.findByText("Send magic link"))
    expect(screen.getByText("Send magic link")).toBeInTheDocument()
  })
})
