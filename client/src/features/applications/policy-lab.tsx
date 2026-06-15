import { useMutation } from "@tanstack/react-query"
import { FlaskConical } from "lucide-react"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  type PolicySimulationResponse,
  type ProtectedApplication,
  simulatePolicy,
} from "@/lib/admin-api"

type PolicyLabValues = {
  applicationId: string
  email: string
  role: string
  path: string
  ipAddress: string
  mfaVerified: boolean
}

export function PolicyLab({ applications }: { applications: ProtectedApplication[] }) {
  const [result, setResult] = useState<PolicySimulationResponse | null>(null)
  const form = useForm<PolicyLabValues>({
    defaultValues: {
      applicationId: applications[0]?.id ?? "",
      email: "user@example.com",
      role: "user",
      path: "/",
      ipAddress: "127.0.0.1",
      mfaVerified: false,
    },
  })
  const selectedApplicationId = form.watch("applicationId")
  const effectiveApplicationId = applications.some(
    (application) => application.id === selectedApplicationId,
  )
    ? selectedApplicationId
    : (applications[0]?.id ?? "")

  const mutation = useMutation({
    mutationFn: (values: PolicyLabValues) =>
      simulatePolicy({
        applicationId: effectiveApplicationId,
        path: values.path.trim() || "/",
        ipAddress: values.ipAddress.trim() || null,
        user: values.email.trim()
          ? {
              email: values.email.trim(),
              role: values.role.trim() || "user",
              twoFactorEnabled: values.mfaVerified,
            }
          : null,
        mfaVerified: values.mfaVerified,
      }),
    onSuccess: setResult,
    onError: (error) => toast.error(error.message),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-4" aria-hidden="true" />
          Policy lab
        </CardTitle>
        <CardDescription>Test a hypothetical request before changing a live route.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Controller
              name="applicationId"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="policy-application">Application</FieldLabel>
                  <Select value={effectiveApplicationId} onValueChange={field.onChange}>
                    <SelectTrigger id="policy-application" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {applications.map((application) => (
                        <SelectItem key={application.id} value={application.id}>
                          {application.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
            <Field>
              <FieldLabel htmlFor="policy-email">Email</FieldLabel>
              <Input
                id="policy-email"
                type="email"
                placeholder="Blank for anonymous"
                {...form.register("email")}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="policy-role">Role</FieldLabel>
              <Input id="policy-role" {...form.register("role")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="policy-path">Request path</FieldLabel>
              <Input id="policy-path" {...form.register("path")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="policy-ip">Client IP</FieldLabel>
              <Input id="policy-ip" {...form.register("ipAddress")} />
            </Field>
            <Controller
              name="mfaVerified"
              control={form.control}
              render={({ field }) => (
                <Field orientation="horizontal" className="rounded-lg border p-3">
                  <FieldContent>
                    <FieldLabel htmlFor="policy-lab-mfa">MFA verified</FieldLabel>
                    <FieldDescription>Simulate a session that completed MFA.</FieldDescription>
                  </FieldContent>
                  <Switch
                    id="policy-lab-mfa"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </Field>
              )}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!effectiveApplicationId || mutation.isPending}>
              {mutation.isPending && <Spinner data-icon="inline-start" />}
              {mutation.isPending ? "Evaluating…" : "Evaluate request"}
            </Button>
            {result && (
              <Badge
                variant={result.decision.allowed ? "secondary" : "destructive"}
                className="h-8 px-3"
              >
                {result.decision.allowed ? "ALLOW" : "DENY"} · {result.decision.status} ·{" "}
                {result.decision.reason}
              </Badge>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
