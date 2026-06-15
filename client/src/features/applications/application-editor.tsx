import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ShieldCheck } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
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
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { adminKeys } from "@/features/admin/query-options"
import {
  type ApplicationInput,
  createApplication,
  type ProtectedApplication,
  updateApplication,
} from "@/lib/admin-api"

const domainPattern = /^(\*\.)?[a-z0-9.-]+(?::\d+)?$/i
const slugPattern = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/

function splitEntries(value: string) {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ]
}

const applicationFormSchema = z.object({
  name: z.string().trim().min(1, "Display name is required").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(slugPattern, "Use 3–64 lowercase letters, numbers, or hyphens"),
  description: z.string().trim().max(500, "Description must be 500 characters or fewer"),
  upstreamUrl: z
    .url("Enter a valid upstream URL")
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
      message: "Upstream URL must use HTTP or HTTPS",
    }),
  healthCheckPath: z.string().trim().min(1, "Health path is required"),
  domains: z
    .string()
    .refine(
      (value) => splitEntries(value).every((domain) => domainPattern.test(domain)),
      "Enter valid hostnames, one per line",
    ),
  publicPaths: z.string(),
  enabled: z.boolean(),
  allowedRoles: z.string(),
  allowedEmailDomains: z
    .string()
    .refine(
      (value) => splitEntries(value).every((domain) => domainPattern.test(domain)),
      "Enter valid email domains",
    ),
  allowedIpCidrs: z.string(),
  requireMfa: z.boolean(),
  sessionMaxAgeMinutes: z
    .string()
    .refine(
      (value) =>
        value === "" || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 43_200),
      "Enter a whole number between 1 and 43,200 minutes",
    ),
})

type ApplicationFormValues = z.infer<typeof applicationFormSchema>

const EMPTY_FORM: ApplicationFormValues = {
  name: "",
  slug: "",
  description: "",
  upstreamUrl: "http://",
  healthCheckPath: "/",
  domains: "",
  publicPaths: "/health\n/assets/*",
  enabled: true,
  allowedRoles: "user, admin",
  allowedEmailDomains: "",
  allowedIpCidrs: "",
  requireMfa: false,
  sessionMaxAgeMinutes: "1440",
}

function fromApplication(application: ProtectedApplication): ApplicationFormValues {
  return {
    name: application.name,
    slug: application.slug,
    description: application.description ?? "",
    upstreamUrl: application.upstreamUrl,
    healthCheckPath: application.healthCheckPath,
    domains: application.domains.join("\n"),
    publicPaths: application.publicPaths.join("\n"),
    enabled: application.enabled,
    allowedRoles: application.policy.allowedRoles.join(", "),
    allowedEmailDomains: application.policy.allowedEmailDomains.join(", "),
    allowedIpCidrs: application.policy.allowedIpCidrs.join("\n"),
    requireMfa: application.policy.requireMfa,
    sessionMaxAgeMinutes: application.policy.sessionMaxAgeSeconds
      ? String(Math.round(application.policy.sessionMaxAgeSeconds / 60))
      : "",
  }
}

