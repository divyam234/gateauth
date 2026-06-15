import { describe, expect, it } from "vitest"
import { shouldAllowUserCreation } from "../src/signup-policy.js"

describe("user creation policy", () => {
  it("allows all registration paths while public signup is enabled", () => {
    expect(shouldAllowUserCreation(true, "/sign-up/email")).toBe(true)
    expect(shouldAllowUserCreation(true, "/callback/google")).toBe(true)
  })

  it.each([
    "/sign-up/email",
    "/callback/google",
    "/callback/github",
    "/sign-in/email-otp",
    "/magic-link/verify",
    undefined,
  ])("blocks public user creation through %s when signup is disabled", (path) => {
    expect(shouldAllowUserCreation(false, path)).toBe(false)
  })

  it("still allows authenticated administrators to provision users", () => {
    expect(shouldAllowUserCreation(false, "/admin/create-user")).toBe(true)
  })
})
