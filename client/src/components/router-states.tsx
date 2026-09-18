import type { ErrorComponentProps } from "@tanstack/react-router"
import { Link } from "@tanstack/react-router"
import { AlertCircle, House, RefreshCcw, SearchX } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

function StateShell({ children }: { children: ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-muted/20 p-4">{children}</main>
}

export function RoutePendingState() {
  return (
    <StateShell>
      <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
        <Spinner className="size-5" />
        Loading GateAuth…
      </div>
    </StateShell>
  )
}

export function RouteErrorState({ error, reset }: ErrorComponentProps) {
  const message = error instanceof Error ? error.message : "The requested view could not be loaded."

  return (
    <StateShell>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="size-5" />
          </div>
          <CardTitle>Unable to load this view</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={reset}>
            <RefreshCcw data-icon="inline-start" /> Retry
          </Button>
          <Button variant="outline" render={<Link to="/dashboard" />}>
            <House data-icon="inline-start" /> Dashboard
          </Button>
        </CardContent>
      </Card>
    </StateShell>
  )
}

export function RouteNotFoundState() {
  return (
    <StateShell>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <SearchX className="size-5" />
          </div>
          <CardTitle>Page not found</CardTitle>
          <CardDescription>The requested GateAuth route does not exist.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link to="/dashboard" />}>
            <House data-icon="inline-start" /> Return to dashboard
          </Button>
        </CardContent>
      </Card>
    </StateShell>
  )
}
