import { apiKeyClient } from "@better-auth/api-key/client"
import { passkeyClient } from "@better-auth/passkey/client"
import { useQuery } from "@tanstack/react-query"
import {
  adminClient,
  emailOTPClient,
  magicLinkClient,
  twoFactorClient,
} from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

const baseURL =
  import.meta.env.VITE_BETTER_AUTH_URL ||
  (typeof window === "undefined"
    ? "http://localhost:8080/api/auth"
    : `${window.location.origin}/api/auth`)

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    emailOTPClient(),
    magicLinkClient(),
    passkeyClient(),
    twoFactorClient({
      twoFactorPage: "/two-factor",
      onTwoFactorRedirect: ({ twoFactorMethods }) => {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(
            "gatehouse:two-factor-methods",
            JSON.stringify(twoFactorMethods ?? []),
          )
        }
      },
    }),
    adminClient(),
    apiKeyClient(),
  ],
})

export type Session = typeof authClient.$Infer.Session
export type PasskeyRecord = NonNullable<
  ReturnType<typeof authClient.useListPasskeys>["data"]
>[number]
export type LinkedAccountRecord = NonNullable<
  Awaited<ReturnType<typeof authClient.listAccounts>>["data"]
>[number]
export type UserSessionRecord = {
  id?: string
  token: string
  userAgent?: string | null
  ipAddress?: string | null
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
  expiresAt?: string | Date | null
  isActive?: boolean
  isCurrent?: boolean
}

export const signIn = authClient.signIn
export const signUp = authClient.signUp
export const signOut = authClient.signOut
export const changePassword = authClient.changePassword
export const useSession = authClient.useSession
export const useListPasskeys = authClient.useListPasskeys
export function useListSessions() {
  return useQuery({
    queryKey: ["current-user-sessions"],
    queryFn: async (): Promise<UserSessionRecord[]> => {
      const result = await authClient.listSessions()
      if (result.error) throw new Error(result.error.message || "Failed to load sessions")
      return (result.data ?? []).map((session) => ({
        ...session,
        isActive: new Date(session.expiresAt).getTime() > Date.now(),
      }))
    },
  })
}
export const addPasskey = authClient.passkey.addPasskey
export const twoFactor = authClient.twoFactor
export const sendVerificationOtp = authClient.emailOtp.sendVerificationOtp
export const revokeSession = authClient.revokeSession
export const revokePasskey = authClient.passkey.deletePasskey
export const listAccounts = authClient.listAccounts
export const linkSocialAccount = authClient.linkSocial
export const unlinkAccount = authClient.unlinkAccount
