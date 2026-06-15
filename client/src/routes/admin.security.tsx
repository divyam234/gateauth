import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router"
import { securityQueryOptions } from "@/features/admin/query-options"

export const Route = createFileRoute("/admin/security")({
  loader: ({ context }) => context.queryClient.ensureQueryData(securityQueryOptions()),
  component: lazyRouteComponent(() => import("@/pages/admin/security"), "AdminSecurityPage"),
})
