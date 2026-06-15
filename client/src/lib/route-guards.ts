import { redirect } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"

function hasAdminRole(role: unknown): boolean {
  return String(role ?? "")
    .split(",")
    .some((candidate) => candidate.trim() === "admin")
}

export async function requireSession() {
  const result = await authClient.getSession()
  if (result.error || !result.data) {
    throw redirect({ to: "/login" })
  }
  return result.data
}

export async function requireAdmin() {
  const session = await requireSession()
  if (!hasAdminRole(session.user.role)) {
    throw redirect({ to: "/dashboard" })
  }
  return session
}
