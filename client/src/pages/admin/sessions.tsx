import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import {
  Activity,
  Clock3,
  Laptop,
  MapPin,
  Search,
  ShieldOff,
  Smartphone,
  Trash2,
} from "lucide-react"
import { type ComponentType, useDeferredValue, useState } from "react"
import { toast } from "sonner"
import {
  AdminDataPanel,
  AdminPage,
  AdminPageHeader,
  AdminStat,
  AdminStatsGrid,
} from "@/components/admin-page"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { adminKeys, sessionsQueryOptions } from "@/features/admin/query-options"
import { type AdminSession, revokeUserSession } from "@/lib/admin-api"

export type GlobalSession = AdminSession & {
  user: { name: string; email: string }
  active: boolean
}

function describeDevice(userAgent?: string | null): {
  label: string
  icon: ComponentType<{ className?: string }>
} {
  if (!userAgent) return { label: "Unknown client", icon: Laptop }

  const mobile = /Android|iPhone|iPad/i.test(userAgent)
  const browser = /Firefox/i.test(userAgent)
    ? "Firefox"
    : /Edg/i.test(userAgent)
      ? "Edge"
      : /Chrome/i.test(userAgent)
        ? "Chrome"
        : /Safari/i.test(userAgent)
          ? "Safari"
          : "Browser"
  const os = /Windows/i.test(userAgent)
    ? "Windows"
    : /Mac OS|Macintosh/i.test(userAgent)
      ? "macOS"
      : /Android/i.test(userAgent)
        ? "Android"
        : /iPhone|iPad/i.test(userAgent)
          ? "iOS"
          : /Linux/i.test(userAgent)
            ? "Linux"
            : "Unknown OS"

  return { label: `${browser} on ${os}`, icon: mobile ? Smartphone : Laptop }
}

export function AdminSessionsPage() {
  const queryClient = useQueryClient()
  const { data: sessions } = useSuspenseQuery(sessionsQueryOptions())
  const [search, setSearch] = useState("")
  const [revokeTarget, setRevokeTarget] = useState<GlobalSession | null>(null)
  const deferredSearch = useDeferredValue(search.trim().toLowerCase())

  const filteredSessions = deferredSearch
    ? sessions.filter((session) =>
        `${session.user.name} ${session.user.email} ${session.ipAddress ?? ""} ${session.userAgent ?? ""}`
          .toLowerCase()
          .includes(deferredSearch),
      )
    : sessions
  const activeCount = sessions.filter((session) => session.active).length
  const uniqueUserCount = new Set(sessions.map((session) => session.userId)).size

  const revokeMutation = useMutation({
    mutationFn: revokeUserSession,
    onSuccess: async () => {
      setRevokeTarget(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.sessions() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.overview() }),
      ])
      toast.success("Session revoked")
    },
    onError: (error) => toast.error(error.message),
  })

  const summary = [
    { label: "Active sessions", value: activeCount, icon: Activity },
    { label: "Users represented", value: uniqueUserCount, icon: Laptop },
    { label: "Expired retained", value: sessions.length - activeCount, icon: Clock3 },
  ] as const

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Live identity state"
        title="Sessions"
        description="Review active devices across every user and revoke suspicious access immediately."
      />

      <AdminStatsGrid className="xl:grid-cols-3">
        {summary.map(({ label, value, icon: Icon }) => (
          <AdminStat key={label} label={label} value={value} icon={Icon} />
        ))}
      </AdminStatsGrid>

      <div className="relative max-w-md">
        <Search
          className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          className="pl-9"
          placeholder="Search user, IP, browser, or device…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <AdminDataPanel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Network</TableHead>
              <TableHead>Authentication</TableHead>
              <TableHead>Last active</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-14" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-48">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <ShieldOff aria-hidden="true" />
                      </EmptyMedia>
                      <EmptyTitle>No matching sessions</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              filteredSessions.map((session) => {
                const device = describeDevice(session.userAgent)
                const DeviceIcon = device.icon
                return (
                  <TableRow key={session.id}>
                    <TableCell>
                      <p className="font-medium">{session.user.name}</p>
                      <p className="text-xs text-muted-foreground">{session.user.email}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <DeviceIcon className="size-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm">{device.label}</p>
                          <p className="max-w-56 truncate text-xs text-muted-foreground">
                            {session.userAgent || "No user agent"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="flex items-center gap-1.5 font-mono text-xs">
                        <MapPin className="size-3 text-muted-foreground" aria-hidden="true" />
                        {session.ipAddress || "Unknown"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">{session.authMethod || "unknown"}</Badge>
                        {session.mfaVerifiedAt && <Badge variant="secondary">MFA verified</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(session.updatedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {session.expiresAt ? new Date(session.expiresAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={session.active ? "secondary" : "outline"}>
                        {session.active ? "Active" : "Expired"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Revoke ${session.user.name}'s session`}
                        disabled={!session.active}
                        onClick={() => setRevokeTarget(session)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </AdminDataPanel>

      <p className="text-xs text-muted-foreground">
        Showing {filteredSessions.length} of {sessions.length} retained sessions. Expired rows
        remain visible until database cleanup.
      </p>

      <ConfirmActionDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null)
        }}
        title="Revoke session?"
        description={
          revokeTarget
            ? `Immediately sign out ${revokeTarget.user.name} on ${describeDevice(revokeTarget.userAgent).label}.`
            : ""
        }
        confirmLabel="Revoke session"
        onConfirm={() => {
          if (revokeTarget) revokeMutation.mutate(revokeTarget.id)
        }}
        pending={revokeMutation.isPending}
        destructive
      />
    </AdminPage>
  )
}
