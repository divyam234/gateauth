import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router"

import { applicationsQueryOptions } from "@/features/admin/query-options"

export const Route = createFileRoute("/admin/applications")({
  loader: ({ context }) => context.queryClient.ensureQueryData(applicationsQueryOptions()),
  component: lazyRouteComponent(
    () => import("@/pages/admin/applications"),
    "AdminApplicationsPage",
  ),
})
