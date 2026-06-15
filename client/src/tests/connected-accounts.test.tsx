import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ConnectedAccounts } from "@/components/security/connected-accounts"
import { linkSocialAccount, listAccounts, unlinkAccount } from "@/lib/auth-client"

vi.mock("@/lib/auth-client", () => ({
  listAccounts: vi.fn(),
  linkSocialAccount: vi.fn(),
  unlinkAccount: vi.fn(),
}))

vi.mock("@/lib/public-api", () => ({
  usePublicAuthConfig: () => ({
    data: {
      capabilities: { github: true, google: true },
      config: { allowPublicSignup: true },
    },
  }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const credentialAccount = {
  id: "credential-account",
  providerId: "credential",
  accountId: "user@example.com",
  userId: "user-1",
  scopes: [],
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
}

const githubAccount = {
  id: "github-account",
  providerId: "github",
  accountId: "1234",
  userId: "user-1",
  scopes: ["user:email"],
  createdAt: new Date("2026-02-01T00:00:00Z"),
  updatedAt: new Date("2026-02-01T00:00:00Z"),
}

function renderAccounts() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ConnectedAccounts />
    </QueryClientProvider>,
  )
}

describe("ConnectedAccounts", () => {
  beforeEach(() => {
    vi.mocked(listAccounts).mockResolvedValue({
      data: [credentialAccount, githubAccount],
      error: null,
    })
    vi.mocked(linkSocialAccount).mockResolvedValue({
      data: { url: "https://accounts.google.test", redirect: true },
      error: null,
    })
    vi.mocked(unlinkAccount).mockResolvedValue({ data: { status: true }, error: null })
  })

  it("lists existing methods and offers only unconnected configured providers", async () => {
    renderAccounts()
    expect(await screen.findByText("Email and password")).toBeInTheDocument()
    expect(screen.getByText("GitHub")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Connect Google" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Connect GitHub" })).not.toBeInTheDocument()
  })

  it("starts an explicit same-account social linking flow", async () => {
    const user = userEvent.setup()
    renderAccounts()
    await user.click(await screen.findByRole("button", { name: "Connect Google" }))
    expect(linkSocialAccount).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: `${window.location.origin}/dashboard?accountLinked=google`,
      errorCallbackURL: `${window.location.origin}/dashboard?accountLinkError=google`,
    })
  })

  it("confirms and disconnects a social provider", async () => {
    const user = userEvent.setup()
    renderAccounts()
    await user.click(await screen.findByRole("button", { name: "Disconnect" }))
    await user.click(screen.getByRole("button", { name: "Disconnect account" }))
    await waitFor(() => {
      expect(unlinkAccount).toHaveBeenCalledWith({
        providerId: "github",
        accountId: "1234",
      })
    })
  })
})
