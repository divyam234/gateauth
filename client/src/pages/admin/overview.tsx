import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  Activity,
  AlertTriangle,
  AppWindow,
  ArrowRight,
  Fingerprint,
  KeyRound,
  ShieldCheck,
  ShieldX,
  Users,
} from "lucide-react"
import { AdminPage, AdminPageHeader, AdminStat, AdminStatsGrid } from "@/components/admin-page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { overviewQueryOptions } from "@/features/admin/query-options"
import type { AuditEvent } from "@/lib/admin-api"

function EventRow({ event }: { event: AuditEvent }) {
  const tone =
    event.severity === "critical"
      ? "destructive"
      : event.outcome === "denied"
        ? "outline"
        : "secondary"
  return (
    <div className="flex items-start gap-3 border-b py-3 last:border-0">
      <div
        className={`mt-1 size-2 rounded-full ${event.severity === "critical" ? "bg-destructive" : "bg-muted-foreground/50"}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{event.action.replaceAll(".", " · ")}</p>
          <Badge variant={tone}>{event.outcome}</Badge>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {event.targetType || "system"}
          {event.targetId ? ` · ${event.targetId}` : ""}
        </p>
      </div>
      <time className="shrink-0 text-xs text-muted-foreground">
        {new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(
          new Date(event.createdAt),
        )}
      </time>
    </div>
  )
}

export function AdminOverviewPage() {
  const navigate = useNavigate()
  const { data } = useSuspenseQuery(overviewQueryOptions())
  const { metrics } = data
  const maxTrend = Math.max(1, ...data.trend.flatMap((item) => [item.signIns, item.denied]))

  const cards = [
    {
      label: "Users",
      value: metrics.users,
      detail: `${metrics.mfaAdoption}% MFA adoption`,
      icon: Users,
    },
    {
      label: "Active sessions",
      value: metrics.activeSessions,
      detail: `${metrics.signIns24h} sign-ins today`,
      icon: Activity,
    },
    {
      label: "Protected apps",
      value: metrics.applications.total,
      detail: `${metrics.applications.healthy} healthy`,
      icon: AppWindow,
    },
    {
      label: "Denied today",
      value: metrics.denied24h,
      detail: `${metrics.criticalEvents7d} critical this week`,
      icon: ShieldX,
    },
  ]

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Identity control plane"
        title="Overview"
        description={
          <>
            <span>Every application. One policy surface.</span> Monitor access, harden identity, and
            operate protected upstreams from a single console.
          </>
        }
        actions={
          <Button onClick={() => navigate({ to: "/admin/applications" })}>
            Manage applications <ArrowRight data-icon="inline-end" />
          </Button>
        }
      />

      <AdminStatsGrid>
        {cards.map((item) => (
          <AdminStat
            key={item.label}
            label={item.label}
            value={item.value.toLocaleString()}
            detail={item.detail}
            icon={item.icon}
          />
        ))}
      </AdminStatsGrid>

      <section className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Authentication activity</CardTitle>
            <CardDescription>
              Successful sign-ins and denied decisions over the last 14 days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-end gap-2 rounded-xl border bg-muted/20 p-4">
              {data.trend.map((item) => (
                <div
                  key={item.day}
                  className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-1"
                  title={`${item.day}: ${item.signIns} sign-ins, ${item.denied} denied`}
                >
                  <div className="flex flex-1 items-end justify-center gap-0.5">
                    <div
                      className="w-[42%] rounded-t bg-foreground/75 transition-opacity group-hover:opacity-70"
                      style={{ height: `${Math.max(2, (item.signIns / maxTrend) * 100)}%` }}
                    />
                    <div
                      className="w-[42%] rounded-t bg-destructive/70 transition-opacity group-hover:opacity-70"
                      style={{
                        height: `${Math.max(item.denied ? 2 : 0, (item.denied / maxTrend) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="truncate text-center text-xs text-muted-foreground">
                    {new Date(`${item.day}T00:00:00`).toLocaleDateString(undefined, {
                      day: "numeric",
                    })}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <i className="size-2 rounded-full bg-foreground/75" /> Sign-ins
              </span>
              <span className="flex items-center gap-1.5">
                <i className="size-2 rounded-full bg-destructive/70" /> Denied
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Security posture</CardTitle>
            <CardDescription>Adoption and credential health.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 pt-1">
            {[
              {
                label: "Multi-factor authentication",
                value: metrics.mfaAdoption,
                icon: ShieldCheck,
              },
              { label: "Passkey adoption", value: metrics.passkeyAdoption, icon: Fingerprint },
            ].map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <item.icon className="size-4 text-muted-foreground" />
                    {item.label}
                  </span>
                  <strong>{item.value}%</strong>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl border bg-muted/20 p-3">
                <KeyRound className="size-4 text-muted-foreground" />
                <p className="mt-3 text-xl font-semibold">{metrics.activeApiKeys}</p>
                <p className="text-xs text-muted-foreground">Active API keys</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <AlertTriangle className="size-4 text-muted-foreground" />
                <p className="mt-3 text-xl font-semibold">{metrics.expiringApiKeys}</p>
                <p className="text-xs text-muted-foreground">Expire in 7 days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Recent control-plane activity</CardTitle>
              <CardDescription>Authentication, policy, and administrative events.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/admin/audit-log" })}
            >
              View audit log <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.recentEvents.length ? (
            data.recentEvents.map((event) => <EventRow key={event.id} event={event} />)
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No events recorded yet.
            </p>
          )}
        </CardContent>
      </Card>
    </AdminPage>
  )
}
