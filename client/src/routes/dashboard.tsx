import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router"
import { requireSession } from "@/lib/route-guards"

type DashboardSearch = {
  accountLinked?: "github" | "google"
  accountLinkError?: string
  error?: string
}

export const Route = createFileRoute("/dashboard")({
  beforeLoad: requireSession,
  validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
    accountLinked:
      search.accountLinked === "github" || search.accountLinked === "google"
        ? search.accountLinked
        : undefined,
    accountLinkError:
      typeof search.accountLinkError === "string" ? search.accountLinkError : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: lazyRouteComponent(() => import("@/pages/dashboard"), "DashboardPage"),
})
