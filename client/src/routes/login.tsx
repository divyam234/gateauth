import { createFileRoute, lazyRouteComponent, redirect } from "@tanstack/react-router"
import { z } from "zod"
import { authClient } from "@/lib/auth-client"
import { validateRedirectTarget } from "@/lib/public-api"

const loginSearchSchema = z.object({
  application: z.string().trim().optional(),
  redirect: z.string().trim().optional(),
})

export const Route = createFileRoute("/login")({
  validateSearch: (search) => loginSearchSchema.parse(search),
  beforeLoad: async ({ search }) => {
    const session = await authClient.getSession()
    if (session.error || !session.data) return

    if (search.application && search.redirect) {
      const target = await validateRedirectTarget(search.application, search.redirect)
      if (target) throw redirect({ href: target })
    }

    throw redirect({ to: "/dashboard" })
  },
  component: lazyRouteComponent(() => import("@/pages/login"), "LoginPage"),
})
