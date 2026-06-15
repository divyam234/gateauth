import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router"
import { configQueryOptions } from "@/features/admin/query-options"

export const Route = createFileRoute("/admin/config")({
  loader: ({ context }) => context.queryClient.ensureQueryData(configQueryOptions()),
  component: lazyRouteComponent(() => import("@/pages/admin/config"), "AdminConfigPage"),
})
