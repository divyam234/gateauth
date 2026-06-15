import { useNavigate, useSearch } from "@tanstack/react-router"
import { ArrowLeft, Mail } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Spinner } from "@/components/ui/spinner"
import { sendVerificationOtp, signIn } from "@/lib/auth-client"

const OTP_SLOTS = [0, 1, 2, 3, 4, 5] as const

export function VerifyOtpPage() {
  const navigate = useNavigate()
  const { email } = useSearch({ from: "/verify-otp" })
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  async function handleVerify() {
    if (!email || otp.length !== 6 || loading) return
    setLoading(true)
    try {
      const result = await signIn.emailOtp({ email, otp })
      if (result.error) throw new Error(result.error.message || "Invalid OTP")
      toast.success("Verified successfully")
      await navigate({ to: "/dashboard" })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed")
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!email || resending) return
    setResending(true)
    try {
      const result = await sendVerificationOtp({ email, type: "sign-in" })
      if (result.error) throw new Error(result.error.message || "Failed to resend OTP")
      toast.success("OTP resent. Check your email.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend OTP")
    } finally {
      setResending(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4 sm:p-8">
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-background via-background to-muted/50 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent dark:from-primary/3" />

      <Card className="relative w-full max-w-sm shadow-xl shadow-black/5 dark:shadow-black/20">
        <CardHeader className="pb-6 text-center">
          <CardTitle className="text-2xl font-semibold tracking-tight">Check your email</CardTitle>
          <CardDescription>
            {email ? (
              <>
                We sent a one-time code to{" "}
                <span className="font-medium text-foreground">{email}</span>
              </>
            ) : (
              "Return to sign in and request a new code."
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
              <Mail className="size-6 text-primary" aria-hidden="true" />
            </div>
          </div>

          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={setOtp}
              onComplete={() => void handleVerify()}
              autoFocus={Boolean(email)}
              disabled={!email || loading}
            >
              <InputOTPGroup>
                {OTP_SLOTS.map((index) => (
                  <InputOTPSlot key={index} index={index} className="size-10 text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button
            className="h-9 w-full"
            disabled={!email || otp.length !== 6 || loading}
            onClick={() => void handleVerify()}
          >
            {loading && <Spinner data-icon="inline-start" />}
            {loading ? "Verifying…" : "Verify code"}
          </Button>

          <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <Button
              type="button"
              variant="link"
              size="xs"
              disabled={!email || resending}
              onClick={() => void handleResend()}
            >
              {resending ? "Sending…" : "Resend code"}
            </Button>
            <Button
              type="button"
              variant="link"
              size="xs"
              onClick={() => void navigate({ to: "/login" })}
            >
              <ArrowLeft className="size-3" aria-hidden="true" />
              Back to sign in
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

export default VerifyOtpPage
