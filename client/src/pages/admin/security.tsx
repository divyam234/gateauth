import { useSuspenseQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  type LucideIcon,
  ShieldCheck,
} from "lucide-react"
import { AdminPage, AdminPageHeader } from "@/components/admin-page"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { securityQueryOptions } from "@/features/admin/query-options"

type ProtectionCheck = {
  label: string
  ok: boolean
  detail: string
  icon: LucideIcon
}

function ReadinessScore({
  score,
  denied24h,
  criticalEvents7d,
}: {
  score: number
  denied24h: number
  criticalEvents7d: number
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Readiness score</CardTitle>
        <CardDescription>Configured protections, not a compliance certification.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-3">
          <span className="font-heading text-4xl font-semibold tabular-nums tracking-tight">
            {score}
          </span>
          <span className="pb-2 text-muted-foreground">/ 100</span>
        </div>
        <div
          className="mt-5 h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Security readiness"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={score}
        >
          <div className="h-full rounded-full bg-foreground" style={{ width: `${score}%` }} />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl border p-3">
            <p className="text-2xl font-semibold">{denied24h}</p>
            <p className="text-xs text-muted-foreground">Denied in 24h</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-2xl font-semibold">{criticalEvents7d}</p>
            <p className="text-xs text-muted-foreground">Critical in 7d</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ProtectionChecklist({ checks }: { checks: ProtectionCheck[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Protection checklist</CardTitle>
        <CardDescription>
          Controls are enabled through plugins and deployment secrets.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {checks.map((item) => (
          <div key={item.label} className="flex items-start gap-3 rounded-xl border p-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <item.icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{item.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
            </div>
            <Badge variant={item.ok ? "secondary" : "outline"}>
              {item.ok ? "Enabled" : "Action needed"}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function AdminSecurityPage() {
  const {
    data: [overview, config],
  } = useSuspenseQuery(securityQueryOptions())

  const checks: ProtectionCheck[] = [
    {
      label: "Passkey authentication",
      ok: config.capabilities.passkey,
      detail: `${overview.metrics.passkeyAdoption}% user adoption`,
      icon: Fingerprint,
    },
    {
      label: "Two-factor authentication",
      ok: config.capabilities.twoFactor,
      detail: `${overview.metrics.mfaAdoption}% user adoption`,
      icon: LockKeyhole,
    },
    {
      label: "Compromised-password screening",
      ok: config.capabilities.compromisedPasswordCheck,
      detail: "HIBP k-anonymity password checks",
      icon: ShieldCheck,
    },
    {
      label: "Bot protection",
      ok: config.capabilities.captcha,
      detail: "Captcha on sensitive authentication routes",
      icon: CheckCircle2,
    },
    {
      label: "API key controls",
      ok: config.capabilities.apiKeys,
      detail: `${overview.metrics.activeApiKeys} active, ${overview.metrics.expiringApiKeys} expiring`,
      icon: KeyRound,
    },
  ]

  const enabledChecks = checks.filter((item) => item.ok).length
  const score = Math.round((enabledChecks / checks.length) * 100)
  const needsProductionHardening =
    !config.capabilities.captcha || !config.capabilities.compromisedPasswordCheck

  return (
    <AdminPage className="max-w-6xl">
      <AdminPageHeader
        eyebrow="Security center"
        title="Identity posture"
        description="A deployment-level view of authentication protections, adoption, and active risk signals."
      />

      <div className="grid gap-6 lg:grid-cols-[.75fr_1.25fr]">
        <ReadinessScore
          score={score}
          denied24h={overview.metrics.denied24h}
          criticalEvents7d={overview.metrics.criticalEvents7d}
        />
        <ProtectionChecklist checks={checks} />
      </div>

      {needsProductionHardening && (
        <div className="flex gap-3 rounded-xl border bg-muted/30 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Recommended production hardening remains</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Configure Turnstile and enable compromised-password checks in the server environment,
              then restart. Secrets are intentionally not editable from this browser console.
            </p>
          </div>
        </div>
      )}
    </AdminPage>
  )
}
