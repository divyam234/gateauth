import { useNavigate } from "@tanstack/react-router"
import {
  Eye,
  EyeOff,
  Fingerprint,
  GitBranch,
  Globe2,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { authClient, sendVerificationOtp, signIn, signUp } from "@/lib/auth-client"
import { usePublicAuthConfig } from "@/lib/public-api"

type AuthMode = "signin" | "signup" | "magic-link" | "otp"
type PendingAction = "credentials" | "github" | "google" | "passkey" | null

type LoginForm = {
  email: string
  password: string
  name: string
  confirmPassword: string
}

const SOCIAL_PROVIDERS = [
  { id: "github", label: "GitHub", icon: GitBranch },
  { id: "google", label: "Google", icon: Globe2 },
] as const

function submitLabel(mode: AuthMode) {
  if (mode === "signin") return "Sign in"
  if (mode === "signup") return "Create account"
  if (mode === "magic-link") return "Send magic link"
  return "Send OTP"
}

export function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>("signin")
  const [showPassword, setShowPassword] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const {
    data: publicAuth,
    isError: publicAuthError,
    isPending: publicAuthPending,
  } = usePublicAuthConfig()
  const {
    register,
    handleSubmit,
    getValues,
    clearErrors,
    setError,
    formState: { errors },
  } = useForm<LoginForm>({
    defaultValues: { email: "", password: "", name: "", confirmPassword: "" },
  })

  const isCredentials = mode === "signin" || mode === "signup"
  const isSignIn = mode === "signin"
  const allowPublicSignup = publicAuth?.config.allowPublicSignup === true
  const socialProviders = SOCIAL_PROVIDERS.filter(
    (provider) => publicAuth?.capabilities[provider.id] === true,
  )

  useEffect(() => {
    if (!allowPublicSignup && mode === "signup") setMode("signin")
  }, [allowPublicSignup, mode])

  function changeMode(nextMode: AuthMode) {
    clearErrors()
    setMode(nextMode)
  }

  const onSubmit = handleSubmit(async (values) => {
    if (mode === "signup" && values.password !== values.confirmPassword) {
      setError("confirmPassword", { message: "Passwords do not match" })
      return
    }

    setPendingAction("credentials")
    try {
      if (mode === "signin") {
        const result = await signIn.email({ email: values.email, password: values.password })
        if (result.error) throw new Error(result.error.message || "Invalid credentials")
        toast.success("Signed in successfully")
        await navigate({ to: "/dashboard" })
        return
      }

      if (mode === "signup") {
        if (!allowPublicSignup) throw new Error("Public account creation is disabled")
        const result = await signUp.email({
          email: values.email,
          password: values.password,
          name: values.name.trim() || values.email,
        })
        if (result.error) throw new Error(result.error.message || "Failed to sign up")
        toast.success("Account created successfully")
        await navigate({ to: "/dashboard" })
        return
      }

      if (mode === "magic-link") {
        const result = await authClient.signIn.magicLink({ email: values.email })
        if (result.error) throw new Error(result.error.message || "Failed to send magic link")
        toast.success("Magic link sent. Check your email.")
        return
      }

      const result = await sendVerificationOtp({ email: values.email, type: "sign-in" })
      if (result.error) throw new Error(result.error.message || "Failed to send OTP")
      toast.success("OTP sent to your email")
      await navigate({ to: "/verify-otp", search: { email: values.email } })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed")
    } finally {
      setPendingAction(null)
    }
  })

  async function handleSocial(provider: "github" | "google") {
    setPendingAction(provider)
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: `${window.location.origin}/dashboard`,
      })
      if (result.error) throw new Error(result.error.message || "Social login failed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Social login failed")
    } finally {
      setPendingAction(null)
    }
  }

  async function handlePasskey() {
    setPendingAction("passkey")
    try {
      const result = await authClient.signIn.passkey()
      if (result.error) throw new Error(result.error.message || "Passkey authentication failed")
      toast.success("Signed in with passkey")
      await navigate({ to: "/dashboard" })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Passkey authentication failed")
    } finally {
      setPendingAction(null)
    }
  }

  const heading = isSignIn
    ? "Welcome back"
    : mode === "signup"
      ? "Create an account"
      : "Get started"
  const description = isSignIn
    ? "Sign in to your account to continue"
    : mode === "signup"
      ? "Enter your details to create your account"
      : "Choose your preferred sign-in method"

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10 sm:px-6">
      <Card className="w-full max-w-md shadow-none">
        <CardHeader className="pb-6 text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">Gatehouse · Secure access</p>
          <CardTitle className="text-2xl font-semibold tracking-tight">{heading}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {publicAuthPending ? (
            <div
              className="flex h-9 items-center justify-center rounded-md border bg-muted/30"
              role="status"
            >
              <Spinner className="size-4" />
              <span className="sr-only">Loading authentication options</span>
            </div>
          ) : publicAuthError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-center text-xs text-destructive">
              Authentication options could not be loaded. Existing email sign-in remains available.
            </div>
          ) : allowPublicSignup ? (
            <Tabs
              value={mode === "signup" ? "signup" : "signin"}
              onValueChange={(value) => {
                if (value === "signin" || value === "signup") changeMode(value)
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
            </Tabs>
          ) : (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
              New accounts are invitation-only. Sign in with an existing account.
            </div>
          )}

          {socialProviders.length > 0 && (
            <div className={socialProviders.length === 1 ? "grid" : "grid grid-cols-2 gap-2.5"}>
              {socialProviders.map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={pendingAction !== null}
                  onClick={() => void handleSocial(id)}
                >
                  {pendingAction === id ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Icon data-icon="inline-start" aria-hidden="true" />
                  )}
                  <span className="truncate">{label}</span>
                </Button>
              ))}
            </div>
          )}

          {publicAuth?.capabilities.passkey === true && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              disabled={pendingAction !== null}
              onClick={() => void handlePasskey()}
            >
              {pendingAction === "passkey" ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Fingerprint data-icon="inline-start" aria-hidden="true" />
              )}
              Sign in with Passkey
            </Button>
          )}

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              Or continue with email
            </span>
          </div>

          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
              <Field data-invalid={Boolean(errors.email)}>
                <FieldLabel htmlFor="email">Email address</FieldLabel>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="m@example.com"
                    className="pl-9"
                    aria-invalid={Boolean(errors.email)}
                    {...register("email", {
                      required: "Email is required",
                      pattern: { value: /^\S+@\S+\.\S+$/, message: "Enter a valid email address" },
                    })}
                  />
                </div>
                <FieldError errors={errors.email ? [errors.email] : undefined} />
              </Field>

              {isCredentials && (
                <>
                  {mode === "signup" && (
                    <Field data-invalid={Boolean(errors.name)}>
                      <FieldLabel htmlFor="name">Full name</FieldLabel>
                      <Input
                        id="name"
                        autoComplete="name"
                        placeholder="John Doe"
                        className="text-sm"
                        aria-invalid={Boolean(errors.name)}
                        {...register("name", { required: "Name is required" })}
                      />
                      <FieldError errors={errors.name ? [errors.name] : undefined} />
                    </Field>
                  )}

                  <Field data-invalid={Boolean(errors.password)}>
                    <div className="flex items-center justify-between">
                      <FieldLabel htmlFor="password">Password</FieldLabel>
                      {isSignIn && publicAuth?.capabilities.magicLink === true && (
                        <Button
                          type="button"
                          variant="link"
                          size="xs"
                          className="h-auto px-0 text-xs text-muted-foreground"
                          onClick={() => changeMode("magic-link")}
                        >
                          Forgot?
                        </Button>
                      )}
                    </div>
                    <div className="relative">
                      <LockKeyhole
                        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={mode === "signup" ? "new-password" : "current-password"}
                        placeholder="••••••••"
                        className="pl-9 pr-9"
                        aria-invalid={Boolean(errors.password)}
                        {...register("password", {
                          required: "Password is required",
                          minLength: {
                            value: 12,
                            message: "Password must contain at least 12 characters",
                          },
                        })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setShowPassword((visible) => !visible)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                      </Button>
                    </div>
                    <FieldError errors={errors.password ? [errors.password] : undefined} />
                  </Field>

                  {mode === "signup" && (
                    <Field data-invalid={Boolean(errors.confirmPassword)}>
                      <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
                      <div className="relative">
                        <LockKeyhole
                          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <Input
                          id="confirmPassword"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="••••••••"
                          className="pl-9 pr-9"
                          aria-invalid={Boolean(errors.confirmPassword)}
                          {...register("confirmPassword", {
                            required: "Confirm your password",
                            validate: (value) =>
                              value === getValues("password") || "Passwords do not match",
                          })}
                        />
                      </div>
                      <FieldError
                        errors={errors.confirmPassword ? [errors.confirmPassword] : undefined}
                      />
                    </Field>
                  )}
                </>
              )}

              <Button type="submit" className="w-full" disabled={pendingAction !== null}>
                {pendingAction === "credentials" && <Spinner data-icon="inline-start" />}
                {pendingAction === "credentials" ? "Working…" : submitLabel(mode)}
              </Button>
            </FieldGroup>
          </form>

          <div className="flex flex-wrap items-center justify-center gap-1 text-xs text-muted-foreground">
            {isCredentials ? (
              <>
                {publicAuth?.capabilities.emailOtp === true && (
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    className="h-auto px-1 text-xs text-muted-foreground"
                    onClick={() => changeMode("otp")}
                  >
                    Sign in with OTP
                  </Button>
                )}
                {isSignIn && publicAuth?.capabilities.magicLink === true && (
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    className="h-auto px-1 text-xs text-muted-foreground"
                    onClick={() => changeMode("magic-link")}
                  >
                    Send magic link
                  </Button>
                )}
              </>
            ) : (
              <Button
                type="button"
                variant="link"
                size="xs"
                className="h-auto px-1 text-xs text-muted-foreground"
                onClick={() => changeMode("signin")}
              >
                Sign in with password
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

export default LoginPage
