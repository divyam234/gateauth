import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router"
import { overviewQueryOptions } from "@/features/admin/query-options"

export const Route = createFileRoute("/admin/overview")({
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQueryOptions()),
  component: lazyRouteComponent(() => import("@/pages/admin/overview"), "AdminOverviewPage"),
})
