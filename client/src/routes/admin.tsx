import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router"
import { configQueryOptions } from "@/features/admin/query-options"
import { requireAdmin } from "@/lib/route-guards"

export const Route = createFileRoute("/admin")({
  beforeLoad: requireAdmin,
  loader: ({ context }) => context.queryClient.ensureQueryData(configQueryOptions()),
  component: lazyRouteComponent(() => import("@/pages/admin/layout"), "AdminLayout"),
})
