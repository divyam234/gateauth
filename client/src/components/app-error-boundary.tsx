import { AlertTriangle, RefreshCw } from "lucide-react"
import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@/components/ui/button"

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  error: Error | null
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("Unhandled application error", error, info.componentStack)
    }
  }

  private reload = () => {
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <section className="w-full max-w-lg rounded-xl bg-card p-6 ring-1 ring-foreground/10">
          <div className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-xl font-semibold">GateAuth could not render this screen</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Reload the application. If the problem persists, check the browser console and server
            logs using the request timestamp.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-4 max-h-48 overflow-auto rounded-xl bg-muted p-3 text-xs text-destructive">
              {error.message}
            </pre>
          )}
          <Button className="mt-5" onClick={this.reload}>
            <RefreshCw data-icon="inline-start" aria-hidden="true" />
            Reload application
          </Button>
        </section>
      </main>
    )
  }
}
