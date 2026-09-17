import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import {
  Database,
  KeyRound,
  Mail,
  Save,
  Settings2,
  ShieldCheck,
  ShieldEllipsis,
} from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { AdminPage, AdminPageHeader } from "@/components/admin-page"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { adminKeys, configQueryOptions } from "@/features/admin/query-options"
import {
  type ConfigMap,
  type ConfigResponse,
  type fetchAdminConfig,
  updateAdminConfig,
} from "@/lib/admin-api"

const configFormSchema = z.object({
  brandingName: z.string().trim().min(1, "Product name is required").max(80),
  environmentLabel: z.string().trim().min(1, "Environment label is required").max(40),
  allowPublicSignup: z.boolean(),
  defaultRequireMfa: z.boolean(),
  defaultSessionMaxAgeSeconds: z
    .number()
    .int("Session age must be a whole number")
    .min(60, "Session age must be at least 60 seconds")
    .max(2_592_000, "Session age cannot exceed 30 days"),
  auditRetentionDays: z
    .number()
    .int("Retention must be a whole number")
    .min(1, "Retention must be at least one day")
    .max(3_650, "Retention cannot exceed 10 years"),
})

type ConfigFormValues = z.infer<typeof configFormSchema>

function asString(value: ConfigMap[string], fallback = "") {
  return typeof value === "string" ? value : fallback
}

function asNumber(value: ConfigMap[string], fallback: number) {
  return typeof value === "number" ? value : fallback
}

function asBoolean(value: ConfigMap[string], fallback = false) {
  return typeof value === "boolean" ? value : fallback
}

function getConfigFormValues(data: ConfigResponse): ConfigFormValues {
  return {
    brandingName: asString(data.config.brandingName, "Gatehouse"),
    environmentLabel: asString(data.config.environmentLabel, "Production"),
    allowPublicSignup: asBoolean(data.config.allowPublicSignup, true),
    defaultRequireMfa: asBoolean(data.config.defaultRequireMfa),
    defaultSessionMaxAgeSeconds: asNumber(data.config.defaultSessionMaxAgeSeconds, 86_400),
    auditRetentionDays: asNumber(data.config.auditRetentionDays, 90),
  }
}

const capabilityLabels: Record<string, string> = {
  emailPassword: "Password authentication",
  emailOtp: "Email one-time codes",
  magicLink: "Magic links",
  passkey: "Passkeys / WebAuthn",
  twoFactor: "TOTP two-factor",
  apiKeys: "API keys",
  github: "GitHub OAuth",
  google: "Google OAuth",
  captcha: "Captcha protection",
  compromisedPasswordCheck: "Compromised-password checks",
}

function CapabilityIcon({ capability }: { capability: string }) {
  if (capability.includes("api")) return <KeyRound className="size-3.5 text-muted-foreground" />
  if (capability.includes("email") || capability.includes("magic")) {
    return <Mail className="size-3.5 text-muted-foreground" />
  }
  if (capability.includes("Password")) {
    return <Database className="size-3.5 text-muted-foreground" />
  }
  return <ShieldCheck className="size-3.5 text-muted-foreground" />
}

