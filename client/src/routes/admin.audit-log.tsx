import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router"
import { z } from "zod"
import { auditLogQueryOptions } from "@/features/admin/query-options"

const auditSearchSchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  severity: z.enum(["info", "warning", "critical"]).optional(),
  outcome: z.enum(["success", "failure", "denied"]).optional(),
})

export const Route = createFileRoute("/admin/audit-log")({
  validateSearch: auditSearchSchema,
  loaderDeps: ({ search }) => ({
    page: search.page ?? 1,
    filters: {
      search: search.q,
      severity: search.severity,
      outcome: search.outcome,
    },
  }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(auditLogQueryOptions(deps.page, deps.filters)),
  component: lazyRouteComponent(() => import("@/pages/admin/audit-log"), "AdminAuditLogPage"),
})
