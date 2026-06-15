const PRIVILEGED_USER_CREATION_PATHS = new Set(["/admin/create-user"])

export function shouldAllowUserCreation(
  publicSignupAllowed: boolean,
  path: string | undefined,
): boolean {
  return publicSignupAllowed || (path !== undefined && PRIVILEGED_USER_CREATION_PATHS.has(path))
}