function toInput(values: ApplicationFormValues): ApplicationInput {
  return {
    name: values.name.trim(),
    slug: values.slug.trim(),
    description: values.description.trim() || null,
    upstreamUrl: values.upstreamUrl.trim(),
    enabled: values.enabled,
    healthCheckPath: values.healthCheckPath.trim() || "/",
    domains: splitEntries(values.domains),
    publicPaths: splitEntries(values.publicPaths),
    policy: {
      name: "Default access policy",
      enabled: true,
      priority: 100,
      allowedRoles: splitEntries(values.allowedRoles),
      allowedEmailDomains: splitEntries(values.allowedEmailDomains),
      allowedIpCidrs: splitEntries(values.allowedIpCidrs),
      requireMfa: values.requireMfa,
      sessionMaxAgeSeconds: values.sessionMaxAgeMinutes
        ? Number(values.sessionMaxAgeMinutes) * 60
        : null,
    },
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function ApplicationEditor({
  open,
  onOpenChange,
  application,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  application: ProtectedApplication | null
}) {
  const queryClient = useQueryClient()
  const defaultValues = application ? fromApplication(application) : EMPTY_FORM
  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationFormSchema),
    defaultValues,
    mode: "onBlur",
  })

  const mutation = useMutation({
    mutationFn: (values: ApplicationFormValues) =>
      application
        ? updateApplication(application.id, toInput(values))
        : createApplication(toInput(values)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.applications() }),
        queryClient.invalidateQueries({ queryKey: adminKeys.overview() }),
      ])
      toast.success(application ? "Application updated" : "Application created")
      form.reset(defaultValues)
      onOpenChange(false)
    },
    onError: (error) => toast.error(error.message),
  })

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) form.reset(defaultValues)
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {application ? `Edit ${application.name}` : "Protect an application"}
          </DialogTitle>
          <DialogDescription>
            Define the upstream, public routes, and identity policy evaluated by forward auth.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
          <FieldGroup className="grid gap-5 py-2 sm:grid-cols-2">
            <Field data-invalid={Boolean(form.formState.errors.name)}>
              <FieldLabel htmlFor="app-name">Display name</FieldLabel>
              <Input
                id="app-name"
                placeholder="Internal dashboard"
                aria-invalid={Boolean(form.formState.errors.name)}
                {...form.register("name", {
                  onChange: (event) => {
                    if (!application && !form.formState.dirtyFields.slug) {
                      form.setValue("slug", slugify(event.target.value), { shouldValidate: true })
                    }
                  },
                })}
              />
              <FieldError
                errors={form.formState.errors.name ? [form.formState.errors.name] : undefined}
              />
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.slug)}>
              <FieldLabel htmlFor="app-slug">Stable slug</FieldLabel>
              <Input
                id="app-slug"
                placeholder="internal-dashboard"
                aria-invalid={Boolean(form.formState.errors.slug)}
                {...form.register("slug")}
              />
              <FieldError
                errors={form.formState.errors.slug ? [form.formState.errors.slug] : undefined}
              />
            </Field>
            <Field
              className="sm:col-span-2"
              data-invalid={Boolean(form.formState.errors.description)}
            >
              <FieldLabel htmlFor="app-description">Description</FieldLabel>
              <Input
                id="app-description"
                placeholder="Operations dashboard for the platform team"
                aria-invalid={Boolean(form.formState.errors.description)}
                {...form.register("description")}
              />
              <FieldError
                errors={
                  form.formState.errors.description
                    ? [form.formState.errors.description]
                    : undefined
                }
              />
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.upstreamUrl)}>
              <FieldLabel htmlFor="app-upstream">Upstream URL</FieldLabel>
              <Input
                id="app-upstream"
                placeholder="http://dashboard:8080"
                aria-invalid={Boolean(form.formState.errors.upstreamUrl)}
                {...form.register("upstreamUrl")}
              />
              <FieldError
                errors={
                  form.formState.errors.upstreamUrl
                    ? [form.formState.errors.upstreamUrl]
                    : undefined
                }
              />
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.healthCheckPath)}>
              <FieldLabel htmlFor="health-path">Health path</FieldLabel>
              <Input
                id="health-path"
                placeholder="/health"
                aria-invalid={Boolean(form.formState.errors.healthCheckPath)}
                {...form.register("healthCheckPath")}
              />
              <FieldError
                errors={
                  form.formState.errors.healthCheckPath
                    ? [form.formState.errors.healthCheckPath]
                    : undefined
                }
              />
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.domains)}>
              <FieldLabel htmlFor="domains">Domains · one per line</FieldLabel>
              <Textarea
                id="domains"
                className="min-h-24"
                placeholder={"dashboard.example.com\n*.tools.example.com"}
                aria-invalid={Boolean(form.formState.errors.domains)}
                {...form.register("domains")}
              />
              <FieldError
                errors={form.formState.errors.domains ? [form.formState.errors.domains] : undefined}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="public-paths">Public paths · one per line</FieldLabel>
              <Textarea
                id="public-paths"
                className="min-h-24"
                placeholder={"/health\n/assets/*"}
                {...form.register("publicPaths")}
              />
            </Field>
            <div className="rounded-xl border bg-muted/20 p-4 sm:col-span-2">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="size-4" aria-hidden="true" />
                <h3 className="text-sm font-medium">Access policy</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="roles">Allowed roles</FieldLabel>
                  <Input id="roles" placeholder="user, admin" {...form.register("allowedRoles")} />
                  <FieldDescription>
                    Leave empty to allow every authenticated role.
                  </FieldDescription>
                </Field>
                <Field data-invalid={Boolean(form.formState.errors.allowedEmailDomains)}>
                  <FieldLabel htmlFor="email-domains">Email domains</FieldLabel>
                  <Input
                    id="email-domains"
                    placeholder="example.com, contractor.org"
                    aria-invalid={Boolean(form.formState.errors.allowedEmailDomains)}
                    {...form.register("allowedEmailDomains")}
                  />
                  <FieldError
                    errors={
                      form.formState.errors.allowedEmailDomains
                        ? [form.formState.errors.allowedEmailDomains]
                        : undefined
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="cidrs">Allowed IP/CIDR ranges</FieldLabel>
                  <Input
                    id="cidrs"
                    placeholder="10.0.0.0/8, 203.0.113.10/32"
                    {...form.register("allowedIpCidrs")}
                  />
                </Field>
                <Field data-invalid={Boolean(form.formState.errors.sessionMaxAgeMinutes)}>
                  <FieldLabel htmlFor="session-age">Maximum session age · minutes</FieldLabel>
                  <Input
                    id="session-age"
                    inputMode="numeric"
                    placeholder="1440"
                    aria-invalid={Boolean(form.formState.errors.sessionMaxAgeMinutes)}
                    {...form.register("sessionMaxAgeMinutes")}
                  />
                  <FieldError
                    errors={
                      form.formState.errors.sessionMaxAgeMinutes
                        ? [form.formState.errors.sessionMaxAgeMinutes]
                        : undefined
                    }
                  />
                </Field>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Controller
                  name="requireMfa"
                  control={form.control}
                  render={({ field }) => (
                    <Field orientation="horizontal" className="rounded-lg border bg-background p-3">
                      <FieldContent>
                        <FieldLabel htmlFor="require-mfa">Require verified MFA</FieldLabel>
                        <FieldDescription>
                          Reject sessions that did not complete MFA.
                        </FieldDescription>
                      </FieldContent>
                      <Switch
                        id="require-mfa"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </Field>
                  )}
                />
                <Controller
                  name="enabled"
                  control={form.control}
                  render={({ field }) => (
                    <Field orientation="horizontal" className="rounded-lg border bg-background p-3">
                      <FieldContent>
                        <FieldLabel htmlFor="application-enabled">Application enabled</FieldLabel>
                        <FieldDescription>
                          Allow this application to receive decisions.
                        </FieldDescription>
                      </FieldContent>
                      <Switch
                        id="application-enabled"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </Field>
                  )}
                />
              </div>
            </div>
          </FieldGroup>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner data-icon="inline-start" />}
              {mutation.isPending ? "Saving…" : application ? "Save changes" : "Create application"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
