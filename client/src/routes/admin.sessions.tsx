import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router"
import { sessionsQueryOptions } from "@/features/admin/query-options"

export const Route = createFileRoute("/admin/sessions")({
  loader: ({ context }) => context.queryClient.ensureQueryData(sessionsQueryOptions()),
  component: lazyRouteComponent(() => import("@/pages/admin/sessions"), "AdminSessionsPage"),
})
