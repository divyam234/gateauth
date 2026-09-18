import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { GitBranch, Globe2, KeyRound, Link2, ShieldCheck, Unlink } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import {
  type LinkedAccountRecord,
  linkSocialAccount,
  listAccounts,
  unlinkAccount,
} from "@/lib/auth-client"
import { usePublicAuthConfig } from "@/lib/public-api"

type SocialProvider = "github" | "google"

type ProviderDefinition = {
  id: SocialProvider
  label: string
  icon: typeof GitBranch
}

const SOCIAL_PROVIDERS: ProviderDefinition[] = [
  { id: "github", label: "GitHub", icon: GitBranch },
  { id: "google", label: "Google", icon: Globe2 },
]

function providerLabel(providerId: string): string {
  if (providerId === "credential") return "Email and password"
  return SOCIAL_PROVIDERS.find((provider) => provider.id === providerId)?.label ?? providerId
}

function providerIcon(providerId: string) {
  if (providerId === "github") return GitBranch
  if (providerId === "google") return Globe2
  return KeyRound
}

export function ConnectedAccounts() {
  const { data: publicAuth } = usePublicAuthConfig()
  const queryClient = useQueryClient()
  const accountsKey = ["auth", "linked-accounts"] as const
  const accountsQuery = useQuery({
    queryKey: accountsKey,
    queryFn: async (): Promise<LinkedAccountRecord[]> => {
      const result = await listAccounts()
      if (result.error) throw new Error(result.error.message || "Failed to load connected accounts")
      return result.data ?? []
    },
  })
  const [linkingProvider, setLinkingProvider] = useState<SocialProvider | null>(null)
  const [unlinkTarget, setUnlinkTarget] = useState<LinkedAccountRecord | null>(null)

  const accounts = accountsQuery.data ?? []
  const availableProviders = SOCIAL_PROVIDERS.filter(
    (provider) => publicAuth?.capabilities[provider.id] === true,
  )
  const connectedProviderIds = new Set(accounts.map((account) => account.providerId))

  const linkMutation = useMutation({
    mutationFn: async (provider: SocialProvider) => {
      const origin = window.location.origin
      const result = await linkSocialAccount({
        provider,
        callbackURL: `${origin}/dashboard?accountLinked=${provider}`,
        errorCallbackURL: `${origin}/dashboard?accountLinkError=${provider}`,
      })
      if (result.error) throw new Error(result.error.message || `Failed to connect ${provider}`)
      return { provider, redirect: Boolean(result.data?.redirect) }
    },
    onMutate: (provider) => setLinkingProvider(provider),
    onSuccess: async ({ provider, redirect }) => {
      if (!redirect) {
        await queryClient.invalidateQueries({ queryKey: accountsKey })
        toast.success(`${providerLabel(provider)} connected`)
      }
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => setLinkingProvider(null),
  })

  const unlinkMutation = useMutation({
    mutationFn: async (account: LinkedAccountRecord) => {
      const result = await unlinkAccount({
        accountId: account.id,
      })
      if (result.error) throw new Error(result.error.message || "Failed to disconnect account")
      return account
    },
    onSuccess: async (account) => {
      await queryClient.invalidateQueries({ queryKey: accountsKey })
      toast.success(`${providerLabel(account.providerId)} disconnected`)
      setUnlinkTarget(null)
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-4" aria-hidden="true" />
            Connected accounts
          </CardTitle>
          <CardDescription>
            Use multiple sign-in methods for the same GateAuth identity. Social accounts must return
            the same verified email address.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {accountsQuery.isPending ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="size-5" />
            </div>
          ) : accountsQuery.isError ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Unlink aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>Could not load connected accounts</EmptyTitle>
                <EmptyDescription>{accountsQuery.error.message}</EmptyDescription>
              </EmptyHeader>
              <Button variant="outline" size="sm" onClick={() => void accountsQuery.refetch()}>
                Try again
              </Button>
            </Empty>
          ) : (
            <div className="flex flex-col gap-2">
              {accounts.map((account) => {
                const Icon = providerIcon(account.providerId)
                const isCredential = account.providerId === "credential"
                const isOnlyAccount = accounts.length === 1
                return (
                  <div
                    key={account.id}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{providerLabel(account.providerId)}</p>
                          <Badge variant="secondary">Connected</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Added {new Date(account.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {!isCredential && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isOnlyAccount}
                        title={
                          isOnlyAccount ? "You cannot remove your last sign-in method" : undefined
                        }
                        onClick={() => setUnlinkTarget(account)}
                      >
                        <Unlink data-icon="inline-start" aria-hidden="true" />
                        Disconnect
                      </Button>
                    )}
                  </div>
                )
              })}

              {!accounts.length && (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ShieldCheck aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>No account methods found</EmptyTitle>
                    <EmptyDescription>
                      Add a configured social provider to create another sign-in method.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          )}

          {availableProviders.some((provider) => !connectedProviderIds.has(provider.id)) && (
            <div className="flex flex-col gap-2 border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground">Add another method</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {availableProviders
                  .filter((provider) => !connectedProviderIds.has(provider.id))
                  .map(({ id, label, icon: Icon }) => (
                    <Button
                      key={id}
                      type="button"
                      variant="outline"
                      disabled={linkingProvider !== null}
                      onClick={() => linkMutation.mutate(id)}
                    >
                      {linkingProvider === id ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <Icon data-icon="inline-start" aria-hidden="true" />
                      )}
                      Connect {label}
                    </Button>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={unlinkTarget !== null}
        onOpenChange={(open) => {
          if (!open) setUnlinkTarget(null)
        }}
        title={`Disconnect ${providerLabel(unlinkTarget?.providerId ?? "account")}?`}
        description="You will no longer be able to sign in with this provider. Your GateAuth account and other sign-in methods will remain active."
        confirmLabel="Disconnect account"
        onConfirm={() => {
          if (unlinkTarget) unlinkMutation.mutate(unlinkTarget)
        }}
        pending={unlinkMutation.isPending}
        destructive
      />
    </>
  )
}
