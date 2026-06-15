import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router"
import { z } from "zod"

const verifyOtpSearchSchema = z.object({
  email: z.string().trim().default(""),
})

export const Route = createFileRoute("/verify-otp")({
  validateSearch: (search) => verifyOtpSearchSchema.parse(search),
  component: lazyRouteComponent(() => import("@/pages/verify-otp"), "VerifyOtpPage"),
})
