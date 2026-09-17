import { useNavigate } from "@tanstack/react-router"
import { KeyRound, Mail, ShieldCheck, TicketCheck } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { twoFactor } from "@/lib/auth-client"

function readChallengeMethods(): string[] {
  if (typeof sessionStorage === "undefined") return ["totp"]
  try {
    const value = JSON.parse(sessionStorage.getItem("gatehouse:two-factor-methods") || "[]")
    return Array.isArray(value) && value.length ? value : ["totp"]
  } catch {
    return ["totp"]
  }
}

export function TwoFactorPage() {
  const navigate = useNavigate()
  const [methods] = useState(readChallengeMethods)
  const initialMode = methods.includes("totp") ? "totp" : methods.includes("otp") ? "otp" : "backup"
  const [mode, setMode] = useState(initialMode)
  const [code, setCode] = useState("")
  const [trustDevice, setTrustDevice] = useState(false)
  const [busy, setBusy] = useState(false)
  const [emailCodeSent, setEmailCodeSent] = useState(false)

  async function complete() {
    if (!code.trim()) return
    setBusy(true)
    try {
      const result =
        mode === "totp"
          ? await twoFactor.verifyTotp({ code: code.trim(), trustDevice })
          : mode === "otp"
            ? await twoFactor.verifyOtp({ code: code.trim(), trustDevice })
            : await twoFactor.verifyBackupCode({ code: code.trim(), trustDevice })
      if (result.error) throw new Error(result.error.message || "Verification failed")
      sessionStorage.removeItem("gatehouse:two-factor-methods")
      toast.success("Two-factor verification complete")
      navigate({ to: "/dashboard" })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed")
    } finally {
      setBusy(false)
    }
  }

  async function sendEmailCode() {
    setBusy(true)
    try {
      const result = await twoFactor.sendOtp()
      if (result.error) throw new Error(result.error.message || "Unable to send code")
      setEmailCodeSent(true)
      toast.success("Verification code sent")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send code")
    } finally {
      setBusy(false)
    }
  }

  const otpInput = (
    <InputOTP
      maxLength={6}
      value={code}
      onChange={setCode}
      onComplete={() => void complete()}
      autoFocus
    >
      <InputOTPGroup>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <InputOTPSlot key={index} index={index} className="size-11 text-lg" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  )

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10 sm:px-6">
      <Card className="w-full max-w-md shadow-none">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <ShieldCheck className="size-5" />
          </div>
          <CardTitle className="text-2xl">Verify it’s really you</CardTitle>
          <CardDescription>
            Complete the second authentication step to create a verified session.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Tabs
            value={mode}
            onValueChange={(value) => {
              setMode(value)
              setCode("")
            }}
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="totp" disabled={!methods.includes("totp")}>
                <KeyRound data-icon="inline-start" />
                Authenticator
              </TabsTrigger>
              <TabsTrigger value="otp" disabled={!methods.includes("otp")}>
                <Mail data-icon="inline-start" />
                Email
              </TabsTrigger>
              <TabsTrigger value="backup">
                <TicketCheck data-icon="inline-start" />
                Recovery
              </TabsTrigger>
            </TabsList>
            <TabsContent value="totp" className="mt-5 flex flex-col gap-4 text-center">
              <p className="text-sm text-muted-foreground">
                Enter the six-digit code from your authenticator app.
              </p>
              <div className="flex justify-center">{otpInput}</div>
            </TabsContent>
            <TabsContent value="otp" className="mt-5 flex flex-col gap-4 text-center">
              <p className="text-sm text-muted-foreground">
                Send a short-lived code to the email address on your account.
              </p>
              {!emailCodeSent && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={sendEmailCode}
                  disabled={busy}
                >
                  Send email code
                </Button>
              )}
              {emailCodeSent && <div className="flex justify-center">{otpInput}</div>}
            </TabsContent>
            <TabsContent value="backup" className="mt-5 flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Use one unused recovery code. It will be consumed after verification.
              </p>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Recovery code"
                autoComplete="one-time-code"
                autoFocus
              />
            </TabsContent>
          </Tabs>

          <Field orientation="horizontal" className="rounded-xl border bg-muted/30 px-3 py-2.5">
            <FieldContent>
              <FieldLabel htmlFor="trust-device">Trust this device</FieldLabel>
              <FieldDescription>Skip repeated MFA prompts for up to 30 days.</FieldDescription>
            </FieldContent>
            <Switch id="trust-device" checked={trustDevice} onCheckedChange={setTrustDevice} />
          </Field>

          <Button
            className="w-full"
            onClick={complete}
            disabled={busy || !code.trim() || (mode !== "backup" && code.length !== 6)}
          >
            {busy ? "Verifying…" : "Verify and continue"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => navigate({ to: "/login" })}>
            Cancel and return to sign in
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}

export default TwoFactorPage
