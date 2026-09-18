import { useNavigate } from "@tanstack/react-router"
import {
  Fingerprint,
  KeyRound,
  Laptop,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react"
import { type FormEvent, useEffect, useState } from "react"
import { toast } from "sonner"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import { ConnectedAccounts } from "@/components/security/connected-accounts"
import { TwoFactorManager } from "@/components/security/two-factor-manager"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { stopImpersonatingAdminUser } from "@/lib/admin-api"
import {
  addPasskey,
  changePassword,
  type PasskeyRecord,
  revokePasskey,
  revokeSession,
  signOut,
  type UserSessionRecord,
  useListPasskeys,
  useListSessions,
  useSession,
} from "@/lib/auth-client"
import { Route } from "@/routes/dashboard"

type RemovalTarget =
  | { kind: "passkey"; id: string; label: string }
  | { kind: "session"; id: string; label: string }

export function DashboardPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const { data: session, isPending, refetch: refetchSession } = useSession()
  const { data: passkeys, refetch: refetchPasskeys } = useListPasskeys()
  const { data: sessions, refetch: refetchSessions } = useListSessions()
  const [busyAction, setBusyAction] = useState<
    "sign-out" | "passkey" | "remove" | "password" | null
  >(null)
  const [removalTarget, setRemovalTarget] = useState<RemovalTarget | null>(null)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  useEffect(() => {
    if (search.accountLinked) {
      const provider = search.accountLinked === "github" ? "GitHub" : "Google"
      toast.success(`${provider} connected to your account`)
    } else if (search.accountLinkError || search.error) {
      toast.error("The social account could not be connected")
    } else {
      return
    }
    void navigate({ to: "/dashboard", search: {}, replace: true })
  }, [navigate, search.accountLinkError, search.accountLinked, search.error])

  async function handleSignOut() {
    setBusyAction("sign-out")
    try {
      const result = await signOut()
      if (result.error) throw new Error(result.error.message || "Failed to sign out")
      toast.success("Signed out")
      await navigate({ to: "/login" })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sign out")
    } finally {
      setBusyAction(null)
    }
  }

  async function handleAddPasskey() {
    setBusyAction("passkey")
    try {
      const result = await addPasskey()
      if (result?.error) throw new Error(result.error.message || "Failed to add passkey")
      toast.success("Passkey added")
      await refetchPasskeys()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add passkey")
    } finally {
      setBusyAction(null)
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (newPassword.length < 12 || newPassword !== confirmPassword) {
      toast.error(
        newPassword.length < 12
          ? "New password must contain at least 12 characters"
          : "New passwords do not match",
      )
      return
    }

    setBusyAction("password")
    try {
      const result = await changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      })
      if (result.error) throw new Error(result.error.message || "Failed to change password")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      await refetchSessions()
      toast.success("Password changed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change password")
    } finally {
      setBusyAction(null)
    }
  }

  async function handleConfirmRemoval() {
    if (!removalTarget) return
    setBusyAction("remove")
    try {
      if (removalTarget.kind === "passkey") {
        const result = await revokePasskey({ id: removalTarget.id })
        if (result.error) throw new Error(result.error.message || "Failed to remove passkey")
        await refetchPasskeys()
        toast.success("Passkey removed")
      } else {
        const result = await revokeSession({ token: removalTarget.id })
        if (result.error) throw new Error(result.error.message || "Failed to revoke session")
        await refetchSessions()
        toast.success("Session revoked")
      }
      setRemovalTarget(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed")
    } finally {
      setBusyAction(null)
    }
  }

  async function handleStopImpersonating() {
    try {
      await stopImpersonatingAdminUser()
      toast.success("Returned to admin session")
      await navigate({ to: "/admin/users" })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to stop impersonating")
    }
  }

  if (isPending) return null

  if (!session) return null

  const { user } = session
  const impersonatedBy = session.session.impersonatedBy
  const twoFactorEnabled = user.twoFactorEnabled === true
  const isAdmin = user.role === "admin"
  const activeDevices = (sessions ?? []).filter((item: UserSessionRecord) => item.isActive)

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
        {impersonatedBy && (
          <section className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            <div>
              <p className="font-medium text-destructive">Impersonation active</p>
              <p className="text-muted-foreground">
                You are viewing this account as an administrator.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void handleStopImpersonating()}>
              Return to admin
            </Button>
          </section>
        )}

        <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <UserRound className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight">{user.name}</h1>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => void navigate({ to: "/admin" })}
              >
                <ShieldCheck data-icon="inline-start" aria-hidden="true" />
                Admin
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => void handleSignOut()}
              disabled={busyAction === "sign-out"}
            >
              {busyAction === "sign-out" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <LogOut data-icon="inline-start" aria-hidden="true" />
              )}
              {busyAction === "sign-out" ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3" aria-label="Account security summary">
          <Card size="sm">
            <CardContent className="flex items-center justify-between px-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Two-factor</p>
                <p className="mt-1 text-sm font-semibold">
                  {twoFactorEnabled ? "Protected" : "Not enabled"}
                </p>
              </div>
              <Badge variant={twoFactorEnabled ? "secondary" : "outline"}>
                <ShieldCheck data-icon="inline-start" aria-hidden="true" />
                {twoFactorEnabled ? "On" : "Off"}
              </Badge>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="flex items-center justify-between px-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Passkeys</p>
                <p className="mt-1 text-sm font-semibold">{passkeys?.length ?? 0} registered</p>
              </div>
              <Fingerprint className="size-5 text-muted-foreground" aria-hidden="true" />
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="flex items-center justify-between px-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Sessions</p>
                <p className="mt-1 text-sm font-semibold">{activeDevices.length} active</p>
              </div>
              <Laptop className="size-5 text-muted-foreground" aria-hidden="true" />
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4" aria-hidden="true" />
              Change password
            </CardTitle>
            <CardDescription>
              Confirm your current password and choose a new one. Other sessions will be signed out.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={(event) => void handleChangePassword(event)}>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium" htmlFor="current-password">
                  Current password
                </label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium" htmlFor="new-password">
                    New password
                  </label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    minLength={12}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium" htmlFor="confirm-new-password">
                    Confirm new password
                  </label>
                  <Input
                    id="confirm-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    minLength={12}
                    required
                  />
                </div>
              </div>
              <div>
                <Button type="submit" disabled={busyAction === "password"}>
                  {busyAction === "password" && <Spinner data-icon="inline-start" />}
                  {busyAction === "password" ? "Changing password…" : "Change password"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <TwoFactorManager enabled={twoFactorEnabled} onChanged={() => void refetchSession()} />

        <ConnectedAccounts />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Fingerprint className="size-4" aria-hidden="true" />
                  Passkeys
                </CardTitle>
                <CardDescription>Passwordless sign-in with your device</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleAddPasskey()}
                disabled={busyAction === "passkey"}
              >
                {busyAction === "passkey" ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Plus data-icon="inline-start" aria-hidden="true" />
                )}
                Add passkey
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!passkeys?.length ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Fingerprint aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>No passkeys registered</EmptyTitle>
                  <EmptyDescription>Add a passkey to enable passwordless sign-in.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col gap-2">
                {passkeys.map((passkey: PasskeyRecord) => (
                  <div
                    key={passkey.id}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Fingerprint
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{passkey.name || "Passkey"}</p>
                        <p className="text-xs text-muted-foreground">
                          Added{" "}
                          {passkey.createdAt
                            ? new Date(passkey.createdAt).toLocaleDateString()
                            : "unknown"}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${passkey.name || "passkey"}`}
                      onClick={() =>
                        setRemovalTarget({
                          kind: "passkey",
                          id: passkey.id,
                          label: passkey.name || "this passkey",
                        })
                      }
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Laptop className="size-4" aria-hidden="true" />
              Active sessions
            </CardTitle>
            <CardDescription>Devices currently signed into your account</CardDescription>
          </CardHeader>
          <CardContent>
            {!activeDevices.length ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Laptop aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>No active sessions</EmptyTitle>
                  <EmptyDescription>
                    There are no other active sessions for this account.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col gap-2">
                {activeDevices.map((device: UserSessionRecord) => (
                  <div
                    key={device.id ?? device.token}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Laptop
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {device.userAgent || "Unknown device"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Last active{" "}
                          {device.updatedAt
                            ? new Date(device.updatedAt).toLocaleString()
                            : "unknown"}
                        </p>
                      </div>
                    </div>
                    {!device.isCurrent && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Revoke session for ${device.userAgent || "unknown device"}`}
                        onClick={() =>
                          setRemovalTarget({
                            kind: "session",
                            id: device.token,
                            label: device.userAgent || "this device",
                          })
                        }
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmActionDialog
        open={removalTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemovalTarget(null)
        }}
        title={removalTarget?.kind === "passkey" ? "Remove passkey?" : "Revoke session?"}
        description={
          removalTarget ? `This will immediately invalidate ${removalTarget.label}.` : ""
        }
        confirmLabel={removalTarget?.kind === "passkey" ? "Remove passkey" : "Revoke session"}
        onConfirm={handleConfirmRemoval}
        pending={busyAction === "remove"}
        destructive
      />
    </main>
  )
}

export default DashboardPage
