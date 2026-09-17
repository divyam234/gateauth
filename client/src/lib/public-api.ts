import { useQuery } from "@tanstack/react-query"
import { z } from "zod"

const runtimeCapabilitiesSchema = z.object({
  emailPassword: z.boolean(),
  emailOtp: z.boolean(),
  magicLink: z.boolean(),
  passkey: z.boolean(),
  twoFactor: z.boolean(),
  apiKeys: z.boolean(),
  github: z.boolean(),
  google: z.boolean(),
  captcha: z.boolean(),
  compromisedPasswordCheck: z.boolean(),
})

const publicAuthConfigSchema = z.object({
  capabilities: runtimeCapabilitiesSchema,
  config: z
    .object({
      allowPublicSignup: z.boolean().default(false),
      brandingName: z.string().optional(),
    })
    .passthrough(),
})

export type RuntimeCapabilities = z.infer<typeof runtimeCapabilitiesSchema>
export type PublicAuthConfig = z.infer<typeof publicAuthConfigSchema>

const redirectTargetSchema = z.object({ redirect: z.string().url() })

export async function validateRedirectTarget(
  application: string,
  redirect: string,
): Promise<string | null> {
  const params = new URLSearchParams({ application, redirect })
  const response = await fetch(`/api/public/redirect-target?${params.toString()}`, {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  })
  if (!response.ok) return null
  return redirectTargetSchema.parse(await response.json()).redirect
}

export async function fetchPublicAuthConfig(): Promise<PublicAuthConfig> {
  const response = await fetch("/api/public/capabilities", {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  })
  if (!response.ok) throw new Error("Failed to load authentication capabilities")
  return publicAuthConfigSchema.parse(await response.json())
}

export function usePublicAuthConfig() {
  return useQuery({
    queryKey: ["public-auth-config"],
    queryFn: fetchPublicAuthConfig,
    staleTime: 60_000,
    retry: 1,
  })
}