function ConfigEditor({ data }: { data: Awaited<ReturnType<typeof fetchAdminConfig>> }) {
  const queryClient = useQueryClient()
  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configFormSchema),
    values: getConfigFormValues(data),
    mode: "onBlur",
  })

  const mutation = useMutation({
    mutationFn: updateAdminConfig,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.config() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.security() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.overview() }),
      ])
      toast.success("Control-plane settings saved")
    },
    onError: (error) => toast.error(error.message),
  })

  const onSubmit = form.handleSubmit((values) => mutation.mutate(values))

  return (
    <AdminPage className="max-w-6xl">
      <AdminPageHeader
        eyebrow="Runtime configuration"
        title="Settings"
        description="Safe, dynamic control-plane settings. Provider credentials remain server-side and are never returned to the browser."
      />

      <form className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]" onSubmit={onSubmit} noValidate>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="size-4" aria-hidden="true" />
                Console identity
              </CardTitle>
              <CardDescription>Labels shown to operators and in generated emails.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={Boolean(form.formState.errors.brandingName)}>
                  <FieldLabel htmlFor="branding">Product name</FieldLabel>
                  <Input
                    id="branding"
                    aria-invalid={Boolean(form.formState.errors.brandingName)}
                    {...form.register("brandingName")}
                  />
                  <FieldError
                    errors={
                      form.formState.errors.brandingName
                        ? [form.formState.errors.brandingName]
                        : undefined
                    }
                  />
                </Field>
                <Field data-invalid={Boolean(form.formState.errors.environmentLabel)}>
                  <FieldLabel htmlFor="environment">Environment badge</FieldLabel>
                  <Input
                    id="environment"
                    aria-invalid={Boolean(form.formState.errors.environmentLabel)}
                    {...form.register("environmentLabel")}
                  />
                  <FieldError
                    errors={
                      form.formState.errors.environmentLabel
                        ? [form.formState.errors.environmentLabel]
                        : undefined
                    }
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldEllipsis className="size-4" aria-hidden="true" />
                Security defaults
              </CardTitle>
              <CardDescription>
                Defaults for onboarding and newly created application policies.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Controller
                  name="allowPublicSignup"
                  control={form.control}
                  render={({ field }) => (
                    <Field orientation="horizontal" className="rounded-xl border p-4">
                      <FieldContent>
                        <FieldLabel htmlFor="allow-public-signup">Public registration</FieldLabel>
                        <FieldDescription>
                          Allow new users to create an account. Disable this for invitation-only
                          deployments.
                        </FieldDescription>
                      </FieldContent>
                      <Switch
                        id="allow-public-signup"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </Field>
                  )}
                />
                <Controller
                  name="defaultRequireMfa"
                  control={form.control}
                  render={({ field }) => (
                    <Field orientation="horizontal" className="rounded-xl border p-4">
                      <FieldContent>
                        <FieldLabel htmlFor="default-require-mfa">
                          Require MFA by default
                        </FieldLabel>
                        <FieldDescription>
                          New application policies begin with MFA verification required.
                        </FieldDescription>
                      </FieldContent>
                      <Switch
                        id="default-require-mfa"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </Field>
                  )}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field data-invalid={Boolean(form.formState.errors.defaultSessionMaxAgeSeconds)}>
                    <FieldLabel htmlFor="session-age">
                      Default maximum session age · seconds
                    </FieldLabel>
                    <Input
                      id="session-age"
                      type="number"
                      min={60}
                      step={1}
                      aria-invalid={Boolean(form.formState.errors.defaultSessionMaxAgeSeconds)}
                      {...form.register("defaultSessionMaxAgeSeconds", { valueAsNumber: true })}
                    />
                    <FieldError
                      errors={
                        form.formState.errors.defaultSessionMaxAgeSeconds
                          ? [form.formState.errors.defaultSessionMaxAgeSeconds]
                          : undefined
                      }
                    />
                  </Field>
                  <Field data-invalid={Boolean(form.formState.errors.auditRetentionDays)}>
                    <FieldLabel htmlFor="retention">Audit retention · days</FieldLabel>
                    <Input
                      id="retention"
                      type="number"
                      min={1}
                      step={1}
                      aria-invalid={Boolean(form.formState.errors.auditRetentionDays)}
                      {...form.register("auditRetentionDays", { valueAsNumber: true })}
                    />
                    <FieldError
                      errors={
                        form.formState.errors.auditRetentionDays
                          ? [form.formState.errors.auditRetentionDays]
                          : undefined
                      }
                    />
                  </Field>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button type="submit" disabled={mutation.isPending || !form.formState.isDirty}>
              <Save data-icon="inline-start" aria-hidden="true" />
              {mutation.isPending ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Runtime capabilities
            </CardTitle>
            <CardDescription>
              Enabled by startup configuration and installed Better Auth plugins.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {Object.entries(data.capabilities).map(([key, enabled]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border px-3 py-2.5"
              >
                <span className="flex items-center gap-2 text-sm">
                  <CapabilityIcon capability={key} />
                  {capabilityLabels[key] || key}
                </span>
                <Badge variant={enabled ? "secondary" : "outline"}>
                  {enabled ? "Enabled" : "Not configured"}
                </Badge>
              </div>
            ))}
            <p className="pt-3 text-xs leading-5 text-muted-foreground">
              OAuth, captcha, email delivery, trusted origins, and proxy-header secrets are
              deployment settings. Change them through environment variables or your secret manager,
              then restart the service.
            </p>
          </CardContent>
        </Card>
      </form>
    </AdminPage>
  )
}

export function AdminConfigPage() {
  const { data } = useSuspenseQuery(configQueryOptions())
  return <ConfigEditor data={data} />
}
