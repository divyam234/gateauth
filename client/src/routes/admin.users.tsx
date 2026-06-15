import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router"
import { z } from "zod"
import { usersQueryOptions } from "@/features/admin/query-options"

const usersSearchSchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  user: z.string().optional(),
})

export const Route = createFileRoute("/admin/users")({
  validateSearch: usersSearchSchema,
  loaderDeps: ({ search }) => ({ q: search.q ?? "", page: search.page ?? 1 }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(usersQueryOptions(deps.q, deps.page)),
  component: lazyRouteComponent(() => import("@/pages/admin/users"), "AdminUsersPage"),
})
