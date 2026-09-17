import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ChangeEvent, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const authMocks = vi.hoisted(() => ({
  sendOtp: vi.fn(async () => ({ data: { success: true }, error: null })),
  verifyTotp: vi.fn(async () => ({ data: { token: "ok" }, error: null })),
  verifyOtp: vi.fn(async () => ({ data: { token: "ok" }, error: null })),
  verifyBackupCode: vi.fn(async () => ({ data: { token: "ok" }, error: null })),
  enable: vi.fn(async () => ({
    data: {
      method: "totp" as const,
      totpURI: "otpauth://totp/Gatehouse:test@example.com?secret=ABC123&issuer=Gatehouse",
      backupCodes: ["backup-1", "backup-2"],
    },
    error: null,
  })),
  disable: vi.fn(async () => ({ data: { status: true }, error: null })),
  generateBackupCodes: vi.fn(async () => ({ data: { backupCodes: ["new-1"] }, error: null })),
}))

vi.mock("@/lib/auth-client", () => ({
  twoFactor: authMocks,
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@/components/ui/input-otp", () => ({
  InputOTP: ({
    children,
    value = "",
    onChange,
  }: {
    children?: ReactNode
    value?: string
    onChange?(value: string): void
  }) => (
    <div>
      <input
        aria-label="One-time code"
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange?.(event.target.value)}
      />
      {children}
    </div>
  ),
  InputOTPGroup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  InputOTPSlot: () => null,
}))

import { TwoFactorManager } from "../components/security/two-factor-manager"
import TwoFactorPage from "../pages/two-factor"

async function renderChallenge(methods: string[]) {
  sessionStorage.setItem("gatehouse:two-factor-methods", JSON.stringify(methods))
  const rootRoute = createRootRoute()
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/login",
    component: () => <div>Login</div>,
  })
  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dashboard",
    component: () => <div>Dashboard</div>,
  })
  const twoFactorRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/two-factor",
    component: TwoFactorPage,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([loginRoute, dashboardRoute, twoFactorRoute]),
    history: createMemoryHistory({ initialEntries: ["/two-factor"] }),
  })
  await router.load()
  return render(<RouterProvider router={router} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

afterEach(cleanup)

describe("two-factor challenge", () => {
  it("requests an email second-factor code using the supported client contract", async () => {
    const user = userEvent.setup()
    await renderChallenge(["otp"])

    expect(await screen.findByText("Verify it’s really you")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /send email code/i }))

    expect(authMocks.sendOtp).toHaveBeenCalledTimes(1)
    expect(authMocks.sendOtp).toHaveBeenCalledWith()
    expect(await screen.findByText(/short-lived code/i)).toBeInTheDocument()
  })

  it("shows authenticator and recovery choices for a TOTP challenge", async () => {
    await renderChallenge(["totp"])

    expect(await screen.findByRole("tab", { name: /authenticator/i })).toBeEnabled()
    expect(screen.getByRole("tab", { name: /recovery/i })).toBeEnabled()
    expect(screen.getByText(/six-digit code from your authenticator/i)).toBeInTheDocument()
  })
})

describe("two-factor enrollment", () => {
  it("starts enrollment after current-password confirmation", async () => {
    const user = userEvent.setup()
    render(<TwoFactorManager enabled={false} onChanged={vi.fn()} />)

    await user.type(screen.getByPlaceholderText("Current password"), "correct horse battery staple")
    await user.click(screen.getByRole("button", { name: /set up 2fa/i }))

    expect(authMocks.enable).toHaveBeenCalledWith(expect.objectContaining({ method: "totp" }))
    expect(await screen.findByText("1. Scan the QR code")).toBeInTheDocument()
    expect(screen.getByText("2. Verify the six-digit code")).toBeInTheDocument()
  })
})
