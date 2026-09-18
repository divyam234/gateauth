import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import {
  Activity,
  AppWindow,
  CheckCircle2,
  CircleOff,
  Globe2,
  LockKeyhole,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Trash2,
  XCircle,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { AdminPage, AdminPageHeader, AdminStat, AdminStatsGrid } from "@/components/admin-page"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import {
  adminKeys,
  applicationQueryOptions,
  applicationsQueryOptions,
} from "@/features/admin/query-options"
import { ApplicationEditor } from "@/features/applications/application-editor"
import { PolicyLab } from "@/features/applications/policy-lab"
import {
  checkApplicationHealth,
  deleteApplication,
  type ProtectedApplication,
} from "@/lib/admin-api"

function HealthBadge({ application }: { application: ProtectedApplication }) {
  const states = {
    healthy: { label: "Healthy", icon: CheckCircle2, variant: "secondary" },
    unhealthy: { label: "Unhealthy", icon: XCircle, variant: "destructive" },
    unknown: { label: "Not checked", icon: CircleOff, variant: "outline" },
  } as const
  const state = states[application.lastHealthStatus]

  return (
    <Badge variant={state.variant}>
      <state.icon data-icon="inline-start" aria-hidden="true" />
      {state.label}
    </Badge>
  )
}

function ApplicationCard({
  application,
  onEdit,
  onDelete,
  onCheckHealth,
  checkingHealth,
  loadingDetails,
}: {
  application: ProtectedApplication
  onEdit: () => void
  onDelete: () => void
  onCheckHealth: () => void
  checkingHealth: boolean
  loadingDetails: boolean
}) {
  return (
    <Card className={!application.enabled ? "opacity-70" : undefined}>
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/8">
              <AppWindow className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate">{application.name}</CardTitle>
              <CardDescription className="mt-1 truncate font-mono text-xs">
                {application.slug}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HealthBadge application={application} />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Actions for ${application.name}`}
                  />
                }
              >
                <MoreHorizontal aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={loadingDetails} onClick={onEdit}>
                  <Pencil className="size-4" aria-hidden="true" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem disabled={checkingHealth} onClick={onCheckHealth}>
                  <RefreshCw
                    className={checkingHealth ? "size-4 animate-spin" : "size-4"}
                    aria-hidden="true"
                  />
                  Check health
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 className="size-4" aria-hidden="true" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {application.description || "No description provided."}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Globe2 className="size-3.5" aria-hidden="true" /> Upstream
            </div>
            <p className="mt-2 truncate font-mono text-xs">{application.upstreamUrl}</p>
          </div>
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="size-3.5" aria-hidden="true" /> Last check
            </div>
            <p className="mt-2 text-xs">
              {application.lastHealthCheckAt
                ? `${new Date(application.lastHealthCheckAt).toLocaleString()} · ${application.lastHealthLatencyMs ?? 0} ms`
                : "Never"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {application.domains.slice(0, 3).map((domain) => (
            <Badge key={domain} variant="outline" className="font-mono text-xs">
              {domain}
            </Badge>
          ))}
          {application.domains.length > 3 && (
            <Badge variant="secondary">+{application.domains.length - 3}</Badge>
          )}
          {application.policy.requireMfa && (
            <Badge variant="secondary">
              <LockKeyhole className="mr-1 size-3" aria-hidden="true" /> MFA
            </Badge>
          )}
          {!application.enabled && <Badge variant="outline">Disabled</Badge>}
        </div>
        <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
          <span>
            {application.publicPaths.length} public paths ·{" "}
            {application.policy.allowedRoles.length || "all"} roles
          </span>
          <Button variant="ghost" size="sm" disabled={loadingDetails} onClick={onEdit}>
            {loadingDetails ? <Spinner className="size-4" /> : null}
            Configure
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminApplicationsPage() {
  const queryClient = useQueryClient()
  const { data: applications } = useSuspenseQuery(applicationsQueryOptions())
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<ProtectedApplication | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProtectedApplication | null>(null)

  const healthMutation = useMutation({
    mutationFn: checkApplicationHealth,
    onSuccess: async (application) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.applications() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.overview() }),
      ])
      toast[application.lastHealthStatus === "healthy" ? "success" : "warning"](
        `${application.name} is ${application.lastHealthStatus}`,
      )
    },
    onError: (error) => toast.error(error.message),
  })

  const applicationDetailMutation = useMutation({
    mutationFn: (applicationId: string) =>
      queryClient.fetchQuery(applicationQueryOptions(applicationId)),
    onSuccess: (application) => {
      setEditing(application)
      setEditorOpen(true)
    },
    onError: (error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteApplication,
    onSuccess: async () => {
      setDeleteTarget(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.applications() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.overview() }),
      ])
      toast.success("Application deleted")
    },
    onError: (error) => toast.error(error.message),
  })

  const stats = [
    {
      label: "Enabled upstreams",
      value: applications.filter((application) => application.enabled).length,
      icon: AppWindow,
    },
    {
      label: "MFA-enforced",
      value: applications.filter((application) => application.policy.requireMfa).length,
      icon: LockKeyhole,
    },
    {
      label: "Public route rules",
      value: applications.reduce((total, application) => total + application.publicPaths.length, 0),
      icon: Route,
    },
  ] as const

  function openCreate() {
    setEditing(null)
    setEditorOpen(true)
  }

  function openEdit(application: ProtectedApplication) {
    applicationDetailMutation.mutate(application.id)
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Proxy inventory"
        title="Applications"
        description="Register upstreams and enforce role, domain, network, verified-MFA, and session-freshness rules."
        actions={
          <Button onClick={openCreate}>
            <Plus data-icon="inline-start" aria-hidden="true" /> Protect application
          </Button>
        }
      />

      <AdminStatsGrid className="xl:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <AdminStat key={label} label={label} value={value} icon={Icon} />
        ))}
      </AdminStatsGrid>

      {applications.length === 0 ? (
        <Card className="border-dashed">
          <CardContent>
            <Empty className="min-h-64 border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AppWindow aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>No protected applications</EmptyTitle>
                <EmptyDescription>
                  Create the first upstream and GateAuth will issue application-aware decisions to
                  your reverse proxy.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={openCreate}>
                  <Plus data-icon="inline-start" aria-hidden="true" /> Create application
                </Button>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {applications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              onEdit={() => openEdit(application)}
              onDelete={() => setDeleteTarget(application)}
              onCheckHealth={() => healthMutation.mutate(application.id)}
              checkingHealth={
                healthMutation.isPending && healthMutation.variables === application.id
              }
              loadingDetails={
                applicationDetailMutation.isPending &&
                applicationDetailMutation.variables === application.id
              }
            />
          ))}
        </section>
      )}

      {applications.length > 0 && <PolicyLab applications={applications} />}
      <ApplicationEditor
        key={editing?.id ?? "new"}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        application={editing}
      />
      <ConfirmActionDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Delete application?"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.name} and all of its policies and grants. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete application"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
        }}
        pending={deleteMutation.isPending}
        destructive
      />
    </AdminPage>
  )
}
