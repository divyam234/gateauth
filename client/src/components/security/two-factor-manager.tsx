import { Check, Clipboard, KeyRound, RefreshCcw, ShieldCheck, ShieldOff } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { twoFactor } from "@/lib/auth-client"

const OTP_SLOTS = [0, 1, 2, 3, 4, 5] as const

interface TwoFactorSetup {
  totpURI: string
  backupCodes: string[]
}

interface TwoFactorManagerProps {
  enabled: boolean
  onChanged(): unknown | Promise<unknown>
}

function BackupCodes({ codes }: { codes: string[] }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"))
      toast.success("Recovery codes copied")
    } catch {
      toast.error("Unable to copy recovery codes")
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">Save these recovery codes now</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Each code works once. They will not be shown again unless you rotate them.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={copy}>
          <Clipboard data-icon="inline-start" />
          Copy
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-3">
        {codes.map((code) => (
          <code key={code} className="rounded-md border bg-background px-2 py-1.5 text-center">
            {code}
          </code>
        ))}
      </div>
    </div>
  )
}

export function TwoFactorManager({ enabled, onChanged }: TwoFactorManagerProps) {
  const [password, setPassword] = useState("")
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null)
  const [verificationCode, setVerificationCode] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  async function enable() {
    if (!password) return toast.error("Enter your current password")
    setBusy(true)
    try {
      const result = await twoFactor.enable({ password, method: "totp" })
      if (result.error) throw new Error(result.error.message || "Unable to start two-factor setup")
      if (result.data?.method !== "totp") {
        throw new Error("Authenticator setup details were not returned")
      }
      setSetup({ totpURI: result.data.totpURI, backupCodes: result.data.backupCodes })
      setVerificationCode("")
      toast.success("Scan the QR code, then verify the generated code")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start two-factor setup")
    } finally {
      setBusy(false)
    }
  }

  async function verifySetup() {
    if (verificationCode.length !== 6 || !setup) return
    setBusy(true)
    try {
      const result = await twoFactor.verifyTotp({ code: verificationCode })
      if (result.error) throw new Error(result.error.message || "Invalid authenticator code")
      setBackupCodes(setup.backupCodes)
      setSetup(null)
      setVerificationCode("")
      setPassword("")
      await onChanged()
      toast.success("Two-factor authentication enabled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid authenticator code")
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    if (!password) return toast.error("Enter your current password")
    setBusy(true)
    try {
      const result = await twoFactor.disable({ password })
      if (result.error)
        throw new Error(result.error.message || "Unable to disable two-factor authentication")
      setPassword("")
      setBackupCodes([])
      await onChanged()
      toast.success("Two-factor authentication disabled")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to disable two-factor authentication",
      )
    } finally {
      setBusy(false)
    }
  }

  async function rotateCodes() {
    if (!password) return toast.error("Enter your current password")
    setBusy(true)
    try {
      const result = await twoFactor.generateBackupCodes({ password })
      if (result.error) throw new Error(result.error.message || "Unable to rotate recovery codes")
      setBackupCodes(result.data?.backupCodes ?? [])
      setPassword("")
      toast.success("Recovery codes rotated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to rotate recovery codes")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4" />
              Two-factor authentication
            </CardTitle>
            <CardDescription>
              Protect password sign-ins with an authenticator, email challenge, and one-time
              recovery codes.
            </CardDescription>
          </div>
          <Badge variant={enabled ? "secondary" : "outline"}>
            {enabled ? (
              <>
                <Check data-icon="inline-start" />
                Enabled
              </>
            ) : (
              "Not enabled"
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {setup ? (
          <div className="grid gap-5 lg:grid-cols-[190px_1fr]">
            <div className="flex items-center justify-center rounded-xl border bg-white p-3">
              <QRCodeSVG value={setup.totpURI} size={164} level="M" />
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <p className="font-medium">1. Scan the QR code</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use any TOTP-compatible authenticator. The secret is stored by Better Auth in
                  PostgreSQL.
                </p>
              </div>
              <div>
                <p className="font-medium">2. Verify the six-digit code</p>
                <div className="mt-3">
                  <InputOTP
                    maxLength={6}
                    value={verificationCode}
                    onChange={setVerificationCode}
                    onComplete={() => void verifySetup()}
                  >
                    <InputOTPGroup>
                      {OTP_SLOTS.map((index) => (
                        <InputOTPSlot key={index} index={index} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={verifySetup} disabled={busy || verificationCode.length !== 6}>
                  Verify and enable
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSetup(null)
                    setVerificationCode("")
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Current password"
                autoComplete="current-password"
              />
              {enabled ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={rotateCodes} disabled={busy}>
                    <RefreshCcw data-icon="inline-start" />
                    Rotate recovery codes
                  </Button>
                  <Button variant="destructive" onClick={disable} disabled={busy}>
                    <ShieldOff data-icon="inline-start" />
                    Disable
                  </Button>
                </div>
              ) : (
                <Button onClick={enable} disabled={busy}>
                  <KeyRound data-icon="inline-start" />
                  Set up 2FA
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Password confirmation is required for security-sensitive changes. Passkey-only
              accounts can be enabled server-side by allowing passwordless 2FA management.
            </p>
          </>
        )}
        {backupCodes.length > 0 && <BackupCodes codes={backupCodes} />}
      </CardContent>
    </Card>
  )
}
