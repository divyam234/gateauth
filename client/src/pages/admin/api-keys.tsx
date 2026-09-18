import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { AdminDataPanel, AdminPage, AdminPageHeader } from "@/components/admin-page"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
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
import { adminKeys, apiKeysQueryOptions } from "@/features/admin/query-options"
import { type ApiKeyRecord, createApiKey, deleteApiKey } from "@/lib/admin-api"

const createKeySchema = z.object({
  name: z.string().trim().min(1, "Key name is required").max(80),
  expiresInDays: z.enum(["30", "90", "180", "365"]),
})

type CreateKeyValues = z.infer<typeof createKeySchema>

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatLastUsed(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString() : "Never"
}

function getKeyStatus(key: ApiKeyRecord) {
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) return "expired"
  if (!key.enabled) return "disabled"
  return "active"
}

export function AdminApiKeysPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [createdKeyValue, setCreatedKeyValue] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyRecord | null>(null)
  const { data: keys } = useSuspenseQuery(apiKeysQueryOptions())
  const form = useForm<CreateKeyValues>({
    resolver: zodResolver(createKeySchema),
    defaultValues: { name: "", expiresInDays: "90" },
  })

  const createMutation = useMutation({
    mutationFn: (values: CreateKeyValues) =>
      createApiKey({
        name: values.name.trim(),
        expiresIn: Number(values.expiresInDays) * 24 * 60 * 60,
      }),
    onSuccess: async (keyValue) => {
      setCreatedKeyValue(keyValue)
      setCreateOpen(false)
      form.reset()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.apiKeys() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.overview() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.security() }),
      ])
    },
    onError: (error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (key: ApiKeyRecord) => deleteApiKey(key.id),
    onSuccess: async (_data, key) => {
      toast.success(`API key “${key.name}” revoked`)
      setDeleteTarget(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.apiKeys() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.overview() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.security() }),
      ])
    },
    onError: (error) => toast.error(error.message),
  })

  async function copyKey(key: string) {
    try {
      await navigator.clipboard.writeText(key)
      toast.success("Copied to clipboard")
    } catch {
      toast.error("Clipboard access was denied")
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Programmatic access"
        title="API keys"
        description="Issue expiring credentials, inspect usage, and revoke compromised keys immediately."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus data-icon="inline-start" aria-hidden="true" /> Create key
          </Button>
        }
      />

      {keys.length === 0 ? (
        <Empty className="min-h-64 border ring-1 ring-foreground/10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyRound aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No API keys yet</EmptyTitle>
            <EmptyDescription>Create a time-limited key for programmatic access.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus data-icon="inline-start" aria-hidden="true" /> Create your first key
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <AdminDataPanel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Requests</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-14" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => {
                const status = getKeyStatus(key)
                return (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {key.prefix || key.key?.slice(0, 12) || "key"}••••••
                      </code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(key.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {key.expiresAt ? formatDate(key.expiresAt) : "Never"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatLastUsed(key.lastRequest)}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm text-muted-foreground">
                      {(key.requestCount ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status === "expired" ? "destructive" : "secondary"}>
                        {status === "active"
                          ? "Active"
                          : status === "expired"
                            ? "Expired"
                            : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Revoke API key ${key.name}`}
                        onClick={() => setDeleteTarget(key)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </AdminDataPanel>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) form.reset()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              The secret is shown once. Store it in a secret manager immediately.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((values) => createMutation.mutate(values))} noValidate>
            <FieldGroup>
              <Field data-invalid={Boolean(form.formState.errors.name)}>
                <FieldLabel htmlFor="api-key-name">Key name</FieldLabel>
                <Input
                  id="api-key-name"
                  placeholder="Production automation"
                  autoFocus
                  aria-invalid={Boolean(form.formState.errors.name)}
                  {...form.register("name")}
                />
                <FieldError
                  errors={form.formState.errors.name ? [form.formState.errors.name] : undefined}
                />
              </Field>
              <Controller
                name="expiresInDays"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="api-key-expiry">Expires after</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="api-key-expiry">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                        <SelectItem value="180">180 days</SelectItem>
                        <SelectItem value="365">365 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            </FieldGroup>
            <DialogFooter className="mt-5">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Spinner data-icon="inline-start" />}
                {createMutation.isPending ? "Creating…" : "Create key"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={createdKeyValue !== null} onOpenChange={() => setCreatedKeyValue(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>API key created</DialogTitle>
            <DialogDescription>
              Copy this secret now. GateAuth will not display it again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 select-all break-all rounded-lg border bg-muted px-3 py-2 font-mono text-sm">
              {createdKeyValue}
            </code>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              aria-label="Copy API key"
              onClick={() => createdKeyValue && void copyKey(createdKeyValue)}
            >
              <Copy className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedKeyValue(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
            <AlertDialogDescription>
              This immediately invalidates <strong>{deleteTarget?.name}</strong>. Services using it
              will lose access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              {deleteMutation.isPending && <Spinner data-icon="inline-start" />}
              {deleteMutation.isPending ? "Revoking…" : "Revoke key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  )
}

export default AdminApiKeysPage
