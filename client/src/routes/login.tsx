import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router"
import { z } from "zod"

const loginSearchSchema = z.object({
  application: z.string().trim().optional(),
  redirect: z.string().trim().optional(),
})

export const Route = createFileRoute("/login")({
  validateSearch: (search) => loginSearchSchema.parse(search),
  component: lazyRouteComponent(() => import("@/pages/login"), "LoginPage"),
})
