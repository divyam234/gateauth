import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router"
import { apiKeysQueryOptions } from "@/features/admin/query-options"

export const Route = createFileRoute("/admin/api-keys")({
  loader: ({ context }) => context.queryClient.ensureQueryData(apiKeysQueryOptions()),
  component: lazyRouteComponent(() => import("@/pages/admin/api-keys"), "AdminApiKeysPage"),
})
