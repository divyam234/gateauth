import { describe, expect, it } from "vitest"
import { router } from "@/router"

const EXPECTED_ROUTES = [
  "/",
  "/login",
  "/verify-otp",
  "/two-factor",
  "/dashboard",
  "/admin",
  "/admin/overview",
  "/admin/applications",
  "/admin/users",
  "/admin/sessions",
  "/admin/api-keys",
  "/admin/audit-log",
  "/admin/security",
  "/admin/config",
] as const

describe("generated file routes", () => {
  it("registers every public, authenticated, and administrative route", () => {
    expect(Object.keys(router.routesByPath)).toEqual(expect.arrayContaining([...EXPECTED_ROUTES]))
  })
})
