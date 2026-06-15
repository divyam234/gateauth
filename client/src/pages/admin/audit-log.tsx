import { useSuspenseQuery } from "@tanstack/react-query"
import { getRouteApi } from "@tanstack/react-router"
import { Download, Filter, Search, ShieldAlert } from "lucide-react"
import { useEffect, useState } from "react"
import { DataPagination } from "@/components/data-pagination"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AUDIT_PAGE_SIZE, auditLogQueryOptions } from "@/features/admin/query-options"
import type { AuditEvent, AuditFilters, AuditOutcome, AuditSeverity } from "@/lib/admin-api"

const route = getRouteApi("/admin/audit-log")

function parseSeverity(value: string | null): AuditSeverity | "" {
  switch (value) {
    case "info":
    case "warning":
    case "critical":
      return value
    default:
      return ""
  }
}

function parseOutcome(value: string | null): AuditOutcome | "" {
  switch (value) {
    case "success":
    case "denied":
    case "failure":
      return value
    default:
      return ""
  }
}

function EventDetails({
  event,
  open,
  onOpenChange,
}: {
  event: AuditEvent | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!event) return null

  const details: Array<[string, string]> = [
    ["Outcome", event.outcome],
    ["Severity", event.severity],
    ["Actor", event.actorUserId || "System / anonymous"],
    ["Application", event.applicationId || "Global"],
    ["Target", [event.targetType, event.targetId].filter(Boolean).join(": ") || "—"],
    ["IP address", event.ipAddress || "—"],
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{event.action}</DialogTitle>
          <DialogDescription>
            {new Date(event.createdAt).toLocaleString()} · request{" "}
            {event.requestId || "not recorded"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label} className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 break-all font-medium">{value}</p>
            </div>
          ))}
        </div>

        {event.metadata && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Metadata
            </p>
            <pre className="max-h-56 overflow-auto rounded-xl border bg-muted/30 p-4 text-xs">
              {JSON.stringify(event.metadata, null, 2)}
            </pre>
          </div>
        )}

        {(event.before != null || event.after != null) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Before
              </p>
              <pre className="max-h-56 overflow-auto rounded-xl border bg-muted/30 p-3 text-xs">
                {JSON.stringify(event.before, null, 2)}
              </pre>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                After
              </p>
              <pre className="max-h-56 overflow-auto rounded-xl border bg-muted/30 p-3 text-xs">
                {JSON.stringify(event.after, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SeverityIndicator({ severity }: { severity: AuditSeverity }) {
  const className =
    severity === "critical"
      ? "bg-destructive"
      : severity === "warning"
        ? "bg-amber-500"
        : "bg-emerald-500"

  return (
    <span
      role="img"
      aria-label={`${severity} severity`}
      className={`size-2 rounded-full ${className}`}
    />
  )
}

export function AdminAuditLogPage() {
  const searchParams = route.useSearch()
  const navigate = route.useNavigate()
  const page = searchParams.page ?? 1
  const [searchDraft, setSearchDraft] = useState(searchParams.q ?? "")
  const [selected, setSelected] = useState<AuditEvent | null>(null)
  const filters: AuditFilters = {
    search: searchParams.q || undefined,
    severity: searchParams.severity || undefined,
    outcome: searchParams.outcome || undefined,
  }
  const { data, isFetching } = useSuspenseQuery(auditLogQueryOptions(page, filters))
  const totalPages = Math.max(1, Math.ceil(data.total / AUDIT_PAGE_SIZE))

  useEffect(() => setSearchDraft(searchParams.q ?? ""), [searchParams.q])

  function resetFilters() {
    setSearchDraft("")
    void navigate({ search: {} })
  }

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Immutable event stream
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Audit log</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Investigate authentication, proxy decisions, configuration changes, and administrator
            actions.
          </p>
        </div>
        <a
          className={buttonVariants({ variant: "outline" })}
          href="/api/admin/audit-logs/export.csv"
          download
        >
          <Download className="size-4" />
          Export CSV
        </a>
      </header>

      <Card>
        <CardContent className="grid gap-3 pt-1 sm:grid-cols-[1fr_180px_180px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search audit events"
              className="pl-9"
              placeholder="Action, target, or metadata…"
              value={searchDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void navigate({
                    search: (previous) => ({
                      ...previous,
                      q: searchDraft.trim() || undefined,
                      page: 1,
                    }),
                  })
                }
              }}
              onChange={(event) => setSearchDraft(event.target.value)}
            />
          </div>

          <Select
            value={searchParams.severity || "all"}
            onValueChange={(value) => {
              void navigate({
                search: (previous) => ({
                  ...previous,
                  severity: parseSeverity(value) || undefined,
                  page: 1,
                }),
              })
            }}
          >
            <SelectTrigger className="w-full" aria-label="Severity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={searchParams.outcome || "all"}
            onValueChange={(value) => {
              void navigate({
                search: (previous) => ({
                  ...previous,
                  outcome: parseOutcome(value) || undefined,
                  page: 1,
                }),
              })
            }}
          >
            <SelectTrigger className="w-full" aria-label="Outcome">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outcomes</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="denied">Denied</SelectItem>
              <SelectItem value="failure">Failure</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <Filter className="size-4" />
            Reset
          </Button>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Actor / target</TableHead>
              <TableHead>Application</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Result</TableHead>
              <TableHead className="w-16">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!data.logs.length ? (
              <TableRow>
                <TableCell colSpan={7} className="h-40 text-center">
                  <ShieldAlert className="mx-auto mb-3 size-6 text-muted-foreground" />
                  <p className="font-medium">No matching events</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Adjust the filters or wait for activity.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              data.logs.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{event.action}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {event.targetType || "system"}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-48">
                    <p className="truncate font-mono text-xs">
                      {event.actorUserId || "anonymous/system"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {event.targetId || "—"}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-32 truncate font-mono text-xs">
                    {event.applicationId || "Global"}
                  </TableCell>
                  <TableCell>
                    <p className="text-xs">{event.ipAddress || "—"}</p>
                    <p className="max-w-36 truncate text-[10px] text-muted-foreground">
                      {event.userAgent || "Unknown client"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <SeverityIndicator severity={event.severity} />
                      <Badge
                        variant={
                          event.outcome === "denied" || event.outcome === "failure"
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {event.outcome}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setSelected(event)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <DataPagination
        page={page}
        pageCount={totalPages}
        total={data.total}
        pageSize={AUDIT_PAGE_SIZE}
        onPageChange={(nextPage) => {
          void navigate({ search: (previous) => ({ ...previous, page: nextPage }) })
        }}
      />
      {isFetching && (
        <div
          className="flex items-center justify-center gap-2 text-xs text-muted-foreground"
          role="status"
        >
          <Spinner /> Refreshing audit events
        </div>
      )}

      <EventDetails
        event={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      />
    </div>
  )
}
