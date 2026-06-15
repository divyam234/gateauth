import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router"

export const Route = createFileRoute("/two-factor")({
  component: lazyRouteComponent(() => import("@/pages/two-factor"), "TwoFactorPage"),
})
