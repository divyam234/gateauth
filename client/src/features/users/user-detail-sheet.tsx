import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { KeyRound, Laptop, Link2, ShieldCheck, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { adminKeys, userDetailsQueryOptions } from "@/features/admin/query-options"
import { revokeUserSession } from "@/lib/admin-api"

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
})

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatDate(value: string | null) {
  return value ? dateTimeFormatter.format(new Date(value)) : "Never"
}

function DetailLoading() {
  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

export function UserDetailSheet({
  userId,
  onOpenChange,
}: {
  userId?: string
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const detailsQuery = useQuery(userDetailsQueryOptions(userId ?? ""))
  const revokeMutation = useMutation({
    mutationFn: revokeUserSession,
    onSuccess: async () => {
      if (userId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: adminKeys.userDetails(userId) }),
          queryClient.invalidateQueries({ queryKey: adminKeys.sessions() }),
          queryClient.invalidateQueries({ queryKey: adminKeys.overview() }),
        ])
      }
      toast.success("Session revoked")
    },
    onError: (error) => toast.error(error.message),
  })
  const data = detailsQuery.data

  return (
    <Sheet open={Boolean(userId)} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>User inspector</SheetTitle>
          <SheetDescription>
            Identity, access, sessions, authenticators, and recent activity.
          </SheetDescription>
        </SheetHeader>
        {detailsQuery.isPending ? (
          <DetailLoading />
        ) : detailsQuery.isError ? (
          <div className="p-4">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Could not load user details</EmptyTitle>
                <EmptyDescription>{detailsQuery.error.message}</EmptyDescription>
              </EmptyHeader>
              <Button variant="outline" onClick={() => detailsQuery.refetch()}>
                Retry
              </Button>
            </Empty>
          </div>
        ) : data ? (
          <div className="flex flex-col gap-5 p-4 pt-0">
            <div className="flex items-start gap-4 rounded-xl border p-4">
              <Avatar className="size-12">
                {data.user.image && <AvatarImage src={data.user.image} alt="" />}
                <AvatarFallback>{initials(data.user.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-base font-semibold">{data.user.name}</p>
                  <Badge variant={data.user.banned ? "destructive" : "secondary"}>
                    {data.user.banned ? "Banned" : "Active"}
                  </Badge>
                  <Badge variant={data.user.role === "admin" ? "default" : "outline"}>
                    {data.user.role}
                  </Badge>
                </div>
                <p className="truncate text-sm text-muted-foreground">{data.user.email}</p>
                <p className="mt-2 font-mono text-xs text-muted-foreground">{data.user.id}</p>
              </div>
            </div>

            <Tabs defaultValue="security">
              <TabsList className="w-full justify-start overflow-x-auto" variant="line">
                <TabsTrigger value="security">Security</TabsTrigger>
                <TabsTrigger value="sessions">Sessions ({data.sessions.length})</TabsTrigger>
                <TabsTrigger value="access">Access ({data.grants.length})</TabsTrigger>
                <TabsTrigger value="activity">Activity ({data.events.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="security" className="flex flex-col gap-4 pt-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border p-3">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="mt-1 font-medium">
                      {data.user.emailVerified ? "Verified" : "Unverified"}
                    </p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-xs text-muted-foreground">Two-factor</p>
                    <p className="mt-1 font-medium">
                      {data.user.twoFactorEnabled ? "Enabled" : "Not enabled"}
                    </p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="mt-1 font-medium">{formatDate(data.user.createdAt)}</p>
                  </div>
                </div>
                <section className="rounded-xl border">
                  <div className="flex items-center gap-2 border-b px-4 py-3">
                    <Link2 className="size-4" />
                    <h3 className="font-medium">Linked sign-in methods</h3>
                  </div>
                  <div className="divide-y">
                    {data.accounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div>
                          <p className="font-medium capitalize">{account.providerId}</p>
                          <p className="text-xs text-muted-foreground">{account.accountId}</p>
                        </div>
                        <Badge variant="outline">Linked</Badge>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="rounded-xl border">
                  <div className="flex items-center gap-2 border-b px-4 py-3">
                    <ShieldCheck className="size-4" />
                    <h3 className="font-medium">Passkeys</h3>
                  </div>
                  {data.passkeys.length ? (
                    <div className="divide-y">
                      {data.passkeys.map((passkey) => (
                        <div
                          key={passkey.id}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <div>
                            <p className="font-medium">{passkey.name || "Unnamed passkey"}</p>
                            <p className="text-xs text-muted-foreground">
                              {passkey.deviceType} · added {formatDate(passkey.createdAt)}
                            </p>
                          </div>
                          <Badge variant={passkey.backedUp ? "secondary" : "outline"}>
                            {passkey.backedUp ? "Synced" : "Device-bound"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="px-4 py-5 text-sm text-muted-foreground">
                      No passkeys registered.
                    </p>
                  )}
                </section>
                <section className="rounded-xl border">
                  <div className="flex items-center gap-2 border-b px-4 py-3">
                    <KeyRound className="size-4" />
                    <h3 className="font-medium">API keys</h3>
                  </div>
                  {data.apiKeys.length ? (
                    <div className="divide-y">
                      {data.apiKeys.map((key) => (
                        <div
                          key={key.id}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <div>
                            <p className="font-medium">{key.name || "Unnamed key"}</p>
                            <p className="text-xs text-muted-foreground">
                              {key.prefix || key.start || "No prefix"} · {key.requestCount} requests
                            </p>
                          </div>
                          <Badge variant={key.enabled ? "secondary" : "outline"}>
                            {key.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="px-4 py-5 text-sm text-muted-foreground">No API keys.</p>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="sessions" className="pt-3">
                <div className="divide-y rounded-xl border">
                  {data.sessions.length ? (
                    data.sessions.map((session) => (
                      <div key={session.id} className="flex items-start justify-between gap-4 p-4">
                        <div className="flex min-w-0 gap-3">
                          <Laptop className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {session.userAgent || "Unknown client"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {session.ipAddress || "Unknown IP"} · updated{" "}
                              {formatDate(session.updatedAt)}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <Badge variant="outline">{session.authMethod || "session"}</Badge>
                              {session.mfaVerifiedAt && (
                                <Badge variant="secondary">MFA verified</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Revoke session"
                          disabled={revokeMutation.isPending}
                          onClick={() => revokeMutation.mutate(session.id)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="p-5 text-sm text-muted-foreground">No active sessions.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="access" className="pt-3">
                <div className="divide-y rounded-xl border">
                  {data.grants.length ? (
                    data.grants.map((grant) => (
                      <div key={grant.id} className="flex items-center justify-between gap-3 p-4">
                        <div>
                          <p className="font-medium">{grant.applicationName}</p>
                          <p className="text-xs text-muted-foreground">
                            /{grant.applicationSlug} · expires {formatDate(grant.expiresAt)}
                          </p>
                        </div>
                        <Badge variant={grant.effect === "allow" ? "secondary" : "destructive"}>
                          {grant.effect}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="p-5 text-sm text-muted-foreground">
                      No user-specific application grants.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="activity" className="pt-3">
                <div className="divide-y rounded-xl border">
                  {data.events.length ? (
                    data.events.map((event) => (
                      <div key={event.id} className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{event.action}</p>
                          <Badge
                            variant={event.outcome === "success" ? "secondary" : "destructive"}
                          >
                            {event.outcome}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(event.createdAt)} · {event.ipAddress || "unknown IP"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="p-5 text-sm text-muted-foreground">No recent activity.</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
            <Separator />
            {data.user.banned && data.user.banReason && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="font-medium text-destructive">Ban reason</p>
                <p className="mt-1 text-sm">{data.user.banReason}</p>
              </div>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
